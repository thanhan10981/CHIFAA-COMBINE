begin;
-- Read-only preview uses the same server-side recipe expansion as saving a plan.
create function public.production_plan_requirements(p_warehouse uuid,p_date date,p_previous uuid,p_mode text,p_lines jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare head public.production_plan_revisions;lines jsonb;approved jsonb;needs jsonb;rows jsonb;products jsonb;begin
 if not private.can('production','view') or not private.can('requirements','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_mode is null or p_mode not in ('append','replace') then raise exception 'INVALID_PLAN';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED';end if;
 select * into head from public.production_plan_revisions r where warehouse_id=p_warehouse and business_date=p_date and not exists(select 1 from public.production_plan_revisions n where n.replaces_id=r.id);
 if head.id is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 perform private.planning_needs(p_date,p_lines);
 lines=p_lines;
 if p_mode='append' then
  select coalesce(jsonb_agg(jsonb_build_object('product_id',id,'quantity',q::text)),'[]') into lines from(select x->>'product_id' id,sum((x->>'quantity')::numeric) q from jsonb_array_elements(coalesce(head.lines,'[]')||p_lines) x group by 1) a;
 end if;
 needs=case when p_mode='append' and jsonb_array_length(p_lines)=0 and head.id is not null then head.needs else private.planning_needs(p_date,lines) end;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',q::text)),'[]') into approved from(select l.product_id,sum(l.planned_quantity) q from public.production_plan_lines l join public.production_plans p on p.id=l.plan_id where p.delivery_date=p_date and p.ingredient_warehouse_id=p_warehouse and p.status in ('approved','completed') group by l.product_id) a;
 needs=needs||private.planning_needs(p_date,approved);
 select coalesce(jsonb_agg(jsonb_build_object('product_id',p.id,'code',p.code,'name',p.name,'unit',p.sale_unit,'quantity',t.q::text) order by p.name),'[]') into products from(select (x->>'product_id')::uuid id,sum((x->>'quantity')::numeric) q from jsonb_array_elements(lines||approved) x group by 1) t join public.products p on p.id=t.id where t.q>0;
 with totals as(select (x->>'material_id')::uuid material_id,(x->>'unit_id')::uuid unit_id,sum((x->>'quantity')::numeric) q from jsonb_array_elements(needs) x where x ? 'material_id' group by 1,2),
 quantities as(select t.*,m.code,m.name,u.code unit,private.inventory_quantity(p_warehouse,p_date,t.material_id,t.unit_id) stock from totals t join public.materials m on m.id=t.material_id join public.material_units u on u.id=t.unit_id)
 select coalesce(jsonb_agg(jsonb_build_object('material_id',material_id,'code',code,'name',name,'unit_id',unit_id,'unit',unit,'quantity',q::text,'stock',stock::text,'remaining',(stock-q)::text,'shortage',case when stock is not null then greatest(0,q-stock)::text end,'package',private.production_package(material_id,p_date)) order by name),'[]') into rows from quantities;
 return jsonb_build_object('date',p_date,'products',products,'materials',rows,'sources',needs,'complete',not exists(select 1 from jsonb_array_elements(needs) x where x ? 'issue'),'plan_id',head.id,'preview_only',true);
end $$;
revoke all on function public.production_plan_requirements(uuid,date,uuid,text,jsonb) from public,anon;
grant execute on function public.production_plan_requirements(uuid,date,uuid,text,jsonb) to authenticated;
commit;
