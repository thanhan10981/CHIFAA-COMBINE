begin;
set local lock_timeout = '5s';

-- A stock-unit change is a dated, verified edge in the material's unit graph.
-- Posted receipt/count lines keep their entered units; every derived balance
-- can convert those lines through one or more approved stock-unit changes.
alter table public.material_resolutions
 add column stock_conversion_from_unit_id uuid references public.material_units(id),
 add column stock_conversion_factor numeric(20,9)
  check(stock_conversion_factor>0 and stock_conversion_factor<>'NaN'::numeric),
 add constraint material_resolutions_stock_conversion_pair_check
  check((stock_conversion_from_unit_id is null)=(stock_conversion_factor is null)),
 add constraint material_resolutions_stock_conversion_units_check
  check(stock_conversion_from_unit_id is null or stock_conversion_from_unit_id<>usage_unit_id);

create function private.material_stock_conversion_factor(
 p_material uuid,p_from uuid,p_to uuid,p_date date
) returns numeric language plpgsql stable security definer set search_path='' as $$
declare low_factor numeric; high_factor numeric;
begin
 if p_material is null or p_from is null or p_to is null or p_date is null then return null;end if;
 if p_from=p_to then return 1;end if;
 with recursive prior_resolutions as (
  select r.*,lag(r.usage_unit_id) over(partition by r.material_id order by r.effective_from,r.revision) prior_usage_unit_id
   from public.material_resolutions r where r.material_id=p_material and r.effective_from<=p_date
 ), legacy_edges(from_unit,to_unit,factor) as (
  select r.prior_usage_unit_id,r.usage_unit_id,coalesce(
   private.physical_factor(r.prior_usage_unit_id,r.usage_unit_id),
   private.material_package_conversion_factor(r.prior_usage_unit_id,r.usage_unit_id,r.package_unit_id,r.package_content_unit_id,r.package_quantity,r.package_verified),
   private.unit_conversion_factor_at(r.material_id,r.prior_usage_unit_id,r.usage_unit_id,r.effective_from))
   from prior_resolutions r
   where r.prior_usage_unit_id is not null and r.prior_usage_unit_id<>r.usage_unit_id
    and r.stock_conversion_from_unit_id is null
 ), edges(from_unit,to_unit,factor) as (
  select r.stock_conversion_from_unit_id,r.usage_unit_id,r.stock_conversion_factor
   from prior_resolutions r where r.stock_conversion_from_unit_id is not null and r.stock_conversion_factor>0
  union all select from_unit,to_unit,factor from legacy_edges where factor>0
  union all
  select r.usage_unit_id,r.stock_conversion_from_unit_id,1/r.stock_conversion_factor
   from prior_resolutions r where r.stock_conversion_from_unit_id is not null and r.stock_conversion_factor>0
  union all select to_unit,from_unit,1/factor from legacy_edges where factor>0
 ), paths(unit_id,factor,visited,depth) as (
  select p_from,1::numeric,array[p_from]::uuid[],0
  union all
  select e.to_unit,p.factor*e.factor,p.visited||e.to_unit,p.depth+1
   from paths p join edges e on e.from_unit=p.unit_id
   where p.depth<32 and not e.to_unit=any(p.visited)
 )
 select min(factor),max(factor) into low_factor,high_factor from paths where unit_id=p_to;
 if low_factor is null or high_factor is null then return null;end if;
 if abs(high_factor-low_factor)>greatest(0.000000001,abs(low_factor)*0.000000001) then return null;end if;
 return low_factor;
end $$;
revoke all on function private.material_stock_conversion_factor(uuid,uuid,uuid,date) from public,anon,authenticated;

create or replace function private.convert_quantity_at(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions; factor numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);
 if factor is not null then return p_quantity*factor;end if;
 factor=private.material_stock_conversion_factor(p_material,p_from,p_to,p_date);
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

-- Extend the immutable, idempotent resolution workflow with a separate
-- old-stock-unit -> new-stock-unit ratio. Packaging and formula ratios remain
-- independent. Every changed master unit records its transition for stock,
-- minimum levels, and later historical conversions.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure) into definition;

 old_fragment=$old$'formula_unit_id','formula_quantity','evidence','issue'$old$;
 new_fragment=$new$'formula_unit_id','formula_quantity','stock_conversion_factor','evidence','issue'$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_INPUT_FIELDS_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$; formula_unit uuid; formula_amount numeric; formula_verified boolean; evidence text;$old$;
 new_fragment=$new$; formula_unit uuid; formula_amount numeric; formula_verified boolean; stock_from uuid; stock_factor numeric; known_factor numeric; physical numeric; package_factor numeric; from_dimension text; to_dimension text; evidence text;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_DECLARATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$ if p_input->>'formula_quantity' is not null and (p_input->>'formula_quantity')!~'^[0-9]{1,14}([.][0-9]{1,9})?$' then raise exception 'INVALID_FORMULA_CONVERSION';end if;$old$;
 new_fragment=old_fragment||$add$
 if p_input->>'stock_conversion_factor' is not null and (p_input->>'stock_conversion_factor')!~'^[0-9]{1,14}([.][0-9]{1,9})?$' then raise exception 'INVALID_STOCK_CONVERSION';end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_RATIO_VALIDATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$formula_unit=nullif(p_input->>'formula_unit_id','')::uuid;formula_amount=(p_input->>'formula_quantity')::numeric;formula_verified=formula_unit is not null and formula_amount is not null;$old$;
 new_fragment=old_fragment||$add$ stock_factor=(p_input->>'stock_conversion_factor')::numeric;stock_from=null;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_VALUE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$if m.usage_unit_id is distinct from usage then
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
end if;$old$;
 new_fragment=$new$null;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_BRIDGE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$formula_unit_id,formula_quantity,formula_verified,issue,evidence,source_data)$old$;
 new_fragment=$new$formula_unit_id,formula_quantity,formula_verified,stock_conversion_from_unit_id,stock_conversion_factor,issue,evidence,source_data)$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_INSERT_COLUMNS_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$formula_unit,formula_amount,formula_verified,coalesce(p_input->>'issue',''),evidence,$old$;
 new_fragment=$new$formula_unit,formula_amount,formula_verified,stock_from,stock_factor,coalesce(p_input->>'issue',''),evidence,$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_INSERT_VALUES_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$insert into public.material_resolutions($old$;
 new_fragment=$new$if m.usage_unit_id is distinct from usage then
 select old_unit.dimension,new_unit.dimension into from_dimension,to_dimension
  from public.material_units old_unit cross join public.material_units new_unit
  where old_unit.id=m.usage_unit_id and new_unit.id=usage;
 if (from_dimension='mass' and to_dimension='volume') or (from_dimension='volume' and to_dimension='mass') then
  raise exception 'UNIT_DIMENSION_INCOMPATIBLE';
 end if;
 package_factor=private.material_package_conversion_factor(
  m.usage_unit_id,usage,(p_input->>'package_unit_id')::uuid,
  (p_input->>'package_content_unit_id')::uuid,(p_input->>'package_quantity')::numeric,
  coalesce((p_input->>'package_verified')::boolean,false));
 if ((from_dimension='package' and to_dimension='volume') or (from_dimension='volume' and to_dimension='package')) and package_factor is null then
  raise exception 'UNIT_DIMENSION_INCOMPATIBLE';
 end if;
 if stock_factor is null then
  stock_factor=package_factor;
  if stock_factor is null then
   begin stock_factor=private.convert_quantity_at(p_material,m.usage_unit_id,usage,1,p_effective);
   exception when raise_exception then if SQLERRM='UNIT_NEEDS_VERIFICATION' then raise exception 'UNIT_CONVERSION_REQUIRED';else raise;end if;
   end;
  end if;
 else
  if stock_factor<=0 then raise exception 'INVALID_STOCK_CONVERSION';end if;
  physical=private.physical_factor(m.usage_unit_id,usage);
  known_factor=private.unit_conversion_factor_at(p_material,m.usage_unit_id,usage,p_effective);
  if physical is not null and abs(physical-stock_factor)>greatest(0.000000001,abs(physical)*0.000000001) then raise exception 'UNIT_RATIO_MISMATCH';end if;
  if known_factor is not null and abs(known_factor-stock_factor)>greatest(0.000000001,abs(known_factor)*0.000000001) then raise exception 'UNIT_RATIO_MISMATCH';end if;
  known_factor=private.material_stock_conversion_factor(p_material,m.usage_unit_id,usage,p_effective);
  if known_factor is not null and abs(known_factor-stock_factor)>greatest(0.000000001,abs(known_factor)*0.000000001) then raise exception 'UNIT_RATIO_MISMATCH';end if;
  if package_factor is not null and abs(package_factor-stock_factor)>greatest(0.000000001,abs(package_factor)*0.000000001) then raise exception 'UNIT_RATIO_MISMATCH';end if;
 end if;
 stock_from=m.usage_unit_id;
elsif stock_factor is not null then
 raise exception 'INVALID_STOCK_CONVERSION';
end if;insert into public.material_resolutions($new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_STOCK_BRIDGE_RELOCATION_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- The direct catalog editor uses the same audited transition command as the
-- verification dialog and rejects a unit change without its explicit ratio.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.save_material_table(uuid,bigint,jsonb,uuid)'::regprocedure) into definition;

 old_fragment=$old$'package_verified','package_evidence'])) then raise exception 'INVALID_FIELDS';end if;$old$;
 new_fragment=$new$'package_verified','package_evidence','stock_conversion_factor'])) then raise exception 'INVALID_FIELDS';end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_EDITOR_STOCK_FIELD_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$package_evidence text; spec text; base_usage uuid; base_minimum numeric;$old$;
 new_fragment=$new$package_evidence text; spec text; base_usage uuid; base_minimum numeric; stock_factor numeric;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_EDITOR_STOCK_DECLARATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$if p_input->>'package_quantity' is not null and(p_input->>'package_quantity')!~'^[0-9]+([.][0-9]{1,9})?$' then raise exception 'INVALID_PACKAGE';end if;$old$;
 new_fragment=old_fragment||$add$
 if p_input->>'stock_conversion_factor' is not null and(p_input->>'stock_conversion_factor')!~'^[0-9]{1,14}([.][0-9]{1,9})?$' then raise exception 'INVALID_STOCK_CONVERSION';end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_EDITOR_STOCK_RATIO_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$usage_changed=p_id is not null and m.usage_unit_id is distinct from usage;$old$;
 new_fragment=old_fragment||$add$ stock_factor=(p_input->>'stock_conversion_factor')::numeric;
 if usage_changed and (stock_factor is null or stock_factor<=0) then raise exception 'UNIT_CONVERSION_REQUIRED';end if;
 if not usage_changed and stock_factor is not null then raise exception 'INVALID_STOCK_CONVERSION';end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_EDITOR_STOCK_REQUIREMENT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$'package_unit_id',package_unit,'package_content_unit_id',package_content,'package_quantity',package_amount,'package_verified',coalesce(package_verified,false),$old$;
 new_fragment=$new$'package_unit_id',package_unit,'package_content_unit_id',package_content,'package_quantity',package_amount,'package_verified',coalesce(package_verified,false),'stock_conversion_factor',case when usage_changed then stock_factor else null end,$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_EDITOR_STOCK_FORWARD_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

revoke all on function private.convert_quantity_at(uuid,uuid,uuid,numeric,date) from public,anon,authenticated;
revoke all on function public.resolve_material(uuid,bigint,date,jsonb,uuid),public.save_material_table(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.resolve_material(uuid,bigint,date,jsonb,uuid),public.save_material_table(uuid,bigint,jsonb,uuid) to authenticated;

commit;
