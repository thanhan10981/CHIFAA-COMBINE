begin;
set local lock_timeout='5s';

-- Publish selected recipe dependencies from the leaves upward. Every child is
-- validated by the existing private publisher, and any failure rolls back the
-- complete parent/topping publication transaction.
create or replace function private.publish_recipe_tree(
 p_version uuid,p_path uuid[],p_publish_self boolean
) returns void language plpgsql security definer set search_path='' as $$
declare current_row public.recipe_versions; dependency record;
begin
 if p_version=any(coalesce(p_path,array[]::uuid[])) then raise exception 'RECIPE_CYCLE';end if;
 select rv.* into strict current_row from public.recipe_versions rv where rv.id=p_version;
 if current_row.status='published' then return;end if;
 if current_row.status<>'draft' then raise exception 'PUBLISH_CHILD_FIRST';end if;

 for dependency in
  select child.id,child.status,child.effective_from
  from public.recipe_items item
  join public.recipe_versions child on child.id=item.child_version_id
  where item.recipe_version_id=p_version and item.child_version_id is not null
  order by item.sort_order,item.id
 loop
  if dependency.effective_from>current_row.effective_from then raise exception 'CHILD_RECIPE_NOT_EFFECTIVE';end if;
  if dependency.status='draft' then
   perform private.publish_recipe_tree(dependency.id,coalesce(p_path,array[]::uuid[])||p_version,true);
  elsif dependency.status<>'published' then
   raise exception 'PUBLISH_CHILD_FIRST';
  end if;
 end loop;

 if p_publish_self then
  perform private.publish_recipe(p_version,current_row.version,null,null,gen_random_uuid());
 end if;
end $$;
revoke all on function private.publish_recipe_tree(uuid,uuid[],boolean) from public,authenticated;

create or replace function public.publish_recipe(
 p_version uuid,p_expected_version bigint,p_product uuid,p_output_per_product numeric,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare parent_version public.recipe_versions; parent_kind text; topping record;
 linked_product uuid; linked_output numeric;
begin
 if not private.can('recipes','approve') or (p_product is not null and not private.can('products','view')) then raise exception 'FORBIDDEN';end if;
 if p_product is not null and not exists(select 1 from public.products where id=p_product and not archived) then raise exception 'PRODUCT_NOT_FOUND';end if;
 if p_product is not null and (p_output_per_product is null or p_output_per_product<=0) then raise exception 'INVALID_PRODUCT_OUTPUT';end if;
 select rv.* into strict parent_version from public.recipe_versions rv where rv.id=p_version;
 select r.kind into strict parent_kind from public.recipes r where r.id=parent_version.recipe_id;

 if parent_kind='product' then
  for topping in
   select tv.id,tv.status,tv.effective_from,tr.archived
   from public.recipe_topping_options o
   join public.recipes tr on tr.id=o.topping_recipe_id
   join public.recipe_versions tv on tv.id=o.topping_version_id and tv.recipe_id=tr.id
   where o.parent_version_id=p_version order by o.sort_order,tr.name
  loop
   if topping.archived then raise exception 'TOPPING_RECIPE_ARCHIVED';end if;
   if topping.effective_from>parent_version.effective_from then raise exception 'TOPPING_EFFECTIVE_AFTER_PRODUCT';end if;
   if topping.status='draft' then
    perform private.publish_recipe_tree(topping.id,array[p_version]::uuid[],true);
   elsif topping.status<>'published' then
    raise exception 'TOPPING_RECIPE_NOT_PUBLISHABLE';
   end if;
  end loop;
 end if;

 -- The product recipe itself is published below so its explicit product link
 -- and the publication share one transaction. Publish its child recipes first.
 perform private.publish_recipe_tree(p_version,array[]::uuid[],false);

 linked_product=p_product;
 linked_output=p_output_per_product;
 -- Preserve a previously verified product conversion on the newly published
 -- formula when code and published product match exactly. Never invent a ratio.
 if linked_product is null and parent_kind='product' and private.can('products','view') then
  select p.id,existing.output_quantity_per_product into linked_product,linked_output
  from public.recipes r
  join public.products p on p.code=r.code and p.published and not p.archived
  join lateral(
   select l.output_quantity_per_product
   from public.product_recipe_links l
   join public.recipe_versions linked on linked.id=l.recipe_version_id
   where l.product_id=p.id and l.effective_from<=parent_version.effective_from
    and linked.status='published' and linked.effective_from<=parent_version.effective_from
   order by l.effective_from desc,linked.revision desc limit 1
  ) existing on true
  where r.id=parent_version.recipe_id and r.kind='product' and not r.archived
  order by p.id limit 1;
 end if;

 return private.publish_recipe(p_version,p_expected_version,linked_product,linked_output,p_key);
end $$;
revoke all on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) from public;
grant execute on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) to authenticated;

-- For order topping options, prefer the effective linked recipe. If the active
-- product has no recipe conversion yet, use a published product recipe with
-- the exact same code. This exposes only topping choices; it creates no BOM
-- conversion or material demand.
create or replace function public.public_order_topping_catalog(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_FILTER';end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',x.product_id,'options',x.options) order by x.product_id),'[]'::jsonb) into result
 from(
  select p.id product_id,
   coalesce(jsonb_agg(jsonb_build_object('version_id',tv.id,'code',tr.code,'name',tr.name,'unit',(select u.code from public.material_units u where u.id=tv.output_unit_id)) order by o.sort_order,tr.name),'[]'::jsonb) options
  from public.products p
  left join lateral(
   select l.recipe_version_id
   from public.product_recipe_links l
   join public.recipe_versions linked on linked.id=l.recipe_version_id
   where l.product_id=p.id and l.effective_from<=p_date and linked.status='published' and linked.effective_from<=p_date
   order by l.effective_from desc,linked.revision desc limit 1
  ) linked on true
  left join lateral(
   select rv.id recipe_version_id
   from public.recipes r
   join public.recipe_versions rv on rv.recipe_id=r.id
   where linked.recipe_version_id is null and r.code=p.code and r.kind='product' and not r.archived
    and rv.status='published' and rv.effective_from<=p_date
   order by rv.effective_from desc,rv.revision desc limit 1
  ) same_code on true
  join public.recipe_topping_options o on o.parent_version_id=coalesce(linked.recipe_version_id,same_code.recipe_version_id)
  join public.recipes tr on tr.id=o.topping_recipe_id and tr.kind='topping' and not tr.archived
  join lateral(
   select selected_topping.* from public.recipe_versions selected_topping
   where selected_topping.recipe_id=tr.id and selected_topping.status='published' and selected_topping.effective_from<=p_date
    and (selected_topping.id=o.topping_version_id or o.topping_version_id is null)
   order by (selected_topping.id=o.topping_version_id) desc,selected_topping.effective_from desc,selected_topping.revision desc limit 1
  ) tv on true
  where p.published and not p.archived group by p.id
 ) x;
 return result;
end $$;
revoke all on function public.public_order_topping_catalog(date) from public,authenticated;
grant execute on function public.public_order_topping_catalog(date) to anon,authenticated;

commit;
