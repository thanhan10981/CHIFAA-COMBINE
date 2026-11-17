export type CommercialSource={stores:{code:string;name:string;address:string;current_rate:string;raw:string[]}[];products:{code:string;name:string;unit:string;price:string;cost:string|null;raw:string[]}[];employees:{code:string;name:string;phone:string;hourly:string;note:string;raw:string[]}[];discounts:{code:string;date:string|null;rate:string;note:string;items:{code:string;eligible:boolean}[];raw:string[]}[];skipped:{entity:string;code:string;raw:string[]}[]};
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
export function parseCommercialSource(text:string):CommercialSource{
 const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.split('\t'));
 if(rows[0]?.[1]!=='Mã ĐB'||rows[0]?.[14]!=='Mã NV'||rows[0]?.[32]!=='Mã ĐB')throw new Error('Unexpected catalogue columns');
 const source:CommercialSource={stores:[],products:[],employees:[],discounts:[],skipped:[]};
 const money=(value:string)=>{const normalized=value.trim().replaceAll('.','');if(!/^\d{1,15}$/.test(normalized))throw new Error('Invalid source money');return normalized;};
 const rate=(value:string)=>{const raw=value.trim();if(!/^\d+(?:,\d+)?%?$/.test(raw))throw new Error('Invalid source percentage');const number=raw.replace('%','').replace(',','.');const digits=number.split('.');let scale=raw.endsWith('%')?2:0;scale+=(digits[1]?.length??0);const units=BigInt(digits.join(''));if(scale>6||units>10n**BigInt(scale))throw new Error('Out-of-range source percentage');return units.toString().padStart(scale+1,'0').slice(0,-scale||undefined)+(scale?'.'+units.toString().padStart(scale+1,'0').slice(-scale):'');};
 for(const cells of rows.slice(1)){
  const at=(i:number)=>(cells[i]??'').trim();
  if(at(1)){if(at(2))source.stores.push({code:at(1),name:at(2),address:at(3),current_rate:rate(at(4)),raw:cells.slice(0,5)});else source.skipped.push({entity:'stores',code:at(1),raw:cells.slice(0,5)});}
  if(at(7)&&/^\d+$/.test(at(6)))source.products.push({code:at(7),name:at(8),unit:at(9),price:money(at(10)),cost:at(11)?money(at(11)):null,raw:cells.slice(6,12)});
  if(at(14)){if(at(15))source.employees.push({code:at(14),name:at(15),phone:at(16),hourly:money(at(17)),note:at(18),raw:cells.slice(13,19)});else source.skipped.push({entity:'employees',code:at(14),raw:cells.slice(13,19)});}
  if(source.stores.some(s=>s.code===at(32)))source.discounts.push({code:at(32),date:at(34)||null,rate:rate(at(35)),note:at(36),items:rows[0].slice(37,48).map((code,i)=>{if(!['TRUE','FALSE'].includes(at(37+i)))throw new Error('Invalid source checkbox');return {code,eligible:at(37+i)==='TRUE'};}),raw:cells.slice(32)});
 }
 for(const key of ['stores','products','employees','discounts'] as const)if(new Set(source[key].map(row=>row.code)).size!==source[key].length)throw new Error('Duplicate source code');
 if(!source.stores.length||!source.products.length||!source.employees.length||source.discounts.length!==source.stores.length)throw new Error('Incomplete catalogue source');
 for(const policy of source.discounts)if(source.stores.find(s=>s.code===policy.code)?.current_rate.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')!==policy.rate.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,''))throw new Error('Store discount conflicts with matrix: '+policy.code+' '+source.stores.find(s=>s.code===policy.code)?.current_rate+' / '+policy.rate);
 if(source.discounts.some(d=>d.date!==null))throw new Error('Dated source policy requires explicit ISO date parsing');
 return source;
}
export function buildCommercialImport(source:CommercialSource,hash:string,date:string){
 if(!/^[a-f0-9]{64}$/.test(hash)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid import metadata');
 return `-- CHIFAA DEV: supplied stores/products/named employees/discount matrix.
-- Run AFTER CHIFAA_PATCH_DANH_MUC_DEV.sql (025), as postgres.
-- One atomic statement; preserves UUIDs. Existing conflicting metadata/terms stop everything.
-- Blank named slots are retained privately, not activated. No sales/payroll/inventory posting.
-- Prices/pay start on import date ${date}; blank discount date means always applicable.
-- Products remain unpublished. Original Cost is reference only. No cloud execution by generator.
do $catalog_import$
declare src jsonb=${literal(JSON.stringify(source))}::jsonb;r jsonb;i jsonb;target uuid;policy uuid;term_id uuid;found_row jsonb;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regprocedure('public.commercial_catalog(text,date,text,text,integer,integer)') is null then raise exception 'CATALOG_PATCH_025_REQUIRED';end if;
 perform set_config('lock_timeout','5s',true);perform pg_advisory_xact_lock(170025);
 if exists(select 1 from public.app_settings where key='commercial_import:${hash}') then return;end if;
 for r in select * from jsonb_array_elements(src->'stores') loop
  select to_jsonb(s) into found_row from public.stores s where code=r->>'code' for update;
  if found_row is null then insert into public.stores(code,name,address) values(r->>'code',r->>'name',nullif(r->>'address','')) returning id into target;
  else target=(found_row->>'id')::uuid;if found_row->>'name'<>r->>'name' or coalesce(found_row->>'address','')<>coalesce(r->>'address','') or not (found_row->>'active')::boolean then raise exception 'EXISTING_STORE_REVIEW: %',r->>'code';end if;end if;
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('stores',target,'${hash}',r);
 end loop;
 for r in select * from jsonb_array_elements(src->'products') loop
  select to_jsonb(p) into found_row from public.products p where code=r->>'code' for update;
  if found_row is null then insert into public.products(code,name,sale_unit) values(r->>'code',r->>'name',r->>'unit') returning id into target;
  else target=(found_row->>'id')::uuid;if found_row->>'name'<>r->>'name' or found_row->>'sale_unit'<>r->>'unit' or (found_row->>'archived')::boolean then raise exception 'EXISTING_PRODUCT_REVIEW: %',r->>'code';end if;end if;
  if exists(select 1 from public.product_prices where product_id=target and effective_from=${literal(date)}::date and price_vnd<>(r->>'price')::bigint) then raise exception 'EXISTING_PRICE_REVIEW: %',r->>'code';end if;
  insert into public.product_prices(product_id,price_vnd,effective_from,evidence) values(target,(r->>'price')::bigint,${literal(date)}::date,'Danh mục chủ sở hữu; SHA256 ${hash}') on conflict(product_id,effective_from) do nothing;
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('products',target,'${hash}',r);
 end loop;
 for r in select * from jsonb_array_elements(src->'employees') loop
  select to_jsonb(e) into found_row from public.employees e where code=r->>'code' for update;
  if found_row is null then insert into public.employees(code,name,phone,note,department_id) values(r->>'code',r->>'name',nullif(r->>'phone',''),nullif(r->>'note',''),null) returning id into target;
  else target=(found_row->>'id')::uuid;if found_row->>'name'<>r->>'name' or coalesce(found_row->>'phone','')<>coalesce(r->>'phone','') or not(found_row->>'active')::boolean then raise exception 'EXISTING_EMPLOYEE_REVIEW: %',r->>'code';end if;end if;
  if exists(select 1 from public.employee_pay_rates where employee_id=target and effective_from=${literal(date)}::date and(hourly_vnd<>(r->>'hourly')::bigint or daily_allowance_vnd<>0)) then raise exception 'EXISTING_PAY_REVIEW: %',r->>'code';end if;
  insert into public.employee_pay_rates(employee_id,hourly_vnd,daily_allowance_vnd,effective_from) values(target,(r->>'hourly')::bigint,0,${literal(date)}::date) on conflict(employee_id,effective_from) do nothing;
  select id into strict term_id from public.employee_pay_rates where employee_id=target and effective_from=${literal(date)}::date;
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('terms:pay',term_id,'${hash}',jsonb_build_object('original',r,'evidence','Danh mục gốc do chủ sở hữu cung cấp; phụ cấp chưa có trong nguồn; SHA256 ${hash}'));
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('employees',target,'${hash}',r);
 end loop;
 for r in select * from jsonb_array_elements(src->'discounts') loop
  select id into strict target from public.stores where code=r->>'code';
  if exists(select 1 from public.store_discount_policies where store_id=target) or exists(select 1 from public.store_discounts where store_id=target) then raise exception 'EXISTING_DISCOUNT_REVIEW: %',r->>'code';end if;
  insert into public.store_discount_policies(store_id,effective_from,common_rate,note,evidence) values(target,'0001-01-01',(r->>'rate')::numeric,r->>'note','Bảng CK gốc, ngày trống = luôn; SHA256 ${hash}') returning id into policy;
  for i in select * from jsonb_array_elements(r->'items') loop
   insert into public.store_discount_policy_items(policy_id,product_id,eligible) select policy,id,(i->>'eligible')::boolean from public.products where code=i->>'code';if not found then raise exception 'MISSING_PRODUCT: %',i->>'code';end if;
  end loop;
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('discounts',policy,'${hash}',r);
 end loop;
 insert into private.catalog_sources(entity,source_hash,source_data) values('skipped:blank_names','${hash}',src->'skipped');
 insert into public.app_settings(key,value) values('commercial_import:${hash}',jsonb_build_object('stores',jsonb_array_length(src->'stores'),'products',jsonb_array_length(src->'products'),'employees',jsonb_array_length(src->'employees'),'effective_from',${literal(date)},'posted',false));
end $catalog_import$;
select key,value from public.app_settings where key='commercial_import:${hash}';
`;
}
