begin;

-- Keep the receipt-weighted average on the same warehouse/date snapshot as the
-- inventory table and export. Unknown receipt prices keep the average unknown.
do $upgrade$
declare definition text;
begin
 select pg_get_functiondef('public.inventory_workspace(uuid,date,date,text,text,text,integer)'::regprocedure) into definition;
 if position('stock_average_unit_cost' in definition)>0 then raise exception 'INVENTORY_EXCEL_AVERAGE_ALREADY_PRESENT';end if;
 if position('private.inventory_quantity(p_warehouse,p_date,m.id,u.id) quantity,' in definition)=0 then raise exception 'INVENTORY_EXCEL_AVERAGE_BASE_MISMATCH';end if;
 definition=replace(definition,
  'private.inventory_quantity(p_warehouse,p_date,m.id,u.id) quantity,',
  'private.inventory_quantity(p_warehouse,p_date,m.id,u.id) quantity,stock_price.average_unit_cost stock_average_unit_cost,');
 if position('from public.materials m left join public.material_units u on u.id=m.usage_unit_id where not m.archived),' in definition)=0 then raise exception 'INVENTORY_EXCEL_AVERAGE_JOIN_MISMATCH';end if;
 definition=replace(definition,
  'from public.materials m left join public.material_units u on u.id=m.usage_unit_id where not m.archived),',
  'from public.materials m left join public.material_units u on u.id=m.usage_unit_id left join lateral( select case when count(*)>0 and bool_and(l.unit_cost_source=''receipt_input'' and l.unit_cost is not null) and sum(l.quantity)>0 then round(sum(l.quantity*l.unit_cost)/sum(l.quantity),6) end average_unit_cost from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id where l.material_id=m.id and v.warehouse_id=p_warehouse and v.kind=''receipt'' and v.status=''posted'' and v.moved_on<=p_date ) stock_price on true where not m.archived),');
 if position('stock_average_unit_cost' in definition)=0 or position('stock_price on true' in definition)=0 then raise exception 'INVENTORY_EXCEL_AVERAGE_PATCH_FAILED';end if;
 if position('''status'',status)' in definition)=0 then raise exception 'INVENTORY_EXCEL_AVERAGE_OUTPUT_MISMATCH';end if;
 definition=replace(definition,'''status'',status)','''status'',status,''stock_average_unit_cost'',stock_average_unit_cost::text)');
 execute definition;
end $upgrade$;

create function public.inventory_excel_export(p_warehouse uuid,p_date date,p_offset integer,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can('inventory','export') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_FILTER';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED';end if;
 with base as(
  select m.id,m.code,m.name,m.category,u.code unit,private.inventory_quantity(p_warehouse,p_date,m.id,u.id)::text quantity,m.minimum_quantity::text minimum,
   stock_price.average_unit_cost::text stock_average_unit_cost
  from public.materials m left join public.material_units u on u.id=m.usage_unit_id
  left join lateral(
   select case when count(*)>0 and bool_and(l.unit_cost_source='receipt_input' and l.unit_cost is not null) and sum(l.quantity)>0 then round(sum(l.quantity*l.unit_cost)/sum(l.quantity),6) end average_unit_cost
   from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id
   where l.material_id=m.id and v.warehouse_id=p_warehouse and v.kind='receipt' and v.status='posted' and v.moved_on<=p_date
  ) stock_price on true where not m.archived
 ) select jsonb_build_object('total',(select count(*) from base),'rows',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'category',category,'unit',unit,'quantity',quantity,'minimum',minimum,'stock_average_unit_cost',stock_average_unit_cost) order by code,id),'[]'::jsonb) from(select * from base order by code,id limit p_limit offset p_offset) page)) into result;
 return result;
end $$;

-- One workbook import is one atomic catalog update plus one append-only receipt.
-- Current stock shown in the workbook is informational; only added_quantity is
-- posted, so uploading an untouched export can never overwrite or duplicate it.
create function public.import_inventory_excel(p_warehouse uuid,p_date date,p_lines jsonb,p_source_name text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; line jsonb; item record; unit_id uuid; material_id uuid; existing public.materials; new_count integer=0; update_count integer=0; receipt_count integer=0; receipt_lines jsonb='[]'::jsonb; movement uuid; result jsonb; normalized_code text;
begin
 if not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_source_name is null or length(btrim(p_source_name)) not between 1 and 250 then raise exception 'INVALID_IMPORT_SOURCE';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>200 then raise exception 'INVALID_IMPORT_LINES';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where jsonb_typeof(x) is distinct from 'object' or exists(select 1 from jsonb_object_keys(x) k where k<>all(array['code','name','category','unit_code','minimum_quantity','added_quantity','unit_cost']))) then raise exception 'INVALID_IMPORT_FIELDS';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where length(btrim(coalesce(x->>'code',''))) not between 1 and 64 or length(btrim(coalesce(x->>'name',''))) not between 1 and 250 or length(btrim(coalesce(x->>'unit_code',''))) not between 1 and 64 or coalesce(x->>'category','')<>all(array['ingredient','packaging','main_ingredient','spice','finished_sauce','auxiliary','other'])) then raise exception 'INVALID_IMPORT_MATERIAL';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where x->>'minimum_quantity' is not null and (x->>'minimum_quantity') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,6})?$') then raise exception 'INVALID_IMPORT_MINIMUM';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where x->>'added_quantity' is not null and ((x->>'added_quantity') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,6})?$' or (x->>'added_quantity')::numeric<=0)) then raise exception 'INVALID_IMPORT_QUANTITY';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x where x->>'unit_cost' is not null and ((x->>'unit_cost') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,6})?$' or x->>'added_quantity' is null)) then raise exception 'INVALID_IMPORT_PRICE';end if;
 if exists(select upper(btrim(x->>'code')) from jsonb_array_elements(p_lines) x group by upper(btrim(x->>'code')) having count(*)>1) then raise exception 'DUPLICATE_IMPORT_CODE';end if;
 cached=private.begin_request(p_key,'inventory:excel-import',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'lines',p_lines,'source_name',p_source_name));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);

 -- Lock codes in a stable order, then validate every referenced unit and
 -- catalog permission before changing any row.
 for item in select distinct upper(btrim(x->>'code')) code from jsonb_array_elements(p_lines) x order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('material-code:'||item.code,0));
 end loop;
 for line in select value from jsonb_array_elements(p_lines) loop
  normalized_code=btrim(line->>'code');
  if not exists(select 1 from public.material_units where code=btrim(line->>'unit_code') and not archived) then raise exception 'IMPORT_UNIT_NOT_FOUND:%',line->>'unit_code';end if;
  if (select count(*) from public.materials where upper(code)=upper(normalized_code))>1 then raise exception 'MATERIAL_CODE_AMBIGUOUS:%',normalized_code;end if;
  select * into existing from public.materials where upper(code)=upper(normalized_code) for update;
  if found then
   if existing.archived then raise exception 'IMPORT_MATERIAL_ARCHIVED:%',normalized_code;end if;
   if not private.can('materials','edit') then raise exception 'FORBIDDEN_MATERIAL_EDIT';end if;
   select id into unit_id from public.material_units where code=btrim(line->>'unit_code') and not archived;
   if existing.usage_unit_id is distinct from unit_id and (exists(select 1 from public.inventory_movement_lines l where l.material_id=existing.id) or exists(select 1 from public.recipe_items i where i.material_id=existing.id)) then raise exception 'UNIT_MIGRATION_REQUIRED:%',normalized_code;end if;
  else
   if not private.can('materials','create') then raise exception 'FORBIDDEN_MATERIAL_CREATE';end if;
  end if;
 end loop;

 for line in select value from jsonb_array_elements(p_lines) loop
  normalized_code=btrim(line->>'code');
  select id into unit_id from public.material_units where code=btrim(line->>'unit_code') and not archived;
  select id into material_id from public.materials where upper(code)=upper(normalized_code) for update;
  if material_id is null then
   insert into public.materials(code,name,category,purchase_unit_id,usage_unit_id,minimum_quantity,source_unit_label,specification)
   select normalized_code,btrim(line->>'name'),line->>'category',unit_id,unit_id,(line->>'minimum_quantity')::numeric,u.code,'' from public.material_units u where u.id=unit_id
   returning id into material_id;
   new_count=new_count+1;
  else
   select * into existing from public.materials where id=material_id;
   if existing.name is distinct from btrim(line->>'name') or existing.category is distinct from line->>'category' or existing.usage_unit_id is distinct from unit_id or existing.minimum_quantity is distinct from (line->>'minimum_quantity')::numeric then
    update public.materials set name=btrim(line->>'name'),category=line->>'category',usage_unit_id=unit_id,minimum_quantity=(line->>'minimum_quantity')::numeric where id=material_id;
   end if;
   update_count=update_count+1;
  end if;
  if line->>'added_quantity' is not null then
   receipt_count=receipt_count+1;
   receipt_lines=receipt_lines||jsonb_build_array(jsonb_build_object('material_id',material_id,'unit_id',unit_id,'quantity',line->>'added_quantity','unit_cost',line->>'unit_cost'));
  end if;
 end loop;
 if receipt_count>0 then movement=private.insert_movement(p_warehouse,p_date,'receipt',receipt_lines,'Nhập Excel · '||btrim(p_source_name),null);end if;
 result=jsonb_build_object('movement_id',movement,'materials_created',new_count,'materials_updated',update_count,'receipt_lines',receipt_count);
 return private.finish_request(p_key,result);
end $$;

revoke all on function public.inventory_excel_export(uuid,date,integer,integer),public.import_inventory_excel(uuid,date,jsonb,text,uuid) from public,anon;
grant execute on function public.inventory_excel_export(uuid,date,integer,integer),public.import_inventory_excel(uuid,date,jsonb,text,uuid) to authenticated;
commit;
