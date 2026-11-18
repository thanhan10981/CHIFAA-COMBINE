begin;
alter table public.production_plans add column ingredient_warehouse_id uuid references public.warehouses(id);
create function public.assign_production_plan(p_plan uuid,p_warehouse uuid,p_version bigint,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;plan public.production_plans;begin
 if not private.can('production','view') or not private.can('production','approve') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'production:assign-plan',jsonb_build_object('plan',p_plan,'warehouse',p_warehouse,'version',p_version));if cached is not null then return cached;end if;
 select * into strict plan from public.production_plans where id=p_plan for update;
 perform private.assert_open(plan.production_date);perform private.assert_open(plan.delivery_date);
 if p_version is distinct from plan.version then raise exception 'VERSION_CONFLICT';end if;
 if plan.status not in ('approved','completed') or not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INVALID_PLAN';end if;
 if exists(select 1 from public.production_batches where plan_id=p_plan and status='posted') then raise exception 'PLAN_ALREADY_PRODUCED';end if;
 update public.production_plans set ingredient_warehouse_id=p_warehouse where id=p_plan;
 return private.finish_request(p_key,jsonb_build_object('id',p_plan));end $$;
alter table public.production_batches add column started_at timestamptz;
alter table public.production_batches add column finished_at timestamptz;
alter table public.production_batches add column delivery_date date;
alter table public.production_batches add column production_note text;
alter table public.production_batches add column replaced_by_id uuid references public.production_batches(id);
alter table public.production_batches add column calculation_context jsonb;
create function private.production_day_version(p_warehouse uuid,p_date date) returns text language sql stable security definer set search_path='' as $$select md5(coalesce(string_agg(id::text||':'||version::text,',' order by id),'')) from public.production_batches where warehouse_id=p_warehouse and produced_on=p_date and status='posted'$$;
create function private.production_package(p_material uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.materials;factor numeric;begin
 select * into strict m from public.materials where id=p_material;
 if m.purchase_unit_id is not null and m.usage_unit_id is not null then
 begin factor=private.convert_quantity_at(m.id,m.purchase_unit_id,m.usage_unit_id,1,p_date);
 exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;factor=null;end;
 end if;
 return jsonb_build_object('unit',(select code from public.material_units where id=m.purchase_unit_id),'usage_per_package',factor::text,'verified',factor is not null);
end $$;
create function public.post_production_run(p_warehouse uuid,p_date date,p_started timestamptz,p_finished timestamptz,p_delivery date,p_lines jsonb,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;result jsonb;x jsonb;f text;begin
 if not private.can('production','view') or not private.can('production','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'production:run',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'started',p_started,'finished',p_finished,'delivery',p_delivery,'lines',p_lines,'note',p_note));if cached is not null then return cached;end if;
 if p_date is null or not isfinite(p_date) or p_started is null or p_finished is null or not isfinite(p_started) or not isfinite(p_finished) or p_finished<p_started or p_delivery is null or not isfinite(p_delivery) or p_finished-p_started>interval '2 days' or length(trim(coalesce(p_note,''))) not between 3 and 2000 then raise exception 'INVALID_PRODUCTION_RUN';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_LINES';end if;
 for x in select value from jsonb_array_elements(p_lines) loop
 foreach f in array array['main_quantity','extra_quantity','rejected_quantity'] loop
 if x->>f is null or (x->>f) !~ '^\d+(\.\d{1,6})?$' or (x->>f)::numeric>=1e14 then raise exception 'INVALID_QUANTITY';end if;end loop;end loop;
 -- Separate internal key: retries of the outer request never duplicate the batch or stock issue.
 result=public.post_production(p_warehouse,p_date,p_lines,gen_random_uuid());
 update public.production_batches set started_at=p_started,finished_at=p_finished,delivery_date=p_delivery,production_note=p_note,
 calculation_context=jsonb_build_object('lines',p_lines,'calculated_at',now(),'date',p_date,
 'recipes',(with recursive versions as(select recipe_version_id id from public.production_batch_lines where batch_id=(result->>'batch_id')::uuid union select i.child_version_id from public.recipe_items i join versions v on v.id=i.recipe_version_id where i.child_version_id is not null) select jsonb_agg(jsonb_build_object('id',v.id,'output_quantity',v.output_quantity::text,'output_unit_id',v.output_unit_id,'revision',v.revision)) from versions r join public.recipe_versions v on v.id=r.id),
 'conversions',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'material_id',c.material_id,'from_unit_id',c.from_unit_id,'to_unit_id',c.to_unit_id,'factor',c.factor::text,'verified',c.verified)),'[]') from public.unit_conversions c where c.material_id in(select s.material_id from public.ingredient_requirement_snapshots s join public.production_batch_lines bl on bl.id=s.batch_line_id where bl.batch_id=(result->>'batch_id')::uuid)),
 'resolutions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'material_id',r.material_id,'effective_from',r.effective_from,'usage_unit_id',r.usage_unit_id,'package_unit_id',r.package_unit_id,'package_content_unit_id',r.package_content_unit_id,'package_quantity',r.package_quantity::text,'package_verified',r.package_verified)),'[]') from public.material_resolutions r where r.id in(select distinct on (mr.material_id) mr.id from public.material_resolutions mr where mr.effective_from<=p_date and mr.material_id in(select s.material_id from public.ingredient_requirement_snapshots s join public.production_batch_lines bl on bl.id=s.batch_line_id where bl.batch_id=(result->>'batch_id')::uuid) order by mr.material_id,mr.effective_from desc,mr.revision desc)))
 where id=(result->>'batch_id')::uuid;
 return private.finish_request(p_key,result);end $$;
create function public.replace_production_day(p_warehouse uuid,p_date date,p_expected text,p_started timestamptz,p_finished timestamptz,p_delivery date,p_lines jsonb,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;result jsonb;old_batch record;movement uuid;reversal uuid;reverse_lines jsonb;old_ids uuid[];begin
 if not private.can('production','view') or not private.can('production','edit') or not private.can('production','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'production:replace-day',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'expected',p_expected,'started',p_started,'finished',p_finished,'delivery',p_delivery,'lines',p_lines,'note',p_note));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);perform pg_advisory_xact_lock(170011);
 if p_expected is distinct from private.production_day_version(p_warehouse,p_date) then raise exception 'VERSION_CONFLICT';end if;
 -- Existing deliveries/sales cannot be silently rewritten by a production correction.
 if exists(select 1 from public.deliveries d where d.status='posted' and (d.delivery_date in(p_date,p_delivery) or exists(select 1 from public.production_batches b where b.warehouse_id=p_warehouse and b.produced_on=p_date and b.status='posted' and b.delivery_date=d.delivery_date))) or exists(select 1 from public.sales_documents sd where sd.status='posted' and (sd.sold_on in(p_date,p_delivery) or exists(select 1 from public.production_batches b where b.warehouse_id=p_warehouse and b.produced_on=p_date and b.status='posted' and b.delivery_date=sd.sold_on))) then raise exception 'LINKED_DELIVERY_OR_SALES_ADJUSTMENT_REQUIRED';end if;
 select array_agg(id) into old_ids from public.production_batches where warehouse_id=p_warehouse and produced_on=p_date and status='posted';
 if old_ids is null then raise exception 'NO_PRODUCTION_TO_REPLACE';end if;
 for old_batch in select * from public.production_batches where id=any(old_ids) loop
 select id into strict movement from public.inventory_movements where source_batch_id=old_batch.id;
 select jsonb_agg(jsonb_build_object('material_id',l.material_id,'unit_id',l.unit_id,'quantity',(-l.quantity)::text,'unit_cost',l.unit_cost)) into reverse_lines from public.inventory_movement_lines l where l.movement_id=movement;
 update public.inventory_movements set status='reversed' where id=movement;
 reversal=private.insert_movement(p_warehouse,p_date,'reversal',reverse_lines,'Điều chỉnh sản xuất: '||p_note);
 update public.inventory_movements set reverses_id=movement where id=reversal;
 update public.production_batches set status='reversed' where id=old_batch.id;
 end loop;
 result=public.post_production_run(p_warehouse,p_date,p_started,p_finished,p_delivery,p_lines,p_note,gen_random_uuid());
 update public.production_batches set replaced_by_id=(result->>'batch_id')::uuid where id=any(old_ids);
 return private.finish_request(p_key,result||jsonb_build_object('replaced_batch_ids',to_jsonb(old_ids)));end $$;
-- Append-only manual planning. Approved customer plans remain separate source documents.
create table public.production_plan_revisions(
 id uuid primary key default gen_random_uuid(),warehouse_id uuid not null references public.warehouses(id),business_date date not null,
 replaces_id uuid unique references public.production_plan_revisions(id),lines jsonb not null,needs jsonb not null,reason text not null,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index production_plan_day on public.production_plan_revisions(warehouse_id,business_date);
create table public.material_usage_checks(
 id uuid primary key default gen_random_uuid(),warehouse_id uuid not null references public.warehouses(id),business_date date not null,material_id uuid not null references public.materials(id),unit_id uuid not null references public.material_units(id),
 opening numeric(20,6) not null check(opening>=0 and opening<1e14),incoming numeric(20,6) not null check(incoming>=0 and incoming<1e14),closing numeric(20,6) not null check(closing>=0 and closing<1e14),other_out numeric(20,6) not null check(other_out>=0 and other_out<1e14),
 evidence text not null check(length(trim(evidence)) between 3 and 2000),replaces_id uuid unique references public.material_usage_checks(id),
 check(opening+incoming-closing-other_out>=0),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index material_usage_day on public.material_usage_checks(warehouse_id,business_date,material_id);
create table public.consumption_report_snapshots(
 id uuid primary key default gen_random_uuid(),warehouse_id uuid not null references public.warehouses(id),starts_on date not null,ends_on date not null,payload jsonb not null,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create function private.production_material_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'DOCUMENT_IMMUTABLE';end $$;
do $$declare t text;m text;begin
 for t,m in select * from(values('production_plan_revisions','production'),('material_usage_checks','counts'),('consumption_report_snapshots','reports')) a(t,m) loop
 execute format('alter table public.%I enable row level security',t);
 -- Payloads cross module boundaries: only scoped RPCs expose them after live checks.
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 insert into private.table_modules values(t,m);
 execute format('create trigger %I before insert or update or delete on public.%I for each row execute function private.record_change(%L)',t||'_audit',t,m);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.production_material_immutable()',t||'_immutable',t);
 end loop;
end $$;

create function private.planning_needs(p_date date,p_lines jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item jsonb;link record;needs jsonb='[]';part jsonb;begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>100 then raise exception 'INVALID_LINES';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'product_id' having count(*)>1) then raise exception 'DUPLICATE_PRODUCT';end if;
 for item in select value from jsonb_array_elements(p_lines) loop
 if item->>'quantity' is null or (item->>'quantity') !~ '^\d+(\.\d{1,6})?$' or (item->>'quantity')::numeric>=1e14 then raise exception 'INVALID_QUANTITY';end if;
 if not exists(select 1 from public.products where id=(item->>'product_id')::uuid and not archived) then raise exception 'INVALID_PRODUCT';end if;
 if (item->>'quantity')::numeric=0 then continue;end if;
 select l.*,p.code,p.name into link from public.product_recipe_links l join public.recipe_versions v on v.id=l.recipe_version_id join public.products p on p.id=l.product_id
 where l.product_id=(item->>'product_id')::uuid and not p.archived and v.status='published' and v.effective_from<=p_date and l.effective_from<=p_date order by l.effective_from desc limit 1;
 if not found then
 needs=needs||jsonb_build_array(jsonb_build_object('product_id',item->>'product_id','issue','PUBLISHED_PRODUCT_RECIPE_REQUIRED'));continue;end if;
 begin
 select coalesce(jsonb_agg(jsonb_build_object('material_id',b.material_id,'unit_id',b.unit_id,'quantity',b.quantity::text,'product_id',link.product_id,'product_code',link.code,'product_name',link.name,'recipe_version_id',link.recipe_version_id,'output_factor',link.output_quantity_per_product::text,'calculated_on',p_date)),'[]') into part
 from private.bom(link.recipe_version_id,(item->>'quantity')::numeric*link.output_quantity_per_product,p_date) b;
 if part='[]'::jsonb then raise exception 'EMPTY_RECIPE';end if;
 needs=needs||part;
 exception when raise_exception then
 if SQLERRM not in ('UNIT_NEEDS_VERIFICATION','RECIPE_NEEDS_REVIEW','CHILD_OUTPUT_UNIT_MISMATCH','EMPTY_RECIPE') then raise;end if;
 needs=needs||jsonb_build_array(jsonb_build_object('product_id',link.product_id,'product_name',link.name,'issue',SQLERRM));end;
 end loop;return needs;
end $$;

create function public.save_production_plan(p_warehouse uuid,p_date date,p_previous uuid,p_mode text,p_lines jsonb,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;head public.production_plan_revisions;lines jsonb;needs jsonb;new_id uuid;begin
 if not private.can('production','view') or not private.can('production','create') or not private.can('requirements','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'production:plan',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'previous',p_previous,'mode',p_mode,'lines',p_lines,'reason',p_reason));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);if not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 if p_mode is null or p_mode not in ('replace','append') or length(trim(coalesce(p_reason,''))) not between 3 and 2000 or not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INVALID_PLAN';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text||p_date::text,28));
 select * into head from public.production_plan_revisions r where warehouse_id=p_warehouse and business_date=p_date and not exists(select 1 from public.production_plan_revisions n where n.replaces_id=r.id);
 if head.id is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 perform private.planning_needs(p_date,p_lines);
 lines=p_lines;
 if p_mode='append' then
 select jsonb_agg(jsonb_build_object('product_id',id,'quantity',q::text)) into lines from(select x->>'product_id' id,sum((x->>'quantity')::numeric) q from jsonb_array_elements(coalesce(head.lines,'[]')||p_lines) x group by x->>'product_id') a;
 end if;
 lines=coalesce(lines,'[]');needs=private.planning_needs(p_date,lines);
 insert into public.production_plan_revisions(warehouse_id,business_date,replaces_id,lines,needs,reason) values(p_warehouse,p_date,head.id,lines,needs,p_reason) returning id into new_id;
 return private.finish_request(p_key,jsonb_build_object('id',new_id));end $$;

create function public.save_material_usage(p_warehouse uuid,p_date date,p_material uuid,p_previous uuid,p_values jsonb,p_evidence text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;head uuid;new_id uuid;u uuid;f text;begin
 if not private.can('counts','view') or not private.can('counts','approve') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'counts:usage',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'material',p_material,'previous',p_previous,'values',p_values,'evidence',p_evidence));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);if not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INVALID_WAREHOUSE';end if;
 foreach f in array array['opening','incoming','closing','other_out'] loop
 if p_values->>f is null or (p_values->>f) !~ '^\d+(\.\d{1,6})?$' then raise exception 'INCOMPLETE_USAGE';end if;end loop;
 perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text||p_date::text||p_material::text,28));
 select r.id into head from public.material_usage_checks r where warehouse_id=p_warehouse and business_date=p_date and material_id=p_material and not exists(select 1 from public.material_usage_checks n where n.replaces_id=r.id);
 if head is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 select usage_unit_id into strict u from public.materials where id=p_material and not archived;
 insert into public.material_usage_checks(warehouse_id,business_date,material_id,unit_id,opening,incoming,closing,other_out,evidence,replaces_id)
 values(p_warehouse,p_date,p_material,u,(p_values->>'opening')::numeric,(p_values->>'incoming')::numeric,(p_values->>'closing')::numeric,(p_values->>'other_out')::numeric,p_evidence,head) returning id into new_id;
 return private.finish_request(p_key,jsonb_build_object('id',new_id));end $$;

create function public.production_material_workspace(p_warehouse uuid,p_from date,p_to date,p_mode text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare products jsonb;needs jsonb='[]';materials jsonb;history jsonb;head public.production_plan_revisions;approved jsonb;result jsonb;begin
 if not private.can('requirements','view') or not private.can('production','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from or p_to-p_from>366 or p_mode is null or p_mode not in ('planned','actual') then raise exception 'INVALID_PERIOD';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and kind='ingredient') then raise exception 'INVALID_WAREHOUSE';end if;
 select * into head from public.production_plan_revisions r where warehouse_id=p_warehouse and business_date=p_to and not exists(select 1 from public.production_plan_revisions n where n.replaces_id=r.id);
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into products from(
 select p.id,p.code,p.name,p.sale_unit,l.recipe_version_id,
 (select sum(pl.planned_quantity)::text from public.production_plan_lines pl join public.production_plans h on h.id=pl.plan_id where pl.product_id=p.id and h.delivery_date=p_to and h.ingredient_warehouse_id=p_warehouse and h.status in ('approved','completed')) approved_quantity,
 (select sum(bl.main_quantity)::text from public.production_batch_lines bl join public.production_batches b on b.id=bl.batch_id where bl.product_id=p.id and b.warehouse_id=p_warehouse and b.status='posted' and b.produced_on between p_from and p_to) main_quantity,
 (select sum(bl.extra_quantity)::text from public.production_batch_lines bl join public.production_batches b on b.id=bl.batch_id where bl.product_id=p.id and b.warehouse_id=p_warehouse and b.status='posted' and b.produced_on between p_from and p_to) extra_quantity,
 (select sum(bl.rejected_quantity)::text from public.production_batch_lines bl join public.production_batches b on b.id=bl.batch_id where bl.product_id=p.id and b.warehouse_id=p_warehouse and b.status='posted' and b.produced_on between p_from and p_to) rejected_quantity,
 case when private.can('sales','view') then(select jsonb_build_object('delivered',sum(sl.delivered)::text,'sold',sum(sl.sold)::text,'returned',sum(sl.returned)::text,'store_borne',sum(sl.store_borne)::text) from public.sales_lines sl join public.sales_documents sd on sd.id=sl.document_id where sl.product_id=p.id and sd.status='posted' and sd.sold_on between p_from and p_to) end sales
 from public.products p left join lateral(select x.recipe_version_id from public.product_recipe_links x join public.recipe_versions v on v.id=x.recipe_version_id where x.product_id=p.id and x.effective_from<=p_to and v.effective_from<=p_to and v.status='published' order by x.effective_from desc limit 1) l on true where not p.archived or exists(select 1 from public.production_batch_lines bl join public.production_batches b on b.id=bl.batch_id where bl.product_id=p.id and b.warehouse_id=p_warehouse and b.status='posted' and b.produced_on between p_from and p_to) order by p.name) t;
 if p_mode='planned' then
 select coalesce(jsonb_agg(jsonb_build_object('product_id',pl.product_id,'quantity',pl.q::text)),'[]') into approved from(select l.product_id,sum(l.planned_quantity) q from public.production_plan_lines l join public.production_plans h on h.id=l.plan_id where h.delivery_date=p_to and h.ingredient_warehouse_id=p_warehouse and h.status in ('approved','completed') group by l.product_id) pl;
 needs=coalesce(head.needs,'[]')||private.planning_needs(p_to,approved);
 else
 select coalesce(jsonb_agg(jsonb_build_object('material_id',s.material_id,'unit_id',s.unit_id,'quantity',s.quantity::text,'product_id',l.product_id,'recipe_version_id',l.recipe_version_id,'batch_id',b.id,'date',b.produced_on,'started_at',b.started_at,'finished_at',b.finished_at,'delivery_date',b.delivery_date,'recorded_at',b.created_at,'recorded_by',b.created_by,'note',b.production_note)),'[]') into needs from public.ingredient_requirement_snapshots s join public.production_batch_lines l on l.id=s.batch_line_id join public.production_batches b on b.id=l.batch_id where b.status='posted' and b.warehouse_id=p_warehouse and b.produced_on between p_from and p_to;
 end if;
 with daily as(select (x->>'material_id')::uuid material_id,(x->>'unit_id')::uuid unit_id,(x->>'date')::date usage_date,sum((x->>'quantity')::numeric) q from jsonb_array_elements(needs) x where x ? 'material_id' group by 1,2,3),
 checks as(select c.* from public.material_usage_checks c where c.warehouse_id=p_warehouse and c.business_date between p_from and p_to and not exists(select 1 from public.material_usage_checks n where n.replaces_id=c.id)),
 totals as(select d.material_id,d.unit_id,sum(d.q) q,sum(d.q) filter(where c.id is not null) checked_theory,sum(c.opening+c.incoming-c.closing-c.other_out) actual,count(c.id) checked_days,count(*) theory_days from daily d left join checks c on c.material_id=d.material_id and c.unit_id=d.unit_id and c.business_date=d.usage_date and private.can('counts','view') group by d.material_id,d.unit_id)
 select coalesce(jsonb_agg(jsonb_build_object('material_id',m.id,'code',m.code,'name',m.name,'unit_id',u.id,'unit',u.code,'quantity',t.q::text,'checked_theory',t.checked_theory::text,'actual',t.actual::text,'difference',(t.actual-t.checked_theory)::text,'percent',((t.actual-t.checked_theory)/nullif(t.checked_theory,0)*100)::text,'checked_days',coalesce(t.checked_days,0),'theory_days',coalesce(t.theory_days,0),
 'package',private.production_package(m.id,p_to),'minimum',m.minimum_quantity::text,'stock',(select sum(l.quantity)::text from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id where l.material_id=m.id and l.unit_id=u.id and v.warehouse_id=p_warehouse and v.moved_on<=p_to),
 'check',case when private.can('counts','view') then(select jsonb_build_object('id',c.id,'opening',c.opening::text,'incoming',c.incoming::text,'closing',c.closing::text,'other_out',c.other_out::text,'evidence',c.evidence) from checks c where c.material_id=m.id and c.unit_id=u.id and c.business_date=p_to) end,
 'check_history',case when private.can('counts','view') then(select coalesce(jsonb_agg(to_jsonb(h)),'[]') from(select c.id,c.replaces_id,c.business_date,c.evidence,c.created_at,c.created_by,c.opening::text,c.incoming::text,c.closing::text,c.other_out::text from public.material_usage_checks c where c.warehouse_id=p_warehouse and c.material_id=m.id and c.business_date between p_from and p_to order by c.created_at desc,c.id limit 30) h) else '[]'::jsonb end) order by m.name),'[]') into materials
 from public.materials m join public.material_units u on u.id=m.usage_unit_id left join totals t on t.material_id=m.id and t.unit_id=u.id where not m.archived or t.material_id is not null;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into history from(select id,reason,created_at,created_by from public.production_plan_revisions where warehouse_id=p_warehouse and business_date=p_to order by created_at desc,id limit 30) t;
 result=jsonb_build_object('products',products,'materials',materials,'sources',needs,'plan_id',head.id,'plan_lines',coalesce(head.lines,'[]'),'history',history,'from',p_from,'to',p_to,'calculated_at',now(),
 'production_version',private.production_day_version(p_warehouse,p_to),
 'approved_plans',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'shift',h.shift,'version',h.version::text,'warehouse_id',h.ingredient_warehouse_id,'lines',(select jsonb_agg(jsonb_build_object('product_id',l.product_id,'quantity',l.planned_quantity::text)) from public.production_plan_lines l where l.plan_id=h.id))),'[]') from public.production_plans h where h.delivery_date=p_to and h.status in ('approved','completed')),
 'batches',(select coalesce(jsonb_agg(to_jsonb(h)),'[]') from(select id,produced_on,status,replaced_by_id,started_at,finished_at,delivery_date,production_note,calculation_context,created_at,created_by from public.production_batches where warehouse_id=p_warehouse and produced_on between p_from and p_to order by created_at desc,id) h),
 'checks',case when private.can('counts','view') then(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'material_id',c.material_id,'unit_id',c.unit_id,'date',c.business_date,'opening',c.opening::text,'incoming',c.incoming::text,'closing',c.closing::text,'other_out',c.other_out::text,'evidence',c.evidence,'created_at',c.created_at,'created_by',c.created_by,'replaces_id',c.replaces_id)),'[]') from public.material_usage_checks c where c.warehouse_id=p_warehouse and c.business_date between p_from and p_to and not exists(select 1 from public.material_usage_checks n where n.replaces_id=c.id)) else '[]'::jsonb end);
 return result;end $$;

create function public.freeze_consumption_report(p_warehouse uuid,p_from date,p_to date,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;payload jsonb;new_id uuid;begin
 if not private.can('reports','approve') or not private.can('reports','view') or not private.can('counts','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'reports:consumption',jsonb_build_object('warehouse',p_warehouse,'from',p_from,'to',p_to));if cached is not null then return cached;end if;
 perform private.assert_open(p_from);perform private.assert_open(p_to);
 if exists(select 1 from public.accounting_periods where status='closed' and starts_on<=p_to and ends_on>=p_from) then raise exception 'PERIOD_CLOSED';end if;
 payload=public.production_material_workspace(p_warehouse,p_from,p_to,'actual');
 insert into public.consumption_report_snapshots(warehouse_id,starts_on,ends_on,payload) values(p_warehouse,p_from,p_to,payload) returning id into new_id;
 return private.finish_request(p_key,jsonb_build_object('id',new_id,'payload',payload));end $$;
create function public.consumption_report_history(p_warehouse uuid,p_snapshot uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.can('reports','view') or not private.can('counts','view') or not private.can('requirements','view') or not private.can('production','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_snapshot is not null then return(select jsonb_build_object('id',id,'payload',case when private.can('sales','view') then payload else jsonb_set(payload,'{products}',(select coalesce(jsonb_agg(p-'sales'),'[]') from jsonb_array_elements(payload->'products') p)) end,'created_at',created_at,'created_by',created_by) from public.consumption_report_snapshots where id=p_snapshot and warehouse_id=p_warehouse);end if;
 return(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from(select id,starts_on,ends_on,created_at,created_by from public.consumption_report_snapshots where warehouse_id=p_warehouse order by created_at desc,id limit 50) t);end $$;
revoke all on all functions in schema private from public;
revoke all on function public.save_production_plan(uuid,date,uuid,text,jsonb,text,uuid),public.save_material_usage(uuid,date,uuid,uuid,jsonb,text,uuid),public.production_material_workspace(uuid,date,date,text),public.freeze_consumption_report(uuid,date,date,uuid),public.consumption_report_history(uuid,uuid) from public;
grant execute on function public.save_production_plan(uuid,date,uuid,text,jsonb,text,uuid),public.save_material_usage(uuid,date,uuid,uuid,jsonb,text,uuid),public.production_material_workspace(uuid,date,date,text),public.freeze_consumption_report(uuid,date,date,uuid),public.consumption_report_history(uuid,uuid) to authenticated;
revoke all on function public.post_production_run(uuid,date,timestamptz,timestamptz,date,jsonb,text,uuid) from public;
grant execute on function public.post_production_run(uuid,date,timestamptz,timestamptz,date,jsonb,text,uuid) to authenticated;
revoke all on function public.replace_production_day(uuid,date,text,timestamptz,timestamptz,date,jsonb,text,uuid) from public;
grant execute on function public.replace_production_day(uuid,date,text,timestamptz,timestamptz,date,jsonb,text,uuid) to authenticated;
revoke all on function public.assign_production_plan(uuid,uuid,bigint,uuid) from public;
grant execute on function public.assign_production_plan(uuid,uuid,bigint,uuid) to authenticated;
commit;
