begin;
set local lock_timeout = '5s';

-- A packaging ratio submitted together with a stock-unit change must be
-- allowed to validate that same change. Previously resolve_material checked
-- only the older saved conversion first, so the new ratio could never be
-- recorded when it was needed to move from the old stock unit.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure)
 into definition;
 old_fragment='if m.usage_unit_id is distinct from usage then begin perform private.convert_quantity_at(p_material,m.usage_unit_id,usage,1,p_effective);exception when raise_exception then if SQLERRM=''UNIT_NEEDS_VERIFICATION'' then raise exception ''UNIT_CONVERSION_REQUIRED'';else raise;end if;end;end if;';
 new_fragment=$new$
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
$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_PACKAGE_UNIT_CHANGE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

revoke all on function public.resolve_material(uuid,bigint,date,jsonb,uuid) from public,anon;
grant execute on function public.resolve_material(uuid,bigint,date,jsonb,uuid) to authenticated;

commit;
