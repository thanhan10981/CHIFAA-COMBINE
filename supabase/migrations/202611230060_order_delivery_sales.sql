begin;

-- A completed customer delivery is the single wholesale sale and receivable.
-- Receipt allocations remain separate and are created only when money is
-- actually received. The source order's locked price/discount are preserved.
create unique index sales_documents_one_posted_delivery_idx
 on public.sales_documents(delivery_id) where delivery_id is not null and status='posted';

do $upgrade$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.fulfill_order_delivery(uuid,bigint,uuid)'::regprocedure) into definition;
 old_fragment='declare cached jsonb; current_order public.customer_orders; item record; delivery_id uuid; available numeric; result jsonb;';
 new_fragment='declare cached jsonb; current_order public.customer_orders; item record; delivery_id uuid; available numeric; sales_id uuid; receivable_id uuid; revenue numeric; result jsonb;';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DELIVERY_SALES_DECLARATION_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment='if not private.can(''orders'',''approve'') or not private.can(''deliveries'',''create'') or not private.can(''deliveries'',''approve'') or not private.can(''production'',''view'') then raise exception ''FORBIDDEN'';end if;';
 new_fragment='if not private.can(''orders'',''approve'') or not private.can(''deliveries'',''create'') or not private.can(''deliveries'',''approve'') or not private.can(''production'',''view'') or not private.can(''sales'',''create'') or not private.can(''sales'',''approve'') or not private.can(''receivables'',''create'') then raise exception ''FORBIDDEN'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DELIVERY_SALES_PERMISSION_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$insert into public.delivery_items(delivery_id,product_id,quantity)
  select delivery_id,product_id,quantity from public.customer_order_items where order_id=p_order order by product_id;$old$;
 new_fragment='insert into public.sales_documents(store_id,sold_on,delivery_id,status) values(current_order.store_id,current_order.delivery_date,delivery_id,''posted'') returning id into sales_id; insert into public.sales_lines(document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate,net_revenue_vnd) select sales_id,i.product_id,i.quantity,i.quantity,0,0,i.price_vnd,i.discount_rate,round(i.quantity*i.price_vnd*(1-i.discount_rate))::bigint from public.customer_order_items i where i.order_id=p_order order by i.product_id; select coalesce(sum(net_revenue_vnd),0) into revenue from public.sales_lines where document_id=sales_id; insert into public.receivables(store_id,sales_document_id,incurred_on,amount_vnd) values(current_order.store_id,sales_id,current_order.delivery_date,revenue::bigint) returning id into receivable_id; '||old_fragment;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DELIVERY_REVENUE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment='result=jsonb_build_object(''order_id'',p_order,''delivery_id'',delivery_id,''delivery_date'',current_order.delivery_date,''status'',''fulfilled'');';
 new_fragment='result=jsonb_build_object(''order_id'',p_order,''delivery_id'',delivery_id,''sales_document_id'',sales_id,''receivable_id'',receivable_id,''revenue_vnd'',revenue::bigint::text,''delivery_date'',current_order.delivery_date,''status'',''fulfilled'');';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DELIVERY_REVENUE_RESULT_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 execute definition;
end $upgrade$;

revoke all on function public.fulfill_order_delivery(uuid,bigint,uuid) from public,anon;
grant execute on function public.fulfill_order_delivery(uuid,bigint,uuid) to authenticated;

commit;
