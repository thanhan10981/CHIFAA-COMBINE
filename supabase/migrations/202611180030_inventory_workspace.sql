begin;
-- A real zero count is evidence even when no adjustment movement was necessary.
create function private.inventory_quantity(p_warehouse uuid,p_date date,p_material uuid,p_unit uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce((select sum(l.quantity) from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id where v.warehouse_id=p_warehouse and v.moved_on<=p_date and l.material_id=p_material and l.unit_id=p_unit),
 (select 0::numeric where exists(select 1 from public.stock_count_lines l join public.stock_counts c on c.id=l.count_id where c.warehouse_id=p_warehouse and c.counted_on<=p_date and c.status='posted' and l.material_id=p_material)))
$$;
create or replace function public.inventory_balance(p_warehouse uuid,p_date date) returns table(material_id uuid,material_code text,material_name text,unit_id uuid,unit_code text,quantity text,minimum_quantity text) language plpgsql stable security definer set search_path='' as $$begin
 if not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or not exists(select 1 from public.warehouses where id=p_warehouse and kind='ingredient') then raise exception 'INVALID_INVENTORY_SCOPE';end if;
 return query select m.id,m.code,m.name,u.id,u.code,private.inventory_quantity(p_warehouse,p_date,m.id,u.id)::text,m.minimum_quantity::text from public.materials m left join public.material_units u on u.id=m.usage_unit_id where not m.archived order by m.code;
end $$;
create or replace function public.stock_count_snapshot(p_warehouse uuid,p_date date,p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; token text;
begin
 if not private.can('counts','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN'; end if;
 if p_date is null or p_offset is null or p_offset<0 or length(coalesce(p_search,''))>100 then raise exception 'INVALID_FILTER'; end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED'; end if;
 select coalesce((select version from public.data_versions where module='inventory'),0)::text into token;
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') into rows from (
  select m.id,m.code,m.name,u.id unit_id,u.code unit_code,
   private.inventory_quantity(p_warehouse,p_date,m.id,u.id)::text quantity
  from public.materials m join public.material_units u on u.id=m.usage_unit_id
  where not m.archived and (coalesce(p_search,'')='' or lower(m.code) like lower(p_search)||'%' or lower(m.name) like lower(p_search)||'%')
  order by m.code,m.id limit 51 offset p_offset
 ) page;
 return jsonb_build_object('inventory_version',token,'rows',rows);
end $$;

create function public.inventory_workspace(p_warehouse uuid,p_date date,p_need_date date,p_search text,p_category text,p_status text,p_offset integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare needs jsonb='[]';part jsonb;plan record;planned boolean=false;complete boolean=false;result jsonb;begin
 if not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or p_need_date is null or not isfinite(p_date) or not isfinite(p_need_date) or p_offset is null or p_offset<0 or length(coalesce(p_search,''))>100 or p_status is null or p_status not in ('all','attention','unknown','low','ok','minimum_missing','unit_missing') then raise exception 'INVALID_FILTER';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED';end if;
 if private.can('production','view') and private.can('requirements','view') then
  for plan in select r.needs from public.production_plan_revisions r where warehouse_id=p_warehouse and business_date=p_need_date and not exists(select 1 from public.production_plan_revisions n where n.replaces_id=r.id) loop needs=needs||plan.needs;planned=true;end loop;
  select jsonb_agg(jsonb_build_object('product_id',p.product_id,'quantity',p.q::text)) into part from(select l.product_id,sum(l.planned_quantity) q from public.production_plan_lines l join public.production_plans h on h.id=l.plan_id where h.ingredient_warehouse_id=p_warehouse and h.delivery_date=p_need_date and h.status in ('approved','completed') group by l.product_id) p;
  if part is not null then needs=needs||private.planning_needs(p_need_date,part);planned=true;end if;
  complete=planned and not exists(select 1 from jsonb_array_elements(needs) x where x ? 'issue');
 end if;
 with theoretical as(select (x->>'material_id')::uuid material_id,(x->>'unit_id')::uuid unit_id,sum((x->>'quantity')::numeric) q from jsonb_array_elements(needs) x where x ? 'material_id' group by 1,2),
 base as(select m.id,m.code,m.name,m.category,m.usage_unit_id unit_id,u.code unit,m.minimum_quantity minimum,private.inventory_quantity(p_warehouse,p_date,m.id,u.id) quantity,
 case when complete and u.id is not null and not exists(select 1 from theoretical t where t.material_id=m.id and t.unit_id<>u.id) then coalesce((select t.q from theoretical t where t.material_id=m.id and t.unit_id=u.id),0) end needed
 from public.materials m left join public.material_units u on u.id=m.usage_unit_id where not m.archived),
 classified as(select *,case when unit_id is null then 'unit_missing' when quantity is null then 'unknown' when minimum is null then 'minimum_missing' when quantity<minimum then 'low' else 'ok' end status,
 case when quantity is not null and minimum is not null and needed is not null then greatest(0,minimum+needed-quantity) end suggested from base),
 filtered as(select * from classified where (coalesce(p_search,'')='' or position(lower(p_search) in lower(code||' '||name))>0) and (coalesce(p_category,'')='' or category=p_category) and (p_status='all' or status=p_status or p_status='attention' and (status<>'ok' or suggested>0))),
 page as(select * from filtered order by code,id limit 50 offset p_offset)
 select jsonb_build_object('rows',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'category',category,'unit_id',unit_id,'unit',unit,'quantity',quantity::text,'minimum',minimum::text,'needed',needed::text,'suggested',suggested::text,'status',status) order by code,id),'[]') from page),
 'total',(select count(*) from filtered),'summary',(select jsonb_build_object('materials',count(*),'known',count(quantity),'unknown',count(*) filter(where quantity is null),'low',count(*) filter(where status='low')) from classified),
 'needs_complete',complete,'planned',planned,'needs_issues',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(needs) x where x ? 'issue'),
 'inventory_version',coalesce((select version::text from public.data_versions where module='inventory'),'0')) into result;
 return result;end $$;
create function public.inventory_history(p_warehouse uuid,p_date date,p_material uuid,p_offset integer) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_offset is null or p_offset<0 then raise exception 'INVALID_FILTER';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED';end if;
 return (with documents as(
 select v.id,v.moved_on,v.kind,v.status,v.note,v.source_batch_id,v.reverses_id,v.created_at,v.created_by,m.code,m.name,u.code unit,l.quantity::text,l.id line_id from public.inventory_movements v join public.inventory_movement_lines l on l.movement_id=v.id join public.materials m on m.id=l.material_id join public.material_units u on u.id=l.unit_id where v.warehouse_id=p_warehouse and v.moved_on<=p_date and (p_material is null or l.material_id=p_material)
 union all select c.id,c.counted_on,'count',c.status,'Ki?m k? kh?ng c?n ?i?u ch?nh t?n',null::uuid,null::uuid,c.created_at,c.created_by,m.code,m.name,u.code,l.counted_quantity::text,l.id from public.stock_counts c join public.stock_count_lines l on l.count_id=c.id join public.materials m on m.id=l.material_id join public.material_units u on u.id=m.usage_unit_id where c.warehouse_id=p_warehouse and c.counted_on<=p_date and c.status='posted' and c.movement_id is null and private.can('counts','view') and (p_material is null or l.material_id=p_material))
 select coalesce(jsonb_agg(to_jsonb(t)-'line_id'),'[]') from(select * from documents order by moved_on desc,created_at desc,id,line_id limit 51 offset p_offset) t);
end $$;
revoke all on function private.inventory_quantity(uuid,date,uuid,uuid) from public,anon,authenticated;
revoke all on function public.inventory_workspace(uuid,date,date,text,text,text,integer),public.inventory_history(uuid,date,uuid,integer) from public,anon;
grant execute on function public.inventory_workspace(uuid,date,date,text,text,text,integer),public.inventory_history(uuid,date,uuid,integer) to authenticated;
commit;
