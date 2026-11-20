begin;

-- The old product table exposed an imported source-sheet cost. Replace that
-- value with the dated cost of the currently linked published recipe.
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
    'recipe_cost_vnd',case when cost.cost->>'complete'='true' then cost.cost->>'total_vnd' end,
    'recipe_cost_complete',case when private.can('recipes','view') and private.can('materials','view') then coalesce((cost.cost->>'complete')::boolean,false) end,
    'recipe_cost_status',case
     when not private.can('recipes','view') or not private.can('materials','view') then 'forbidden'
     when nullif(value->>'recipe_version_id','') is null then 'unlinked'
     when coalesce((cost.cost->>'complete')::boolean,false) then 'ready'
     else 'incomplete'
    end
   ) order by position),'[]') into rows
  from jsonb_array_elements(result->'rows') with ordinality as source(value,position)
  left join lateral(
   select case when nullif(value->>'recipe_version_id','') is not null
     and nullif(value->>'output_quantity_per_product','') is not null
     and private.can('recipes','view') and private.can('materials','view')
    then public.recipe_cost((value->>'recipe_version_id')::uuid,(value->>'output_quantity_per_product')::numeric,p_date)
   end cost
  ) cost on true;
  result=jsonb_set(result,'{rows}',rows);
 end if;
 return result;
end $$;

revoke all on function public.commercial_catalog(text,date,text,text,integer,integer) from public,anon;
grant execute on function public.commercial_catalog(text,date,text,text,integer,integer) to authenticated;

commit;
