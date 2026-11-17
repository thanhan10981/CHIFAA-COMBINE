begin;
create function public.recipe_cost(p_version uuid,p_quantity numeric,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can('recipes','view') or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'INVALID_COST_REQUEST';end if;
 with amounts as(select b.material_id,b.unit_id,sum(b.quantity) quantity,case when count(*)=count(b.unit_cost) then max(b.unit_cost) end unit_cost from private.bom(p_version,p_quantity,p_date) b group by b.material_id,b.unit_id),lines as(
  select a.*,m.code,m.name,u.code unit_code,round(a.quantity*a.unit_cost) line_cost from amounts a join public.materials m on m.id=a.material_id join public.material_units u on u.id=a.unit_id
 ) select jsonb_build_object('quantity',p_quantity::text,'price_date',p_date,'total_vnd',case when count(*)=count(unit_cost) then sum(line_cost)::text end,'complete',count(*)>0 and count(*)=count(unit_cost),'lines',coalesce(jsonb_agg(jsonb_build_object('material_id',material_id,'code',code,'name',name,'unit',unit_code,'quantity',quantity::text,'unit_cost_vnd',unit_cost::text,'line_cost_vnd',line_cost::text) order by code),'[]')) into result from lines;
 return result;
end $$;
revoke all on function public.recipe_cost(uuid,numeric,date) from public;
grant execute on function public.recipe_cost(uuid,numeric,date) to authenticated;
commit;
