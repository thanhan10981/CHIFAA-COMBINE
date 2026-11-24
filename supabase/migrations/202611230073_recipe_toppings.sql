begin;
set local lock_timeout='5s';

-- Toppings are independently costed recipes. The parent dish cost stays the
-- base dish cost; optional topping costs are shown and captured separately.
alter table public.recipes drop constraint if exists recipes_kind_check;
alter table public.recipes add constraint recipes_kind_check
 check(kind in ('product','sauce','rice','packaging','topping'));

insert into private.table_modules(table_name,module) values('recipe_topping_options','recipes')
 on conflict do nothing;
create table public.recipe_topping_options(
 id uuid not null default gen_random_uuid() unique,
 parent_version_id uuid not null references public.recipe_versions(id),
 topping_recipe_id uuid not null references public.recipes(id),
 sort_order integer not null default 0 check(sort_order>=0),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),created_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),
 primary key(parent_version_id,topping_recipe_id)
);
alter table public.recipe_topping_options enable row level security;
create policy recipe_topping_options_read on public.recipe_topping_options for select to authenticated using((select private.can('recipes','view')));
create trigger recipe_topping_options_audit before insert or update or delete on public.recipe_topping_options for each row execute function private.record_change('recipes');
grant select on public.recipe_topping_options to authenticated;
revoke all on public.recipe_topping_options from anon;

-- The existing save RPC remains the single atomic save. topping_version_ids is
-- part of p_recipe and is applied to the newly created immutable version.
do $patch$
declare d text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into d;
 old_fragment=$old$new_version=(result->>'version_id')::uuid;
 for item in select value||jsonb_build_object('_ordinality',ordinality) from jsonb_array_elements(p_items) with ordinality as x(value,ordinality) loop$old$;
 new_fragment=$new$new_version=(result->>'version_id')::uuid;
 if p_recipe?'topping_version_ids' then
  if jsonb_typeof(p_recipe->'topping_version_ids') is distinct from 'array' or jsonb_array_length(p_recipe->'topping_version_ids')>50 then raise exception 'INVALID_TOPPING_OPTIONS';end if;
  if jsonb_array_length(p_recipe->'topping_version_ids')>0 and p_recipe->>'kind'<>'product' then raise exception 'TOPPING_OPTIONS_REQUIRE_PRODUCT';end if;
  if exists(select 1 from jsonb_array_elements_text(p_recipe->'topping_version_ids') x(id)
   where not exists(select 1 from public.recipe_versions tv join public.recipes tr on tr.id=tv.recipe_id where tv.id=x.id::uuid and tv.status='published' and tr.kind='topping' and not tr.archived)) then raise exception 'TOPPING_RECIPE_REQUIRED';end if;
  if exists(select tv.recipe_id from jsonb_array_elements_text(p_recipe->'topping_version_ids') x(id) join public.recipe_versions tv on tv.id=x.id::uuid group by tv.recipe_id having count(*)>1) then raise exception 'DUPLICATE_TOPPING';end if;
  if p_recipe->>'kind'='topping' and jsonb_array_length(p_recipe->'topping_version_ids')>0 then raise exception 'TOPPING_CANNOT_NEST';end if;
  delete from public.recipe_topping_options where parent_version_id=new_version;
  insert into public.recipe_topping_options(parent_version_id,topping_recipe_id,sort_order)
   select new_version,tr.id,x.ordinality::integer-1 from jsonb_array_elements_text(p_recipe->'topping_version_ids') with ordinality x(id,ordinality)
   join public.recipe_versions tv on tv.id=x.id::uuid join public.recipes tr on tr.id=tv.recipe_id;
 end if;
 for item in select value||jsonb_build_object('_ordinality',ordinality) from jsonb_array_elements(p_items) with ordinality as x(value,ordinality) loop$new$;
 if strpos(d,old_fragment)=0 then raise exception 'RECIPE_TOPPING_SAVE_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;

-- Keep the options and their independent costs visible on the recipe detail.
do $patch$
declare d text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.recipe_detail(uuid,date)'::regprocedure) into d;
 old_fragment='return result;';
 new_fragment=$new$result=jsonb_set(result,'{toppings}',case when private.can('recipes','view') then
  (select coalesce(jsonb_agg(jsonb_build_object('version_id',tv.id,'recipe_id',tr.id,'code',tr.code,'name',tr.name,
   'output_quantity',tv.output_quantity::text,'output_unit',(select code from public.material_units where id=tv.output_unit_id),
   'cost',case when private.can('materials','view') then public.recipe_cost(tv.id,tv.output_quantity,p_date) end)
   order by o.sort_order,tr.name),'[]'::jsonb) from public.recipe_topping_options o join public.recipes tr on tr.id=o.topping_recipe_id
   join lateral(select topping_version.* from public.recipe_versions topping_version where topping_version.recipe_id=tr.id and topping_version.status='published' and topping_version.effective_from<=p_date order by topping_version.effective_from desc,topping_version.revision desc limit 1) tv on true where o.parent_version_id=p_version)
  else '[]'::jsonb end,true);
 return result;$new$;
 if strpos(d,old_fragment)=0 then raise exception 'RECIPE_TOPPING_DETAIL_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;

-- Include topping in the catalog filter and revision validation.
do $patch$
declare d text; old_fragment text; new_fragment text;
begin
 old_fragment=$old$'product','sauce','rice','packaging'$old$; new_fragment=old_fragment||$new$,'topping'$new$;
 select pg_get_functiondef('public.recipe_catalog(text,date,text,integer,integer)'::regprocedure) into d;
 if position(old_fragment in d)=0 then raise exception 'RECIPE_TOPPING_CATALOG_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);
 old_fragment=$old$'product','rice','sauce','packaging'$old$; new_fragment=old_fragment||$new$,'topping'$new$;
 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into d;
 if position(old_fragment in d)=0 then raise exception 'RECIPE_TOPPING_REVISION_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;

-- Public catalog data contains only names/units/options, never recipe costs.
create function public.public_order_topping_catalog(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_FILTER';end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',x.product_id,'options',x.options) order by x.product_id),'[]'::jsonb) into result
 from(select p.id product_id,coalesce(jsonb_agg(jsonb_build_object('version_id',tv.id,'code',tr.code,'name',tr.name,'unit',(select u.code from public.material_units u where u.id=tv.output_unit_id)) order by o.sort_order,tr.name),'[]'::jsonb) options
  from public.products p join lateral(select l.recipe_version_id from public.product_recipe_links l join public.recipe_versions rv on rv.id=l.recipe_version_id where l.product_id=p.id and l.effective_from<=p_date and rv.status='published' and rv.effective_from<=p_date order by l.effective_from desc limit 1) base on true
  join public.recipe_topping_options o on o.parent_version_id=base.recipe_version_id join public.recipes tr on tr.id=o.topping_recipe_id and tr.kind='topping' and not tr.archived
  join lateral(select v.* from public.recipe_versions v where v.recipe_id=tr.id and v.status='published' and v.effective_from<=p_date order by v.effective_from desc,v.revision desc limit 1) tv on true
  where p.published and not p.archived group by p.id)x;
 return result;
end $$;
revoke all on function public.public_order_topping_catalog(date) from public,authenticated;
grant execute on function public.public_order_topping_catalog(date) to anon,authenticated;

create table private.public_order_topping_requests(key uuid primary key,fingerprint text not null,result jsonb,created_at timestamptz not null default now());
alter table private.public_order_topping_requests enable row level security;
revoke all on private.public_order_topping_requests from public,anon,authenticated;
create table public.customer_order_item_toppings(
 id uuid primary key default gen_random_uuid(),order_item_id uuid not null references public.customer_order_items(id),
 topping_version_id uuid references public.recipe_versions(id),topping_code text not null,topping_name text not null,
 topping_output_unit text not null,quantity numeric(12,3) not null default 1 check(quantity>0),
 cost_vnd numeric(20,2),cost_complete boolean not null default false,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),created_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id)
);
insert into private.table_modules values('customer_order_item_toppings','orders') on conflict do nothing;
alter table public.customer_order_item_toppings enable row level security;
create policy customer_order_item_toppings_read on public.customer_order_item_toppings for select to authenticated using((select private.can('orders','view')));
create trigger customer_order_item_toppings_audit before insert or update or delete on public.customer_order_item_toppings for each row execute function private.record_change('orders');
grant select on public.customer_order_item_toppings to authenticated;
revoke all on public.customer_order_item_toppings from anon;

-- Internal cost snapshot bypasses the authenticated UI permission gate only
-- inside the order submit RPC; the cost is never returned to the public caller.
create function private.topping_cost_snapshot(p_version uuid,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 with amounts as(
  select b.material_id,b.unit_id,sum(b.quantity) quantity,
   case when count(*)=count(b.unit_cost) then sum(b.quantity*b.unit_cost)/nullif(sum(b.quantity),0) end unit_cost
  from private.bom(p_version,1,p_date) b group by b.material_id,b.unit_id
 )
 select jsonb_build_object('total_vnd',case when count(*)>0 and count(*)=count(unit_cost) then sum(round(quantity*unit_cost))::text end,
  'complete',count(*)>0 and count(*)=count(unit_cost)) into result from amounts;
 return result;
exception when raise_exception then
 if SQLERRM not in ('UNIT_NEEDS_VERIFICATION','RECIPE_NEEDS_REVIEW','CHILD_OUTPUT_UNIT_MISMATCH') then raise;end if;
 return jsonb_build_object('total_vnd',null,'complete',false);
end $$;
revoke all on function private.topping_cost_snapshot(uuid,date) from public,anon,authenticated;

-- Topping selections are independently validated against the dated published
-- recipe options. They do not alter product price or the base recipe cost.
create function public.submit_public_order_with_toppings(
 p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_link_token text,
 p_payment_method text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare clean_items jsonb; fingerprint text; request_row record; response_json jsonb; item jsonb; topping jsonb; order_uuid uuid; product_uuid uuid; order_item uuid; option_version uuid; topping_row record; topping_cost jsonb;
begin
 if p_key is null then raise exception 'INVALID_REQUEST_KEY';end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_ORDER_ITEMS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) as item_row(value) where jsonb_typeof(item_row.value) is distinct from 'object' or jsonb_typeof(coalesce(item_row.value->'toppings','[]'::jsonb)) is distinct from 'array') then raise exception 'INVALID_ORDER_ITEMS';end if;
 select coalesce(jsonb_agg(x.value-'toppings' order by x.ordinality),'[]'::jsonb) into clean_items from jsonb_array_elements(p_items) with ordinality as x(value,ordinality);
 fingerprint=encode(sha256(convert_to(jsonb_build_object('date',p_date,'shift',p_shift,'contact',p_contact,'items',p_items,'note',p_note,'link',case when p_link_token is null then null else encode(sha256(convert_to(p_link_token,'UTF8')),'hex') end,'method',p_payment_method)::text,'UTF8')),'hex');
 insert into private.public_order_topping_requests(key,fingerprint) values(p_key,fingerprint) on conflict do nothing;
 select * into strict request_row from private.public_order_topping_requests where key=p_key for update;
 if request_row.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 if request_row.result is not null then return request_row.result;end if;
 response_json=private.submit_public_order_options_core(p_date,p_shift,p_contact,clean_items,p_note,p_link_token,p_payment_method,p_key);
 order_uuid=(response_json->>'order_id')::uuid;
 for item in select value from jsonb_array_elements(p_items) loop
  product_uuid=(item->>'product_id')::uuid;
  select id into strict order_item from public.customer_order_items where order_id=order_uuid and product_id=product_uuid;
  for topping in select value from jsonb_array_elements(coalesce(item->'toppings','[]'::jsonb)) loop
   option_version=(topping->>'version_id')::uuid;
   if exists(select 1 from public.customer_order_item_toppings where order_item_id=order_item and topping_version_id=option_version) then raise exception 'DUPLICATE_TOPPING';end if;
   if not exists(select 1 from public.public_order_topping_catalog(p_date) c cross join lateral jsonb_array_elements(c->'options') as opt(value) where c->>'product_id'=product_uuid::text and opt.value->>'version_id'=option_version::text) then raise exception 'TOPPING_NOT_AVAILABLE';end if;
   select tr.code,tr.name,u.code unit_code,tv.output_quantity into strict topping_row from public.recipe_versions tv join public.recipes tr on tr.id=tv.recipe_id join public.material_units u on u.id=tv.output_unit_id where tv.id=option_version and tv.status='published' and tr.kind='topping';
   topping_cost=private.topping_cost_snapshot(option_version,p_date);
   insert into public.customer_order_item_toppings(order_item_id,topping_version_id,topping_code,topping_name,topping_output_unit,quantity,cost_vnd,cost_complete)
   values(order_item,option_version,topping_row.code,topping_row.name,topping_row.unit_code,(item->>'quantity')::numeric,
    case when coalesce((topping_cost->>'complete')::boolean,false) then (topping_cost->>'total_vnd')::numeric*(item->>'quantity')::numeric end,
    coalesce((topping_cost->>'complete')::boolean,false));
  end loop;
 end loop;
 update private.public_order_topping_requests set result=response_json where key=p_key;
 return response_json;
end $$;
revoke all on function public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid) from public,authenticated;
grant execute on function public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid) to anon,authenticated;

create function public.order_review_toppings(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_order is null or not exists(select 1 from public.customer_orders where id=p_order) then raise exception 'ORDER_NOT_FOUND';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('order_item_id',i.id,'product_name',i.product_name,'topping_code',t.topping_code,'topping_name',t.topping_name,'quantity',t.quantity::text,'unit',t.topping_output_unit,'cost_vnd',t.cost_vnd::text,'cost_complete',t.cost_complete) order by i.product_name,t.topping_name),'[]'::jsonb)
  from public.customer_order_item_toppings t join public.customer_order_items i on i.id=t.order_item_id where i.order_id=p_order);
end $$;
revoke all on function public.order_review_toppings(uuid) from public,anon;
grant execute on function public.order_review_toppings(uuid) to authenticated;

commit;
