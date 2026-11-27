begin;
set local lock_timeout='5s';

-- Quantity tiers remain order-wide, but the configured checkbox is per product.
create function private.store_order_discount_rate(p_store uuid,p_product uuid,p_date date,p_total_quantity numeric)
returns numeric language sql stable security definer set search_path='' as $$
 select case when coalesce(policy.enabled,false) and private.order_quantity_discount_eligible(p_store,p_product,p_date) then
   case when policy.common_rate=0.15 and coalesce(p_total_quantity,0)>50 then 0.17::numeric else policy.common_rate end
  else 0::numeric end
 from (select 1) seed left join lateral(
  select p.common_rate,p.enabled from public.store_discount_policies p
  where p.store_id=p_store and p.effective_from<=p_date order by p.effective_from desc limit 1
 ) policy on true
$$;
revoke all on function private.store_order_discount_rate(uuid,uuid,date,numeric) from public,anon,authenticated;

-- Keep the aggregate quantity for tier selection, while passing each product
-- to the rate function so unchecked dishes are always zero.
do $patch$
declare d text; old_fragment text; new_fragment text; r record;
begin
 for r in select * from (values
  ('private.submit_public_order_core(date,text,jsonb,jsonb,text,text,uuid)',
   'private.store_order_discount_rate(target_store_id,p_date,(select sum((x->>''quantity'')::numeric) from jsonb_array_elements(p_items) x))',
   'private.store_order_discount_rate(target_store_id,product.id,p_date,(select sum((x->>''quantity'')::numeric) from jsonb_array_elements(p_items) x))'),
  ('private.submit_public_order_options_core(date,text,jsonb,jsonb,text,text,text,uuid)',
   'update public.customer_order_items i set discount_rate=private.store_order_discount_rate(target_store,p_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=created_order_id)) where i.order_id=created_order_id;',
   'update public.customer_order_items i set discount_rate=private.store_order_discount_rate(target_store,i.product_id,p_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=created_order_id)) where i.order_id=created_order_id;'),
  ('public.review_public_order(uuid,bigint,uuid,boolean,text,uuid)',
   'discount_rate=private.store_order_discount_rate(p_store,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null))',
   'discount_rate=private.store_order_discount_rate(p_store,i.product_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null))')
 ) changes(signature,old_fragment,new_fragment) loop
  select pg_get_functiondef(r.signature::regprocedure) into d;
  d=replace(d,chr(13)||chr(10),chr(10));
  if strpos(d,r.old_fragment)=0 then raise exception 'SELECTED_ORDER_DISCOUNT_PATCH_MISMATCH: %',r.signature;end if;
  execute replace(d,r.old_fragment,r.new_fragment);
 end loop;
end $patch$;

-- Recalculate each item independently after submitted or approved edits.
do $patch$
declare d text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)'::regprocedure) into d;
 old_fragment='if o.store_id is not null then update public.customer_order_items set discount_rate=private.store_order_discount_rate(o.store_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null)) where order_id=p_order and cancelled_at is null; select * into line from public.customer_order_items where id=line.id; new_values=to_jsonb(line); end if; ';
 new_fragment='if o.store_id is not null then update public.customer_order_items i set discount_rate=private.store_order_discount_rate(o.store_id,i.product_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null)) where i.order_id=p_order and i.cancelled_at is null; select * into line from public.customer_order_items where id=line.id; new_values=to_jsonb(line); end if; ';
 if strpos(d,old_fragment)=0 then raise exception 'SELECTED_SUBMITTED_DISCOUNT_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);

 select pg_get_functiondef('public.revise_approved_order_item(uuid,bigint,text,uuid,numeric,text,uuid)'::regprocedure) into d;
 old_fragment='if o.store_id is not null then update public.customer_order_items set discount_rate=private.store_order_discount_rate(o.store_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null)) where order_id=p_order and cancelled_at is null; select * into line from public.customer_order_items where id=line.id; end if; new_values=to_jsonb(line);';
 new_fragment='if o.store_id is not null then update public.customer_order_items i set discount_rate=private.store_order_discount_rate(o.store_id,i.product_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null)) where i.order_id=p_order and i.cancelled_at is null; select * into line from public.customer_order_items where id=line.id; end if; new_values=to_jsonb(line);';
 if strpos(d,old_fragment)=0 then raise exception 'SELECTED_APPROVED_DISCOUNT_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;

notify pgrst,'reload schema';
commit;
