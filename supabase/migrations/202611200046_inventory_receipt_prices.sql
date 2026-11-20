begin;

-- Keep the price that was entered for each receipt as a ledger snapshot.
-- Existing rows are deliberately tagged as legacy and are not re-priced.
alter table public.inventory_movement_lines
 add column unit_cost_source text not null default 'legacy_snapshot'
 check(unit_cost_source in ('receipt_input','production_snapshot','adjustment_snapshot','unknown','legacy_snapshot'));
alter table public.inventory_movement_lines
 add column correction_source_line_id uuid references public.inventory_movement_lines(id);
create unique index inventory_movement_line_correction_source on public.inventory_movement_lines(movement_id,correction_source_line_id) where correction_source_line_id is not null;

create function private.tag_inventory_cost_source() returns trigger language plpgsql security definer set search_path='' as $$
declare movement_kind text; source_batch uuid;
begin
 select kind,source_batch_id into movement_kind,source_batch from public.inventory_movements where id=new.movement_id;
 new.unit_cost_source=case
  when movement_kind='receipt' and new.unit_cost is not null then 'receipt_input'
  when movement_kind='receipt' then 'unknown'
  when movement_kind='issue' and source_batch is not null then 'production_snapshot'
  when new.unit_cost is not null then 'adjustment_snapshot'
  else 'unknown'
 end;
 return new;
end $$;
create trigger inventory_cost_source before insert on public.inventory_movement_lines for each row execute function private.tag_inventory_cost_source();
revoke all on function private.tag_inventory_cost_source() from public,anon,authenticated;

-- A receipt's actual entered price takes precedence over the current catalog
-- price. The latter remains the effective price used by recipe cost snapshots.
do $upgrade$
declare definition text; old_cost text; new_cost text; insert_token text; insert_values text; replacement_values text; validation text;
begin
 select pg_get_functiondef('private.insert_movement(uuid,date,text,jsonb,text,uuid)'::regprocedure) into definition;
 old_cost=$old$case when exists(select 1 from public.material_resolutions where material_id=(line->>'material_id')::uuid and effective_from<=p_date) then private.confirmed_unit_cost((line->>'material_id')::uuid,standard,p_date) when coalesce((select verification from private.effective_material_price((line->>'material_id')::uuid,p_date)),'')<>'verified' then null else (line->>'unit_cost')::numeric end$old$;
 new_cost=$new$case when p_kind='reversal' then (line->>'unit_cost')::numeric when p_kind='receipt' then case when line->>'unit_cost' is null then null else (line->>'unit_cost')::numeric/private.convert_quantity_at((line->>'material_id')::uuid,(line->>'unit_id')::uuid,standard,1,p_date) end else case when exists(select 1 from public.material_resolutions where material_id=(line->>'material_id')::uuid and effective_from<=p_date) then private.confirmed_unit_cost((line->>'material_id')::uuid,standard,p_date) when coalesce((select verification from private.effective_material_price((line->>'material_id')::uuid,p_date)),'')<>'verified' then null else (line->>'unit_cost')::numeric end end$new$;
 if position(old_cost in definition)=0 then raise exception 'INVENTORY_RECEIPT_PRICE_UPGRADE_MISMATCH';end if;
 definition=replace(definition,old_cost,new_cost);
 insert_token='insert into public.inventory_movement_lines(movement_id,material_id,unit_id,quantity,unit_cost) values';
 validation=$check$
  if p_kind='receipt' and line->>'unit_cost' is not null then
   if (line->>'unit_cost') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,6})?$' then raise exception 'INVALID_RECEIPT_PRICE';end if;
   if private.convert_quantity_at((line->>'material_id')::uuid,(line->>'unit_id')::uuid,standard,1,p_date) is null then raise exception 'RECEIPT_PRICE_UNIT_UNVERIFIED';end if;
  end if;
 $check$;
 if position(insert_token in definition)=0 then raise exception 'INVENTORY_RECEIPT_VALIDATION_UPGRADE_MISMATCH';end if;
 insert_values='values(movement_id,(line->>''material_id'')::uuid,standard,delta,'||new_cost||');';
 replacement_values='values(movement_id,(line->>''material_id'')::uuid,standard,delta,'||new_cost||',(line->>''correction_source_line_id'')::uuid);';
 if position(insert_values in definition)=0 then raise exception 'INVENTORY_RECEIPT_LINE_REFERENCE_UPGRADE_MISMATCH';end if;
 definition=replace(definition,insert_values,replacement_values);
 definition=replace(definition,insert_token,validation||insert_token);
 definition=replace(definition,insert_token,'insert into public.inventory_movement_lines(movement_id,material_id,unit_id,quantity,unit_cost,correction_source_line_id) values');
 execute definition;

 select pg_get_functiondef('public.material_catalog(date,text,text,integer,integer)'::regprocedure) into definition;
 if position('stock_average_unit_cost' in definition)>0 then raise exception 'INVENTORY_RECEIPT_CATALOG_ALREADY_UPDATED';end if;
 if position('price_resolved,' in definition)=0 then raise exception 'INVENTORY_RECEIPT_CATALOG_UPGRADE_MISMATCH';end if;
 definition=replace(definition,'price_resolved,',
  'price_resolved,'||E'\n   case when private.can(''inventory'',''view'') then stock_price.average_unit_cost::text end stock_average_unit_cost,'||
  E'\n   case when private.can(''inventory'',''view'') then stock_price.receipt_count::text end stock_receipt_count,'||
  E'\n   case when private.can(''inventory'',''view'') then stock_price.unpriced_count::text end stock_unpriced_receipt_count,');
 if position('left join lateral(select p.* from private.effective_material_price(m.id,p_date) p) price on true' in definition)=0 then raise exception 'INVENTORY_RECEIPT_PRICE_JOIN_UPGRADE_MISMATCH';end if;
 definition=replace(definition,
  'left join lateral(select p.* from private.effective_material_price(m.id,p_date) p) price on true',
  'left join lateral(select p.* from private.effective_material_price(m.id,p_date) p) price on true'||E'\n  left join lateral(\n   select count(*) receipt_count,count(*) filter(where l.unit_cost_source<>''receipt_input'' or l.unit_cost is null) unpriced_count,\n    case when count(*)>0 and bool_and(l.unit_cost_source=''receipt_input'' and l.unit_cost is not null) and sum(l.quantity)>0 then round(sum(l.quantity*l.unit_cost)/sum(l.quantity),6) end average_unit_cost\n   from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id join public.warehouses w on w.id=v.warehouse_id\n   where l.material_id=m.id and v.kind=''receipt'' and v.status=''posted'' and w.kind=''ingredient'' and v.moved_on<=p_date\n  ) stock_price on true');
 if position('stock_average_unit_cost' in definition)=0 or position('stock_price' in definition)=0 then raise exception 'INVENTORY_RECEIPT_CATALOG_PATCH_FAILED';end if;
 execute definition;
end $upgrade$;

-- Return the immutable entered unit price and extended value with each history row.
do $history$
declare definition text;
begin
 select pg_get_functiondef('public.inventory_history(uuid,date,uuid,integer)'::regprocedure) into definition;
 if position('unit_cost_source' in definition)>0 then raise exception 'INVENTORY_HISTORY_PRICE_ALREADY_UPDATED';end if;
 if position('v.reverses_id,v.created_at' in definition)=0 then raise exception 'INVENTORY_HISTORY_VERSION_PATCH_MISMATCH';end if;
 definition=replace(definition,'v.reverses_id,v.created_at','v.reverses_id,v.version::text movement_version,v.created_at');
 if position('null::uuid,c.created_at,c.created_by' in definition)=0 then raise exception 'INVENTORY_HISTORY_COUNT_VERSION_PATCH_MISMATCH';end if;
 definition=replace(definition,'null::uuid,c.created_at,c.created_by','null::uuid,c.version::text movement_version,c.created_at,c.created_by');
 if position('l.quantity::text,l.id line_id' in definition)=0 then raise exception 'INVENTORY_HISTORY_PRICE_PATCH_MISMATCH';end if;
 definition=replace(definition,'l.quantity::text,l.id line_id',
  'l.quantity::text,l.id line_id,l.version::text line_version,l.unit_cost::text unit_cost,l.unit_cost_source,case when l.unit_cost is not null then round(abs(l.quantity)*l.unit_cost,6)::text end line_value');
 if position('l.counted_quantity::text,l.id' in definition)=0 then raise exception 'INVENTORY_HISTORY_COUNT_PATCH_MISMATCH';end if;
 definition=replace(definition,'l.counted_quantity::text,l.id',
  'l.counted_quantity::text,l.id line_id,l.version::text line_version,null::text unit_cost,''unknown''::text unit_cost_source,null::text line_value');
 if position('to_jsonb(t)-''line_id''' in definition)=0 then raise exception 'INVENTORY_HISTORY_LINE_REFERENCE_PATCH_MISMATCH';end if;
 definition=replace(definition,'to_jsonb(t)-''line_id''','to_jsonb(t)');
 execute definition;
end $history$;

create table public.inventory_receipt_corrections(
 id uuid primary key default gen_random_uuid(),
 original_movement_id uuid not null unique references public.inventory_movements(id),
 reversal_movement_id uuid not null unique references public.inventory_movements(id),
 replacement_movement_id uuid not null unique references public.inventory_movements(id),
 original_line_id uuid not null references public.inventory_movement_lines(id),
 replacement_line_id uuid not null references public.inventory_movement_lines(id),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 version bigint not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
alter table public.inventory_receipt_corrections enable row level security;
insert into private.table_modules values('inventory_receipt_corrections','inventory');
create policy inventory_receipt_corrections_read on public.inventory_receipt_corrections for select to authenticated using(private.can('inventory','view'));
create trigger inventory_receipt_corrections_audit before insert or update or delete on public.inventory_receipt_corrections for each row execute function private.record_change('inventory');
grant select on public.inventory_receipt_corrections to authenticated;
revoke all on public.inventory_receipt_corrections from anon;

create function public.correct_inventory_receipt(
 p_movement uuid,p_line uuid,p_movement_version bigint,p_line_version bigint,p_quantity numeric,p_unit_cost numeric,p_reason text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; original public.inventory_movements; target public.inventory_movement_lines; row_line record; replacement_lines jsonb='[]'; reversal_lines jsonb; reversal uuid; replacement uuid; replacement_line uuid;
begin
 if not private.can('inventory','view') or not private.can('inventory','edit') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 if p_movement is null or p_line is null or p_movement_version is null or p_line_version is null or p_quantity is null or p_quantity<=0 or p_unit_cost<0 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_RECEIPT_CORRECTION';end if;
 cached=private.begin_request(p_key,'inventory:correct-receipt',jsonb_build_object('movement',p_movement,'line',p_line,'movement_version',p_movement_version,'line_version',p_line_version,'quantity',p_quantity,'unit_cost',p_unit_cost,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict original from public.inventory_movements where id=p_movement;
 perform private.assert_open(original.moved_on);
 perform pg_advisory_xact_lock(hashtextextended(original.warehouse_id::text,0));
 select * into strict original from public.inventory_movements where id=p_movement for update;
 select * into strict target from public.inventory_movement_lines where id=p_line and movement_id=p_movement for update;
 if original.version<>p_movement_version or target.version<>p_line_version then raise exception 'VERSION_CONFLICT';end if;
 if original.kind<>'receipt' or original.status<>'posted' or exists(select 1 from public.inventory_receipt_corrections where original_movement_id=p_movement) then raise exception 'RECEIPT_NO_LONGER_EDITABLE';end if;
 if p_unit_cost is not null and p_unit_cost>=1e14 then raise exception 'INVALID_RECEIPT_PRICE';end if;
 for row_line in select l.* from public.inventory_movement_lines l where l.movement_id=p_movement order by l.id loop
  replacement_lines=replacement_lines||jsonb_build_array(jsonb_build_object(
   'material_id',row_line.material_id,'unit_id',row_line.unit_id,
   'quantity',case when row_line.id=p_line then p_quantity::text else row_line.quantity::text end,
   'unit_cost',case when row_line.id=p_line then p_unit_cost::text when row_line.unit_cost_source='receipt_input' then row_line.unit_cost::text else null end,
   'correction_source_line_id',row_line.id));
 end loop;
 select jsonb_agg(jsonb_build_object('material_id',l.material_id,'unit_id',l.unit_id,'quantity',(-l.quantity)::text,'unit_cost',l.unit_cost::text,'correction_source_line_id',l.id)) into reversal_lines from public.inventory_movement_lines l where l.movement_id=p_movement;
 replacement=private.insert_movement(original.warehouse_id,original.moved_on,'receipt',replacement_lines,'Điều chỉnh thay thế từ phiếu nhập '||original.id||': '||btrim(p_reason));
 reversal=private.insert_movement(original.warehouse_id,original.moved_on,'reversal',reversal_lines,'Đảo phiếu nhập '||original.id||' để điều chỉnh: '||btrim(p_reason));
 update public.inventory_movements set status='reversed' where id=p_movement;
 update public.inventory_movements set reverses_id=p_movement where id=reversal;
 select id into strict replacement_line from public.inventory_movement_lines where movement_id=replacement and correction_source_line_id=p_line;
 insert into public.inventory_receipt_corrections(original_movement_id,reversal_movement_id,replacement_movement_id,original_line_id,replacement_line_id,reason)
 values(p_movement,reversal,replacement,p_line,replacement_line,btrim(p_reason));
 return private.finish_request(p_key,jsonb_build_object('original_movement_id',p_movement,'reversal_movement_id',reversal,'replacement_movement_id',replacement,'replacement_line_id',replacement_line));
end $$;

revoke all on function private.insert_movement(uuid,date,text,jsonb,text,uuid),private.tag_inventory_cost_source(),public.material_catalog(date,text,text,integer,integer),public.inventory_history(uuid,date,uuid,integer),public.correct_inventory_receipt(uuid,uuid,bigint,bigint,numeric,numeric,text,uuid) from public,anon;
grant execute on function public.material_catalog(date,text,text,integer,integer),public.inventory_history(uuid,date,uuid,integer),public.correct_inventory_receipt(uuid,uuid,bigint,bigint,numeric,numeric,text,uuid) to authenticated;

commit;
