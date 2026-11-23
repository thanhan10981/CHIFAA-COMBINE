begin;
set local lock_timeout = '5s';

-- A verified package ratio can bridge the old stock unit and the new stock
-- unit through compatible physical units (for example, kg -> 1 bag = 1000 g).
-- It must never infer a bridge across dimensions such as kg and litre.
create function private.material_package_conversion_factor(
 p_from uuid,p_to uuid,p_package_unit uuid,p_package_content_unit uuid,
 p_package_quantity numeric,p_verified boolean
) returns numeric language plpgsql stable security definer set search_path='' as $$
declare from_to_package numeric; content_to_target numeric;
begin
 if not coalesce(p_verified,false) or p_from is null or p_to is null
  or p_package_unit is null or p_package_content_unit is null
  or p_package_quantity is null or p_package_quantity<=0 then return null;end if;

 -- 1 package unit = package_quantity content units.
 from_to_package=case when p_from=p_package_unit then 1 else private.physical_factor(p_from,p_package_unit) end;
 content_to_target=case when p_package_content_unit=p_to then 1 else private.physical_factor(p_package_content_unit,p_to) end;
 if from_to_package is not null and content_to_target is not null then
  return from_to_package*p_package_quantity*content_to_target;
 end if;

 -- Reverse direction: convert through the content side, then divide by the
 -- verified package quantity to reach package units.
 from_to_package=case when p_from=p_package_content_unit then 1 else private.physical_factor(p_from,p_package_content_unit) end;
 content_to_target=case when p_package_unit=p_to then 1 else private.physical_factor(p_package_unit,p_to) end;
 if from_to_package is not null and content_to_target is not null then
  return from_to_package/p_package_quantity*content_to_target;
 end if;
 return null;
end $$;
revoke all on function private.material_package_conversion_factor(uuid,uuid,uuid,uuid,numeric,boolean) from public,anon,authenticated;

-- Use the same verified bridge for saved stock/history conversions.
create or replace function private.convert_quantity_at(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions; factor numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);
 if factor is not null then return p_quantity*factor;end if;
 select * into r from public.material_resolutions
  where material_id=p_material and effective_from<=p_date
  order by effective_from desc,revision desc limit 1;
 if r.id is null then return private.convert_quantity(p_material,p_from,p_to,p_quantity);end if;
 if r.package_verified then
  factor=private.material_package_conversion_factor(p_from,p_to,r.package_unit_id,r.package_content_unit_id,r.package_quantity,true);
  if factor is not null then return p_quantity*factor;end if;
 end if;
 factor=private.unit_conversion_factor_at(p_material,p_from,p_to,p_date);
 if factor is null then raise exception 'UNIT_NEEDS_VERIFICATION';end if;
 return p_quantity*factor;
end $$;

-- Validate stock-unit changes against the ratio submitted in this same save,
-- before that ratio has been appended to material_resolutions.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure) into definition;
 old_fragment=$old$
if m.usage_unit_id is distinct from usage then
 if coalesce((p_input->>'package_verified')::boolean,false)
  and (case when coalesce(p_input->>'package_quantity','') ~ '^[0-9]+([.][0-9]{1,9})?$' then (p_input->>'package_quantity')::numeric>0 else false end)
  and ((lower(coalesce(p_input->>'package_unit_id',''))=m.usage_unit_id::text and lower(coalesce(p_input->>'package_content_unit_id',''))=usage::text)
    or (lower(coalesce(p_input->>'package_content_unit_id',''))=m.usage_unit_id::text and lower(coalesce(p_input->>'package_unit_id',''))=usage::text)) then
  null;
 else
  begin perform private.convert_quantity_at(p_material,m.usage_unit_id,usage,1,p_effective);
  exception when raise_exception then if SQLERRM='UNIT_NEEDS_VERIFICATION' then raise exception 'UNIT_CONVERSION_REQUIRED';else raise;end if;
  end;
 end if;
end if;
$old$;
 new_fragment=$new$
if m.usage_unit_id is distinct from usage then
 if private.material_package_conversion_factor(
   m.usage_unit_id,usage,(p_input->>'package_unit_id')::uuid,
   (p_input->>'package_content_unit_id')::uuid,(p_input->>'package_quantity')::numeric,
   coalesce((p_input->>'package_verified')::boolean,false)
  ) is not null then
  null;
 else
  begin perform private.convert_quantity_at(p_material,m.usage_unit_id,usage,1,p_effective);
  exception when raise_exception then if SQLERRM='UNIT_NEEDS_VERIFICATION' then raise exception 'UNIT_CONVERSION_REQUIRED';else raise;end if;
  end;
 end if;
end if;
$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_PACKAGE_BRIDGE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

revoke all on function private.convert_quantity_at(uuid,uuid,uuid,numeric,date) from public,anon,authenticated;
revoke all on function public.resolve_material(uuid,bigint,date,jsonb,uuid) from public,anon;
grant execute on function public.resolve_material(uuid,bigint,date,jsonb,uuid) to authenticated;

commit;
