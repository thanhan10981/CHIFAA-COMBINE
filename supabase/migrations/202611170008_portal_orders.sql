begin;
create table private.rate_limits(actor_id uuid not null, operation text not null, bucket timestamptz not null, requests integer not null check(requests>0), primary key(actor_id,operation,bucket));
alter table private.rate_limits enable row level security;
create function private.owns_store(p_store uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.store_users s on s.user_id=p.id join public.stores t on t.id=s.store_id where p.id=auth.uid() and p.enabled and s.active and t.active and s.store_id=p_store);
$$;
revoke all on function private.owns_store(uuid) from public;grant execute on function private.owns_store(uuid) to authenticated;
create policy own_store_read on public.stores for select to authenticated using(private.owns_store(id));
create policy own_membership_read on public.store_users for select to authenticated using(user_id=(select auth.uid()) and private.owns_store(store_id));
create policy own_order_read on public.customer_orders for select to authenticated using(customer_id=(select auth.uid()) and private.owns_store(store_id));
create policy own_order_items_read on public.customer_order_items for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id and o.customer_id=(select auth.uid()) and private.owns_store(o.store_id)));
create policy own_order_history_read on public.order_status_history for select to authenticated using(exists(select 1 from public.customer_orders o where o.id=order_id and o.customer_id=(select auth.uid()) and private.owns_store(o.store_id)));
create policy own_notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and enabled));

create function public.portal_catalog(p_store uuid,p_date date) returns table(product_id uuid,code text,name text,sale_unit text,price_vnd text,discount_rate text) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.owns_store(p_store) then raise exception 'FORBIDDEN';end if;
 return query select p.id,p.code,p.name,p.sale_unit,price.price_vnd::text,coalesce(discount.rate,0)::text from public.products p
 join lateral(select x.price_vnd from public.store_product_prices x where x.store_id=p_store and x.product_id=p.id and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1) price on true
 left join lateral(select x.rate from public.store_discounts x where x.store_id=p_store and x.product_id=p.id and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1) discount on true
 where p.published and not p.archived order by p.code;
end $$;
create function public.submit_order(p_store uuid,p_date date,p_shift text,p_items jsonb,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; order_id uuid; item jsonb; product record; request_count integer; policy jsonb; total numeric; capacity numeric;
begin
 if not private.owns_store(p_store) then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:submit',jsonb_build_object('store',p_store,'date',p_date,'shift',p_shift,'items',p_items,'note',p_note));if cached is not null then return cached;end if;
 if p_date<(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_shift is null or length(trim(p_shift)) not between 1 and 60 or length(coalesce(p_note,''))>2000 then raise exception 'INVALID_ORDER';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'INVALID_ORDER_ITEMS';end if;
 insert into private.rate_limits(actor_id,operation,bucket,requests) values(auth.uid(),'order',date_trunc('minute',now()),1) on conflict(actor_id,operation,bucket) do update set requests=private.rate_limits.requests+1 returning requests into request_count;
 if request_count>20 then raise exception 'RATE_LIMIT';end if;
 perform pg_advisory_xact_lock(hashtextextended('orders:'||p_date::text,0));
 select value into policy from public.app_settings where key='order_policy';
 if policy?'cutoff_local' and p_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date and (now() at time zone 'Asia/Ho_Chi_Minh')::time>(policy->>'cutoff_local')::time then raise exception 'ORDER_CUTOFF';end if;
 capacity=(policy->>'daily_capacity')::numeric;
 select sum((x.value->>'quantity')::numeric) into total from jsonb_array_elements(p_items) x;
 if capacity is not null and capacity<(select coalesce(sum(i.quantity),0) from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.delivery_date=p_date and o.status not in ('cancelled','rejected'))+total then raise exception 'DAILY_CAPACITY';end if;
 insert into public.customer_orders(store_id,customer_id,delivery_date,shift,note) values(p_store,auth.uid(),p_date,p_shift,p_note) returning id into order_id;
 for item in select value from jsonb_array_elements(p_items) loop
  select * into product from public.portal_catalog(p_store,p_date) c where c.product_id=(item->>'product_id')::uuid;
  if product.product_id is null then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
  insert into public.customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values(order_id,product.product_id,(item->>'quantity')::numeric,product.price_vnd::bigint,product.discount_rate::numeric);
 end loop;
 insert into public.order_status_history(order_id,to_status) values(order_id,'submitted');
 return private.finish_request(p_key,jsonb_build_object('order_id',order_id,'status','submitted'));
end $$;

create function public.review_order(p_order uuid,p_expected_version bigint,p_approve boolean,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_order public.customer_orders; new_status text;
begin
 if not private.can('orders','approve') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:review',jsonb_build_object('order',p_order,'version',p_expected_version,'approve',p_approve,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict current_order from public.customer_orders where id=p_order for update;
 if current_order.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if current_order.status<>'submitted' then raise exception 'INVALID_ORDER_STATUS';end if;
 new_status=case when p_approve then 'approved' else 'rejected' end;
 if not p_approve and length(trim(coalesce(p_reason,'')))<3 then raise exception 'REJECTION_REASON_REQUIRED';end if;
 update public.customer_orders set status=new_status,rejection_reason=case when p_approve then null else p_reason end where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status,note) values(p_order,current_order.status,new_status,p_reason);
 insert into public.notifications(user_id,order_id,title) values(current_order.customer_id,p_order,case when p_approve then 'Đơn hàng đã được duyệt' else 'Đơn hàng bị từ chối' end);
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'status',new_status));
end $$;

create function public.schedule_order(p_order uuid,p_plan uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_order public.customer_orders; plan public.production_plans;
begin
 if not private.can('orders','approve') or not private.can('production','edit') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:schedule',jsonb_build_object('order',p_order,'plan',p_plan));if cached is not null then return cached;end if;
 select * into strict current_order from public.customer_orders where id=p_order for update;
 if current_order.status<>'approved' or current_order.plan_id is not null then raise exception 'ORDER_ALREADY_LINKED_OR_NOT_APPROVED';end if;
 select * into strict plan from public.production_plans where id=p_plan for update;
 if plan.delivery_date<>current_order.delivery_date or plan.shift<>current_order.shift or plan.status='cancelled' then raise exception 'PLAN_MISMATCH';end if;
 -- Linking never adds a second copy to a manually entered production plan.
 if exists(select 1 from public.customer_order_items i where i.order_id=p_order and i.quantity>(select coalesce(sum(l.planned_quantity),0) from public.production_plan_lines l where l.plan_id=p_plan and l.product_id=i.product_id)) then raise exception 'PLAN_QUANTITY_INSUFFICIENT';end if;
 update public.customer_orders set plan_id=p_plan,status='scheduled' where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status) values(p_order,'approved','scheduled');
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'plan_id',p_plan,'status','scheduled','plan_quantity_changed',false));
end $$;
revoke all on function public.portal_catalog(uuid,date),public.submit_order(uuid,date,text,jsonb,text,uuid),public.review_order(uuid,bigint,boolean,text,uuid),public.schedule_order(uuid,uuid,uuid) from public;
grant execute on function public.portal_catalog(uuid,date),public.submit_order(uuid,date,text,jsonb,text,uuid),public.review_order(uuid,bigint,boolean,text,uuid),public.schedule_order(uuid,uuid,uuid) to authenticated;
commit;
