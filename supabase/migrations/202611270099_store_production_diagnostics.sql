begin;
set local lock_timeout='5s';

-- Read only: quantities are in the product sale unit, using the same balance as approval.
create or replace function private.store_finished_goods_checks(p_date date,p_store uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with demand as (
  select i.product_id,sum(i.quantity) quantity
  from public.customer_orders o join public.customer_order_items i on i.order_id=o.id
  where o.delivery_date=p_date and o.status in('approved','scheduled') and o.store_id is not null
   and (p_store is null or o.store_id=p_store) and i.cancelled_at is null
  group by i.product_id
 ), balances as (
  select d.*,private.finished_goods_balance(d.product_id,p_date) available from demand d
 )
 select coalesce(jsonb_agg(jsonb_build_object('product_id',p.id,'code',p.code,'name',p.name,'unit',p.sale_unit,
  'required_quantity',b.quantity::text,'available_quantity',b.available::text,
  'shortage_quantity',greatest(0,b.quantity-b.available)::text) order by p.code),'[]'::jsonb)
 from balances b join public.products p on p.id=b.product_id
$$;
revoke all on function private.store_finished_goods_checks(date,uuid) from public,anon,authenticated;

create or replace function public.store_production_diagnostics(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('production','view') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 return jsonb_build_object('products',private.store_finished_goods_checks(p_date,null),
  'stores',coalesce((select jsonb_object_agg(s.store_id::text,private.store_finished_goods_checks(p_date,s.store_id))
   from (select distinct store_id from public.customer_orders where delivery_date=p_date
    and status in('approved','scheduled') and store_id is not null) s),'{}'::jsonb));
end $$;
revoke all on function public.store_production_diagnostics(date) from public,anon;
grant execute on function public.store_production_diagnostics(date) to authenticated;

-- Keep the readiness history, but do not show a stale approval for changed orders.
create or replace function public.store_production_readiness(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('production','view') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 return coalesce((select jsonb_object_agg(r.store_id::text,jsonb_build_object('status',r.status,'created_at',r.created_at,'note',r.note))
  from (select distinct on(store_id) * from public.store_production_readiness where delivery_date=p_date order by store_id,created_at desc,id desc) r
  where r.order_ids=(select array_agg(o.id order by o.id) from public.customer_orders o where o.store_id=r.store_id and o.delivery_date=p_date and o.status in('approved','scheduled'))
   and not exists(select 1 from public.customer_orders o where o.id=any(r.order_ids) and o.updated_at>r.created_at)
   and not exists(select 1 from public.customer_order_items i where i.order_id=any(r.order_ids) and i.updated_at>r.created_at)
 ),'{}'::jsonb);
end $$;

create or replace function public.confirm_store_production_ready(p_date date,p_store uuid,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; order_list uuid[]; rec public.store_production_readiness; shortages jsonb;
begin
 if not private.can('production','view') or not private.can('production','approve') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_store is null or p_key is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_STORE_READINESS';end if;
 cached=private.begin_request(p_key,'production:store-ready',jsonb_build_object('date',p_date,'store',p_store,'reason',p_reason));if cached is not null then return cached;end if;
 perform 1 from public.stores where id=p_store and active;
 if not found then raise exception 'STORE_NOT_FOUND';end if;
 select array_agg(o.id order by o.id) into order_list from public.customer_orders o where o.store_id=p_store and o.delivery_date=p_date and o.status in('approved','scheduled');
 if coalesce(cardinality(order_list),0)=0 then raise exception 'NO_APPROVED_STORE_ORDERS';end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into shortages
 from jsonb_array_elements(private.store_finished_goods_checks(p_date,p_store)) x
 where (x->>'shortage_quantity')::numeric>0;
 if jsonb_array_length(shortages)>0 then
  raise exception using message='INSUFFICIENT_FINISHED_GOODS',detail=jsonb_build_object(
   'store_id',p_store,'store_name',(select name from public.stores where id=p_store),
   'date',p_date,'products',shortages)::text;
 end if;
 insert into public.store_production_readiness(delivery_date,store_id,order_ids,status,note,created_by)
 values(p_date,p_store,order_list,'ready',trim(p_reason),auth.uid()) returning * into rec;
 insert into public.audit_logs(actor_id,action,table_name,record_id,after_row)
 values(auth.uid(),'STORE_PRODUCTION_READY','store_production_readiness',rec.id,jsonb_build_object('date',p_date,'store_id',p_store,'order_ids',order_list,'reason',trim(p_reason)));
 return private.finish_request(p_key,jsonb_build_object('id',rec.id,'status','ready','order_ids',order_list));
end $$;

create or replace function public.confirm_all_store_production_ready(p_date date,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; store_row record; completed integer=0; shortages jsonb; ready_map jsonb;
begin
 if not private.can('production','view') or not private.can('production','approve') or not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or p_key is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_STORE_READINESS';end if;
 cached=private.begin_request(p_key,'production:all-stores-ready',jsonb_build_object('date',p_date,'reason',p_reason));if cached is not null then return cached;end if;
 -- A shared finished balance must cover the whole day before approving every store.
 select coalesce(jsonb_agg(x),'[]'::jsonb) into shortages
 from jsonb_array_elements(private.store_finished_goods_checks(p_date,null)) x
 where (x->>'shortage_quantity')::numeric>0;
 if jsonb_array_length(shortages)>0 then
  raise exception using message='INSUFFICIENT_FINISHED_GOODS',detail=jsonb_build_object(
   'store_name','tất cả điểm bán','date',p_date,'products',shortages)::text;
 end if;
 ready_map=public.store_production_readiness(p_date);
 for store_row in select distinct o.store_id from public.customer_orders o where o.delivery_date=p_date and o.status in('approved','scheduled') and o.store_id is not null
  and not (ready_map ? o.store_id::text)
 loop
  perform public.confirm_store_production_ready(p_date,store_row.store_id,trim(p_reason),gen_random_uuid());completed=completed+1;
 end loop;
 if completed=0 then raise exception 'NO_UNCONFIRMED_STORE_ORDERS';end if;
 return private.finish_request(p_key,jsonb_build_object('date',p_date,'stores_confirmed',completed,'status','ready'));
end $$;

notify pgrst,'reload schema';
commit;
