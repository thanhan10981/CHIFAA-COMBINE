begin;
set local lock_timeout = '5s';

-- Formula units are a separate, dated conversion from a material's stock unit.
-- They do not change the unit used by receipts, counts, or inventory balances.
alter table public.material_resolutions
 add column formula_unit_id uuid references public.material_units(id),
 add column formula_quantity numeric(20,9) check(formula_quantity>0 and formula_quantity<>'NaN'::numeric),
 add column formula_verified boolean not null default false,
 add constraint material_resolutions_formula_pair_check
  check((formula_unit_id is null)=(formula_quantity is null)),
 add constraint material_resolutions_formula_verified_check
  check(not formula_verified or (formula_unit_id is not null and formula_quantity is not null and formula_unit_id<>usage_unit_id));

-- Add the formula-specific ratio to the existing Admin-only, immutable
-- material-resolution workflow. Older clients continue to write no ratio.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure) into definition;

 old_fragment=$old$'package_quantity','package_verified','evidence','issue'$old$;
 new_fragment=$new$'package_quantity','package_verified','formula_unit_id','formula_quantity','evidence','issue'$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_INPUT_FIELDS_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$; pack_content uuid; pack_amount numeric; pack_verified boolean; evidence text;$old$;
 new_fragment=$new$; pack_content uuid; pack_amount numeric; pack_verified boolean; formula_unit uuid; formula_amount numeric; formula_verified boolean; evidence text;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_DECLARATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$array[purchase,usage,basis,(p_input->>'package_unit_id')::uuid,(p_input->>'package_content_unit_id')::uuid]$old$;
 new_fragment=$new$array[purchase,usage,basis,(p_input->>'package_unit_id')::uuid,(p_input->>'package_content_unit_id')::uuid,(p_input->>'formula_unit_id')::uuid]$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_UNIT_VALIDATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$ if p_input->>'package_quantity' is not null and (p_input->>'package_quantity')!~'^[0-9]+([.][0-9]{1,9})?$' then raise exception 'INVALID_PACKAGE';end if;$old$;
 new_fragment=old_fragment||$add$
 if p_input->>'formula_quantity' is not null and (p_input->>'formula_quantity')!~'^[0-9]{1,14}([.][0-9]{1,9})?$' then raise exception 'INVALID_FORMULA_CONVERSION';end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_RATIO_VALIDATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$pack_unit=(p_input->>'package_unit_id')::uuid;pack_content=(p_input->>'package_content_unit_id')::uuid;pack_amount=(p_input->>'package_quantity')::numeric;pack_verified=coalesce((p_input->>'package_verified')::boolean,false);$old$;
 new_fragment=old_fragment||$add$ formula_unit=nullif(p_input->>'formula_unit_id','')::uuid;formula_amount=(p_input->>'formula_quantity')::numeric;formula_verified=formula_unit is not null and formula_amount is not null;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_VALUE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$ if pack_verified and private.physical_factor(pack_unit,pack_content) is not null and abs(private.physical_factor(pack_unit,pack_content)-pack_amount)>0.000000001 then raise exception 'UNIT_RATIO_MISMATCH';end if;$old$;
 new_fragment=old_fragment||$add$
 if (formula_unit is null) is distinct from (formula_amount is null) or (formula_unit is not null and (formula_unit=usage or formula_amount<=0)) then raise exception 'INVALID_FORMULA_CONVERSION';end if;
 if formula_verified and private.physical_factor(usage,formula_unit) is not null and abs(private.physical_factor(usage,formula_unit)-formula_amount)>0.000000001 then raise exception 'UNIT_RATIO_MISMATCH';end if;
 if formula_verified then
  perform private.unit_conversion_factor_at(p_material,usage,formula_unit,p_effective);
  if private.unit_conversion_factor_at(p_material,usage,formula_unit,p_effective) is not null
   and abs(private.unit_conversion_factor_at(p_material,usage,formula_unit,p_effective)-formula_amount)>0.000000001 then raise exception 'UNIT_RATIO_MISMATCH';end if;
 end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_RATIO_CHECK_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$package_quantity,package_verified,issue,evidence,source_data)$old$;
 new_fragment=$new$package_quantity,package_verified,formula_unit_id,formula_quantity,formula_verified,issue,evidence,source_data)$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_INSERT_COLUMNS_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$pack_content,pack_amount,pack_verified,coalesce(p_input->>'issue',''),evidence,$old$;
 new_fragment=$new$pack_content,pack_amount,pack_verified,formula_unit,formula_amount,formula_verified,coalesce(p_input->>'issue',''),evidence,$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_FORMULA_INSERT_VALUES_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Keep formula-only ratios out of inventory conversions. Recipe quantities and
-- recipe price bases may travel through the formula unit and stock unit.
create function private.recipe_convert_quantity_at(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions; stock_quantity numeric; factor numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);
 if factor is not null then return p_quantity*factor;end if;
 select * into r from public.material_resolutions
  where material_id=p_material and effective_from<=p_date
  order by effective_from desc,revision desc limit 1;
 if r.id is not null and r.formula_verified and r.formula_unit_id is not null then
  if p_from=r.formula_unit_id then
   stock_quantity=p_quantity/r.formula_quantity;
   return private.convert_quantity_at(p_material,r.usage_unit_id,p_to,stock_quantity,p_date);
  elsif p_to=r.formula_unit_id then
   stock_quantity=private.convert_quantity_at(p_material,p_from,r.usage_unit_id,p_quantity,p_date);
   return stock_quantity*r.formula_quantity;
  end if;
 end if;
 return private.convert_quantity_at(p_material,p_from,p_to,p_quantity,p_date);
end $$;

revoke all on function private.recipe_convert_quantity_at(uuid,uuid,uuid,numeric,date) from public,anon,authenticated;

-- Preserve formula rules when a later catalog price/package resolution is
-- appended. A stock-unit change clears the old formula ratio for re-verification.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.save_material_table(uuid,bigint,jsonb,uuid)'::regprocedure) into definition;
 old_fragment=$old$'package_unit_id',package_unit,'package_content_unit_id',package_content,'package_quantity',package_amount,'package_verified',coalesce(package_verified,false),$old$;
 new_fragment=old_fragment||$add$'formula_unit_id',case when m.usage_unit_id is not distinct from usage then previous.formula_unit_id end,'formula_quantity',case when m.usage_unit_id is not distinct from usage then previous.formula_quantity end,$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_TABLE_FORMULA_PRESERVE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Validate recipe lines and calculate BOM/cost with the recipe-only mapping.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into definition;
 old_fragment=$old$private.convert_quantity_at((item->>'material_id')::uuid,(item->>'unit_id')::uuid,(select usage_unit_id from public.materials where id=(item->>'material_id')::uuid),1,(p_recipe->>'effective_from')::date)$old$;
 if strpos(definition,old_fragment)=0 then raise exception 'RECIPE_FORMULA_UNIT_VALIDATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,replace(old_fragment,'private.convert_quantity_at','private.recipe_convert_quantity_at'));
 execute definition;

 select pg_get_functiondef('private.bom(uuid,numeric,date)'::regprocedure) into definition;
 old_fragment=$old$private.convert_quantity_at(r.material_id,r.unit_id,unit_id,p_quantity*r.quantity/r.output_quantity,p_date)$old$;
 if strpos(definition,old_fragment)=0 then raise exception 'RECIPE_BOM_FORMULA_UNIT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,replace(old_fragment,'private.convert_quantity_at','private.recipe_convert_quantity_at'));
 execute definition;

 select pg_get_functiondef('public.recipe_detail(uuid,date)'::regprocedure) into definition;
 old_fragment=$old$private.convert_quantity_at(r.material_id,r.unit_id,(select usage_unit_id from public.materials where id=r.material_id),r.quantity,p_date)$old$;
 new_fragment=replace(old_fragment,'private.convert_quantity_at','private.recipe_convert_quantity_at');
 if strpos(definition,old_fragment)=0 then raise exception 'RECIPE_DETAIL_FORMULA_QUANTITY_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$private.convert_quantity_at(r.material_id,price.basis_unit_id,r.unit_id,1,p_date)$old$;
 new_fragment=replace(old_fragment,'private.convert_quantity_at','private.recipe_convert_quantity_at');
 if strpos(definition,old_fragment)=0 then raise exception 'RECIPE_DETAIL_FORMULA_COST_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Supply the recipe editor with each material's effective stock and verified
-- formula unit so it can explain the saved ratio beside the unit selector.
create function public.recipe_material_units(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can('recipes','view') or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',m.id,'code',m.code,'name',m.name,'usage_unit_id',m.usage_unit_id,
  'formula_unit_id',case when r.formula_verified then r.formula_unit_id end,
  'formula_quantity',case when r.formula_verified then r.formula_quantity::text end,
  'formula_verified',coalesce(r.formula_verified,false)
 ) order by m.code,m.id),'[]'::jsonb) into result
 from public.materials m
 left join lateral(select x.* from public.material_resolutions x where x.material_id=m.id and x.effective_from<=p_date order by x.effective_from desc,x.revision desc limit 1) r on true
 where not m.archived and m.usage_unit_id is not null;
 return result;
end $$;
revoke all on function public.recipe_material_units(date) from public,anon;
grant execute on function public.recipe_material_units(date) to authenticated;

commit;
