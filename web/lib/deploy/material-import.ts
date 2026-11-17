export type MaterialImportRow={position:number;code:string;name:string;category:'ingredient'|'packaging';unit:string;amount:string|null;minimum:string|null;reference:string|null;specification:string};
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
export function buildMaterialImport(rows:MaterialImportRow[],sourceHash:string,effective:string){
 if(!rows.length||new Set(rows.map(row=>row.code)).size!==rows.length||!/^\d{4}-\d{2}-\d{2}$/.test(effective)||!/^[a-f0-9]{64}$/.test(sourceHash))throw new Error('Invalid material source');
 for(const row of rows)if(!row.code||!row.name||!['ingredient','packaging'].includes(row.category)||!['kg','túi','vỉ','bì','can','chai','cái','quả'].includes(row.unit)||[row.amount,row.minimum,row.reference].some(value=>value!==null&&!/^\d+(?:\.\d{1,6})?$/.test(value)))throw new Error('Invalid material row');
 return `-- CHIFAA DEV: user-provided material catalogue only; no inventory posting.
-- Run AFTER CHIFAA_PATCH_MATERIALS_DEV.sql. Existing codes retain their UUIDs.
-- Explicit zero prices are retained as unverified; blank values remain NULL.
-- Positive prices use the exact stated purchase unit, effective ${effective}.
-- Unknown package conversions stay unverified. No volume-to-mass assumption.
-- All import writes run atomically in ONE DO statement; no temporary table/session dependency.
do $import$
declare source_rows jsonb=${literal(JSON.stringify(rows))}::jsonb;
 r record; unit_id uuid; target_material uuid; old_row public.materials; price public.material_prices; to_id uuid; ratio numeric; is_verified boolean;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform set_config('lock_timeout','5s',true);
 if to_regprocedure('public.material_catalog(date,text,text,integer,integer)') is null then raise exception 'MATERIAL_PATCH_023_REQUIRED';end if;
 perform pg_advisory_xact_lock(170024);
 if exists(select 1 from public.app_settings where key='material_import:${sourceHash}') then return;end if;
 if jsonb_array_length(source_rows)<>${rows.length} then raise exception 'SOURCE_ROW_COUNT';end if;
 for r in select * from (values ('kg','Kilôgam','mass'),('g','Gam','mass'),('l','Lít','volume'),('túi','Túi','package'),('vắt','Vắt','count'),('vỉ','Vỉ','package'),('quả','Quả','count'),('bì','Bì','package'),('lá','Lá','count'),('can','Can','package'),('chai','Chai','package'),('cái','Cái','count')) u(code,name,dimension) loop
  if exists(select 1 from public.material_units where code=r.code and (dimension<>r.dimension or archived)) then raise exception 'EXISTING_UNIT_CONFLICT: %',r.code;end if;
  insert into public.material_units(code,name,dimension) values(r.code,r.name,r.dimension) on conflict(code) do nothing;
 end loop;
 for r in select * from jsonb_to_recordset(source_rows) as source(position integer,code text,name text,category text,unit text,amount numeric,minimum numeric,reference numeric,specification text) order by position loop
  select id into strict unit_id from public.material_units where code=r.unit;
  select * into old_row from public.materials where code=r.code for update;
  if old_row.archived then raise exception 'ARCHIVED_MATERIAL_REVIEW: %',r.code;end if;
  if old_row.id is not null and (old_row.usage_unit_id is distinct from unit_id or old_row.purchase_unit_id is distinct from unit_id) and (exists(select 1 from public.inventory_movement_lines where material_id=old_row.id) or exists(select 1 from public.recipe_items where material_id=old_row.id)) then raise exception 'UNIT_MIGRATION_REQUIRED: %',r.code;end if;
  insert into public.materials(code,name,category,purchase_unit_id,usage_unit_id,minimum_quantity,source_unit_label,specification,reference_quantity,catalog_order)
  values(r.code,r.name,r.category,unit_id,unit_id,r.minimum,r.unit,r.specification,r.reference,r.position)
  on conflict(code) do update set name=excluded.name,category=excluded.category,purchase_unit_id=excluded.purchase_unit_id,usage_unit_id=excluded.usage_unit_id,minimum_quantity=excluded.minimum_quantity,source_unit_label=excluded.source_unit_label,specification=excluded.specification,reference_quantity=excluded.reference_quantity,catalog_order=excluded.catalog_order returning id into target_material;
  select * into price from public.material_prices where material_prices.material_id=target_material and effective_from=${literal(effective)}::date;
  if price.id is not null then
   if price.amount is distinct from r.amount or price.basis_unit_id is distinct from unit_id or price.verification is distinct from (case when r.amount>0 then 'verified' else 'needs_verification' end) then raise exception 'EXISTING_PRICE_CONFLICT: %',r.code;end if;
  else
   insert into public.material_prices(material_id,basis_unit_id,amount,effective_from,verification,source_reference) values(target_material,unit_id,r.amount,${literal(effective)}::date,case when r.amount>0 then 'verified' else 'needs_verification' end,'Danh mục do chủ sở hữu cung cấp; SHA256 ${sourceHash}; giá đúng ĐVT ghi trong nguồn');
  end if;
  update public.materials set price_status=case when r.amount>0 then 'verified' else 'needs_verification' end where id=target_material;
  -- Only ratios explicitly stated in the source; SI mass conversion is built in.
  ratio=null;to_id=null;is_verified=true;
  if r.specification='1 túi = 16 vắt' then ratio=16;select id into to_id from public.material_units where code='vắt';
  elsif r.specification='250 g/chai' then ratio=250;select id into to_id from public.material_units where code='g';
  elsif r.specification='2,2 kg/can' then ratio=2.2;select id into to_id from public.material_units where code='kg';
  elsif r.specification='5 lít/can — chưa có quy đổi khối lượng' then ratio=5;select id into to_id from public.material_units where code='l';
  elsif r.specification='30 quả/vỉ (cần xác nhận)' then ratio=30;is_verified=false;select id into to_id from public.material_units where code='quả';
  elsif r.specification='100 lá/bì (cần xác nhận)' then ratio=100;is_verified=false;select id into to_id from public.material_units where code='lá';end if;
  if ratio is not null then
   if exists(select 1 from public.unit_conversions c where c.material_id=target_material and c.from_unit_id=unit_id and c.to_unit_id=to_id and (c.factor<>ratio or c.verified<>is_verified)) then raise exception 'EXISTING_CONVERSION_CONFLICT: %',r.code;end if;
   insert into public.unit_conversions(material_id,from_unit_id,to_unit_id,factor,verified,evidence) values(target_material,unit_id,to_id,ratio,is_verified,'Nguồn chủ sở hữu: '||r.specification||'; SHA256 ${sourceHash}') on conflict(material_id,from_unit_id,to_unit_id) do nothing;
  end if;
 end loop;
 insert into public.app_settings(key,value) values('material_import:${sourceHash}',jsonb_build_object('rows',${rows.length},'effective_from',${literal(effective)},'inventory_posted',false,'source_hash','${sourceHash}'));
end $import$;
select count(*) imported_codes from public.materials where code in (select code from jsonb_to_recordset(${literal(JSON.stringify(rows.map(({code})=>({code}))))}::jsonb) r(code text));
`;
}
