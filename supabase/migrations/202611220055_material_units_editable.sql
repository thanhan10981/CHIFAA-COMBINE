begin;

-- Store the conversion effective date on the editable head row. Past values
-- are copied to an append-only table before an edit so dated recipes and cost
-- lookups keep the ratio that was in force on their date.
alter table public.unit_conversions
 add column effective_from date not null default '1900-01-01';
update public.unit_conversions
 set effective_from='1900-01-01';

create table private.material_unit_conversion_history(
 id uuid primary key default gen_random_uuid(),
 conversion_id uuid not null,
 material_id uuid not null references public.materials(id),
 from_unit_id uuid not null references public.material_units(id),
 to_unit_id uuid not null references public.material_units(id),
 factor numeric(20,9) not null check(factor>0),
 verified boolean not null,
 evidence text not null,
 effective_from date not null,
 revision bigint not null,
 recorded_at timestamptz not null default now(),
 recorded_by uuid references auth.users(id)
);
create index material_unit_conversion_history_lookup_idx
 on private.material_unit_conversion_history(material_id,from_unit_id,to_unit_id,effective_from desc,revision desc);
revoke all on private.material_unit_conversion_history from public,anon,authenticated;

create function private.capture_unit_conversion_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.factor is distinct from old.factor or new.verified is distinct from old.verified or new.evidence is distinct from old.evidence then
  insert into private.material_unit_conversion_history(conversion_id,material_id,from_unit_id,to_unit_id,factor,verified,evidence,effective_from,revision,recorded_by)
  values(old.id,old.material_id,old.from_unit_id,old.to_unit_id,old.factor,old.verified,old.evidence,old.effective_from,old.version,auth.uid());
  new.effective_from=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 end if;
 return new;
end $$;
create trigger unit_conversion_history_capture before update on public.unit_conversions
 for each row execute function private.capture_unit_conversion_revision();

create function private.unit_conversion_factor_at(p_material uuid,p_from uuid,p_to uuid,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare factor numeric; verified boolean; found_conversion boolean;
begin
 if p_from=p_to then return 1;end if;
 select x.factor,x.verified into factor,verified from(
  select c.factor,c.verified,c.effective_from,c.version revision
   from public.unit_conversions c where c.material_id=p_material and c.from_unit_id=p_from and c.to_unit_id=p_to
  union all
  select h.factor,h.verified,h.effective_from,h.revision
   from private.material_unit_conversion_history h where h.material_id=p_material and h.from_unit_id=p_from and h.to_unit_id=p_to
 ) x where x.effective_from<=p_date order by x.effective_from desc,x.revision desc limit 1;
 found_conversion=found;
 if found_conversion then return case when verified then factor else null end;end if;
 select x.factor,x.verified into factor,verified from(
  select c.factor,c.verified,c.effective_from,c.version revision
   from public.unit_conversions c where c.material_id=p_material and c.from_unit_id=p_to and c.to_unit_id=p_from
  union all
  select h.factor,h.verified,h.effective_from,h.revision
   from private.material_unit_conversion_history h where h.material_id=p_material and h.from_unit_id=p_to and h.to_unit_id=p_from
 ) x where x.effective_from<=p_date order by x.effective_from desc,x.revision desc limit 1;
 if not found then return null;end if;
 return case when verified then 1/factor else null end;
end $$;

create or replace function private.convert_quantity(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare factor numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);
 if factor is null then factor=private.unit_conversion_factor_at(p_material,p_from,p_to,(now() at time zone 'Asia/Ho_Chi_Minh')::date);end if;
 if factor is null then raise exception 'UNIT_NEEDS_VERIFICATION';end if;
 return p_quantity*factor;
end $$;

create or replace function private.convert_quantity_at(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions; factor numeric; leg numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);if factor is not null then return p_quantity*factor;end if;
 select * into r from public.material_resolutions where material_id=p_material and effective_from<=p_date order by effective_from desc,revision desc limit 1;
 if r.id is not null and r.package_verified then
  if p_from=r.package_unit_id then
   leg=case when p_to=r.package_content_unit_id then 1 else private.physical_factor(r.package_content_unit_id,p_to) end;
   if leg is not null then return p_quantity*r.package_quantity*leg;end if;
  elsif p_to=r.package_unit_id then
   leg=case when p_from=r.package_content_unit_id then 1 else private.physical_factor(p_from,r.package_content_unit_id) end;
   if leg is not null then return p_quantity*leg/r.package_quantity;end if;
  end if;
 end if;
 factor=private.unit_conversion_factor_at(p_material,p_from,p_to,p_date);
 if factor is null then raise exception 'UNIT_NEEDS_VERIFICATION';end if;
 return p_quantity*factor;
end $$;

-- Convert old receipt/count lines into the catalog's current stock unit for
-- derived balances. Posted movement rows are never rewritten. NULL means at
-- least one posted line has no verified path to the current unit.
create or replace function private.inventory_quantity(p_warehouse uuid,p_date date,p_material uuid,p_unit uuid)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare line record; total numeric=0; has_line boolean=false; converted numeric;
begin
 for line in
  select l.unit_id,l.quantity from public.inventory_movement_lines l
  join public.inventory_movements v on v.id=l.movement_id
  join public.warehouses w on w.id=v.warehouse_id
  where (p_warehouse is null and w.kind='ingredient' or p_warehouse is not null and v.warehouse_id=p_warehouse)
   and v.moved_on<=p_date and l.material_id=p_material
  order by v.moved_on,v.created_at,v.id,l.id
 loop
  has_line=true;
  begin
   converted=private.convert_quantity_at(p_material,line.unit_id,p_unit,line.quantity,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
  exception when raise_exception then
   if SQLERRM='UNIT_NEEDS_VERIFICATION' then return null;else raise;end if;
  end;
  total=total+converted;
 end loop;
 if has_line then return total;end if;
 if exists(
  select 1 from public.stock_count_lines l join public.stock_counts c on c.id=l.count_id
  join public.warehouses w on w.id=c.warehouse_id
  where (p_warehouse is null and w.kind='ingredient' or p_warehouse is not null and c.warehouse_id=p_warehouse)
   and c.counted_on<=p_date and c.status='posted' and l.material_id=p_material
 ) then return 0;end if;
 return null;
end $$;

-- Keep catalog stock derived from ledger lines, converted to the current
-- material unit. Neither the editor nor the Excel import writes stock.
do $upgrade$
declare definition text; old_fragment text; new_fragment text;
begin
 old_fragment='(select sum(l.quantity)::text from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id join public.warehouses w on w.id=v.warehouse_id where l.material_id=m.id and w.kind=''ingredient'' and v.moved_on<=p_date)';
 new_fragment='private.inventory_quantity(null,p_date,m.id,m.usage_unit_id)::text';
 select pg_get_functiondef('public.material_catalog(date,text,text,integer,integer)'::regprocedure) into definition;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_CATALOG_STOCK_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
 select pg_get_functiondef('public.material_catalog_sorted(date,text,text,text,integer,integer)'::regprocedure) into definition;
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_CATALOG_SORTED_STOCK_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('private.effective_material_price(uuid,date)'::regprocedure) into definition;
 old_fragment='case when r.usage_unit_id=m.usage_unit_id then r.verification else ''needs_verification'' end';
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_PRICE_UNIT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,'r.verification');
 if definition not like '%UNIT_MIGRATION_REQUIRED%' then raise exception 'MATERIAL_PRICE_ISSUE_PATCH_MISMATCH';end if;
 execute replace(definition,'UNIT_MIGRATION_REQUIRED','');

 select pg_get_functiondef('public.save_catalog(text,uuid,bigint,jsonb,uuid)'::regprocedure) into definition;
 old_fragment='if p_table=''unit_conversions'' and exists(select 1 from public.unit_conversions c where c.id=p_id and (exists(select 1 from public.inventory_movement_lines l where l.material_id=c.material_id) or exists(select 1 from public.recipe_items i where i.material_id=c.material_id))) then raise exception ''UNIT_MIGRATION_REQUIRED'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'UNIT_CONVERSION_EDIT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,'');

 select pg_get_functiondef('public.resolve_material(uuid,bigint,date,jsonb,uuid)'::regprocedure) into definition;
 old_fragment='if m.usage_unit_id is distinct from usage and(exists(select 1 from public.inventory_movement_lines where material_id=p_material) or exists(select 1 from public.recipe_items where material_id=p_material)) then raise exception ''UNIT_MIGRATION_REQUIRED'';end if;';
 new_fragment='if m.usage_unit_id is distinct from usage then begin perform private.convert_quantity_at(p_material,m.usage_unit_id,usage,1,p_effective);exception when raise_exception then if SQLERRM=''UNIT_NEEDS_VERIFICATION'' then raise exception ''UNIT_CONVERSION_REQUIRED'';else raise;end if;end;end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_USAGE_UNIT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='minimum_quantity=case when m.usage_unit_id=usage then minimum_quantity else null end';
 new_fragment='minimum_quantity=case when m.usage_unit_id=usage then minimum_quantity else private.convert_quantity_at(p_material,m.usage_unit_id,usage,minimum_quantity,p_effective) end';
 if strpos(definition,old_fragment)=0 then raise exception 'MATERIAL_MINIMUM_UNIT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into definition;
 old_fragment='if item->>''material_id'' is not null and not exists(select 1 from public.materials where id=(item->>''material_id'')::uuid and not archived) then raise exception ''MATERIAL_NOT_FOUND'';end if;';
 new_fragment=old_fragment||' if item->>''material_id'' is not null then perform private.convert_quantity_at((item->>''material_id'')::uuid,(item->>''unit_id'')::uuid,(select usage_unit_id from public.materials where id=(item->>''material_id'')::uuid),1,(p_recipe->>''effective_from'')::date);end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'RECIPE_MATERIAL_UNIT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $upgrade$;

drop trigger if exists resolved_conversion_guard on public.unit_conversions;

-- Keep the existing response shape for clients that inspect this field; unit
-- changes are now allowed through the dated verification workflow.
create or replace function public.material_cost_basis(p_material uuid,p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p record; m public.materials; usage_cost numeric; purchase_cost numeric; factor numeric;
begin
 if not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null then raise exception 'INVALID_DATE';end if;
 select * into strict m from public.materials where id=p_material;select * into p from private.effective_material_price(p_material,p_date);
 if p.verification='verified' and p.amount is not null then
  begin factor=private.convert_quantity_at(p_material,p.basis_unit_id,m.usage_unit_id,1,p_date);usage_cost=round(p.amount/factor,6);
  exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;end;
  begin factor=private.convert_quantity_at(p_material,p.basis_unit_id,m.purchase_unit_id,1,p_date);purchase_cost=round(p.amount/factor,6);
  exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;end;
 end if;
 return jsonb_build_object(
  'amount',p.amount::text,'basis_unit',(select code from public.material_units where id=p.basis_unit_id),
  'usage_unit',(select code from public.material_units where id=m.usage_unit_id),'usage_unit_id',m.usage_unit_id::text,
  'usage_unit_locked',false,'purchase_unit',(select code from public.material_units where id=m.purchase_unit_id),
  'usage_cost_vnd',usage_cost::text,'purchase_cost_vnd',purchase_cost::text,
  'official_ready',usage_cost is not null,'verification',p.verification,'issue',p.issue
 );
end $$;

revoke all on function private.capture_unit_conversion_revision(),private.unit_conversion_factor_at(uuid,uuid,uuid,date),private.convert_quantity(uuid,uuid,uuid,numeric),private.convert_quantity_at(uuid,uuid,uuid,numeric,date),private.inventory_quantity(uuid,date,uuid,uuid) from public,anon,authenticated;
revoke all on function public.material_cost_basis(uuid,date) from public,anon;
grant execute on function public.material_cost_basis(uuid,date) to authenticated;

commit;
