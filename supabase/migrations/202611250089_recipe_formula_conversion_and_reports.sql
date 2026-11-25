begin;
set local lock_timeout='5s';

-- Recipe ratios belong to the dated material specification. Physical units on
-- either side may be compatible (kg/g, l/ml); package ratios remain separate.
create or replace function private.recipe_convert_quantity_at(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions;factor numeric;stock_quantity numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);
 if factor is not null then return p_quantity*factor;end if;
 select * into r from public.material_resolutions where material_id=p_material and effective_from<=p_date
  order by effective_from desc,revision desc limit 1;
 if r.formula_verified and r.formula_unit_id is not null then
  factor=case when p_from=r.formula_unit_id then 1 else private.physical_factor(p_from,r.formula_unit_id) end;
  if factor is not null then
   stock_quantity=p_quantity*factor/r.formula_quantity;
   return private.convert_quantity_at(p_material,r.usage_unit_id,p_to,stock_quantity,p_date);
  end if;
  factor=case when p_to=r.formula_unit_id then 1 else private.physical_factor(r.formula_unit_id,p_to) end;
  if factor is not null then
   stock_quantity=private.convert_quantity_at(p_material,p_from,r.usage_unit_id,p_quantity,p_date);
   return stock_quantity*r.formula_quantity*factor;
  end if;
 end if;
 return private.convert_quantity_at(p_material,p_from,p_to,p_quantity,p_date);
end $$;

-- One material cannot assert two contradictory ratios for the same units.
do $patch$
declare d text;old_fragment text;
begin
 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure) into d;
 old_fragment='if formula_verified then';
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_SPEC_VALIDATION_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,$new$if formula_verified then
  if private.material_package_conversion_factor(usage,formula_unit,pack_unit,pack_content,pack_amount,pack_verified) is not null
   and abs(private.material_package_conversion_factor(usage,formula_unit,pack_unit,pack_content,pack_amount,pack_verified)-formula_amount)>greatest(0.000000001,abs(formula_amount)*0.000000001)
  then raise exception 'UNIT_RATIO_MISMATCH';end if;$new$);
end $patch$;

-- Financial basis conversions also use the verified recipe ratio. Keep the
-- stock BOM contract, cost exemptions and immutable production snapshots.
do $patch$
declare d text;old_fragment text;
begin
 select pg_get_functiondef('private.bom(uuid,numeric,date)'::regprocedure) into d;
 old_fragment='select m.usage_unit_id into unit_id from public.materials m where m.id=r.material_id;';
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_DATED_STOCK_UNIT_PATCH_MISMATCH';end if;
 d=replace(d,old_fragment,$new$select coalesce((select mr.usage_unit_id from public.material_resolutions mr
   where mr.material_id=m.id and mr.effective_from<=p_date order by mr.effective_from desc,mr.revision desc limit 1),m.usage_unit_id)
   into unit_id from public.materials m where m.id=r.material_id;$new$);
 old_fragment='private.convert_quantity_at(r.material_id,price.basis_unit_id,unit_id,1,p_date)';
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_PRICE_BASIS_PATCH_MISMATCH';end if;
 d=replace(d,old_fragment,'private.recipe_convert_quantity_at(r.material_id,price.basis_unit_id,unit_id,1,p_date)');
 old_fragment=$old$raise exception using message=format('UNIT_NEEDS_VERIFICATION|material=%s|from=%s|to=%s',
      (select m.code from public.materials m where m.id=r.material_id),
      (select u.code from public.material_units u where u.id=r.unit_id),
      (select u.code from public.material_units u where u.id=unit_id));$old$;
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_DATE_DIAGNOSTIC_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,$new$raise exception using message=format('UNIT_NEEDS_VERIFICATION|material=%s|from=%s|to=%s|date=%s|formula_from=%s',
      (select m.code from public.materials m where m.id=r.material_id),
      (select u.code from public.material_units u where u.id=r.unit_id),
      (select u.code from public.material_units u where u.id=unit_id),p_date,
      (select mr.effective_from from public.material_resolutions mr where mr.material_id=r.material_id and mr.formula_verified
       order by mr.effective_from desc,mr.revision desc limit 1));$new$);
end $patch$;

-- Detailed unit errors must stay incomplete results in cost/planning APIs;
-- they must not prevent other recipes and known material quantities loading.
do $patch$
declare signature text;d text;
begin
 foreach signature in array array['public.recipe_cost(uuid,numeric,date)','private.planning_needs(date,jsonb)','private.topping_cost_snapshot(uuid,date)'] loop
  select pg_get_functiondef(signature::regprocedure) into d;
  if strpos(d,'if SQLERRM not in (')=0 then raise exception 'FORMULA_ERROR_ISOLATION_PATCH_MISMATCH: %',signature;end if;
  d=replace(d,'if SQLERRM not in (','if split_part(SQLERRM,''|'',1) not in (');
  d=replace(d,'''issue'',SQLERRM','''issue'',split_part(SQLERRM,''|'',1),''issue_detail'',SQLERRM');
  execute d;
 end loop;
end $patch$;

create function private.recipe_formula_line(p_material uuid,p_unit uuid,p_quantity numeric,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions;target_unit uuid;amount numeric;issue text;stock_unit uuid;
begin
 select * into r from public.material_resolutions where material_id=p_material and effective_from<=p_date
  order by effective_from desc,revision desc limit 1;
 select coalesce(r.usage_unit_id,usage_unit_id) into stock_unit from public.materials where id=p_material;
 target_unit=case when r.formula_verified then r.formula_unit_id else p_unit end;
 begin
  -- Validate the quantity path independently of whether the price is known.
  perform private.recipe_convert_quantity_at(p_material,p_unit,stock_unit,p_quantity,p_date);
  amount=private.recipe_convert_quantity_at(p_material,p_unit,target_unit,p_quantity,p_date);
 exception when raise_exception then
  if split_part(SQLERRM,'|',1)<>'UNIT_NEEDS_VERIFICATION' then raise;end if;
  issue='UNIT_NEEDS_VERIFICATION';amount=null;
 end;
 return jsonb_build_object('formula_unit',(select code from public.material_units where id=target_unit),
  'formula_unit_id',target_unit,'formula_converted',amount::text,'formula_verified',coalesce(r.formula_verified,false),
  'formula_quantity',case when r.formula_verified then r.formula_quantity::text end,
  'formula_source_unit',case when r.formula_verified then (select code from public.material_units where id=r.usage_unit_id) end,
  'formula_source_unit_id',case when r.formula_verified then r.usage_unit_id end,
  'formula_effective_from',case when r.formula_verified then r.effective_from end,'formula_issue',issue);
end $$;

do $patch$
declare d text;old_fragment text;
begin
 select pg_get_functiondef('public.recipe_detail(uuid,date)'::regprocedure) into d;
 old_fragment=$old$'child_status',r.child_status,'sort_order',r.sort_order));$old$;
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_DETAIL_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,$new$'child_status',r.child_status,'sort_order',r.sort_order)
  ||case when r.material_id is not null then private.recipe_formula_line(r.material_id,r.unit_id,r.quantity,p_date) else '{}'::jsonb end);$new$);
 select pg_get_functiondef('public.recipe_material_units(date)'::regprocedure) into d;
 old_fragment=$old$'formula_quantity',case when r.formula_verified then r.formula_quantity::text end,$old$;
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_SOURCE_UNIT_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,old_fragment||$new$
  'formula_source_unit_id',case when r.formula_verified then r.usage_unit_id end,$new$);
end $patch$;

-- Convert balances only after obtaining real stock evidence in a stock unit.
-- A formula-only ratio never changes receipts, counts or inventory history.
create function private.formula_inventory_quantity(p_warehouse uuid,p_date date,p_material uuid,p_unit uuid)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare source_unit uuid;balance numeric;
begin
 select coalesce((select r.usage_unit_id from public.material_resolutions r where r.material_id=m.id and r.effective_from<=p_date
  order by r.effective_from desc,r.revision desc limit 1),m.usage_unit_id) into source_unit from public.materials m where m.id=p_material;
 balance=private.inventory_quantity(p_warehouse,p_date,p_material,source_unit);
 if balance is null then return null;end if;
 return private.recipe_convert_quantity_at(p_material,source_unit,p_unit,balance,p_date);
exception when raise_exception then
 if split_part(SQLERRM,'|',1)<>'UNIT_NEEDS_VERIFICATION' then raise;end if;
 return null;
end $$;

create function private.formula_minimum_quantity(p_material uuid,p_unit uuid,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare m public.materials;source_unit uuid;amount numeric;
begin
 select * into strict m from public.materials where id=p_material;
 if m.minimum_quantity is null then return null;end if;
 select coalesce((select r.usage_unit_id from public.material_resolutions r where r.material_id=m.id and r.effective_from<=p_date
  order by r.effective_from desc,r.revision desc limit 1),m.usage_unit_id) into source_unit;
 amount=private.convert_quantity_at(m.id,m.usage_unit_id,source_unit,m.minimum_quantity,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
 return private.recipe_convert_quantity_at(m.id,source_unit,p_unit,amount,p_date);
exception when raise_exception then
 if split_part(SQLERRM,'|',1)<>'UNIT_NEEDS_VERIFICATION' then raise;end if;
 return null;
end $$;

create function private.formula_package(p_material uuid,p_date date,p_unit uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare package_unit uuid;factor numeric;
begin
 select coalesce((select r.purchase_unit_id from public.material_resolutions r where r.material_id=m.id and r.effective_from<=p_date
  order by r.effective_from desc,r.revision desc limit 1),m.purchase_unit_id) into package_unit from public.materials m where m.id=p_material;
 begin factor=private.recipe_convert_quantity_at(p_material,package_unit,p_unit,1,p_date);
 exception when raise_exception then if split_part(SQLERRM,'|',1)<>'UNIT_NEEDS_VERIFICATION' then raise;end if;factor=null;end;
 return jsonb_build_object('unit',(select code from public.material_units where id=package_unit),'usage_per_package',factor::text,'verified',factor is not null);
end $$;

create or replace function private.order_demand_formula_units(p_needs jsonb,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare line jsonb;result jsonb='[]'::jsonb;target_unit uuid;amount numeric;
begin
 if p_needs is null or jsonb_typeof(p_needs) is distinct from 'array' then raise exception 'INVALID_NEEDS';end if;
 for line in select value from jsonb_array_elements(p_needs) loop
  if line ? 'issue' or not (line ? 'material_id') then result=result||jsonb_build_array(line);continue;end if;
  select case when r.formula_verified then r.formula_unit_id end into target_unit
   from public.material_resolutions r where r.material_id=(line->>'material_id')::uuid and r.effective_from<=p_date
   order by r.effective_from desc,r.revision desc limit 1;
  target_unit=coalesce(target_unit,(line->>'unit_id')::uuid);
  begin
   amount=private.recipe_convert_quantity_at((line->>'material_id')::uuid,(line->>'unit_id')::uuid,target_unit,(line->>'quantity')::numeric,p_date);
   result=result||jsonb_build_array(line||jsonb_build_object('unit_id',target_unit,'quantity',amount::text));
  exception when raise_exception then
   if split_part(SQLERRM,'|',1)<>'UNIT_NEEDS_VERIFICATION' then raise;end if;
   result=result||jsonb_build_array((line-'quantity'-'material_id'-'unit_id')||jsonb_build_object('issue','UNIT_NEEDS_VERIFICATION','issue_detail',SQLERRM));
  end;
 end loop;
 return result;
end $$;

-- Isolate each topping so one unresolved recipe cannot erase other needs.
create function private.topping_material_needs(p_date date,p_warehouse uuid,p_summary boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t record;part jsonb;result jsonb='[]'::jsonb;
begin
 for t in
  select top.*,i.product_id,i.product_code,i.product_name from public.customer_order_item_toppings top
  join public.customer_order_items i on i.id=top.order_item_id and i.cancelled_at is null
  join public.customer_orders o on o.id=i.order_id and o.delivery_date=p_date
  left join public.production_plans p on p.id=o.plan_id
  where top.topping_version_id is not null and (
   p_summary and o.status in('approved','scheduled','fulfilled') or
   not p_summary and o.status='scheduled' and p.ingredient_warehouse_id=p_warehouse and p.delivery_date=p_date
    and p.status in('approved','completed') and top.consumed_at is null)
 loop
  begin
   select coalesce(jsonb_agg(jsonb_build_object('material_id',b.material_id,'unit_id',b.unit_id,'quantity',b.quantity::text,
    'product_id',t.product_id,'product_code',t.product_code,'product_name',t.product_name,'recipe_version_id',t.topping_version_id,
    'topping_code',t.topping_code,'topping_name',t.topping_name,'topping_quantity',t.quantity::text,'calculated_on',p_date)),'[]') into part
    from private.bom(t.topping_version_id,t.quantity,p_date) b;
   if part='[]'::jsonb then raise exception 'EMPTY_RECIPE';end if;
   result=result||part;
  exception when raise_exception then
   if split_part(SQLERRM,'|',1) not in('UNIT_NEEDS_VERIFICATION','RECIPE_NEEDS_REVIEW','CHILD_OUTPUT_UNIT_MISMATCH','EMPTY_RECIPE') then raise;end if;
   result=result||jsonb_build_array(jsonb_build_object('product_id',t.product_id,'product_code',t.product_code,'product_name',t.product_name,
    'topping_code',t.topping_code,'topping_name',t.topping_name,'issue',split_part(SQLERRM,'|',1),'issue_detail',SQLERRM));
  end;
 end loop;
 return result;
end $$;
create or replace function private.order_topping_material_needs(p_date date)
returns jsonb language sql stable security definer set search_path='' as $$select private.topping_material_needs(p_date,null,true)$$;
create or replace function private.plan_order_topping_material_needs(p_warehouse uuid,p_date date)
returns jsonb language sql stable security definer set search_path='' as $$select private.topping_material_needs(p_date,p_warehouse,false)$$;

-- Customer summary is total theoretical demand from its approved orders,
-- independent of scheduling. It never creates a second production demand.
do $patch$
declare d text;old_fragment text;
begin
 select pg_get_functiondef('public.order_material_demand(date)'::regprocedure) into d;
 old_fragment=$old$where o.delivery_date=p_date and o.status in('approved','scheduled') and o.plan_id is null$old$;
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_ORDER_SCOPE_PATCH_MISMATCH';end if;
 d=replace(d,old_fragment,$new$where i.cancelled_at is null and o.delivery_date=p_date and o.status in('approved','scheduled','fulfilled')$new$);
 d=replace(d,'private.inventory_quantity(null,p_date,x.material_id,x.unit_id)','private.formula_inventory_quantity(null,p_date,x.material_id,x.unit_id)');
 d=replace(d,'private.recipe_convert_quantity_at(m.id,m.usage_unit_id,x.unit_id,m.minimum_quantity,p_date)','private.formula_minimum_quantity(m.id,x.unit_id,p_date)');
 execute d;

 -- Display-only conversion: persisted plan needs and actual snapshots stay
 -- in their original stock units; comparison columns share the display unit.
 select pg_get_functiondef('public.production_plan_requirements(uuid,date,uuid,text,jsonb)'::regprocedure) into d;
 old_fragment='with totals as(select';
 if strpos(d,old_fragment)=0 then raise exception 'FORMULA_PLAN_PREVIEW_PATCH_MISMATCH';end if;
 d=replace(d,old_fragment,'needs=private.order_demand_formula_units(needs,p_date); '||old_fragment);
 d=replace(d,'private.inventory_quantity(p_warehouse,p_date,t.material_id,t.unit_id)','private.formula_inventory_quantity(p_warehouse,p_date,t.material_id,t.unit_id)');
 d=replace(d,'private.production_package(material_id,p_date)','private.formula_package(material_id,p_date,unit_id)');
 execute d;
end $patch$;

revoke all on function private.recipe_formula_line(uuid,uuid,numeric,date),private.formula_inventory_quantity(uuid,date,uuid,uuid),
 private.formula_minimum_quantity(uuid,uuid,date),private.formula_package(uuid,date,uuid),private.topping_material_needs(date,uuid,boolean)
 from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
