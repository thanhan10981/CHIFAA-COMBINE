begin;

-- Material packaging is stored as a dated, structured resolution and is the
-- same conversion used by recipe costing and inventory normalization.
create or replace function public.save_material_table(p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 cached jsonb; m public.materials; current_price_amount numeric; current_price_basis uuid; previous public.material_resolutions;
 result jsonb; row_id uuid; purchase uuid; usage uuid; basis uuid; amount numeric; changed boolean; price_changed boolean; usage_changed boolean;
 package_unit uuid; package_content uuid; package_amount numeric; package_verified boolean; package_supplied boolean;
 package_evidence text; spec text; base_usage uuid; base_minimum numeric; today date=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not private.can('materials',case when p_id is null then 'create' else 'edit' end) then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['code','name','category','purchase_unit_id','usage_unit_id','basis_unit_id','price_amount','minimum_quantity','specification','package_content_unit_id','package_quantity','package_verified','package_evidence'])) then raise exception 'INVALID_FIELDS';end if;
 if p_input->>'price_amount' is not null and(p_input->>'price_amount')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_PRICE';end if;
 if p_input->>'minimum_quantity' is not null and(p_input->>'minimum_quantity')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_QUANTITY';end if;
 if p_input->>'package_quantity' is not null and(p_input->>'package_quantity')!~'^[0-9]+([.][0-9]{1,9})?$' then raise exception 'INVALID_PACKAGE';end if;
 cached=private.begin_request(p_key,'material:table',jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached;end if;
 if p_id is not null then
  perform pg_advisory_xact_lock(hashtextextended('units:'||p_id::text,0));
  select * into strict m from public.materials where id=p_id for update;
  if p_expected_version is null or m.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
  select p.amount,p.basis_unit_id into current_price_amount,current_price_basis from private.effective_material_price(p_id,today) p;
  select * into previous from public.material_resolutions where material_id=p_id and effective_from<=today order by effective_from desc,revision desc limit 1;
  if previous.id is null then
   select from_unit_id,to_unit_id,factor,verified,evidence into previous.package_unit_id,previous.package_content_unit_id,previous.package_quantity,previous.package_verified,previous.evidence
    from public.unit_conversions where material_id=p_id and from_unit_id=m.purchase_unit_id and to_unit_id=m.usage_unit_id limit 1;
  end if;
 end if;
 purchase=nullif(p_input->>'purchase_unit_id','')::uuid;
 usage=coalesce(nullif(p_input->>'usage_unit_id','')::uuid,coalesce(m.usage_unit_id,purchase));
 basis=coalesce(nullif(p_input->>'basis_unit_id','')::uuid,purchase);
 amount=(p_input->>'price_amount')::numeric;
 package_supplied=p_input ? 'package_quantity' or p_input ? 'package_content_unit_id' or p_input ? 'package_verified';
 package_amount=(p_input->>'package_quantity')::numeric;
 package_content=nullif(p_input->>'package_content_unit_id','')::uuid;
 package_verified=coalesce((p_input->>'package_verified')::boolean,false);
 package_evidence=trim(coalesce(p_input->>'package_evidence',''));
 if purchase is null or usage is null or basis is null or not exists(select 1 from public.material_units where id=purchase and not archived) or not exists(select 1 from public.material_units where id=usage and not archived) or not exists(select 1 from public.material_units where id=basis and not archived) then raise exception 'ACTIVE_UNITS_REQUIRED';end if;
 if package_amount is not null and(package_amount<=0 or package_content is null or purchase=package_content) then raise exception 'INVALID_PACKAGE';end if;
 if package_amount is null and(package_content is not null or package_verified) then raise exception 'INVALID_PACKAGE';end if;
 if package_verified and length(package_evidence)<5 then raise exception 'PACKAGE_EVIDENCE_REQUIRED';end if;
 usage_changed=p_id is not null and m.usage_unit_id is distinct from usage;
 price_changed=case when p_id is null then amount is not null else current_price_amount is distinct from amount or current_price_basis is distinct from basis or m.purchase_unit_id is distinct from purchase end;
 changed=price_changed or usage_changed or (p_id is null and package_amount is not null) or
  (package_supplied and (previous.package_unit_id is distinct from case when package_amount is null then null else purchase end or
   previous.package_content_unit_id is distinct from package_content or previous.package_quantity is distinct from package_amount or
   coalesce(previous.package_verified,false) is distinct from package_verified or (package_amount is not null and package_evidence<>'' and previous.evidence is distinct from package_evidence)));
 if changed and(not private.can('admin','manage') or not private.can('materials','approve')) then raise exception 'FORBIDDEN_VERIFICATION';end if;
 if package_verified and not private.can('materials','approve') then raise exception 'FORBIDDEN_VERIFICATION';end if;
 if length(trim(coalesce(p_input->>'code',''))) not between 1 and 64 or length(trim(coalesce(p_input->>'name',''))) not between 1 and 250 then raise exception 'INVALID_MATERIAL';end if;
 if package_supplied then
  spec=case when package_amount is null then '' else
   '1 '||(select code from public.material_units where id=purchase)||' = '||package_amount::text||' '||(select code from public.material_units where id=package_content)||case when package_verified then '' else ' · Chờ xác minh' end end;
 else spec=coalesce(p_input->>'specification','');end if;
 base_usage=coalesce(m.usage_unit_id,usage);
 base_minimum=case when usage_changed then m.minimum_quantity else (p_input->>'minimum_quantity')::numeric end;
 -- Keep old units through the metadata edit; resolve_material applies the
 -- dated conversion and updates the current unit in this same transaction.
 result=public.save_material(p_id,p_expected_version,jsonb_build_object(
  'code',p_input->>'code','name',p_input->>'name','category',p_input->>'category',
  'purchase_unit_id',coalesce(m.purchase_unit_id,purchase),'usage_unit_id',base_usage,
  'minimum_quantity',base_minimum::text,'source_unit_label',coalesce(m.source_unit_label,''),'specification',spec
 ),null,gen_random_uuid());
 row_id=(result->>'id')::uuid;
 if changed then
  if not package_supplied then
   package_unit=previous.package_unit_id;package_content=previous.package_content_unit_id;package_amount=previous.package_quantity;package_verified=coalesce(previous.package_verified,false);package_evidence=coalesce(previous.evidence,'');
  else package_unit=case when package_amount is null then null else purchase end;end if;
  perform public.resolve_material(row_id,(result->>'version')::bigint,today,jsonb_build_object(
   'purchase_unit_id',purchase,'usage_unit_id',usage,'basis_unit_id',basis,'amount',amount,
   'verification',case when price_changed then 'needs_verification' else coalesce(previous.verification,'needs_verification') end,
   'package_unit_id',package_unit,'package_content_unit_id',package_content,'package_quantity',package_amount,'package_verified',coalesce(package_verified,false),
   'evidence',case when package_supplied and package_evidence<>'' then package_evidence else coalesce(previous.evidence,'Direct catalog edit; no price document verification asserted.') end,
   'issue',''
  ),gen_random_uuid());
  if usage_changed then update public.materials set minimum_quantity=(p_input->>'minimum_quantity')::numeric where id=row_id;end if;
 end if;
 return private.finish_request(p_key,(select jsonb_build_object('id',id,'version',version::text) from public.materials where id=row_id));
end $$;

-- Return the latest effective structured package rule in the catalog so the
-- editor and recipe-facing labels do not rely on user-authored free text.
do $patch$
declare definition text; old_select text; new_select text; old_join text; new_join text;
begin
 old_select='m.source_unit_label,m.specification,m.reference_quantity::text,m.catalog_order,';
 new_select='m.source_unit_label,m.specification,m.reference_quantity::text,m.catalog_order,package.package_unit_id,package.package_content_unit_id,package.package_quantity::text package_quantity,package.package_verified,package.package_content_unit_code,package.package_evidence,';
 old_join='left join public.material_units s on s.id=m.usage_unit_id';
 new_join=old_join||' left join lateral(select rules.package_unit_id,rules.package_content_unit_id,rules.package_quantity,rules.package_verified,case when rules.package_verified then rules.evidence end package_evidence,c.code package_content_unit_code from(select r.package_unit_id,r.package_content_unit_id,r.package_quantity,r.package_verified,r.evidence,r.effective_from,r.revision,1 source_order from public.material_resolutions r where r.material_id=m.id and r.effective_from<=p_date union all select u.from_unit_id,u.to_unit_id,u.factor,u.verified,u.evidence,u.effective_from,u.version,0 from public.unit_conversions u where u.material_id=m.id and u.from_unit_id=m.purchase_unit_id and u.to_unit_id=m.usage_unit_id and u.effective_from<=p_date) rules left join public.material_units c on c.id=rules.package_content_unit_id order by rules.effective_from desc,rules.source_order desc,rules.revision desc limit 1) package on true';
 select pg_get_functiondef('public.material_catalog(date,text,text,integer,integer)'::regprocedure) into definition;
 if strpos(definition,old_select)=0 or strpos(definition,old_join)=0 then raise exception 'MATERIAL_CATALOG_PACKAGE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_select,new_select);execute replace(definition,old_join,new_join);
 select pg_get_functiondef('public.material_catalog_sorted(date,text,text,text,integer,integer)'::regprocedure) into definition;
 if strpos(definition,old_select)=0 or strpos(definition,old_join)=0 then raise exception 'MATERIAL_CATALOG_SORTED_PACKAGE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_select,new_select);execute replace(definition,old_join,new_join);
end $patch$;

revoke all on function public.save_material_table(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_material_table(uuid,bigint,jsonb,uuid) to authenticated;

commit;
