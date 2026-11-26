begin;
set local lock_timeout='5s';

alter table public.production_batches add column store_id uuid references public.stores(id);
alter table public.production_batches add column source_order_ids uuid[] not null default '{}'::uuid[];

create function public.post_store_production_run(
 p_warehouse uuid,p_date date,p_started timestamptz,p_finished timestamptz,p_delivery date,
 p_lines jsonb,p_note text,p_store uuid,p_orders uuid[],p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; result jsonb; expected_orders uuid[]; batch_id uuid;
begin
 if not private.can('orders','view') or not private.can('production','view') or not private.can('production','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 if p_store is null or p_orders is null or cardinality(p_orders)=0 or p_key is null then raise exception 'INVALID_STORE_PRODUCTION_SOURCE';end if;
 cached=private.begin_request(p_key,'production:store-run',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'delivery',p_delivery,'store',p_store,'orders',p_orders,'lines',p_lines,'note',p_note));if cached is not null then return cached;end if;
 perform 1 from public.customer_orders o where o.id=any(p_orders) and o.store_id=p_store and o.delivery_date=p_delivery and o.status in('approved','scheduled') for update;
 select array_agg(o.id order by o.id) into expected_orders from public.customer_orders o where o.store_id=p_store and o.delivery_date=p_delivery and o.status in('approved','scheduled');
 if expected_orders is null or (select array_agg(x order by x) from unnest(p_orders) x) is distinct from expected_orders then raise exception 'STORE_ORDER_SET_CHANGED';end if;
 result=public.post_production_run(p_warehouse,p_date,p_started,p_finished,p_delivery,p_lines,p_note,gen_random_uuid());
 batch_id=(result->>'batch_id')::uuid;
 update public.production_batches set store_id=p_store,source_order_ids=expected_orders where id=batch_id and status='posted';
 if not found then raise exception 'STORE_PRODUCTION_BATCH_NOT_FOUND';end if;
 return private.finish_request(p_key,result||jsonb_build_object('store_id',p_store,'source_order_ids',expected_orders));
end $$;
revoke all on function public.post_store_production_run(uuid,date,timestamptz,timestamptz,date,jsonb,text,uuid,uuid[],uuid) from public,anon;
grant execute on function public.post_store_production_run(uuid,date,timestamptz,timestamptz,date,jsonb,text,uuid,uuid[],uuid) to authenticated;

create table public.store_production_readiness(
 id uuid primary key default gen_random_uuid(),
 delivery_date date not null,
 store_id uuid not null references public.stores(id),
 order_ids uuid[] not null,
 status text not null check(status='ready'),
 note text,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 version bigint not null default 1
);
alter table public.store_production_readiness enable row level security;
create policy store_production_readiness_read on public.store_production_readiness for select to authenticated using((select private.can('production','view')));
grant select on public.store_production_readiness to authenticated;
revoke all on public.store_production_readiness from anon;
insert into private.table_modules(table_name,module) values('store_production_readiness','production') on conflict do nothing;
create trigger store_production_readiness_audit before insert or update or delete on public.store_production_readiness for each row execute function private.record_change('production');

create function public.store_production_readiness(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('production','view') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 return coalesce((select jsonb_object_agg(store_id::text,jsonb_build_object('status',status,'created_at',created_at,'note',note)) from (select distinct on(store_id) store_id,status,created_at,note from public.store_production_readiness where delivery_date=p_date order by store_id,created_at desc,id desc) latest),'{}'::jsonb);
end $$;
revoke all on function public.store_production_readiness(date) from public,anon;
grant execute on function public.store_production_readiness(date) to authenticated;

create function public.confirm_store_production_ready(p_date date,p_store uuid,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; order_list uuid[]; rec public.store_production_readiness; demand record;
begin
 if not private.can('production','view') or not private.can('production','approve') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_store is null or p_key is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_STORE_READINESS';end if;
 cached=private.begin_request(p_key,'production:store-ready',jsonb_build_object('date',p_date,'store',p_store,'reason',p_reason));if cached is not null then return cached;end if;
 perform 1 from public.stores where id=p_store and active;
 if not found then raise exception 'STORE_NOT_FOUND';end if;
 select array_agg(o.id order by o.id) into order_list from public.customer_orders o where o.store_id=p_store and o.delivery_date=p_date and o.status in('approved','scheduled');
 if coalesce(cardinality(order_list),0)=0 then raise exception 'NO_APPROVED_STORE_ORDERS';end if;
 for demand in select i.product_id,sum(i.quantity) quantity from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.id=any(order_list) and i.cancelled_at is null group by i.product_id loop
  if coalesce(private.finished_goods_balance(demand.product_id,p_date),0)<demand.quantity then raise exception 'INSUFFICIENT_FINISHED_GOODS';end if;
 end loop;
 insert into public.store_production_readiness(delivery_date,store_id,order_ids,status,note,created_by)
 values(p_date,p_store,order_list,'ready',trim(p_reason),auth.uid()) returning * into rec;
 insert into public.audit_logs(actor_id,action,table_name,record_id,after_row)
 values(auth.uid(),'STORE_PRODUCTION_READY','store_production_readiness',rec.id,jsonb_build_object('date',p_date,'store_id',p_store,'order_ids',order_list,'reason',trim(p_reason)));
 return private.finish_request(p_key,jsonb_build_object('id',rec.id,'status','ready','order_ids',order_list));
end $$;
revoke all on function public.confirm_store_production_ready(date,uuid,text,uuid) from public,anon;
grant execute on function public.confirm_store_production_ready(date,uuid,text,uuid) to authenticated;

create function public.confirm_all_store_production_ready(p_date date,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; store_row record; completed integer=0;
begin
 if not private.can('production','view') or not private.can('production','approve') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_key is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_STORE_READINESS';end if;
 cached=private.begin_request(p_key,'production:all-stores-ready',jsonb_build_object('date',p_date,'reason',p_reason));if cached is not null then return cached;end if;
 for store_row in select distinct o.store_id from public.customer_orders o where o.delivery_date=p_date and o.status in('approved','scheduled') and o.store_id is not null
  and not exists(select 1 from public.store_production_readiness r where r.delivery_date=p_date and r.store_id=o.store_id and r.order_ids=(select array_agg(o2.id order by o2.id) from public.customer_orders o2 where o2.store_id=o.store_id and o2.delivery_date=p_date and o2.status in('approved','scheduled')))
 loop
  perform public.confirm_store_production_ready(p_date,store_row.store_id,trim(p_reason),gen_random_uuid());completed=completed+1;
 end loop;
 if completed=0 then raise exception 'NO_UNCONFIRMED_STORE_ORDERS';end if;
 return private.finish_request(p_key,jsonb_build_object('date',p_date,'stores_confirmed',completed,'status','ready'));
end $$;
revoke all on function public.confirm_all_store_production_ready(date,text,uuid) from public,anon;
grant execute on function public.confirm_all_store_production_ready(date,text,uuid) to authenticated;
commit;
