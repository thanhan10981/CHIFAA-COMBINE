begin;

-- If a verified price arrives without an explicit basis, use the already
-- selected purchase unit (for example 12,000 VND / bag). Never infer a
-- different unit or price from package conversion data.
create or replace function public.resolve_material(p_material uuid,p_expected_version bigint,p_effective date,p_input jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; m public.materials; previous public.material_resolutions; result uuid; purchase uuid; usage uuid; basis uuid; amount numeric; verified text; pack_unit uuid; pack_content uuid; pack_amount numeric; pack_verified boolean; evidence text;
begin
 if not private.can('admin','manage') or not private.can('materials','approve') then raise exception 'FORBIDDEN';end if;
 if p_effective is null or jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['purchase_unit_id','usage_unit_id','basis_unit_id','amount','verification','package_unit_id','package_content_unit_id','package_quantity','package_verified','evidence','issue'])) then raise exception 'INVALID_RESOLUTION';end if;
 cached=private.begin_request(p_key,'material:resolve',jsonb_build_object('material',p_material,'version',p_expected_version,'effective',p_effective,'input',p_input));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended('units:'||p_material::text,0));
 select * into strict m from public.materials where id=p_material for update;
 if p_expected_version is null or m.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 select * into previous from public.material_resolutions where material_id=p_material order by effective_from desc,revision desc limit 1;
 if previous.id is not null and p_effective<previous.effective_from then raise exception 'EFFECTIVE_DATE_BEFORE_LATEST_REVIEW';end if;
 purchase=(p_input->>'purchase_unit_id')::uuid;usage=(p_input->>'usage_unit_id')::uuid;basis=coalesce((p_input->>'basis_unit_id')::uuid,purchase);
 if p_effective>(now() at time zone 'Asia/Ho_Chi_Minh')::date and(m.usage_unit_id is distinct from usage or m.purchase_unit_id is distinct from purchase) then raise exception 'FUTURE_UNIT_CHANGE_REQUIRES_MIGRATION';end if;
 if m.usage_unit_id is distinct from usage and(exists(select 1 from public.inventory_movement_lines where material_id=p_material) or exists(select 1 from public.recipe_items where material_id=p_material)) then raise exception 'UNIT_MIGRATION_REQUIRED';end if;
 if exists(select 1 from unnest(array[purchase,usage,basis,(p_input->>'package_unit_id')::uuid,(p_input->>'package_content_unit_id')::uuid]) x where x is not null and not exists(select 1 from public.material_units where id=x and not archived)) or purchase is null or usage is null then raise exception 'ACTIVE_UNITS_REQUIRED';end if;
 if p_input->>'amount' is not null and (p_input->>'amount')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_PRICE';end if;
 if p_input->>'package_quantity' is not null and (p_input->>'package_quantity')!~'^[0-9]+([.][0-9]{1,9})?$' then raise exception 'INVALID_PACKAGE';end if;
 amount=(p_input->>'amount')::numeric;verified=p_input->>'verification';evidence=trim(coalesce(p_input->>'evidence',''));
 pack_unit=(p_input->>'package_unit_id')::uuid;pack_content=(p_input->>'package_content_unit_id')::uuid;pack_amount=(p_input->>'package_quantity')::numeric;pack_verified=coalesce((p_input->>'package_verified')::boolean,false);
 if verified is null or verified<>all(array['verified','needs_verification']) or length(evidence)>2000 or (verified='verified' and(amount is null or basis is null)) then raise exception 'PRICE_BASIS_REQUIRED';end if;
 if pack_verified and(pack_unit is null or pack_content is null or pack_unit=pack_content or pack_amount is null or pack_amount<=0) then raise exception 'INVALID_PACKAGE';end if;
 if pack_verified and private.physical_factor(pack_unit,pack_content) is not null and abs(private.physical_factor(pack_unit,pack_content)-pack_amount)>0.000000001 then raise exception 'UNIT_RATIO_MISMATCH';end if;
 insert into public.material_resolutions(material_id,effective_from,purchase_unit_id,usage_unit_id,basis_unit_id,amount,verification,package_unit_id,package_content_unit_id,package_quantity,package_verified,issue,evidence,source_data)
 values(p_material,p_effective,purchase,usage,basis,amount,verified,pack_unit,pack_content,pack_amount,pack_verified,coalesce(p_input->>'issue',''),evidence,coalesce(previous.source_data,jsonb_build_object('original_material',to_jsonb(m)))) returning id into result;
 update public.materials set purchase_unit_id=purchase,usage_unit_id=usage,minimum_quantity=case when m.usage_unit_id=usage then minimum_quantity else null end,price_status=verified where id=p_material;
 return private.finish_request(p_key,jsonb_build_object('id',result,'material_id',p_material,'verification',verified));
end $$;

revoke all on function public.resolve_material(uuid,bigint,date,jsonb,uuid) from public,anon;
grant execute on function public.resolve_material(uuid,bigint,date,jsonb,uuid) to authenticated;

commit;
