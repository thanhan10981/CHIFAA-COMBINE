begin;
set local lock_timeout='5s';

-- The configured store rate is the order-wide base. A store configured at 15%
-- receives 17% only when the combined item quantity is greater than 50.
create function private.store_order_discount_rate(p_store uuid,p_date date,p_total_quantity numeric)
returns numeric language sql stable security definer set search_path='' as $$
 select case when coalesce(policy.enabled,false) then
   case when policy.common_rate=0.15 and coalesce(p_total_quantity,0)>50 then 0.17::numeric else policy.common_rate end
  else 0::numeric end
 from (select 1) seed left join lateral(
  select p.common_rate,p.enabled from public.store_discount_policies p
  where p.store_id=p_store and p.effective_from<=p_date order by p.effective_from desc limit 1
 ) policy on true
$$;
revoke all on function private.store_order_discount_rate(uuid,date,numeric) from public,anon,authenticated;

-- Replace each per-product calculation with the combined quantity of the order.
do $patch$
declare d text; old_fragment text; new_fragment text; r record;
begin
 for r in select * from (values
  ('private.submit_public_order_core(date,text,jsonb,jsonb,text,text,uuid)',
   'private.order_quantity_discount_rate(target_store_id,product.id,p_date,(item->>''quantity'')::numeric)',
   'private.store_order_discount_rate(target_store_id,p_date,(select sum((x->>''quantity'')::numeric) from jsonb_array_elements(p_items) x))'),
  ('private.submit_public_order_options_core(date,text,jsonb,jsonb,text,text,text,uuid)',
   'update public.customer_order_items i set discount_rate=coalesce(',
   'update public.customer_order_items i set discount_rate=private.store_order_discount_rate(target_store,p_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=created_order_id)) where i.order_id=created_order_id;'),
  ('public.review_public_order(uuid,bigint,uuid,boolean,text,uuid)',
   'discount_rate=private.order_quantity_discount_rate(p_store,i.product_id,o.delivery_date,i.quantity)',
   'discount_rate=private.store_order_discount_rate(p_store,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null))'),
  ('public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)',
   'set quantity=p_quantity,discount_rate=case when o.store_id is not null then private.order_quantity_discount_rate(o.store_id,line.product_id,o.delivery_date,p_quantity) else line.discount_rate end where id=line.id returning * into line;',
   'set quantity=p_quantity where id=line.id returning * into line;'),
  ('public.public_order_catalog_linked(date,integer,integer,text)',
   '''quantity_discount_rule'',jsonb_build_object(''version'',1,''threshold'',''50'',''below'',''0.15'',''at_or_above'',''0.17'')',
   '''quantity_discount_rule'',jsonb_build_object(''version'',2,''threshold'',''50'',''base_rate'',coalesce((select case when enabled then common_rate else 0 end from public.store_discount_policies where store_id=target_store and effective_from<=p_date order by effective_from desc limit 1),0)::text,''upgraded_rate'',''0.17'')')
 ) changes(signature,old_fragment,new_fragment) loop
  select pg_get_functiondef(r.signature::regprocedure) into d;
  d=replace(d,chr(13)||chr(10),chr(10));
  if r.signature='private.submit_public_order_options_core(date,text,jsonb,jsonb,text,text,text,uuid)' then
   old_fragment='update public.customer_order_items i set discount_rate=[^;]+where i.order_id=created_order_id;';
   new_fragment=regexp_replace(d,old_fragment,r.new_fragment);
   if new_fragment=d then raise exception 'STORE_ORDER_DISCOUNT_PATCH_MISMATCH: %',r.signature;end if;
   d=new_fragment;
  else
   if strpos(d,r.old_fragment)=0 then raise exception 'STORE_ORDER_DISCOUNT_PATCH_MISMATCH: %',r.signature;end if;
   d=replace(d,r.old_fragment,r.new_fragment);
  end if;
  if r.signature='public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)' then
   old_fragment='insert into public.customer_order_item_changes(order_id,order_item_id,action,reason,previous_values,current_values)';
   new_fragment='if o.store_id is not null then update public.customer_order_items set discount_rate=private.store_order_discount_rate(o.store_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null)) where order_id=p_order and cancelled_at is null; select * into line from public.customer_order_items where id=line.id; new_values=to_jsonb(line); end if; '||old_fragment;
   if strpos(d,old_fragment)=0 then raise exception 'STORE_ORDER_DISCOUNT_RECALC_PATCH_MISMATCH';end if;
   d=replace(d,old_fragment,new_fragment);
  end if;
  execute d;
 end loop;
end $patch$;

-- Approved order edits also cross the order-wide tier, so recompute all active
-- line snapshots in the same transaction after the edited quantity is applied.
do $patch$
declare d text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.revise_approved_order_item(uuid,bigint,text,uuid,numeric,text,uuid)'::regprocedure) into d;
 old_fragment='new_values=to_jsonb(line);';
 new_fragment='if o.store_id is not null then update public.customer_order_items set discount_rate=private.store_order_discount_rate(o.store_id,o.delivery_date,(select coalesce(sum(quantity),0) from public.customer_order_items where order_id=p_order and cancelled_at is null)) where order_id=p_order and cancelled_at is null; select * into line from public.customer_order_items where id=line.id; end if; new_values=to_jsonb(line);';
 if strpos(d,old_fragment)=0 then raise exception 'APPROVED_ORDER_DISCOUNT_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,new_fragment);
end $patch$;

notify pgrst,'reload schema';
commit;
