begin;
alter table public.materials add column source_unit_label text not null default '',
 add column specification text not null default '',
 add column reference_quantity numeric(20,6) check(reference_quantity>=0),
 add column catalog_order integer check(catalog_order>0);

create function public.material_catalog(p_date date,p_search text default '',p_category text default '',p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; metrics jsonb; rows jsonb; total bigint;
begin
 if not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_search,''))>100 then raise exception 'INVALID_FILTER';end if;
 select jsonb_build_object('total',count(*),'kg',count(*) filter(where u.code='kg'),'categories',count(distinct m.category),'unpriced',count(*) filter(where price.amount is null or price.verification<>'verified')) into metrics
 from public.materials m left join public.material_units u on u.id=m.purchase_unit_id
 left join lateral(select p.amount,p.verification from public.material_prices p where p.material_id=m.id and p.effective_from<=p_date and (p.effective_to is null or p.effective_to>=p_date) order by p.effective_from desc limit 1) price on true where not m.archived;
 select count(*) into total from public.materials m where not archived and (coalesce(p_search,'')='' or m.code ilike '%'||p_search||'%' or m.name ilike '%'||p_search||'%') and (coalesce(p_category,'')='' or m.category=p_category);
 select coalesce(jsonb_agg(to_jsonb(page) order by page.catalog_order nulls last,page.code),'[]') into rows from (
  select m.id,m.version::text,m.code,m.name,m.category,m.purchase_unit_id,m.usage_unit_id,m.minimum_quantity::text,m.source_unit_label,m.specification,m.reference_quantity::text,m.catalog_order,
   u.code unit_code,s.code usage_unit_code,price.amount::text price_amount,price.basis_unit_id,price.effective_from price_date,price.verification price_verification,
   case when private.can('inventory','view') then (select sum(l.quantity)::text from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id join public.warehouses w on w.id=v.warehouse_id where l.material_id=m.id and w.kind='ingredient' and v.moved_on<=p_date) end stock_quantity,
   case when private.can('inventory','view') then m.reference_quantity::text end stock_reference,
   coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'from',a.code,'to',b.code,'factor',c.factor::text,'verified',c.verified,'evidence',c.evidence) order by a.code,b.code) from public.unit_conversions c join public.material_units a on a.id=c.from_unit_id join public.material_units b on b.id=c.to_unit_id where c.material_id=m.id),'[]') conversions
  from public.materials m left join public.material_units u on u.id=m.purchase_unit_id left join public.material_units s on s.id=m.usage_unit_id
  left join lateral(select p.amount,p.basis_unit_id,p.effective_from,p.verification from public.material_prices p where p.material_id=m.id and p.effective_from<=p_date and (p.effective_to is null or p.effective_to>=p_date) order by p.effective_from desc limit 1) price on true
  where not m.archived and (coalesce(p_search,'')='' or m.code ilike '%'||p_search||'%' or m.name ilike '%'||p_search||'%') and (coalesce(p_category,'')='' or m.category=p_category)
  order by m.catalog_order nulls last,m.code,m.id limit p_limit offset p_offset
 ) page;
 return jsonb_build_object('metrics',metrics,'rows',rows,'total',total::text);
end $$;

create function public.save_material(p_id uuid,p_expected_version bigint,p_input jsonb,p_price jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_row public.materials; row_id uuid=coalesce(p_id,gen_random_uuid()); effective date; existing public.material_prices; amount numeric; verified text; basis uuid;
begin
 if not private.can('materials',case when p_id is null then 'create' else 'edit' end) then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['code','name','category','purchase_unit_id','usage_unit_id','minimum_quantity','source_unit_label','specification'])) then raise exception 'INVALID_FIELDS';end if;
 if p_price is not null and (jsonb_typeof(p_price) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_price) k where k<>all(array['amount','effective_from','verification','source_reference']))) then raise exception 'INVALID_PRICE_FIELDS';end if;
 if p_price->>'verification'='verified' and not private.can('materials','approve') then raise exception 'FORBIDDEN_VERIFICATION';end if;
 cached=private.begin_request(p_key,'material:save',jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input,'price',p_price));if cached is not null then return cached;end if;
 if p_id is not null then
  select * into strict current_row from public.materials where id=p_id for update;
  if p_expected_version is null or current_row.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
  if (current_row.usage_unit_id is distinct from (p_input->>'usage_unit_id')::uuid or current_row.purchase_unit_id is distinct from (p_input->>'purchase_unit_id')::uuid) and (exists(select 1 from public.inventory_movement_lines where material_id=p_id) or exists(select 1 from public.recipe_items where material_id=p_id)) then raise exception 'UNIT_MIGRATION_REQUIRED';end if;
 end if;
 if coalesce(p_input->>'category','')<>all(array['ingredient','packaging','main_ingredient','spice','finished_sauce','auxiliary','other']) then raise exception 'INVALID_CATEGORY';end if;
 basis=(p_input->>'purchase_unit_id')::uuid;
 if p_id is not null and current_row.purchase_unit_id is distinct from basis and p_price is null then raise exception 'PRICE_BASIS_REQUIRED';end if;
 if p_input->>'minimum_quantity' is not null and (p_input->>'minimum_quantity')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_QUANTITY';end if;
 if p_price->>'amount' is not null and (p_price->>'amount')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_PRICE';end if;
 if not exists(select 1 from public.material_units where id=basis and not archived) or not exists(select 1 from public.material_units where id=(p_input->>'usage_unit_id')::uuid and not archived) then raise exception 'ACTIVE_UNITS_REQUIRED';end if;
 if length(trim(coalesce(p_input->>'code',''))) not between 1 and 64 or length(trim(coalesce(p_input->>'name',''))) not between 1 and 250 or length(coalesce(p_input->>'source_unit_label',''))>250 or length(coalesce(p_input->>'specification',''))>1000 then raise exception 'INVALID_MATERIAL';end if;
 if p_id is null then
  insert into public.materials(id,code,name,category,purchase_unit_id,usage_unit_id,minimum_quantity,source_unit_label,specification)
  values(row_id,trim(p_input->>'code'),trim(p_input->>'name'),p_input->>'category',basis,(p_input->>'usage_unit_id')::uuid,(p_input->>'minimum_quantity')::numeric,coalesce(p_input->>'source_unit_label',''),coalesce(p_input->>'specification',''));
 else
  update public.materials set code=trim(p_input->>'code'),name=trim(p_input->>'name'),category=p_input->>'category',purchase_unit_id=basis,usage_unit_id=(p_input->>'usage_unit_id')::uuid,minimum_quantity=(p_input->>'minimum_quantity')::numeric,source_unit_label=coalesce(p_input->>'source_unit_label',''),specification=coalesce(p_input->>'specification','') where id=row_id;
 end if;
 if p_price is not null then
  effective=(p_price->>'effective_from')::date;amount=(p_price->>'amount')::numeric;verified=p_price->>'verification';
  if effective is null or verified is null or verified<>all(array['verified','needs_verification']) or amount<0 or (verified='verified' and amount is null) or length(trim(coalesce(p_price->>'source_reference','')))<5 then raise exception 'INVALID_PRICE';end if;
  select * into existing from public.material_prices where material_id=row_id and effective_from=effective for update;
  if existing.id is not null then
   if existing.amount is distinct from amount or existing.basis_unit_id is distinct from basis or existing.verification is distinct from verified then raise exception 'PRICE_DATE_EXISTS: choose a new effective date; preserve price history';end if;
  else
   insert into public.material_prices(material_id,basis_unit_id,amount,effective_from,verification,source_reference) values(row_id,basis,amount,effective,verified,p_price->>'source_reference');
  end if;
  update public.materials set price_status=verified where id=row_id;
 end if;
 return private.finish_request(p_key,(select jsonb_build_object('id',id,'version',version::text) from public.materials where id=row_id));
end $$;
revoke all on function public.material_catalog(date,text,text,integer,integer),public.save_material(uuid,bigint,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.material_catalog(date,text,text,integer,integer),public.save_material(uuid,bigint,jsonb,jsonb,uuid) to authenticated;
commit;
