begin;
set local lock_timeout='5s';

-- Latest owner decision: only enabled/eligible dishes; each dish independently.
create function private.order_quantity_discount_eligible(p_store uuid,p_product uuid,p_date date)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select pol.enabled and coalesce(item.eligible,false)
 from public.store_discount_policies pol left join public.store_discount_policy_items item
 on item.policy_id=pol.id and item.product_id=p_product
 where pol.store_id=p_store and pol.effective_from<=p_date order by pol.effective_from desc limit 1),
 (select coalesce(offer.discount_rate,0)>0 from private.commercial_offer(p_store,p_product,p_date) offer),false)
$$;
create function private.order_quantity_discount_rate(p_store uuid,p_product uuid,p_date date,p_quantity numeric)
returns numeric language sql stable security definer set search_path='' as $$
 select case when private.order_quantity_discount_eligible(p_store,p_product,p_date)
 then case when p_quantity>=50 then 0.17::numeric else 0.15::numeric end else 0::numeric end
$$;
revoke all on function private.order_quantity_discount_eligible(uuid,uuid,date),private.order_quantity_discount_rate(uuid,uuid,date,numeric) from public,anon,authenticated;

-- Patch the existing validated, audited and idempotent workflows in place.
-- No existing order or financial snapshot is updated by this migration.
do $patch$
declare d text;r record;
begin
 for r in select * from (values
 ('private.submit_public_order_core(date,text,jsonb,jsonb,text,text,uuid)',
  'product.price_vnd,0,product.name',
  'product.price_vnd,private.order_quantity_discount_rate(target_store_id,product.id,p_date,(item->>''quantity'')::numeric),product.name'),
 ('private.submit_public_order_options_core(date,text,jsonb,jsonb,text,text,text,uuid)',
  'discount_rate=coalesce('||chr(10)||'   (select x.discount_rate from private.commercial_offer(target_store,i.product_id,p_date) x),0)',
  'discount_rate=private.order_quantity_discount_rate(target_store,i.product_id,p_date,i.quantity)'),
 ('public.review_public_order(uuid,bigint,uuid,boolean,text,uuid)',
  'discount_rate=coalesce((select offer.discount_rate from private.commercial_offer(p_store,i.product_id,o.delivery_date) offer),0)',
  'discount_rate=private.order_quantity_discount_rate(p_store,i.product_id,o.delivery_date,i.quantity)'),
 ('public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)',
  'set quantity=p_quantity where id=line.id returning * into line;',
  'set quantity=p_quantity,discount_rate=case when o.store_id is not null then private.order_quantity_discount_rate(o.store_id,line.product_id,o.delivery_date,p_quantity) else line.discount_rate end where id=line.id returning * into line;'),
 ('public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)',
  'if line.id is not null then'||chr(10)||'   old_values=to_jsonb(line);',
  'discount=private.order_quantity_discount_rate(o.store_id,p.id,o.delivery_date,p_quantity); if line.id is not null then'||chr(10)||'   old_values=to_jsonb(line);'),
 ('public.public_order_catalog_linked(date,integer,integer,text)',
  'coalesce(offer.discount_rate,0)::text discount_rate',
  'coalesce(offer.discount_rate,0)::text discount_rate,private.order_quantity_discount_eligible(target_store,p.id,p_date) discount_eligible'),
 ('public.public_order_catalog_linked(date,integer,integer,text)',
  '''store_contact'',jsonb_build_object',
  '''quantity_discount_rule'',jsonb_build_object(''version'',1,''threshold'',''50'',''below'',''0.15'',''at_or_above'',''0.17''),''store_contact'',jsonb_build_object')
 ) changes(signature,old_fragment,new_fragment) loop
  select pg_get_functiondef(r.signature::regprocedure) into d;
  d=replace(d,chr(13)||chr(10),chr(10));
  if strpos(d,r.old_fragment)=0 then raise exception 'QUANTITY_DISCOUNT_PATCH_MISMATCH: %',r.signature;end if;
  execute replace(d,r.old_fragment,r.new_fragment);
 end loop;
end $patch$;
notify pgrst,'reload schema';
commit;
