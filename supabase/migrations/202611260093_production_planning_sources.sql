begin;
set local lock_timeout='5s';

-- Use exactly the dated recipe resolution already used by planning_needs.
do $resolver$
declare d text;start_at integer;end_at integer;selection text;
begin
 d=replace(pg_get_functiondef('private.planning_needs(date,jsonb)'::regprocedure),chr(13)||chr(10),chr(10));
 start_at=strpos(d,'select selected.recipe_version_id');
 end_at=strpos(d,'if link.recipe_version_id is null then');
 if start_at=0 or end_at<=start_at then raise exception 'PRODUCTION_RECIPE_RESOLVER_PATCH_MISMATCH';end if;
 selection=substr(d,start_at,end_at-start_at);
 selection=replace(selection,'into link','');
 selection=replace(selection,'(item->>''product_id'')::uuid','p_product');
 execute 'create function private.production_recipe_choice(p_product uuid,p_date date) returns table(recipe_version_id uuid,output_quantity_per_product numeric,product_id uuid,code text,name text,issue text) language sql stable security definer set search_path='''' as $choice$'||selection||'$choice$';
end $resolver$;

-- Customer plans and approved orders without a plan are separate inputs.
-- An unassigned input belongs here only when this is the sole active ingredient
-- warehouse; never attribute it to several warehouses or create a plan on read.
create function private.production_demand_lines(p_warehouse uuid,p_date date)
returns table(product_id uuid,quantity numeric,unassigned_quantity numeric)
language sql stable security definer set search_path='' as $$
 with sole as(select count(*)=1 and bool_and(id=p_warehouse) yes from public.warehouses where active and kind='ingredient'),
 source as(
  select l.product_id,l.planned_quantity quantity,case when p.ingredient_warehouse_id is null then l.planned_quantity else 0 end unassigned
  from public.production_plan_lines l join public.production_plans p on p.id=l.plan_id
  where p.delivery_date=p_date and p.status in('approved','completed')
  and (p.ingredient_warehouse_id=p_warehouse or p.ingredient_warehouse_id is null and (select yes from sole))
  union all
  select i.product_id,i.quantity,i.quantity from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
  where o.delivery_date=p_date and o.status in('approved','scheduled','fulfilled') and o.plan_id is null
  and i.cancelled_at is null and (select yes from sole) and private.can('orders','view')
 ) select product_id,sum(quantity),sum(unassigned) from source group by product_id
$$;
revoke all on function private.production_recipe_choice(uuid,date),private.production_demand_lines(uuid,date) from public,anon,authenticated;

do $patch$
declare d text;r record;
begin
 for r in select * from(values
 ('public.production_material_workspace_before029(uuid,date,date,text)',
  'p.sale_unit,l.recipe_version_id,',
  'p.sale_unit,l.recipe_version_id,coalesce(l.issue,case when l.recipe_version_id is null then ''PUBLISHED_PRODUCT_RECIPE_REQUIRED'' when l.output_quantity_per_product is null then ''PRODUCT_RECIPE_RATIO_REQUIRED'' end) recipe_issue,l.output_quantity_per_product::text output_quantity_per_product,'),
 ('public.production_material_workspace_before029(uuid,date,date,text)',
  'left join lateral(select x.recipe_version_id from public.product_recipe_links x join public.recipe_versions v on v.id=x.recipe_version_id where x.product_id=p.id and x.effective_from<=p_to and v.effective_from<=p_to and v.status=''published'' order by x.effective_from desc limit 1) l on true',
  'left join lateral(select * from private.production_recipe_choice(p.id,p_to)) l on true left join private.production_demand_lines(p_warehouse,p_to) demand on demand.product_id=p.id'),
 ('public.production_material_workspace_before029(uuid,date,date,text)',
  '(select sum(pl.planned_quantity)::text from public.production_plan_lines pl join public.production_plans h on h.id=pl.plan_id where pl.product_id=p.id and h.delivery_date=p_to and h.ingredient_warehouse_id=p_warehouse and h.status in (''approved'',''completed'')) approved_quantity,',
  'demand.quantity::text approved_quantity,demand.unassigned_quantity::text unassigned_order_quantity,'),
 ('public.production_material_workspace_before029(uuid,date,date,text)',
  'from(select l.product_id,sum(l.planned_quantity) q from public.production_plan_lines l join public.production_plans h on h.id=l.plan_id where h.delivery_date=p_to and h.ingredient_warehouse_id=p_warehouse and h.status in (''approved'',''completed'') group by l.product_id) pl;',
  'from(select product_id,quantity q from private.production_demand_lines(p_warehouse,p_to)) pl;'),
 ('public.production_material_workspace_before029(uuid,date,date,text)',
  'needs=coalesce(head.needs,''[]'')||private.planning_needs(p_to,approved);',
  'needs=private.planning_needs(p_to,coalesce(head.lines,''[]''))||private.planning_needs(p_to,approved);'),
 ('public.production_material_workspace_before029(uuid,date,date,text)',
  '''plan_lines'',coalesce(head.lines,''[]''),',
  '''plan_lines'',coalesce(head.lines,''[]''),''manual_source'',case when head.id is not null then jsonb_build_object(''id'',head.id,''created_at'',head.created_at,''created_by'',head.created_by,''reason'',head.reason) end,''planning_live_recipes'',true,'),
 ('public.production_plan_requirements(uuid,date,uuid,text,jsonb)',
  'needs=case when p_mode=''append'' and jsonb_array_length(p_lines)=0 and head.id is not null then head.needs else private.planning_needs(p_date,lines) end;',
  'needs=private.planning_needs(p_date,lines);'),
 ('public.production_plan_requirements(uuid,date,uuid,text,jsonb)',
  'from(select l.product_id,sum(l.planned_quantity) q from public.production_plan_lines l join public.production_plans p on p.id=l.plan_id where p.delivery_date=p_date and p.ingredient_warehouse_id=p_warehouse and p.status in (''approved'',''completed'') group by l.product_id) a;',
  'from(select product_id,quantity q from private.production_demand_lines(p_warehouse,p_date)) a;'),
 ('public.post_production(uuid,date,jsonb,uuid)',
  'if (line->>''recipe_version_id'')::uuid is distinct from (select l.recipe_version_id from public.product_recipe_links l join public.recipe_versions v on v.id=l.recipe_version_id where l.product_id=(line->>''product_id'')::uuid and v.status=''published'' and v.effective_from<=p_date and l.effective_from<=p_date order by l.effective_from desc limit 1) then raise exception ''PUBLISHED_PRODUCT_RECIPE_REQUIRED''; end if;',
  'if (line->>''recipe_version_id'') is null or (line->>''recipe_version_id'')::uuid is distinct from (select c.recipe_version_id from private.production_recipe_choice((line->>''product_id'')::uuid,p_date) c) then raise exception ''PUBLISHED_PRODUCT_RECIPE_REQUIRED''; end if;'),
 ('public.post_production(uuid,date,jsonb,uuid)',
  'select l.output_quantity_per_product into strict output_factor from public.product_recipe_links l where l.product_id=(line->>''product_id'')::uuid and l.recipe_version_id=(line->>''recipe_version_id'')::uuid and l.effective_from<=p_date order by l.effective_from desc limit 1;',
  'select c.output_quantity_per_product into strict output_factor from private.production_recipe_choice((line->>''product_id'')::uuid,p_date) c; if output_factor is null then raise exception ''PRODUCT_RECIPE_RATIO_REQUIRED'';end if;'),
 ('private.topping_material_needs(date,uuid,boolean)',
  'and p.status in(''approved'',''completed'') and top.consumed_at is null)',
  'and p.status in(''approved'',''completed'') and top.consumed_at is null or not p_summary and o.plan_id is null and o.status in(''approved'',''scheduled'',''fulfilled'') and top.consumed_at is null and private.can(''orders'',''view'') and (select count(*)=1 and bool_and(id=p_warehouse) from public.warehouses where active and kind=''ingredient''))')
 ) changes(signature,old_fragment,new_fragment) loop
  d=replace(pg_get_functiondef(r.signature::regprocedure),chr(13)||chr(10),chr(10));
  if strpos(d,r.old_fragment)=0 then raise exception 'PRODUCTION_SOURCE_PATCH_MISMATCH: %',r.signature;end if;
  execute replace(d,r.old_fragment,r.new_fragment);
 end loop;
end $patch$;
notify pgrst,'reload schema';
commit;
