begin;
create table public.material_resolutions (
 id uuid primary key default gen_random_uuid(),
 revision bigint generated always as identity unique,
 material_id uuid not null references public.materials(id), effective_from date not null,
 purchase_unit_id uuid not null references public.material_units(id), usage_unit_id uuid not null references public.material_units(id),
 basis_unit_id uuid references public.material_units(id), amount numeric(20,6) check(amount>=0 and amount<>'NaN'::numeric),
 verification text not null check(verification in ('verified','needs_verification')),
 package_unit_id uuid references public.material_units(id), package_content_unit_id uuid references public.material_units(id),
 package_quantity numeric(20,9) check(package_quantity>0 and package_quantity<>'NaN'::numeric), package_verified boolean not null default false,
 issue text not null default '', evidence text not null, source_data jsonb not null,
 version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
 check(verification<>'verified' or (amount is not null and basis_unit_id is not null)),
 check(not package_verified or (package_unit_id is not null and package_content_unit_id is not null and package_quantity is not null and package_unit_id<>package_content_unit_id))
);
insert into private.table_modules values('material_resolutions','materials');
create index material_resolution_effective_idx on public.material_resolutions(material_id,effective_from desc,revision desc);
alter table public.material_resolutions enable row level security;
create policy material_resolutions_read on public.material_resolutions for select to authenticated using((select private.can('materials','view')));
grant select on public.material_resolutions to authenticated;
revoke all on public.material_resolutions from anon;
create trigger material_resolutions_audit before insert or update or delete on public.material_resolutions for each row execute function private.record_change('materials');
create function private.resolution_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'RESOLUTION_IMMUTABLE: append a new effective revision';end $$;
create trigger resolution_immutable before update or delete on public.material_resolutions for each row execute function private.resolution_immutable();

create function private.effective_material_price(p_material uuid,p_date date)
returns table(amount numeric,basis_unit_id uuid,verification text,effective_from date,issue text,id uuid)
language sql stable security definer set search_path='' as $$
 with resolved as(select r.* from public.material_resolutions r where r.material_id=p_material and r.effective_from<=p_date order by r.effective_from desc,r.revision desc limit 1)
 select r.amount,r.basis_unit_id,case when r.usage_unit_id=m.usage_unit_id then r.verification else 'needs_verification' end,r.effective_from,
 r.issue||case when r.package_quantity is not null and not r.package_verified then ' · Quy cách đóng gói chờ xác minh' else '' end||case when r.usage_unit_id is distinct from m.usage_unit_id then ' UNIT_MIGRATION_REQUIRED' else '' end,r.id from resolved r join public.materials m on m.id=r.material_id
 union all select p.amount,p.basis_unit_id,p.verification,p.effective_from,''::text,p.id from (select * from public.material_prices p where p.material_id=p_material and p.effective_from<=p_date and(p.effective_to is null or p.effective_to>=p_date) order by p.effective_from desc,p.id limit 1) p where not exists(select 1 from resolved);
$$;

create function private.convert_quantity_at(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric,p_date date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare r public.material_resolutions; factor numeric; leg numeric;
begin
 if p_from=p_to then return p_quantity;end if;
 factor=private.physical_factor(p_from,p_to);if factor is not null then return p_quantity*factor;end if;
 select * into r from public.material_resolutions where material_id=p_material and effective_from<=p_date order by effective_from desc,revision desc limit 1;
 if r.id is null then return private.convert_quantity(p_material,p_from,p_to,p_quantity);end if;
 if r.package_verified then
  if p_from=r.package_unit_id then
   leg=case when p_to=r.package_content_unit_id then 1 else private.physical_factor(r.package_content_unit_id,p_to) end;
   if leg is not null then return p_quantity*r.package_quantity*leg;end if;
  elsif p_to=r.package_unit_id then
   leg=case when p_from=r.package_content_unit_id then 1 else private.physical_factor(p_from,r.package_content_unit_id) end;
   if leg is not null then return p_quantity*leg/r.package_quantity;end if;
  end if;
 end if;
 raise exception 'UNIT_NEEDS_VERIFICATION';
end $$;

create function private.confirmed_unit_cost(p_material uuid,p_unit uuid,p_date date) returns numeric language plpgsql stable security definer set search_path='' as $$
declare p record; factor numeric;
begin
 select * into p from private.effective_material_price(p_material,p_date);
 if p.verification is distinct from 'verified' or p.amount is null then return null;end if;
 begin factor=private.convert_quantity_at(p_material,p.basis_unit_id,p_unit,1,p_date);
 exception when raise_exception then if SQLERRM='UNIT_NEEDS_VERIFICATION' then return null;else raise;end if;end;
 return p.amount/factor;
end $$;

create or replace function private.bom(p_version uuid,p_quantity numeric,p_date date)
returns table(material_id uuid,unit_id uuid,quantity numeric,unit_cost numeric) language plpgsql stable security definer set search_path='' as $$
declare r record; child record; price record; converted numeric;
begin
 if p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'INVALID_QUANTITY';end if;
 if not exists(select 1 from public.recipe_versions where id=p_version) then raise exception 'RECIPE_NOT_FOUND';end if;
 for r in select i.*,v.output_quantity from public.recipe_items i join public.recipe_versions v on v.id=i.recipe_version_id where i.recipe_version_id=p_version loop
  if r.child_version_id is not null then
   if not exists(select 1 from public.recipe_versions v where v.id=r.child_version_id and v.output_unit_id=r.unit_id) then raise exception 'CHILD_OUTPUT_UNIT_MISMATCH';end if;
   for child in select * from private.bom(r.child_version_id,p_quantity*r.quantity/r.output_quantity,p_date) loop
    material_id=child.material_id;unit_id=child.unit_id;quantity=child.quantity;unit_cost=child.unit_cost;return next;
   end loop;
  else
   select m.usage_unit_id into unit_id from public.materials m where m.id=r.material_id;
   material_id=r.material_id;quantity=private.convert_quantity_at(r.material_id,r.unit_id,unit_id,p_quantity*r.quantity/r.output_quantity,p_date);
   select * into price from private.effective_material_price(r.material_id,p_date);unit_cost=null;
   if price.verification='verified' and price.amount is not null then
    begin
     converted=private.convert_quantity_at(r.material_id,price.basis_unit_id,unit_id,1,p_date);unit_cost=price.amount/converted;
    exception when raise_exception then
     if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;
    end;
   end if;
   return next;
  end if;
 end loop;
end $$;

create function public.material_cost_basis(p_material uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 return jsonb_build_object('amount',p.amount::text,'basis_unit',(select code from public.material_units where id=p.basis_unit_id),'usage_unit',(select code from public.material_units where id=m.usage_unit_id),'purchase_unit',(select code from public.material_units where id=m.purchase_unit_id),'usage_cost_vnd',usage_cost::text,'purchase_cost_vnd',purchase_cost::text,'official_ready',usage_cost is not null,'verification',p.verification,'issue',p.issue);
end $$;

-- Reuse the catalog pagination/scopes while changing its authoritative price source.
do $upgrade$
declare definition text;
begin
 select pg_get_functiondef('public.material_catalog(date,text,text,integer,integer)'::regprocedure) into definition;
 definition=replace(definition,'select p.amount,p.verification from public.material_prices p where p.material_id=m.id and p.effective_from<=p_date and (p.effective_to is null or p.effective_to>=p_date) order by p.effective_from desc limit 1','select p.amount,p.verification from private.effective_material_price(m.id,p_date) p');
 definition=replace(definition,'select p.amount,p.basis_unit_id,p.effective_from,p.verification from public.material_prices p where p.material_id=m.id and p.effective_from<=p_date and (p.effective_to is null or p.effective_to>=p_date) order by p.effective_from desc limit 1','select p.* from private.effective_material_price(m.id,p_date) p');
 definition=replace(definition,'price.verification price_verification,','price.verification price_verification,price.issue price_issue,(select code from public.material_units where id=price.basis_unit_id) price_unit_code,exists(select 1 from public.material_resolutions where id=price.id) price_resolved,');
 if definition like '%from public.material_prices%' then raise exception 'CATALOG_UPGRADE_MISMATCH';end if;
 execute definition;
 select pg_get_functiondef('private.insert_movement(uuid,date,text,jsonb,text,uuid)'::regprocedure) into definition;
 definition=replace(definition,'private.convert_quantity((line->>''material_id'')::uuid,(line->>''unit_id'')::uuid,standard,(line->>''quantity'')::numeric)','private.convert_quantity_at((line->>''material_id'')::uuid,(line->>''unit_id'')::uuid,standard,(line->>''quantity'')::numeric,p_date)');
 definition=replace(definition,'(line->>''unit_cost'')::numeric);','case when exists(select 1 from public.material_resolutions where material_id=(line->>''material_id'')::uuid and effective_from<=p_date) then private.confirmed_unit_cost((line->>''material_id'')::uuid,standard,p_date) when coalesce((select verification from private.effective_material_price((line->>''material_id'')::uuid,p_date)),'''')<>''verified'' then null else (line->>''unit_cost'')::numeric end);');
 if definition not like '%private.confirmed_unit_cost%' or definition not like '%private.convert_quantity_at%' then raise exception 'MOVEMENT_UPGRADE_MISMATCH';end if;
 execute definition;
end $upgrade$;

-- A resolved material must use the append-only review workflow for subsequent price changes.
create function private.resolved_price_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.material_resolutions where material_id=new.material_id) then raise exception 'USE_MATERIAL_VERIFICATION: append a resolution';end if;
 return new;
end $$;
create trigger resolved_price_guard before insert or update on public.material_prices for each row execute function private.resolved_price_guard();
create trigger resolved_conversion_guard before insert or update on public.unit_conversions for each row execute function private.resolved_price_guard();
create function private.material_resolution_identity_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.material_resolutions;
begin
 if new.usage_unit_id is distinct from old.usage_unit_id or new.purchase_unit_id is distinct from old.purchase_unit_id then
  select * into r from public.material_resolutions where material_id=new.id order by effective_from desc,revision desc limit 1;
  if r.id is not null and(new.usage_unit_id is distinct from r.usage_unit_id or new.purchase_unit_id is distinct from r.purchase_unit_id) then raise exception 'USE_MATERIAL_VERIFICATION';end if;
 end if;
 return new;
end $$;
create trigger material_resolution_identity_guard before update on public.materials for each row execute function private.material_resolution_identity_guard();

create function public.resolve_material(p_material uuid,p_expected_version bigint,p_effective date,p_input jsonb,p_key uuid)
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
 purchase=(p_input->>'purchase_unit_id')::uuid;usage=(p_input->>'usage_unit_id')::uuid;basis=(p_input->>'basis_unit_id')::uuid;
 if p_effective>(now() at time zone 'Asia/Ho_Chi_Minh')::date and(m.usage_unit_id is distinct from usage or m.purchase_unit_id is distinct from purchase) then raise exception 'FUTURE_UNIT_CHANGE_REQUIRES_MIGRATION';end if;
 if m.usage_unit_id is distinct from usage and(exists(select 1 from public.inventory_movement_lines where material_id=p_material) or exists(select 1 from public.recipe_items where material_id=p_material)) then raise exception 'UNIT_MIGRATION_REQUIRED';end if;
 if exists(select 1 from unnest(array[purchase,usage,basis,(p_input->>'package_unit_id')::uuid,(p_input->>'package_content_unit_id')::uuid]) x where x is not null and not exists(select 1 from public.material_units where id=x and not archived)) or purchase is null or usage is null then raise exception 'ACTIVE_UNITS_REQUIRED';end if;
 if p_input->>'amount' is not null and (p_input->>'amount')!~'^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_PRICE';end if;
 if p_input->>'package_quantity' is not null and (p_input->>'package_quantity')!~'^[0-9]+([.][0-9]{1,9})?$' then raise exception 'INVALID_PACKAGE';end if;
 amount=(p_input->>'amount')::numeric;verified=p_input->>'verification';evidence=trim(coalesce(p_input->>'evidence',''));
 pack_unit=(p_input->>'package_unit_id')::uuid;pack_content=(p_input->>'package_content_unit_id')::uuid;pack_amount=(p_input->>'package_quantity')::numeric;pack_verified=coalesce((p_input->>'package_verified')::boolean,false);
 if verified is null or verified<>all(array['verified','needs_verification']) or length(evidence)<5 or length(evidence)>2000 or (verified='verified' and(amount is null or basis is null)) then raise exception 'EVIDENCE_AND_PRICE_BASIS_REQUIRED';end if;
 if pack_verified and(pack_unit is null or pack_content is null or pack_unit=pack_content or pack_amount is null or pack_amount<=0) then raise exception 'INVALID_PACKAGE';end if;
 if pack_verified and private.physical_factor(pack_unit,pack_content) is not null and abs(private.physical_factor(pack_unit,pack_content)-pack_amount)>0.000000001 then raise exception 'UNIT_RATIO_MISMATCH';end if;
 insert into public.material_resolutions(material_id,effective_from,purchase_unit_id,usage_unit_id,basis_unit_id,amount,verification,package_unit_id,package_content_unit_id,package_quantity,package_verified,issue,evidence,source_data)
 values(p_material,p_effective,purchase,usage,basis,amount,verified,pack_unit,pack_content,pack_amount,pack_verified,coalesce(p_input->>'issue',''),evidence,coalesce(previous.source_data,jsonb_build_object('original_material',to_jsonb(m)))) returning id into result;
 -- Preserve the physical meaning of any stored minimum when changing the usage unit.
 update public.materials set purchase_unit_id=purchase,usage_unit_id=usage,minimum_quantity=case when m.usage_unit_id=usage then minimum_quantity else null end,price_status=verified where id=p_material;
 return private.finish_request(p_key,jsonb_build_object('id',result,'material_id',p_material,'verification',verified));
end $$;
revoke all on function private.resolution_immutable(),private.effective_material_price(uuid,date),private.convert_quantity_at(uuid,uuid,uuid,numeric,date),private.confirmed_unit_cost(uuid,uuid,date),private.resolved_price_guard(),private.material_resolution_identity_guard() from public;
revoke all on function public.resolve_material(uuid,bigint,date,jsonb,uuid),public.material_cost_basis(uuid,date) from public,anon;
grant execute on function public.resolve_material(uuid,bigint,date,jsonb,uuid),public.material_cost_basis(uuid,date) to authenticated;
commit;
