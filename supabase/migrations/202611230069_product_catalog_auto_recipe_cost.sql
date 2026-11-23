begin;

-- Product recipes imported and maintained with the same business code are
-- already associated by identity. Prefer an explicit dated link when one
-- exists; otherwise use the latest published, effective product recipe with
-- the exact same code. This is a read-time association: it does not rewrite
-- production or historical link records.
create or replace function public.commercial_catalog(p_kind text,p_date date,p_search text,p_status text,p_offset integer,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows jsonb;
begin
 result=private.commercial_catalog(p_kind,p_date,p_search,p_status,p_offset,p_limit);
 if p_kind='employees' then
  select coalesce(jsonb_agg((value-'daily_allowance_vnd')||jsonb_build_object(
   'monthly_allowance_vnd',case when private.can('payroll','view') then(
    select a.amount_vnd::text from public.employee_monthly_allowances a
    where a.employee_id=(value->>'id')::uuid and a.month=date_trunc('month',p_date)::date
    order by a.revision desc limit 1) else null end
  ) order by position),'[]') into rows
  from jsonb_array_elements(result->'rows') with ordinality as source(value,position);
  result=jsonb_set(result,'{rows}',rows);
 elsif p_kind='products' then
  select coalesce(jsonb_agg(
   (value-'legacy_cost')||jsonb_build_object(
    'recipe_version_id',case when chosen.version_id is not null then chosen.version_id::text end,
    'output_quantity_per_product',chosen.quantity::text,
    'recipe_cost_vnd',case when cost.cost->>'complete'='true' then cost.cost->>'total_vnd' end,
    'recipe_cost_complete',case when private.can('recipes','view') and private.can('materials','view') then coalesce((cost.cost->>'complete')::boolean,false) end,
    'recipe_cost_status',case
     when not private.can('recipes','view') or not private.can('materials','view') then 'forbidden'
     when chosen.version_id is null then 'unlinked'
     when coalesce((cost.cost->>'complete')::boolean,false) then 'ready'
     else 'incomplete'
    end
   ) order by position),'[]') into rows
  from jsonb_array_elements(result->'rows') with ordinality as source(value,position)
  left join lateral(
   select link.recipe_version_id,link.output_quantity_per_product quantity
   from public.product_recipe_links link
   where link.product_id=(value->>'id')::uuid and link.effective_from<=p_date
   order by link.effective_from desc limit 1
  ) explicit_link on true
  left join lateral(
   select v.id version_id,coalesce(explicit_link.quantity,
    (select nullif(s.source_data->>'productQuantity','')::numeric from private.catalog_sources s
     where s.entity='recipe:source' and s.entity_id=v.id order by s.recorded_at desc limit 1),1::numeric) quantity
   from public.products p
   join public.recipes r on r.code=p.code and r.kind='product' and not r.archived
   join public.recipe_versions v on v.recipe_id=r.id and v.status='published' and v.effective_from<=p_date
   where explicit_link.recipe_version_id is null and p.id=(value->>'id')::uuid
   order by v.effective_from desc,v.revision desc limit 1
  ) auto_link on true
  cross join lateral(select coalesce(explicit_link.recipe_version_id,auto_link.version_id) version_id,
   coalesce(explicit_link.quantity,auto_link.quantity) quantity) chosen
  left join lateral(
   select case when chosen.version_id is not null and chosen.quantity is not null
    and private.can('recipes','view') and private.can('materials','view')
    then public.recipe_cost(chosen.version_id,chosen.quantity,p_date) end cost
  ) cost on true;
  result=jsonb_set(result,'{rows}',rows);
 end if;
 return result;
end $$;

revoke all on function public.commercial_catalog(text,date,text,text,integer,integer) from public,anon;
grant execute on function public.commercial_catalog(text,date,text,text,integer,integer) to authenticated;
commit;
