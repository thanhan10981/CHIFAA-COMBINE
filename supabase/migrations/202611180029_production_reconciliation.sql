begin;
-- Forward-only update after028: operational corrections never rewrite sales or payments.
create table public.inventory_flow_classifications(
 id uuid primary key default gen_random_uuid(),movement_id uuid not null references public.inventory_movements(id),flow text not null check(flow in ('physical','production','unclassified')),
 evidence text not null check(length(trim(evidence)) between 3 and 2000),replaces_id uuid unique references public.inventory_flow_classifications(id),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index inventory_flow_source on public.inventory_flow_classifications(movement_id,created_at desc);
create table public.stock_count_certifications(
 id uuid primary key default gen_random_uuid(),count_id uuid not null references public.stock_counts(id),observed_at timestamptz not null check(isfinite(observed_at)),
 evidence text not null check(length(trim(evidence)) between 3 and 2000),replaces_id uuid unique references public.stock_count_certifications(id),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index stock_certification_source on public.stock_count_certifications(count_id,observed_at desc);
create table public.production_day_adjustments(
 id uuid primary key default gen_random_uuid(),warehouse_id uuid not null references public.warehouses(id),business_date date not null,replacement_batch_id uuid not null references public.production_batches(id),
 before_lines jsonb not null,after_lines jsonb not null,source_documents jsonb not null,reason text not null,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index production_adjustment_day on public.production_day_adjustments(warehouse_id,business_date);
alter table public.material_usage_checks add column source_snapshot jsonb;
do $$declare tbl text;scope text;begin
 for tbl,scope in select * from(values('inventory_flow_classifications','inventory'),('stock_count_certifications','counts'),('production_day_adjustments','production')) v(t,m) loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('revoke all on public.%I from public,anon,authenticated',tbl);
 insert into private.table_modules values(tbl,scope);
 execute format('create trigger %I before insert or update or delete on public.%I for each row execute function private.record_change(%L)',tbl||'_audit',tbl,scope);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.production_material_immutable()',tbl||'_immutable',tbl);
 end loop;
end $$;

create function public.classify_inventory_flow(p_movement uuid,p_previous uuid,p_flow text,p_evidence text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;head uuid;doc public.inventory_movements;new_id uuid;begin
 if not private.can('inventory','view') or not private.can('inventory','approve') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'inventory:classify',jsonb_build_object('id',p_movement,'previous',p_previous,'flow',p_flow,'evidence',p_evidence));if cached is not null then return cached;end if;
 select * into strict doc from public.inventory_movements where id=p_movement;
 perform private.assert_open(doc.moved_on);perform pg_advisory_xact_lock(hashtextextended(doc.warehouse_id::text,0));
 if doc.source_batch_id is not null or exists(select 1 from public.stock_counts where movement_id=p_movement) or doc.reverses_id is not null then raise exception 'AUTOMATIC_FLOW_CLASSIFICATION';end if;
 select r.id into head from public.inventory_flow_classifications r where r.movement_id=p_movement and not exists(select 1 from public.inventory_flow_classifications n where n.replaces_id=r.id);
 if head is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 insert into public.inventory_flow_classifications(movement_id,flow,evidence,replaces_id) values(p_movement,p_flow,p_evidence,head) returning id into new_id;
 return private.finish_request(p_key,jsonb_build_object('id',new_id));end $$;

create function public.certify_stock_count(p_count uuid,p_version bigint,p_previous uuid,p_observed timestamptz,p_evidence text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;doc public.stock_counts;head uuid;new_id uuid;begin
 if not private.can('counts','view') or not private.can('counts','approve') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'counts:certify',jsonb_build_object('id',p_count,'version',p_version,'previous',p_previous,'observed',p_observed,'evidence',p_evidence));if cached is not null then return cached;end if;
 select * into strict doc from public.stock_counts where id=p_count;
 perform private.assert_open(doc.counted_on);perform pg_advisory_xact_lock(hashtextextended(doc.warehouse_id::text,0));
 if doc.status<>'posted' or p_version is distinct from doc.version then raise exception 'VERSION_CONFLICT';end if;
 if p_observed is null or not isfinite(p_observed) or (p_observed at time zone 'Asia/Ho_Chi_Minh')::date not between doc.counted_on and doc.counted_on+1 then raise exception 'INVALID_COUNT_TIME';end if;
 select r.id into head from public.stock_count_certifications r where count_id=p_count and not exists(select 1 from public.stock_count_certifications n where n.replaces_id=r.id);
 if head is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 insert into public.stock_count_certifications(count_id,observed_at,evidence,replaces_id) values(p_count,p_observed,p_evidence,head) returning id into new_id;
 return private.finish_request(p_key,jsonb_build_object('id',new_id));end $$;

-- Resolve reversal chains without classifying a theoretical stock issue as a physical flow.
create function private.inventory_flow(p_movement uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare doc public.inventory_movements;flow text;depth integer=0;begin
 loop
 select * into strict doc from public.inventory_movements where id=p_movement;
 if doc.source_batch_id is not null then return 'production';end if;
 if exists(select 1 from public.stock_counts where movement_id=doc.id) then return 'count';end if;
 if doc.reverses_id is not null then p_movement=doc.reverses_id;depth=depth+1;if depth>100 then raise exception 'INVALID_REVERSAL_CHAIN';end if;continue;end if;
 select r.flow into flow from public.inventory_flow_classifications r where r.movement_id=doc.id and not exists(select 1 from public.inventory_flow_classifications n where n.replaces_id=r.id);
 return coalesce(flow,case when doc.kind='receipt' then 'physical' else 'unclassified' end);
 end loop;end $$;

create function public.material_usage_evidence(p_warehouse uuid,p_date date,p_material uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare opening record;closing record;docs jsonb;counts jsonb;unknowns integer;incoming numeric;other_out numeric;token text;result jsonb;begin
 if not private.can('counts','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or not exists(select 1 from public.warehouses where id=p_warehouse and kind='ingredient') then raise exception 'INVALID_QUERY';end if;
 if not exists(select 1 from public.materials where id=p_material and usage_unit_id is not null) then raise exception 'MATERIAL_STANDARD_UNIT_REQUIRED';end if;
 select md5(coalesce(string_agg(module||':'||version::text,',' order by module),'')) into token from public.data_versions where module in ('inventory','counts','materials');
 select c.id,c.counted_on,l.counted_quantity,q.id certification_id,q.observed_at into opening from public.stock_counts c join public.stock_count_lines l on l.count_id=c.id join public.stock_count_certifications q on q.count_id=c.id and not exists(select 1 from public.stock_count_certifications n where n.replaces_id=q.id)
 where c.warehouse_id=p_warehouse and c.counted_on=p_date-1 and c.status='posted' and l.material_id=p_material order by q.observed_at desc,q.created_at desc,c.id desc limit 1;
 select c.id,c.counted_on,l.counted_quantity,q.id certification_id,q.observed_at into closing from public.stock_counts c join public.stock_count_lines l on l.count_id=c.id join public.stock_count_certifications q on q.count_id=c.id and not exists(select 1 from public.stock_count_certifications n where n.replaces_id=q.id)
 where c.warehouse_id=p_warehouse and c.counted_on=p_date and c.status='posted' and l.material_id=p_material order by q.observed_at desc,q.created_at desc,c.id desc limit 1;
 with lines as(select v.id,v.moved_on,v.kind,v.note,l.quantity,private.inventory_flow(v.id) flow,
 (select r.id from public.inventory_flow_classifications r where r.movement_id=v.id and not exists(select 1 from public.inventory_flow_classifications n where n.replaces_id=r.id)) classification_id
 from public.inventory_movements v join public.inventory_movement_lines l on l.movement_id=v.id where v.warehouse_id=p_warehouse and v.moved_on=p_date and l.material_id=p_material)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',moved_on,'kind',kind,'quantity',quantity::text,'flow',flow,'note',note,'classification_id',classification_id) order by id),'[]'),count(*) filter(where flow='unclassified'),coalesce(sum(quantity) filter(where flow='physical' and quantity>0),0),coalesce(-sum(quantity) filter(where flow='physical' and quantity<0),0)
 into docs,unknowns,incoming,other_out from lines;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.counted_on,t.created_at,t.id),'[]') into counts from(select c.id,c.counted_on,c.version::text,l.counted_quantity::text,c.created_at,
 (select q.id from public.stock_count_certifications q where q.count_id=c.id and not exists(select 1 from public.stock_count_certifications n where n.replaces_id=q.id)) certification_id
 from public.stock_counts c join public.stock_count_lines l on l.count_id=c.id where c.warehouse_id=p_warehouse and c.counted_on between p_date-1 and p_date and c.status='posted' and l.material_id=p_material) t;
 result=jsonb_build_object('version',token,'date',p_date,'material_id',p_material,'opening_count',to_jsonb(opening),'closing_count',to_jsonb(closing),'documents',docs,'counts',counts,'unclassified',unknowns,
 'complete',opening.id is not null and closing.id is not null and opening.observed_at<closing.observed_at and unknowns=0,
 'values',jsonb_build_object('opening',opening.counted_quantity::text,'incoming',case when unknowns=0 then incoming::text end,'closing',closing.counted_quantity::text,'other_out',case when unknowns=0 then other_out::text end));
 return result;end $$;

create function public.save_material_usage_from_evidence(p_warehouse uuid,p_date date,p_material uuid,p_previous uuid,p_version text,p_evidence text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;source jsonb;result jsonb;new_id uuid;begin
 if not private.can('counts','view') or not private.can('counts','approve') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'counts:usage-documents',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'material',p_material,'previous',p_previous,'version',p_version,'evidence',p_evidence));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text,0));
 -- Counts and classifications share the warehouse lock with all inventory postings.
 source=public.material_usage_evidence(p_warehouse,p_date,p_material);
 if p_version is distinct from source->>'version' then raise exception 'VERSION_CONFLICT';end if;
 if source->>'complete'<>'true' then raise exception 'INCOMPLETE_PHYSICAL_EVIDENCE';end if;
 -- Insert the immutable record with its source in the same statement (no later update).
 perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text||p_date::text||p_material::text,28));
 select r.id into new_id from public.material_usage_checks r where warehouse_id=p_warehouse and business_date=p_date and material_id=p_material and not exists(select 1 from public.material_usage_checks n where n.replaces_id=r.id);
 if new_id is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 insert into public.material_usage_checks(warehouse_id,business_date,material_id,unit_id,opening,incoming,closing,other_out,evidence,replaces_id,source_snapshot)
 values(p_warehouse,p_date,p_material,(select usage_unit_id from public.materials where id=p_material),(source#>>'{values,opening}')::numeric,(source#>>'{values,incoming}')::numeric,(source#>>'{values,closing}')::numeric,(source#>>'{values,other_out}')::numeric,p_evidence,p_previous,source) returning id into new_id;
 result=jsonb_build_object('id',new_id);return private.finish_request(p_key,result);end $$;

create function private.production_edit_version(p_warehouse uuid,p_date date) returns text language sql stable security definer set search_path='' as $$select md5(private.production_day_version(p_warehouse,p_date)||':'||coalesce((select string_agg(module||':'||version::text,',' order by module) from public.data_versions where module in ('sales','deliveries')),''))$$;

create or replace function public.replace_production_day(p_warehouse uuid,p_date date,p_expected text,p_started timestamptz,p_finished timestamptz,p_delivery date,p_lines jsonb,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;result jsonb;old_batch record;movement uuid;reversal uuid;reverse_lines jsonb;old_ids uuid[];positive jsonb;before_lines jsonb;after_lines jsonb;source_docs jsonb;day date;dates date[];item jsonb;field text;new_batch uuid;journal uuid;removed record;new_line uuid;begin
 if not private.can('production','view') or not private.can('production','edit') or not private.can('production','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'production:replace-day-029',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'expected',p_expected,'started',p_started,'finished',p_finished,'delivery',p_delivery,'lines',p_lines,'note',p_note));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);
 if not isfinite(p_date) or p_delivery is null or not isfinite(p_delivery) or length(trim(coalesce(p_note,''))) not between 3 and 2000 or jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'INVALID_CORRECTION';end if;
 if jsonb_array_length(p_lines)>100 then raise exception 'INVALID_LINES';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'product_id' having count(*)>1) then raise exception 'DUPLICATE_PRODUCT';end if;
 for item in select value from jsonb_array_elements(p_lines) loop
 foreach field in array array['main_quantity','extra_quantity','rejected_quantity'] loop
 if item->>field is null or item->>field !~ '^\d+(\.\d{1,6})?$' or (item->>field)::numeric>=1e14 then raise exception 'INVALID_QUANTITY';end if;end loop;
 if (item->>'rejected_quantity')::numeric>(item->>'main_quantity')::numeric+(item->>'extra_quantity')::numeric then raise exception 'INVALID_REJECTED_QUANTITY';end if;
 end loop;
 perform pg_advisory_xact_lock(170011);perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text,0));
 lock table public.deliveries,public.delivery_items,public.sales_documents,public.sales_lines in share mode;
 if p_expected is distinct from private.production_edit_version(p_warehouse,p_date) then raise exception 'VERSION_CONFLICT';end if;
 select array_agg(id) into old_ids from public.production_batches where warehouse_id=p_warehouse and produced_on=p_date and status='posted';
 if old_ids is null then raise exception 'NO_PRODUCTION_TO_REPLACE';end if;
 select array_agg(distinct d) into dates from(select coalesce(b.delivery_date,b.produced_on) d from public.production_batches b where id=any(old_ids) union select p_delivery) a;
 select coalesce(jsonb_agg(x),'[]') into positive from jsonb_array_elements(p_lines) x where (x->>'main_quantity')::numeric+(x->>'extra_quantity')::numeric>0;
 foreach day in array dates loop
 perform private.assert_open(day);
 if exists(select 1 from public.sales_documents sd join public.deliveries d on d.id=sd.delivery_id join public.sales_lines sl on sl.document_id=sd.id
 where sd.status='posted' and d.status='posted' and d.delivery_date=day and sl.product_id in(select product_id from public.production_batch_lines where batch_id=any(old_ids) union select (x->>'product_id')::uuid from jsonb_array_elements(positive) x)
 group by d.id,sl.product_id having sum(sl.delivered)>coalesce((select sum(i.quantity) from public.delivery_items i where i.delivery_id=d.id and i.product_id=sl.product_id),0)) then raise exception 'SOURCE_DELIVERY_SALES_MISMATCH';end if;
 -- Delivery rows are authoritative; linked sales do not add the same delivered quantity twice.
 if exists(with required as(
 select i.product_id,sum(i.quantity) q from public.delivery_items i join public.deliveries d on d.id=i.delivery_id where d.status='posted' and d.delivery_date=day and i.product_id in(select product_id from public.production_batch_lines where batch_id=any(old_ids) union select (x->>'product_id')::uuid from jsonb_array_elements(positive) x) group by i.product_id
 union all select l.product_id,sum(l.delivered) from public.sales_lines l join public.sales_documents sd on sd.id=l.document_id where sd.status='posted' and sd.sold_on=day and l.product_id in(select product_id from public.production_batch_lines where batch_id=any(old_ids) union select (x->>'product_id')::uuid from jsonb_array_elements(positive) x) and not exists(select 1 from public.deliveries d where d.id=sd.delivery_id and d.status='posted') group by l.product_id),
 available as(select l.product_id,sum(l.main_quantity+l.extra_quantity-l.rejected_quantity) q from public.production_batch_lines l join public.production_batches b on b.id=l.batch_id where b.status='posted' and not(b.id=any(old_ids)) and coalesce(b.delivery_date,b.produced_on)=day group by l.product_id
 union all select (x->>'product_id')::uuid,sum((x->>'main_quantity')::numeric+(x->>'extra_quantity')::numeric-(x->>'rejected_quantity')::numeric) from jsonb_array_elements(positive) x where day=p_delivery group by 1)
 select 1 from required r group by r.product_id having sum(r.q)>coalesce((select sum(a.q) from available a where a.product_id=r.product_id),0)) then raise exception 'CORRECTED_PRODUCTION_BELOW_DELIVERED';end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'version',version::text,'date',source_date)),'[]') into source_docs from(
 select 'delivery' kind,id,version,delivery_date source_date from public.deliveries where status='posted' and delivery_date=any(dates)
 union all select 'sales',sd.id,sd.version,sd.sold_on from public.sales_documents sd where sd.status='posted' and (sd.sold_on=any(dates) or exists(select 1 from public.deliveries d where d.id=sd.delivery_id and d.status='posted' and d.delivery_date=any(dates)))) sources;
 if source_docs<>'[]'::jsonb and (not private.can('deliveries','view') or not private.can('sales','view')) then raise exception 'SOURCE_REVIEW_PERMISSION_REQUIRED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('batch_id',l.batch_id,'product_id',l.product_id,'recipe_version_id',l.recipe_version_id,'main',l.main_quantity::text,'extra',l.extra_quantity::text,'rejected',l.rejected_quantity::text)),'[]') into before_lines from public.production_batch_lines l where batch_id=any(old_ids);
 for old_batch in select * from public.production_batches where id=any(old_ids) loop
 select id into movement from public.inventory_movements where source_batch_id=old_batch.id;
 if movement is not null then
 select jsonb_agg(jsonb_build_object('material_id',l.material_id,'unit_id',l.unit_id,'quantity',(-l.quantity)::text,'unit_cost',l.unit_cost)) into reverse_lines from public.inventory_movement_lines l where l.movement_id=movement;
 reversal=private.insert_movement(p_warehouse,p_date,'reversal',reverse_lines,'Điều chỉnh số sản lượng: '||p_note);
 update public.inventory_movements set status='reversed' where id=movement;update public.inventory_movements set reverses_id=movement where id=reversal;
 end if;
 update public.production_batches set status='reversed' where id=old_batch.id;
 end loop;
 if positive<>'[]'::jsonb then
 result=public.post_production_run(p_warehouse,p_date,p_started,p_finished,p_delivery,positive,p_note,gen_random_uuid());new_batch=(result->>'batch_id')::uuid;
 else
 insert into public.production_batches(warehouse_id,produced_on,status,delivery_date,production_note,calculation_context) values(p_warehouse,p_date,'posted',p_delivery,p_note,jsonb_build_object('cancelled_entry',true,'replaced_batch_ids',old_ids,'calculated_at',now())) returning id into new_batch;
 result=jsonb_build_object('batch_id',new_batch,'movement_id',null,'cancelled_entry',true);
 end if;
 -- Explicit zero source rows distinguish a corrected zero from missing production data.
 for removed in select distinct on(l.product_id) l.product_id,l.recipe_version_id from public.production_batch_lines l where l.batch_id=any(old_ids) and not exists(select 1 from public.production_batch_lines n where n.batch_id=new_batch and n.product_id=l.product_id) order by l.product_id,l.id loop
 insert into public.production_batch_lines(batch_id,product_id,recipe_version_id,main_quantity,extra_quantity,rejected_quantity) values(new_batch,removed.product_id,removed.recipe_version_id,0,0,0) returning id into new_line;
 insert into public.ingredient_requirement_snapshots(batch_line_id,material_id,unit_id,quantity) select new_line,s.material_id,s.unit_id,0 from public.ingredient_requirement_snapshots s join public.production_batch_lines l on l.id=s.batch_line_id where l.batch_id=any(old_ids) and l.product_id=removed.product_id group by s.material_id,s.unit_id;
 end loop;
 update public.production_batches set replaced_by_id=new_batch where id=any(old_ids);
 select coalesce(jsonb_agg(jsonb_build_object('batch_id',l.batch_id,'product_id',l.product_id,'recipe_version_id',l.recipe_version_id,'main',l.main_quantity::text,'extra',l.extra_quantity::text,'rejected',l.rejected_quantity::text)),'[]') into after_lines from public.production_batch_lines l where batch_id=new_batch;
 insert into public.production_day_adjustments(warehouse_id,business_date,replacement_batch_id,before_lines,after_lines,source_documents,reason) values(p_warehouse,p_date,new_batch,before_lines,after_lines,source_docs,p_note) returning id into journal;
 return private.finish_request(p_key,result||jsonb_build_object('adjustment_id',journal,'replaced_batch_ids',old_ids));end $$;

alter function public.production_material_workspace(uuid,date,date,text) rename to production_material_workspace_before029;
revoke all on function public.production_material_workspace_before029(uuid,date,date,text) from public,anon,authenticated;
create function public.production_material_workspace(p_warehouse uuid,p_from date,p_to date,p_mode text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 result=public.production_material_workspace_before029(p_warehouse,p_from,p_to,p_mode);
 return result||jsonb_build_object('capabilities',jsonb_build_object('reconciliation',true,'production_correction',true),'production_version',private.production_edit_version(p_warehouse,p_to),
 'adjustments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',business_date,'replacement_batch_id',replacement_batch_id,'before_lines',before_lines,'after_lines',after_lines,'documents',case when private.can('sales','view') and private.can('deliveries','view') then source_documents else '[]'::jsonb end,'reason',reason,'created_at',created_at,'created_by',created_by) order by created_at desc),'[]') from public.production_day_adjustments where warehouse_id=p_warehouse and business_date between p_from and p_to),
 'usage_sources',case when private.can('counts','view') then(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'material_id',c.material_id,'date',c.business_date,'snapshot',c.source_snapshot)),'[]') from public.material_usage_checks c where c.warehouse_id=p_warehouse and c.business_date between p_from and p_to and c.source_snapshot is not null and not exists(select 1 from public.material_usage_checks n where n.replaces_id=c.id)) else '[]'::jsonb end);
end $$;
-- Rebind snapshot creation to the029 reader and retain all operational source snapshots.
create or replace function public.freeze_consumption_report(p_warehouse uuid,p_from date,p_to date,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;payload jsonb;new_id uuid;begin
 if not private.can('reports','approve') or not private.can('reports','view') or not private.can('counts','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'reports:consumption',jsonb_build_object('warehouse',p_warehouse,'from',p_from,'to',p_to));if cached is not null then return cached;end if;
 perform private.assert_open(p_from);perform private.assert_open(p_to);
 if exists(select 1 from public.accounting_periods where status='closed' and starts_on<=p_to and ends_on>=p_from) then raise exception 'PERIOD_CLOSED';end if;
 payload=public.production_material_workspace(p_warehouse,p_from,p_to,'actual');
 insert into public.consumption_report_snapshots(warehouse_id,starts_on,ends_on,payload) values(p_warehouse,p_from,p_to,payload) returning id into new_id;
 return private.finish_request(p_key,jsonb_build_object('id',new_id,'payload',payload));end $$;
create or replace function public.consumption_report_history(p_warehouse uuid,p_snapshot uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;payload jsonb;begin
 if not private.can('reports','view') or not private.can('counts','view') or not private.can('requirements','view') or not private.can('production','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_snapshot is not null then
 select jsonb_build_object('id',s.id,'created_at',s.created_at,'created_by',s.created_by),s.payload into result,payload from public.consumption_report_snapshots s where s.id=p_snapshot and s.warehouse_id=p_warehouse;
 if result is null then return null;end if;
 if not private.can('sales','view') then payload=jsonb_set(payload,'{products}',(select coalesce(jsonb_agg(p-'sales'),'[]') from jsonb_array_elements(payload->'products') p));end if;
 if payload ? 'adjustments' and (not private.can('sales','view') or not private.can('deliveries','view')) then payload=jsonb_set(payload,'{adjustments}',(select coalesce(jsonb_agg(jsonb_set(a,'{documents}','[]')),'[]') from jsonb_array_elements(payload->'adjustments') a));end if;
 return result||jsonb_build_object('payload',payload);
 end if;
 return(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from(select id,starts_on,ends_on,created_at,created_by from public.consumption_report_snapshots where warehouse_id=p_warehouse order by created_at desc,id limit 50) t);end $$;
revoke all on all functions in schema private from public;
revoke all on function public.classify_inventory_flow(uuid,uuid,text,text,uuid),public.certify_stock_count(uuid,bigint,uuid,timestamptz,text,uuid),public.material_usage_evidence(uuid,date,uuid),public.save_material_usage_from_evidence(uuid,date,uuid,uuid,text,text,uuid),public.production_material_workspace(uuid,date,date,text) from public,anon;
grant execute on function public.classify_inventory_flow(uuid,uuid,text,text,uuid),public.certify_stock_count(uuid,bigint,uuid,timestamptz,text,uuid),public.material_usage_evidence(uuid,date,uuid),public.save_material_usage_from_evidence(uuid,date,uuid,uuid,text,text,uuid),public.production_material_workspace(uuid,date,date,text) to authenticated;
commit;
