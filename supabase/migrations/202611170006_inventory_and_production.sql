begin;
create function private.assert_open(p_date date) returns void language plpgsql stable security definer set search_path='' as $$
begin if p_date is null then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_date between starts_on and ends_on) then raise exception 'PERIOD_CLOSED'; end if;
end $$;
create function public.inventory_balance(p_warehouse uuid,p_date date) returns table(material_id uuid,material_code text,material_name text,unit_id uuid,unit_code text,quantity text,minimum_quantity text) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('inventory','view') then raise exception 'FORBIDDEN'; end if;
 return query select m.id,m.code,m.name,m.usage_unit_id,u.code,sum(l.quantity)::text,m.minimum_quantity::text from public.materials m left join public.material_units u on u.id=m.usage_unit_id
  left join public.inventory_movement_lines l on l.material_id=m.id and exists(select 1 from public.inventory_movements v where v.id=l.movement_id and v.warehouse_id=p_warehouse and v.moved_on<=p_date)
  group by m.id,m.code,m.name,m.usage_unit_id,u.code,m.minimum_quantity order by m.code;
end $$;
create function private.insert_movement(p_warehouse uuid,p_date date,p_kind text,p_lines jsonb,p_note text,p_batch uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare movement_id uuid; line jsonb; standard uuid; delta numeric; closing numeric;
begin
 perform private.assert_open(p_date);
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>200 then raise exception 'INVALID_LINES'; end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED'; end if;
 -- Serialize all changes to this warehouse, including counts/backdated input.
 perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text,0));
 insert into public.inventory_movements(warehouse_id,moved_on,kind,note,source_batch_id) values(p_warehouse,p_date,p_kind,p_note,p_batch) returning id into movement_id;
 for line in select value from jsonb_array_elements(p_lines) loop
  select usage_unit_id into standard from public.materials where id=(line->>'material_id')::uuid and not archived;
  if standard is null then raise exception 'MATERIAL_STANDARD_UNIT_REQUIRED'; end if;
  delta=private.convert_quantity((line->>'material_id')::uuid,(line->>'unit_id')::uuid,standard,(line->>'quantity')::numeric);
  if delta is null or delta=0 or (p_kind='receipt' and delta<0) or(p_kind='issue' and delta>0) then raise exception 'INVALID_MOVEMENT_DIRECTION'; end if;
  insert into public.inventory_movement_lines(movement_id,material_id,unit_id,quantity,unit_cost) values(movement_id,(line->>'material_id')::uuid,standard,delta,(line->>'unit_cost')::numeric);
  -- Check every later daily closing balance after a backdated change.
  select min(q) into closing from (
   select sum(sum(l.quantity)) over(order by v.moved_on) q from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id
   where v.warehouse_id=p_warehouse and l.material_id=(line->>'material_id')::uuid group by v.moved_on
  ) balances;
  if closing<0 then raise exception 'INSUFFICIENT_STOCK'; end if;
 end loop;
 return movement_id;
end $$;
create function public.post_inventory(p_warehouse uuid,p_date date,p_kind text,p_lines jsonb,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; movement uuid;
begin
 if not private.can('inventory','create') then raise exception 'FORBIDDEN'; end if;
 if p_kind not in ('receipt','issue','adjustment') then raise exception 'INVALID_MOVEMENT_KIND'; end if;
 cached=private.begin_request(p_key,'inventory:post',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'kind',p_kind,'lines',p_lines,'note',p_note));if cached is not null then return cached; end if;
 movement=private.insert_movement(p_warehouse,p_date,p_kind,p_lines,p_note);
 return private.finish_request(p_key,jsonb_build_object('movement_id',movement));
end $$;

create function public.post_stock_count(p_warehouse uuid,p_date date,p_lines jsonb,p_inventory_version bigint,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; count_id uuid; line jsonb; expected numeric; counted numeric; movement uuid; adjustments jsonb='[]'; current_version bigint;
begin
 if not private.can('counts','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN'; end if;
 cached=private.begin_request(p_key,'count:post',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'lines',p_lines,'version',p_inventory_version));if cached is not null then return cached; end if;
 perform private.assert_open(p_date);perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text,0));
 select version into current_version from public.data_versions where module='inventory';if coalesce(current_version,0)<>p_inventory_version then raise exception 'INVENTORY_VERSION_CONFLICT'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>200 then raise exception 'INVALID_COUNT_LINES'; end if;
 insert into public.stock_counts(warehouse_id,counted_on,status) values(p_warehouse,p_date,'draft') returning id into count_id;
 for line in select value from jsonb_array_elements(p_lines) loop
  select coalesce(sum(l.quantity),0) into expected from public.inventory_movement_lines l join public.inventory_movements m on m.id=l.movement_id where l.material_id=(line->>'material_id')::uuid and m.warehouse_id=p_warehouse and m.moved_on<=p_date;
  counted=(line->>'counted_quantity')::numeric;
  insert into public.stock_count_lines(count_id,material_id,expected_quantity,counted_quantity) values(count_id,(line->>'material_id')::uuid,expected,counted);
  if counted<>expected then adjustments=adjustments||jsonb_build_array(jsonb_build_object('material_id',line->>'material_id','unit_id',(select usage_unit_id from public.materials where id=(line->>'material_id')::uuid),'quantity',counted-expected,'unit_cost',null)); end if;
 end loop;
 if jsonb_array_length(adjustments)>0 then movement=private.insert_movement(p_warehouse,p_date,'adjustment',adjustments,'Kiểm kê',null); end if;
 update public.stock_counts set status='posted',movement_id=movement where id=count_id;
 return private.finish_request(p_key,jsonb_build_object('count_id',count_id,'movement_id',movement));
end $$;

create function public.post_production(p_warehouse uuid,p_date date,p_lines jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; batch uuid; batch_line uuid; line jsonb; ingredient record; bom_lines jsonb='[]'; movement uuid; produced_quantity numeric; output_factor numeric;
begin
 if not private.can('production','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN'; end if;
 cached=private.begin_request(p_key,'production:post',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'lines',p_lines));if cached is not null then return cached; end if;
 perform private.assert_open(p_date);perform pg_advisory_xact_lock(170011);
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>100 then raise exception 'INVALID_PRODUCTION_LINES'; end if;
 insert into public.production_batches(warehouse_id,produced_on,status) values(p_warehouse,p_date,'draft') returning id into batch;
 for line in select value from jsonb_array_elements(p_lines) loop
  if (line->>'recipe_version_id')::uuid is distinct from (select l.recipe_version_id from public.product_recipe_links l join public.recipe_versions v on v.id=l.recipe_version_id where l.product_id=(line->>'product_id')::uuid and v.status='published' and v.effective_from<=p_date and l.effective_from<=p_date order by l.effective_from desc limit 1) then raise exception 'PUBLISHED_PRODUCT_RECIPE_REQUIRED'; end if;
  produced_quantity=(line->>'main_quantity')::numeric+(line->>'extra_quantity')::numeric;
  select l.output_quantity_per_product into strict output_factor from public.product_recipe_links l where l.product_id=(line->>'product_id')::uuid and l.recipe_version_id=(line->>'recipe_version_id')::uuid and l.effective_from<=p_date order by l.effective_from desc limit 1;
  if produced_quantity<=0 then raise exception 'INVALID_PRODUCTION_QUANTITY'; end if;
  insert into public.production_batch_lines(batch_id,product_id,recipe_version_id,main_quantity,extra_quantity,rejected_quantity) values(batch,(line->>'product_id')::uuid,(line->>'recipe_version_id')::uuid,(line->>'main_quantity')::numeric,(line->>'extra_quantity')::numeric,(line->>'rejected_quantity')::numeric) returning id into batch_line;
  for ingredient in select b.material_id,b.unit_id,sum(b.quantity) quantity,case when count(*)=count(b.unit_cost) then max(b.unit_cost) else null end unit_cost from private.bom((line->>'recipe_version_id')::uuid,produced_quantity*output_factor,p_date) b group by b.material_id,b.unit_id loop
   insert into public.ingredient_requirement_snapshots(batch_line_id,material_id,unit_id,quantity,unit_cost) values(batch_line,ingredient.material_id,ingredient.unit_id,ingredient.quantity,ingredient.unit_cost);
  end loop;
 end loop;
 select jsonb_agg(jsonb_build_object('material_id',s.material_id,'unit_id',s.unit_id,'quantity',-s.quantity,'unit_cost',s.unit_cost)) into bom_lines from(
  select material_id,unit_id,sum(quantity) quantity,case when count(*)=count(unit_cost) then max(unit_cost) else null end unit_cost from public.ingredient_requirement_snapshots where batch_line_id in(select id from public.production_batch_lines where batch_id=batch) group by material_id,unit_id
 ) s;
 if bom_lines is null then raise exception 'EMPTY_RECIPE'; end if;
 movement=private.insert_movement(p_warehouse,p_date,'issue',bom_lines,'Xuất định mức sản xuất',batch);
 update public.production_batches set status='posted' where id=batch;
 return private.finish_request(p_key,jsonb_build_object('batch_id',batch,'movement_id',movement));
end $$;
revoke all on all functions in schema private from public;
grant execute on function private.can(text,text) to authenticated;
grant execute on function private.audit_visible(text) to authenticated;
revoke all on function public.inventory_balance(uuid,date),public.post_inventory(uuid,date,text,jsonb,text,uuid),public.post_stock_count(uuid,date,jsonb,bigint,uuid),public.post_production(uuid,date,jsonb,uuid) from public;
grant execute on function public.inventory_balance(uuid,date),public.post_inventory(uuid,date,text,jsonb,text,uuid),public.post_stock_count(uuid,date,jsonb,bigint,uuid),public.post_production(uuid,date,jsonb,uuid) to authenticated;
commit;
