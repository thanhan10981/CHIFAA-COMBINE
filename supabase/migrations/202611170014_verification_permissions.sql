begin;
-- Forward migration: verification requires the approve action.
create or replace function public.save_catalog(p_table text,p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare columns text[]; module text; cached jsonb; result jsonb; current_version bigint; assignments text; row_id uuid=coalesce(p_id,gen_random_uuid());
begin
 case p_table
 when 'materials' then module='materials'; columns=array['code','name','category','purchase_unit_id','usage_unit_id','minimum_quantity','price_status','archived'];
 when 'material_units' then module='materials'; columns=array['code','name','dimension','archived'];
 when 'unit_conversions' then module='materials'; columns=array['material_id','from_unit_id','to_unit_id','factor','verified','evidence'];
 when 'material_prices' then module='materials'; columns=array['material_id','basis_unit_id','amount','effective_from','effective_to','verification','source_reference'];
 when 'products' then module='products'; columns=array['code','name','sale_unit','published','archived'];
 when 'stores' then module='stores'; columns=array['code','name','address','contact','active'];
 when 'departments' then module='employees'; columns=array['code','name'];
 when 'employees' then module='employees'; columns=array['code','name','department_id','active'];
 when 'suppliers' then module='materials'; columns=array['code','name','contact','archived'];
 when 'warehouses' then module='inventory'; columns=array['code','name','kind','active'];
 else raise exception 'UNSUPPORTED_CATALOG'; end case;
 if not private.can(module,case when p_id is null then 'create' else 'edit' end) then raise exception 'FORBIDDEN'; end if;
 if ((p_table='unit_conversions' and coalesce((p_input->>'verified')::boolean,false)) or(p_table='material_prices' and p_input->>'verification'='verified') or(p_table='materials' and p_input->>'price_status'='verified')) and not private.can('materials','approve') then raise exception 'FORBIDDEN_VERIFICATION';end if;
 if jsonb_typeof(p_input)<>'object' or p_input='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(columns))) then raise exception 'INVALID_FIELDS'; end if;
 if p_table='materials' and p_input->>'price_status'='verified' and not exists(select 1 from public.material_prices p where p.material_id=p_id and p.verification='verified' and p.amount is not null) then raise exception 'VERIFIED_PRICE_ROW_REQUIRED';end if;
 cached=private.begin_request(p_key,'catalog:'||p_table,jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached; end if;
 if p_id is null then
  select string_agg(format('%I',key),',') into assignments from jsonb_object_keys(p_input) key;
  execute format('insert into public.%I(id,%s) select $2,%s from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I.*)',p_table,assignments,assignments,p_table,p_table) into result using p_input,row_id;
 else
  execute format('select version from public.%I where id=$1 for update',p_table) into current_version using p_id;
  if current_version is null then raise exception 'NOT_FOUND'; end if;
  if p_expected_version is null or p_expected_version<>current_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_table='material_prices' and exists(select 1 from public.material_prices where id=p_id and verification='verified') then raise exception 'PRICE_VERSION_IMMUTABLE';end if;
  if p_table='unit_conversions' and exists(select 1 from public.unit_conversions c where c.id=p_id and (exists(select 1 from public.inventory_movement_lines l where l.material_id=c.material_id) or exists(select 1 from public.recipe_items i where i.material_id=c.material_id))) then raise exception 'UNIT_MIGRATION_REQUIRED';end if;
  -- A base unit cannot be relabeled after its stock/recipe history exists.
  if p_table='materials' and p_input?'usage_unit_id' and exists(select 1 from public.materials m where m.id=p_id and m.usage_unit_id is distinct from (p_input->>'usage_unit_id')::uuid) and
    (exists(select 1 from public.inventory_movement_lines where material_id=p_id) or exists(select 1 from public.recipe_items where material_id=p_id)) then raise exception 'UNIT_MIGRATION_REQUIRED'; end if;
  select string_agg(format('%I=v.%I',key,key),',') into assignments from jsonb_object_keys(p_input) key;
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) v where t.id=$2 returning to_jsonb(t.*)',p_table,assignments,p_table) into result using p_input,p_id;
 end if;
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.save_catalog(text,uuid,bigint,jsonb,uuid) from public;
grant execute on function public.save_catalog(text,uuid,bigint,jsonb,uuid) to authenticated;
commit;
