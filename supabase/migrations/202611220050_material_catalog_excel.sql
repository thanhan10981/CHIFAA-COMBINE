begin;

create function public.material_catalog_excel_export(p_date date,p_offset integer,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can('materials','export') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_FILTER';end if;
 with base as(
  select m.id,m.version::text version,m.code,m.name,m.category,pu.code purchase_unit_code,bu.code basis_unit_code,
   price.amount::text price_amount,m.minimum_quantity::text minimum_quantity,m.specification
  from public.materials m
  left join public.material_units pu on pu.id=m.purchase_unit_id
  left join lateral(select p.amount,p.basis_unit_id from private.effective_material_price(m.id,p_date) p) price on true
  left join public.material_units bu on bu.id=price.basis_unit_id
  where not m.archived
 )
 select jsonb_build_object(
  'total',(select count(*) from base),
  'rows',(select coalesce(jsonb_agg(jsonb_build_object(
   'material_id',id,'version',version,'code',code,'name',name,'category',category,
   'purchase_unit_code',purchase_unit_code,'basis_unit_code',basis_unit_code,
   'price_amount',price_amount,'minimum_quantity',minimum_quantity,'specification',specification
  ) order by code,id),'[]'::jsonb) from(select * from base order by code,id limit p_limit offset p_offset) page)
 ) into result;
 return result;
end $$;

create function public.import_material_catalog_excel(p_rows jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; line jsonb; item record; m public.materials; current_price record;
 purchase uuid; basis uuid; today date=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 new_count integer=0;update_count integer=0;unchanged_count integer=0;result jsonb;input_value jsonb;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>200 then raise exception 'INVALID_IMPORT_ROWS';end if;
 if p_key is null then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 if not private.can('materials','create') and not private.can('materials','edit') then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x) is distinct from 'object' or exists(select 1 from jsonb_object_keys(x) k where k<>all(array['material_id','version','code','name','category','purchase_unit_code','basis_unit_code','price_amount','minimum_quantity','specification']))) then raise exception 'INVALID_IMPORT_FIELDS';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where length(btrim(coalesce(x->>'code',''))) not between 1 and 64 or length(btrim(coalesce(x->>'name',''))) not between 1 and 250 or length(btrim(coalesce(x->>'purchase_unit_code',''))) not between 1 and 64 or coalesce(x->>'category','')<>all(array['ingredient','packaging','main_ingredient','spice','finished_sauce','auxiliary','other']) or length(coalesce(x->>'specification',''))>1000) then raise exception 'INVALID_IMPORT_MATERIAL';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where ((x->>'material_id' is null)<>(x->>'version' is null)) or (x->>'material_id' is not null and x->>'material_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') or (x->>'version' is not null and x->>'version' !~ '^[1-9][0-9]{0,17}$')) then raise exception 'INVALID_IMPORT_IDENTITY';end if;
 if exists(select upper(btrim(x->>'code')) from jsonb_array_elements(p_rows) x group by upper(btrim(x->>'code')) having count(*)>1) then raise exception 'DUPLICATE_IMPORT_CODE';end if;
 if exists(select x->>'material_id' from jsonb_array_elements(p_rows) x where x->>'material_id' is not null group by x->>'material_id' having count(*)>1) then raise exception 'DUPLICATE_IMPORT_ID';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where x->>'price_amount' is not null and x->>'price_amount' !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,6})?$') then raise exception 'INVALID_IMPORT_PRICE';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where x->>'minimum_quantity' is not null and x->>'minimum_quantity' !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,6})?$') then raise exception 'INVALID_IMPORT_MINIMUM';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where x->>'price_amount' is not null and nullif(btrim(x->>'basis_unit_code'),'') is null) then raise exception 'IMPORT_PRICE_BASIS_REQUIRED';end if;
 cached=private.begin_request(p_key,'materials:excel-import',jsonb_build_object('rows',p_rows));if cached is not null then return cached;end if;

 -- Serialize competing imports that target the same code, then lock existing
 -- rows by stable identity before checking versions and permissions.
 for item in select distinct upper(btrim(x->>'code')) code from jsonb_array_elements(p_rows) x order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('material-code:'||item.code,0));
 end loop;
 for item in select x->>'material_id' material_id from jsonb_array_elements(p_rows) x where x->>'material_id' is not null order by x->>'material_id' loop
  perform 1 from public.materials where id=(item.material_id)::uuid for update;
 end loop;

 for line in select value from jsonb_array_elements(p_rows) loop
  if line->>'material_id' is null then
   if not private.can('materials','create') then raise exception 'FORBIDDEN_MATERIAL_CREATE';end if;
   if exists(select 1 from public.materials where upper(code)=upper(btrim(line->>'code'))) then raise exception 'IMPORT_CODE_EXISTS:%',line->>'code';end if;
  else
   if not private.can('materials','edit') then raise exception 'FORBIDDEN_MATERIAL_EDIT';end if;
   select * into strict m from public.materials where id=(line->>'material_id')::uuid;
   if m.archived then raise exception 'IMPORT_MATERIAL_ARCHIVED:%',m.code;end if;
   if m.version<>(line->>'version')::bigint then raise exception 'VERSION_CONFLICT:%',m.code;end if;
   if exists(select 1 from public.materials other where upper(other.code)=upper(btrim(line->>'code')) and other.id<>m.id) then raise exception 'IMPORT_CODE_EXISTS:%',line->>'code';end if;
  end if;
  if not exists(select 1 from public.material_units where code=btrim(line->>'purchase_unit_code') and not archived) then raise exception 'IMPORT_UNIT_NOT_FOUND:%',line->>'purchase_unit_code';end if;
  if nullif(btrim(line->>'basis_unit_code'),'') is not null and not exists(select 1 from public.material_units where code=btrim(line->>'basis_unit_code') and not archived) then raise exception 'IMPORT_UNIT_NOT_FOUND:%',line->>'basis_unit_code';end if;
 end loop;

 for line in select value from jsonb_array_elements(p_rows) loop
  select id into strict purchase from public.material_units where code=btrim(line->>'purchase_unit_code') and not archived;
  basis=null;
  if nullif(btrim(line->>'basis_unit_code'),'') is not null then select id into strict basis from public.material_units where code=btrim(line->>'basis_unit_code') and not archived;end if;
  if line->>'material_id' is null then
   input_value=jsonb_build_object('code',btrim(line->>'code'),'name',btrim(line->>'name'),'category',line->>'category','purchase_unit_id',purchase,'basis_unit_id',basis,'price_amount',line->>'price_amount','minimum_quantity',line->>'minimum_quantity','specification',line->>'specification');
   perform public.save_material_table(null,null,input_value,gen_random_uuid());
   new_count=new_count+1;
  else
   select * into strict m from public.materials where id=(line->>'material_id')::uuid for update;
   select * into current_price from private.effective_material_price(m.id,today);
   if m.code is distinct from btrim(line->>'code') or m.name is distinct from btrim(line->>'name') or m.category is distinct from line->>'category' or m.purchase_unit_id is distinct from purchase or m.minimum_quantity is distinct from (line->>'minimum_quantity')::numeric or m.specification is distinct from coalesce(line->>'specification','') or current_price.amount is distinct from (line->>'price_amount')::numeric or current_price.basis_unit_id is distinct from basis then
    input_value=jsonb_build_object('code',btrim(line->>'code'),'name',btrim(line->>'name'),'category',line->>'category','purchase_unit_id',purchase,'basis_unit_id',basis,'price_amount',line->>'price_amount','minimum_quantity',line->>'minimum_quantity','specification',line->>'specification');
    perform public.save_material_table(m.id,m.version,input_value,gen_random_uuid());
    update_count=update_count+1;
   else
    unchanged_count=unchanged_count+1;
   end if;
  end if;
 end loop;

 result=jsonb_build_object('materials_created',new_count,'materials_updated',update_count,'materials_unchanged',unchanged_count);
 return private.finish_request(p_key,result);
end $$;

revoke all on function public.material_catalog_excel_export(date,integer,integer),public.import_material_catalog_excel(jsonb,uuid) from public,anon;
grant execute on function public.material_catalog_excel_export(date,integer,integer),public.import_material_catalog_excel(jsonb,uuid) to authenticated;

commit;
