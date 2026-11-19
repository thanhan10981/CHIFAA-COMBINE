begin;

-- Creating a material with a price must not inspect an unassigned record that
-- is only populated by the edit path.
create or replace function public.save_material_table(p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; m public.materials; current_price_amount numeric; current_price_basis uuid; previous public.material_resolutions;
 result jsonb; row_id uuid; purchase uuid; basis uuid; amount numeric; changed boolean; today date=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not private.can('materials',case when p_id is null then 'create' else 'edit' end) then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['code','name','category','purchase_unit_id','basis_unit_id','price_amount','minimum_quantity','specification'])) then raise exception 'INVALID_FIELDS';end if;
 if p_input->>'price_amount' is not null and(p_input->>'price_amount')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_PRICE';end if;
 cached=private.begin_request(p_key,'material:table',jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached;end if;
 if p_id is not null then
  perform pg_advisory_xact_lock(hashtextextended('units:'||p_id::text,0));
  select * into strict m from public.materials where id=p_id for update;
  if p_expected_version is null or m.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
  select p.amount,p.basis_unit_id into current_price_amount,current_price_basis from private.effective_material_price(p_id,today) p;
 end if;
 purchase=(p_input->>'purchase_unit_id')::uuid;basis=(p_input->>'basis_unit_id')::uuid;amount=(p_input->>'price_amount')::numeric;
 if p_id is null then changed=amount is not null;
 else changed=current_price_amount is distinct from amount or current_price_basis is distinct from basis or m.purchase_unit_id is distinct from purchase;
 end if;
 if changed and(not private.can('admin','manage') or not private.can('materials','approve')) then raise exception 'FORBIDDEN_VERIFICATION';end if;
 -- Start with the old units so resolved identity and historical-unit guards stay active.
 result=public.save_material(p_id,p_expected_version,jsonb_build_object('code',p_input->>'code','name',p_input->>'name','category',p_input->>'category','purchase_unit_id',coalesce(m.purchase_unit_id,purchase),'usage_unit_id',coalesce(m.usage_unit_id,purchase),'minimum_quantity',p_input->>'minimum_quantity','source_unit_label',coalesce(m.source_unit_label,''),'specification',coalesce(p_input->>'specification','')),null,gen_random_uuid());
 row_id=(result->>'id')::uuid;
 if changed then
  select * into previous from public.material_resolutions where material_id=row_id order by effective_from desc,revision desc limit 1;
  if previous.id is null then
   select from_unit_id,to_unit_id,factor,verified into previous.package_unit_id,previous.package_content_unit_id,previous.package_quantity,previous.package_verified
   from public.unit_conversions where material_id=row_id and from_unit_id=purchase and to_unit_id=coalesce(m.usage_unit_id,purchase) limit 1;
  end if;
  -- A catalog edit records its true origin. It never claims a source document was checked.
  perform public.resolve_material(row_id,(result->>'version')::bigint,today,jsonb_build_object(
   'purchase_unit_id',purchase,'usage_unit_id',coalesce(m.usage_unit_id,purchase),'basis_unit_id',basis,'amount',amount,'verification','needs_verification',
   'package_unit_id',previous.package_unit_id,'package_content_unit_id',previous.package_content_unit_id,'package_quantity',previous.package_quantity,'package_verified',coalesce(previous.package_verified,false),
   'evidence','Direct edit of material catalog columns; no document verification asserted.','issue',''),gen_random_uuid());
 end if;
 return private.finish_request(p_key,(select jsonb_build_object('id',id,'version',version::text) from public.materials where id=row_id));
end $$;

revoke all on function public.save_material_table(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_material_table(uuid,bigint,jsonb,uuid) to authenticated;

commit;
