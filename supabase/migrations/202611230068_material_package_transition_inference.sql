begin;
set local lock_timeout = '5s';

-- Derive old-package -> new-package transitions from both dated, verified
-- package ratios when their contents share a physical dimension. For example,
-- old 1 bag = 200 pieces and new 1 bì = 200 pieces yields 1:1 without asking
-- the operator to re-enter the old ratio. Never equate package units directly.
create function private.material_package_transition_factor(
 p_material uuid,p_from uuid,p_to uuid,p_date date,
 p_new_package_unit uuid,p_new_content_unit uuid,p_new_quantity numeric,p_new_verified boolean
) returns numeric language plpgsql stable security definer set search_path='' as $$
declare old_content uuid; old_quantity numeric; old_verified boolean; content_factor numeric;
begin
 if p_material is null or p_from is null or p_to is null or p_date is null
  or p_new_package_unit is distinct from p_to or not coalesce(p_new_verified,false)
  or p_new_content_unit is null or p_new_quantity is null or p_new_quantity<=0 then return null;end if;
 select package_content_unit_id,package_quantity,package_verified
  into old_content,old_quantity,old_verified
  from public.material_resolutions
  where material_id=p_material and package_unit_id=p_from
   and package_content_unit_id is not null and package_quantity>0 and effective_from<=p_date
  order by effective_from desc,revision desc limit 1;
 if not coalesce(old_verified,false) or old_content is null or old_quantity is null then return null;end if;
 content_factor=case when old_content=p_new_content_unit then 1
  else private.physical_factor(old_content,p_new_content_unit) end;
 if content_factor is null then return null;end if;
 return old_quantity*content_factor/p_new_quantity;
end $$;
revoke all on function private.material_package_transition_factor(uuid,uuid,uuid,date,uuid,uuid,numeric,boolean) from public,anon,authenticated;

-- Let resolve_material use the pair of verified package ratios before requiring
-- a manually entered stock transition factor.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure) into definition;
 old_fragment='if[[:space:]]+stock_factor[[:space:]]+is[[:space:]]+null[[:space:]]+then';
 new_fragment=$new$package_factor=coalesce(
  private.material_package_transition_factor(p_material,m.usage_unit_id,usage,p_effective,
   (p_input->>'package_unit_id')::uuid,(p_input->>'package_content_unit_id')::uuid,
   (p_input->>'package_quantity')::numeric,coalesce((p_input->>'package_verified')::boolean,false)),package_factor);
 if stock_factor is null then$new$;
 if definition!~*old_fragment then
  if position('stock_conversion_from_unit_id' in definition)=0 then
   raise exception 'MATERIAL_STOCK_UNIT_TRANSITION_MIGRATION_REQUIRED';
  end if;
  raise exception 'MATERIAL_PACKAGE_TRANSITION_RESOLVE_PATCH_MISMATCH';
 end if;
 definition=regexp_replace(definition,old_fragment,new_fragment,'i');
 execute definition;
end
$patch$;

-- Catalog edits may omit an explicit transition factor when the submitted
-- verified package ratio and the old verified ratio establish it.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.save_material_table(uuid,bigint,jsonb,uuid)'::regprocedure) into definition;
 old_fragment=$old$if usage_changed and (stock_factor is null or stock_factor<=0) then raise exception 'UNIT_CONVERSION_REQUIRED';end if;$old$;
 new_fragment=$new$if usage_changed and stock_factor is not null and stock_factor<=0 then raise exception 'INVALID_STOCK_CONVERSION';end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_PACKAGE_TRANSITION_EDITOR_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

revoke all on function private.material_package_transition_factor(uuid,uuid,uuid,date,uuid,uuid,numeric,boolean) from public,anon,authenticated;
revoke all on function public.resolve_material(uuid,bigint,date,jsonb,uuid),public.save_material_table(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.resolve_material(uuid,bigint,date,jsonb,uuid),public.save_material_table(uuid,bigint,jsonb,uuid) to authenticated;
commit;
