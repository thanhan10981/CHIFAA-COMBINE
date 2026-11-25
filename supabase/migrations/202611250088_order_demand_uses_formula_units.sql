begin;
set local lock_timeout='5s';

-- The production BOM remains in stock units for costing and inventory issues.
-- Customer-order demand is a planning view, so report each material in its
-- verified formula unit (for example: 1 bag in stock = 100 pieces in recipe).
create function private.order_demand_formula_units(p_needs jsonb,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare line jsonb;result jsonb='[]'::jsonb;resolution_usage uuid;resolution_formula uuid;resolution_verified boolean;source_unit uuid;target_unit uuid;amount numeric;
begin
 if p_needs is null or jsonb_typeof(p_needs) is distinct from 'array' then raise exception 'INVALID_NEEDS';end if;
 for line in select value from jsonb_array_elements(p_needs) loop
  if line ? 'issue' or not (line ? 'material_id') then
   result=result||jsonb_build_array(line);continue;
  end if;
  source_unit=(line->>'unit_id')::uuid;
  target_unit=source_unit;
  select r.usage_unit_id,r.formula_unit_id,r.formula_verified into resolution_usage,resolution_formula,resolution_verified
   from public.material_resolutions r
   where r.material_id=(line->>'material_id')::uuid and r.effective_from<=p_date
   order by r.effective_from desc,r.revision desc limit 1;
  if resolution_verified and resolution_formula is not null
    and source_unit=resolution_usage then
   target_unit=resolution_formula;
  end if;
  amount=private.recipe_convert_quantity_at((line->>'material_id')::uuid,source_unit,target_unit,(line->>'quantity')::numeric,p_date);
  result=result||jsonb_build_array(line||jsonb_build_object('unit_id',target_unit,'quantity',amount::text));
 end loop;
 return result;
end $$;
revoke all on function private.order_demand_formula_units(jsonb,date) from public,anon,authenticated;

create or replace function public.order_material_demand(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lines jsonb;needs jsonb;result jsonb;
begin
 if not private.can('orders','view') or not private.can('requirements','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',x.product_id,'quantity',x.quantity::text)),'[]') into lines
 from(select i.product_id,sum(i.quantity) quantity from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
  where o.delivery_date=p_date and o.status in('approved','scheduled') and o.plan_id is null group by i.product_id) x;
 needs=private.order_demand_formula_units(private.planning_needs(p_date,lines)||private.order_topping_material_needs(p_date),p_date);
 select jsonb_build_object(
  'date',p_date,
  'products',lines,
  'issues',(select coalesce(jsonb_agg(n),'[]') from jsonb_array_elements(needs) n where n ? 'issue'),
  'materials',(select coalesce(jsonb_agg(jsonb_build_object(
   'material_id',x.material_id,'code',m.code,'name',m.name,'unit_code',u.code,'quantity',x.quantity::text,
   'stock_quantity',stock.quantity::text,'minimum_quantity',minimum.quantity::text,
   'shortage_quantity',case when stock.quantity is null then null else greatest(x.quantity-stock.quantity,0)::text end,
   'status',case when stock.quantity is null then 'unknown' when stock.quantity<x.quantity then 'insufficient'
     when minimum.quantity is not null and stock.quantity-x.quantity<minimum.quantity then 'low' else 'ok' end,
   'sources',x.sources
  ) order by m.code),'[]') from(
   select (n->>'material_id')::uuid material_id,(n->>'unit_id')::uuid unit_id,
    sum((n->>'quantity')::numeric) quantity,
    jsonb_agg(jsonb_build_object('product_id',n->>'product_id','product_code',n->>'product_code','product_name',n->>'product_name','quantity',n->>'quantity')) sources
   from jsonb_array_elements(needs) n where not (n ? 'issue') group by 1,2
  ) x join public.materials m on m.id=x.material_id join public.material_units u on u.id=x.unit_id
   cross join lateral(select private.inventory_quantity(null,p_date,x.material_id,x.unit_id) quantity) stock
   cross join lateral(select case when m.minimum_quantity is null then null else
    private.recipe_convert_quantity_at(m.id,m.usage_unit_id,x.unit_id,m.minimum_quantity,p_date) end quantity) minimum
  )
 ) into result;
 return result;
end $$;

revoke all on function public.order_material_demand(date) from public,anon;
grant execute on function public.order_material_demand(date) to authenticated;
commit;
