begin;
set local lock_timeout='5s';

-- Remember the exact topping revision selected by the product recipe. This
-- lets product publication publish the selected draft atomically and keeps
-- the option stable when a newer topping revision is created later.
alter table public.recipe_topping_options
 add column topping_version_id uuid references public.recipe_versions(id);

-- Existing selections were made from published topping recipes. Backfill the
-- effective revision at the parent recipe's effective date where one exists.
update public.recipe_topping_options o
 set topping_version_id=(
  select tv.id from public.recipe_versions tv
  where tv.recipe_id=o.topping_recipe_id and tv.status='published'
   and tv.effective_from<=pv.effective_from
  order by tv.effective_from desc,tv.revision desc limit 1
 )
from public.recipe_versions pv
where pv.id=o.parent_version_id and o.topping_version_id is null;

-- A product recipe can now select saved draft toppings. The selected topping
-- revision must belong to a live topping recipe and be effective no later
-- than the product recipe. Store that exact version on the option row.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into definition;
 old_fragment=$old$tv.id=x.id::uuid and tv.status='published' and tr.kind='topping' and not tr.archived$old$;
 new_fragment=$new$tv.id=x.id::uuid and tv.status in('draft','published') and tv.effective_from<=(p_recipe->>'effective_from')::date and tr.kind='topping' and not tr.archived$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'AUTO_PUBLISH_TOPPING_SAVE_VALIDATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$insert into public.recipe_topping_options(parent_version_id,topping_recipe_id,sort_order)
   select new_version,tr.id,x.ordinality::integer-1 from jsonb_array_elements_text(p_recipe->'topping_version_ids') with ordinality x(id,ordinality)
   join public.recipe_versions tv on tv.id=x.id::uuid join public.recipes tr on tr.id=tv.recipe_id;$old$;
 new_fragment=$new$insert into public.recipe_topping_options(parent_version_id,topping_recipe_id,topping_version_id,sort_order)
   select new_version,tr.id,tv.id,x.ordinality::integer-1 from jsonb_array_elements_text(p_recipe->'topping_version_ids') with ordinality x(id,ordinality)
   join public.recipe_versions tv on tv.id=x.id::uuid join public.recipes tr on tr.id=tv.recipe_id;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'AUTO_PUBLISH_TOPPING_SAVE_INSERT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Product publication is the single publish action. Draft topping revisions
-- attached to this exact product revision are validated and published first
-- in the same transaction; any failure rolls back all publications and links.
create or replace function public.publish_recipe(
 p_version uuid,p_expected_version bigint,p_product uuid,p_output_per_product numeric,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare parent_version public.recipe_versions; parent_kind text; topping record;
begin
 if not private.can('recipes','approve') or (p_product is not null and not private.can('products','view')) then raise exception 'FORBIDDEN';end if;
 if p_product is not null and not exists(select 1 from public.products where id=p_product and not archived) then raise exception 'PRODUCT_NOT_FOUND';end if;
 select rv.* into strict parent_version from public.recipe_versions rv where rv.id=p_version;
 select r.kind into strict parent_kind from public.recipes r where r.id=parent_version.recipe_id;

 if parent_kind='product' then
  for topping in
   select tv.id,tv.version,tv.status,tv.effective_from,tr.archived
   from public.recipe_topping_options o
   join public.recipes tr on tr.id=o.topping_recipe_id
   join public.recipe_versions tv on tv.id=o.topping_version_id and tv.recipe_id=tr.id
   where o.parent_version_id=p_version order by o.sort_order,tr.name
  loop
   if topping.archived then raise exception 'TOPPING_RECIPE_ARCHIVED';end if;
   if topping.effective_from>parent_version.effective_from then raise exception 'TOPPING_EFFECTIVE_AFTER_PRODUCT';end if;
   if topping.status='draft' then
    perform private.publish_recipe(topping.id,topping.version,null,null,gen_random_uuid());
   elsif topping.status<>'published' then
    raise exception 'TOPPING_RECIPE_NOT_PUBLISHABLE';
   end if;
  end loop;
 end if;

 return private.publish_recipe(p_version,p_expected_version,p_product,p_output_per_product,p_key);
end $$;
revoke all on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) from public;
grant execute on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) to authenticated;

-- Recipe details show the exact selected topping revision (including drafts
-- during editing); legacy options without a version keep the old dated lookup.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.recipe_detail(uuid,date)'::regprocedure) into definition;
 old_fragment=$old$join lateral(select topping_version.* from public.recipe_versions topping_version where topping_version.recipe_id=tr.id and topping_version.status='published' and topping_version.effective_from<=p_date order by topping_version.effective_from desc,topping_version.revision desc limit 1) tv on true$old$;
 new_fragment=$new$join lateral(select selected_topping.* from public.recipe_versions selected_topping
    where selected_topping.recipe_id=tr.id and selected_topping.effective_from<=p_date
     and (selected_topping.id=o.topping_version_id or (o.topping_version_id is null and selected_topping.status='published'))
    order by (selected_topping.id=o.topping_version_id) desc,selected_topping.effective_from desc,selected_topping.revision desc limit 1) tv on true$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'AUTO_PUBLISH_TOPPING_DETAIL_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Only published topping revisions for the effective published product recipe
-- leave the public catalog; no topping costs or draft choices are exposed.
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
  join lateral(
   select l.recipe_version_id from public.product_recipe_links l join public.recipe_versions rv on rv.id=l.recipe_version_id
   where l.product_id=p.id and l.effective_from<=p_date and rv.status='published' and rv.effective_from<=p_date
   order by l.effective_from desc limit 1
  ) base on true
  join public.recipe_topping_options o on o.parent_version_id=base.recipe_version_id
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
