begin;
-- One canonical price basis per material/effective date. Existing ambiguous
-- rows cause this migration to fail, never get silently deleted or selected.
alter table public.material_prices add constraint material_prices_one_basis_per_date unique(material_id,effective_from);
create function private.physical_factor(p_from uuid,p_to uuid) returns numeric language plpgsql stable security definer set search_path='' as $$
declare a public.material_units; b public.material_units; x numeric; y numeric;
begin
 select * into a from public.material_units where id=p_from;select * into b from public.material_units where id=p_to;
 if a.dimension<>b.dimension then return null;end if;
 if a.dimension='mass' then
  x=case lower(a.code) when 'kg' then 1000 when 'g' then 1 when 'gr' then 1 when 'gram' then 1 end;
  y=case lower(b.code) when 'kg' then 1000 when 'g' then 1 when 'gr' then 1 when 'gram' then 1 end;
 elsif a.dimension='volume' then
  x=case lower(a.code) when 'l' then 1000 when 'lit' then 1000 when 'lít' then 1000 when 'ml' then 1 end;
  y=case lower(b.code) when 'l' then 1000 when 'lit' then 1000 when 'lít' then 1000 when 'ml' then 1 end;
 end if;
 return x/y;
end $$;
create or replace function private.convert_quantity(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric) returns numeric language plpgsql stable security definer set search_path='' as $$
declare factor numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);
 if factor is null then select c.factor into factor from public.unit_conversions c where c.material_id=p_material and c.from_unit_id=p_from and c.to_unit_id=p_to and c.verified;end if;
 if factor is null then select 1/c.factor into factor from public.unit_conversions c where c.material_id=p_material and c.from_unit_id=p_to and c.to_unit_id=p_from and c.verified;end if;
 if factor is null then raise exception 'UNIT_NEEDS_VERIFICATION';end if;
 return p_quantity*factor;
end $$;
create function private.conversion_consistency() returns trigger language plpgsql security definer set search_path='' as $$
declare expected numeric; reverse_factor numeric;
begin
 if new.verified then
  if length(trim(new.evidence))<5 then raise exception 'UNIT_EVIDENCE_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended('units:'||new.material_id::text,0));
  expected=private.physical_factor(new.from_unit_id,new.to_unit_id);
  if expected is not null and abs(new.factor-expected)>0.000000001 then raise exception 'UNIT_RATIO_MISMATCH';end if;
  select factor into reverse_factor from public.unit_conversions where material_id=new.material_id and from_unit_id=new.to_unit_id and to_unit_id=new.from_unit_id and verified and id<>new.id;
  if reverse_factor is not null and abs(new.factor*reverse_factor-1)>0.000000001 then raise exception 'UNIT_RECIPROCAL_MISMATCH';end if;
 end if;
 return new;
end $$;
create trigger conversion_consistency before insert or update on public.unit_conversions for each row execute function private.conversion_consistency();
revoke all on function private.physical_factor(uuid,uuid),private.conversion_consistency() from public;
commit;
