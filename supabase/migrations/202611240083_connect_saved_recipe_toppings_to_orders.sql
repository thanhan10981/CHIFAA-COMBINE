begin;
set local lock_timeout='5s';

do $prerequisites$
begin
 if to_regprocedure('private.publish_recipe_tree(uuid,uuid[],boolean)') is null
  or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipe_topping_options' and column_name='topping_version_id')
 then raise exception 'TOPPING_MIGRATIONS_081_082_REQUIRED';end if;
end $prerequisites$;

-- Ordering choices follow the latest saved, effective dish configuration.
-- A dish's BOM may still be a draft; its selected topping versions must be
-- published and immutable before they can be ordered. No sale conversion is
-- inferred from this association.
create function private.order_topping_configuration(p_date date)
returns table(product_id uuid,required boolean,unavailable_count bigint,options jsonb)
language sql stable security definer set search_path='' as $$
 select p.id,true,count(*)-count(tv.id),
  coalesce(jsonb_agg(jsonb_build_object('version_id',tv.id,'code',tr.code,'name',tr.name,'unit',u.code)
   order by o.sort_order,tr.name) filter(where tv.id is not null),'[]'::jsonb)
 from public.products p
 left join lateral(
  select r.id from public.product_recipe_links l
  join public.recipe_versions linked on linked.id=l.recipe_version_id
  join public.recipes r on r.id=linked.recipe_id and r.kind='product' and not r.archived
  where l.product_id=p.id and l.effective_from<=p_date and linked.effective_from<=p_date
   and linked.status='published'
  order by l.effective_from desc,linked.revision desc limit 1
 ) linked_recipe on true
 join public.recipes dish on dish.id=coalesce(linked_recipe.id,
  (select r.id from public.recipes r where r.code=p.code and r.kind='product' and not r.archived))
 join lateral(
  select rv.id from public.recipe_versions rv where rv.recipe_id=dish.id
   and rv.status in('draft','published') and rv.effective_from<=p_date
  order by rv.effective_from desc,rv.revision desc limit 1
 ) configured on true
 join public.recipe_topping_options o on o.parent_version_id=configured.id
 left join public.recipes tr on tr.id=o.topping_recipe_id and tr.kind='topping' and not tr.archived
 left join lateral(
  select selected_topping.id,selected_topping.output_unit_id
  from public.recipe_versions selected_topping
  where selected_topping.recipe_id=tr.id and selected_topping.status='published'
   and selected_topping.effective_from<=p_date
   and selected_topping.id=o.topping_version_id
  order by selected_topping.effective_from desc,selected_topping.revision desc limit 1
 ) tv on true
 left join public.material_units u on u.id=tv.output_unit_id
 where p.published and not p.archived group by p.id
$$;
revoke all on function private.order_topping_configuration(date) from public,anon,authenticated;

create or replace function public.public_order_topping_catalog(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_FILTER';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('product_id',c.product_id,
  'required',c.required,'unavailable_count',c.unavailable_count,'options',c.options) order by c.product_id),'[]'::jsonb)
  from private.order_topping_configuration(p_date) c);
end $$;
revoke all on function public.public_order_topping_catalog(date) from public,authenticated;
grant execute on function public.public_order_topping_catalog(date) to anon,authenticated;

-- New clients require this capability marker. If migration 083 is absent,
-- loading choices fails visibly instead of accepting an ambiguous empty list.
create function public.public_order_topping_catalog_v2(p_date date)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schema_version',1,'rows',public.public_order_topping_catalog(p_date))
$$;
revoke all on function public.public_order_topping_catalog_v2(date) from public,authenticated;
grant execute on function public.public_order_topping_catalog_v2(date) to anon,authenticated;

-- Saving an authorized dish configuration publishes its selected toppings
-- without attempting to publish the parent dish BOM. Failures roll back the
-- save and publication together. Existing historical drafts are not changed.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into definition;
 old_fragment='return private.finish_request(p_key,result);';
 new_fragment=$new$if p_recipe->>'kind'='product' and private.can('recipes','approve') then
  for item in select jsonb_build_object('version_id',o.topping_version_id)
   from public.recipe_topping_options o where o.parent_version_id=new_version and o.topping_version_id is not null
  loop
   perform private.publish_recipe_tree((item->>'version_id')::uuid,array[new_version]::uuid[],true);
  end loop;
 end if;
 if p_recipe->>'kind'='product' then
  result=result||jsonb_build_object('toppings_ready',not exists(
   select 1 from public.recipe_topping_options o
   left join public.recipe_versions tv on tv.id=o.topping_version_id and tv.recipe_id=o.topping_recipe_id
   left join public.recipes tr on tr.id=o.topping_recipe_id
   where o.parent_version_id=new_version and (tv.status is distinct from 'published'
    or tv.effective_from>(p_recipe->>'effective_from')::date or tr.archived or tr.kind<>'topping')));
 end if;
 return private.finish_request(p_key,result);$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'SAVED_TOPPING_PUBLICATION_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $patch$;

create or replace function public.submit_public_order_with_toppings(
 p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_link_token text,
 p_payment_method text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare clean_items jsonb;fingerprint text;request_row record;response_json jsonb;item jsonb;topping jsonb;
 order_uuid uuid;product_uuid uuid;order_item uuid;option_version uuid;topping_row record;topping_cost jsonb;
 configuration record;allocated numeric;
begin
 if p_key is null then raise exception 'INVALID_REQUEST_KEY';end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_ORDER_ITEMS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) i(value)
  where jsonb_typeof(i.value) is distinct from 'object'
   or jsonb_typeof(coalesce(i.value->'toppings','[]'::jsonb)) is distinct from 'array'
   or coalesce(i.value->>'quantity','')!~'^[1-9][0-9]{0,5}$'
   or i.value->>'product_id' is null) then raise exception 'INVALID_ORDER_ITEMS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) i(value)
  cross join lateral jsonb_array_elements(coalesce(i.value->'toppings','[]'::jsonb)) t(value)
  where jsonb_typeof(t.value) is distinct from 'object' or coalesce(t.value->>'version_id','')=''
   or coalesce(t.value->>'quantity','')!~'^[1-9][0-9]{0,5}$') then raise exception 'INVALID_TOPPING_ALLOCATION';end if;
 if exists(select 1 from jsonb_array_elements(p_items) with ordinality i(value,ordinality)
  cross join lateral jsonb_array_elements(coalesce(i.value->'toppings','[]'::jsonb)) t(value)
  group by i.ordinality,i.value->>'quantity'
  having sum((t.value->>'quantity')::numeric)>(i.value->>'quantity')::numeric) then raise exception 'TOPPING_ALLOCATION_EXCEEDS_ORDER_QUANTITY';end if;
 if exists(select 1 from jsonb_array_elements(p_items) i(value)
  cross join lateral jsonb_array_elements(coalesce(i.value->'toppings','[]'::jsonb)) t(value)
  group by i.value->>'product_id',t.value->>'version_id' having count(*)>1) then raise exception 'DUPLICATE_TOPPING';end if;
 select coalesce(jsonb_agg(x.value-'toppings' order by x.ordinality),'[]'::jsonb) into clean_items
  from jsonb_array_elements(p_items) with ordinality x(value,ordinality);
 fingerprint=encode(sha256(convert_to(jsonb_build_object('date',p_date,'shift',p_shift,'contact',p_contact,
  'items',p_items,'note',p_note,'link',case when p_link_token is null then null else encode(sha256(convert_to(p_link_token,'UTF8')),'hex') end,
  'method',p_payment_method)::text,'UTF8')),'hex');
 insert into private.public_order_topping_requests(key,fingerprint) values(p_key,fingerprint) on conflict do nothing;
 select * into strict request_row from private.public_order_topping_requests where key=p_key for update;
 if request_row.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 if request_row.result is not null then return request_row.result;end if;
 if exists(select 1 from private.public_order_requests where key=p_key and result is not null)
  or exists(select 1 from private.public_order_option_requests where key=p_key and result is not null)
 then raise exception 'IDEMPOTENCY_CONFLICT';end if;

 -- Replaying a completed request returns its original snapshot before reading
 -- current configuration. New orders require one assigned topping per dish.
 for item in select value from jsonb_array_elements(p_items) loop
  product_uuid=(item->>'product_id')::uuid;
  select * into configuration from private.order_topping_configuration(p_date) c where c.product_id=product_uuid;
  if found then
   if configuration.unavailable_count>0 then raise exception 'TOPPING_NOT_AVAILABLE';end if;
   select coalesce(sum((t.value->>'quantity')::numeric),0) into allocated
    from jsonb_array_elements(coalesce(item->'toppings','[]'::jsonb)) t(value);
   if allocated<>(item->>'quantity')::numeric then raise exception 'TOPPING_REQUIRED';end if;
  end if;
  for topping in select value from jsonb_array_elements(coalesce(item->'toppings','[]'::jsonb)) loop
   if not exists(select 1 from private.order_topping_configuration(p_date) c
    cross join lateral jsonb_array_elements(c.options) opt(value)
    where c.product_id=product_uuid and opt.value->>'version_id'=topping->>'version_id') then raise exception 'TOPPING_NOT_AVAILABLE';end if;
  end loop;
 end loop;

 response_json=private.submit_public_order_options_core(p_date,p_shift,p_contact,clean_items,p_note,p_link_token,p_payment_method,p_key);
 order_uuid=(response_json->>'order_id')::uuid;
 for item in select value from jsonb_array_elements(p_items) loop
  product_uuid=(item->>'product_id')::uuid;
  select id into strict order_item from public.customer_order_items where order_id=order_uuid and product_id=product_uuid;
  for topping in select value from jsonb_array_elements(coalesce(item->'toppings','[]'::jsonb)) loop
   option_version=(topping->>'version_id')::uuid;
   select tr.code,tr.name,u.code unit_code into strict topping_row
    from public.recipe_versions tv join public.recipes tr on tr.id=tv.recipe_id
    join public.material_units u on u.id=tv.output_unit_id
    where tv.id=option_version and tv.status='published' and tr.kind='topping';
   topping_cost=private.topping_cost_snapshot(option_version,p_date);
   insert into public.customer_order_item_toppings(order_item_id,topping_version_id,topping_code,topping_name,topping_output_unit,quantity,cost_vnd,cost_complete)
   values(order_item,option_version,topping_row.code,topping_row.name,topping_row.unit_code,(topping->>'quantity')::numeric,
    case when coalesce((topping_cost->>'complete')::boolean,false) then (topping_cost->>'total_vnd')::numeric*(topping->>'quantity')::numeric end,
    coalesce((topping_cost->>'complete')::boolean,false));
  end loop;
 end loop;
 update private.public_order_topping_requests set result=response_json where key=p_key;
 return response_json;
end $$;
revoke all on function public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid) from public,authenticated;
grant execute on function public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid) to anon,authenticated;

-- Legacy public entry points cannot skip required topping selection. Only the
-- topping RPC can reserve this inaccessible request row, and all validation
-- plus order creation still commits or rolls back in one transaction. Keep the
-- guard after the existing completed-request return for historical retries.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('private.submit_public_order_core(date,text,jsonb,jsonb,text,text,uuid)'::regprocedure) into definition;
 old_fragment='if request.result is not null then return request.result;end if;';
 new_fragment=$new$if request.result is not null then
  if exists(select 1 from private.public_order_topping_requests where key=p_key and result is null)
  then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return request.result;
 end if;
 if not exists(select 1 from private.public_order_topping_requests where key=p_key)
  and exists(select 1 from jsonb_array_elements(p_items) i(value)
   join private.order_topping_configuration(p_date) c on c.product_id=(i.value->>'product_id')::uuid)
 then raise exception 'TOPPING_REQUIRED';end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'LEGACY_REQUIRED_TOPPING_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $patch$;

-- The options core has its own successful-request cache. Guard its replay as
-- well so a concurrent legacy submission cannot become a topping amendment.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('private.submit_public_order_options_core(date,text,jsonb,jsonb,text,text,text,uuid)'::regprocedure) into definition;
 old_fragment='if request.result is not null then return request.result;end if;';
 new_fragment=$new$if request.result is not null then
  if exists(select 1 from private.public_order_topping_requests where key=p_key and result is null)
  then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return request.result;
 end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'TOPPING_OPTIONS_REPLAY_GUARD_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $patch$;

commit;
