import type {MaterialImportRow} from './material-import';
export type ReconciledMaterial=MaterialImportRow & {
 purchase:string;usage:string;basis:string|null;verification:'verified'|'needs_verification';
 packageUnit:string|null;contentUnit:string|null;packageQuantity:string|null;packageVerified:boolean;
 minimumInUsage:string|null;issue:string;original:Record<string,unknown>;
};
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
export function buildMaterialReconciliation(rows:ReconciledMaterial[],hash:string,effective:string){
 if(!rows.length||new Set(rows.map(row=>row.code)).size!==rows.length||!/^[a-f0-9]{64}$/.test(hash)||!/^\d{4}-\d{2}-\d{2}$/.test(effective))throw new Error('Invalid reconciliation source');
 const known=['kg','g','l','ml','túi','vắt','vỉ','quả','bì','lá','can','chai','cái'];
 for(const row of rows){
  if(!['ingredient','packaging'].includes(row.category)||[row.purchase,row.usage,...[row.basis,row.packageUnit,row.contentUnit].filter((unit):unit is string=>unit!==null)].some(unit=>!known.includes(unit))||[row.amount,row.minimum,row.reference,row.minimumInUsage,row.packageQuantity].some(value=>value!==null&&!/^\d+(?:\.\d{1,9})?$/.test(value))||(row.verification==='verified'&&(!row.basis||row.amount===null)))throw new Error('Invalid reconciliation row');
 }
 return `-- CHIFAA DEV: original catalogue plus owner clarification. Run AFTER patch024.
-- One atomic DO, append-only resolutions, stable material IDs, no inventory posting.
-- Original values and the previous installed records are retained in source_data/audit.
do $reconcile$
declare source_rows jsonb=${literal(JSON.stringify(rows))}::jsonb;
 r record; old_row public.materials; material uuid; buy uuid; use_unit uuid; basis uuid; pack uuid; content uuid; has_history boolean; previous_data jsonb;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regclass('public.material_resolutions') is null then raise exception 'MATERIAL_VERIFICATION_PATCH_024_REQUIRED';end if;
 perform set_config('lock_timeout','5s',true);perform pg_advisory_xact_lock(170024);
 if exists(select 1 from public.app_settings where key='material_reconciliation:${hash}') then return;end if;
 for r in select * from (values('kg','Kilôgam','mass'),('g','Gam','mass'),('l','Lít','volume'),('ml','Mililít','volume'),('túi','Túi','package'),('vắt','Vắt','count'),('vỉ','Vỉ','package'),('quả','Quả','count'),('bì','Bì','package'),('lá','Lá','count'),('can','Can','package'),('chai','Chai','package'),('cái','Cái','count')) u(code,name,dimension) loop
  if exists(select 1 from public.material_units where code=r.code and(dimension<>r.dimension or archived)) then raise exception 'EXISTING_UNIT_CONFLICT: %',r.code;end if;
  insert into public.material_units(code,name,dimension) values(r.code,r.name,r.dimension) on conflict(code) do nothing;
 end loop;
 for r in select * from jsonb_to_recordset(source_rows) as source(position integer,code text,name text,category text,amount numeric,minimum numeric,reference numeric,specification text,purchase text,usage text,basis text,verification text,"packageUnit" text,"contentUnit" text,"packageQuantity" numeric,"packageVerified" boolean,"minimumInUsage" numeric,issue text,original jsonb) order by position loop
  select * into old_row from public.materials where code=r.code for update;
  if old_row.archived then raise exception 'ARCHIVED_MATERIAL_REVIEW: %',r.code;end if;
  if exists(select 1 from public.material_resolutions where material_id=old_row.id) then raise exception 'RESOLUTION_ALREADY_EXISTS: preserve review for %',r.code;end if;
  select id into strict buy from public.material_units where code=r.purchase;select id into strict use_unit from public.material_units where code=r.usage;
  select id into basis from public.material_units where code=r.basis;select id into pack from public.material_units where code=r."packageUnit";select id into content from public.material_units where code=r."contentUnit";
  has_history=exists(select 1 from public.inventory_movement_lines where material_id=old_row.id) or exists(select 1 from public.recipe_items where material_id=old_row.id);
  previous_data=jsonb_build_object('original',r.original,'clarification',to_jsonb(r),'previous_material',to_jsonb(old_row),'previous_prices',coalesce((select jsonb_agg(to_jsonb(p)) from public.material_prices p where p.material_id=old_row.id),'[]'),'previous_conversions',coalesce((select jsonb_agg(to_jsonb(c)) from public.unit_conversions c where c.material_id=old_row.id),'[]'),'historical_postings_require_review',has_history,'source_hash','${hash}');
  insert into public.materials(code,name,category,purchase_unit_id,usage_unit_id,minimum_quantity,source_unit_label,specification,reference_quantity,catalog_order,price_status)
  values(r.code,r.name,r.category,buy,use_unit,r."minimumInUsage",r.original->>'unit',r.specification,r.reference,r.position,r.verification)
  on conflict(code) do update set name=excluded.name,category=excluded.category,purchase_unit_id=excluded.purchase_unit_id,
   usage_unit_id=case when has_history then public.materials.usage_unit_id else excluded.usage_unit_id end,
   minimum_quantity=case when has_history and public.materials.usage_unit_id is distinct from excluded.usage_unit_id then public.materials.minimum_quantity else excluded.minimum_quantity end,
   source_unit_label=excluded.source_unit_label,specification=excluded.specification,reference_quantity=excluded.reference_quantity,catalog_order=excluded.catalog_order,price_status=case when has_history and public.materials.usage_unit_id is distinct from excluded.usage_unit_id then 'needs_verification' else excluded.price_status end returning id into material;
  insert into public.material_resolutions(material_id,effective_from,purchase_unit_id,usage_unit_id,basis_unit_id,amount,verification,package_unit_id,package_content_unit_id,package_quantity,package_verified,issue,evidence,source_data)
  values(material,${literal(effective)}::date,buy,use_unit,basis,r.amount,r.verification,pack,content,r."packageQuantity",r."packageVerified",r.issue||case when has_history and old_row.usage_unit_id is distinct from use_unit then ' · Cần chuyển đổi đơn vị có lịch sử' else '' end,'Danh mục gốc và giải thích của chủ sở hữu ngày ${effective}',previous_data);
 end loop;
 insert into public.app_settings(key,value) values('material_reconciliation:${hash}',jsonb_build_object('rows',${rows.length},'effective_from',${literal(effective)},'inventory_posted',false));
end $reconcile$;
select m.code,m.name,p.amount::text,coalesce(u.code,'Chưa xác định') price_unit,p.verification,p.issue from public.materials m cross join lateral private.effective_material_price(m.id,${literal(effective)}::date) p left join public.material_units u on u.id=p.basis_unit_id where m.code in(select value->>'code' from jsonb_array_elements(${literal(JSON.stringify(rows.map(({code})=>({code}))))}::jsonb)) order by m.catalog_order;
`;
}
