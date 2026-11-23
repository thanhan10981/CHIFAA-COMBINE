begin;
set local lock_timeout='5s';

-- Customer payment preference is not a receipt. Real receipt methods and
-- amounts continue to be recorded only by the delivery settlement workflow.
alter table public.customer_orders
 add column customer_payment_method text
  check(customer_payment_method is null or customer_payment_method in ('cash','bank'));

create table private.public_order_option_requests(
 key uuid primary key,fingerprint text not null,result jsonb,created_at timestamptz not null default now()
);
alter table private.public_order_option_requests enable row level security;
revoke all on private.public_order_option_requests from public,anon,authenticated;

-- A store-link catalog can reveal only the effective discount for the store
-- whose bearer link was presented. General public catalog remains unchanged.
create function public.public_order_catalog_linked(
 p_date date,p_offset integer,p_limit integer,p_link_token text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target_store uuid;rows jsonb;total bigint;
begin
 if p_date is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
  or p_link_token is null or p_link_token!~'^[0-9a-f]{64}$' then raise exception 'INVALID_FILTER';end if;
 select l.store_id into target_store from private.public_order_links l join public.stores s on s.id=l.store_id
  where l.token_hash=encode(sha256(convert_to(p_link_token,'UTF8')),'hex') and l.revoked_at is null and s.active;
 if target_store is null then raise exception 'INVALID_LINK';end if;
 select count(*) into total from public.products p where p.published and not p.archived;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.code,page.product_id),'[]') into rows from(
  select p.id product_id,p.code,p.name,p.sale_unit,price.price_vnd::text,p.image_path,
   coalesce(offer.discount_rate,0)::text discount_rate
  from public.products p
  left join lateral(select x.price_vnd from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) price on true
  left join lateral(select x.discount_rate from private.commercial_offer(target_store,p.id,p_date) x) offer on true
  where p.published and not p.archived order by p.code,p.id offset p_offset limit p_limit
 ) page;
 return jsonb_build_object('rows',rows,'total',total::text);
end $$;
revoke all on function public.public_order_catalog_linked(date,integer,integer,text) from public,authenticated;
grant execute on function public.public_order_catalog_linked(date,integer,integer,text) to anon,authenticated;

-- Add an idempotent public RPC that snapshots the payment preference and
-- recomputes the linked store discount on the server, never trusting the UI.
create function private.submit_public_order_options_core(
 p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,
 p_link_token text,p_payment_method text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare fingerprint text;request private.public_order_option_requests;response_json jsonb;created_order_id uuid;target_store uuid;
begin
 if p_payment_method is null or p_payment_method not in ('cash','bank') then raise exception 'INVALID_PAYMENT_METHOD';end if;
 if p_key is null then raise exception 'INVALID_REQUEST_KEY';end if;
 fingerprint=encode(sha256(convert_to(jsonb_build_object(
  'date',p_date,'shift',p_shift,'contact',p_contact,'items',p_items,'note',p_note,
  'link_token_hash',case when p_link_token is null then null else encode(sha256(convert_to(p_link_token,'UTF8')),'hex') end,
  'payment_method',p_payment_method)::text,'UTF8')),'hex');
 insert into private.public_order_option_requests(key,fingerprint) values(p_key,fingerprint) on conflict do nothing;
 select * into strict request from private.public_order_option_requests where key=p_key for update;
 if request.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 if request.result is not null then return request.result;end if;

 response_json=private.submit_public_order_core(p_date,p_shift,p_contact,p_items,p_note,p_link_token,p_key);
 created_order_id=(response_json->>'order_id')::uuid;
 if p_link_token is not null then
  select l.store_id into target_store from private.public_order_links l join public.stores s on s.id=l.store_id
   where l.token_hash=encode(sha256(convert_to(p_link_token,'UTF8')),'hex') and l.revoked_at is null and s.active;
  if target_store is null then raise exception 'INVALID_LINK';end if;
 end if;
 update public.customer_orders set customer_payment_method=p_payment_method where id=created_order_id;
 if target_store is not null then
  update public.customer_order_items i set discount_rate=coalesce(
   (select x.discount_rate from private.commercial_offer(target_store,i.product_id,p_date) x),0)
   where i.order_id=created_order_id;
 end if;
 update private.public_order_option_requests set result=response_json where key=p_key;
 return response_json;
end $$;
revoke all on function private.submit_public_order_options_core(date,text,jsonb,jsonb,text,text,text,uuid) from public,anon,authenticated;

create function public.submit_public_order_v2(
 p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_payment_method text,p_key uuid
) returns jsonb language sql security definer set search_path='' as $$
 select private.submit_public_order_options_core(p_date,p_shift,p_contact,p_items,p_note,null,p_payment_method,p_key)
$$;
create function public.submit_store_link_order_v2(
 p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_link_token text,p_payment_method text,p_key uuid
) returns jsonb language sql security definer set search_path='' as $$
 select private.submit_public_order_options_core(p_date,p_shift,p_contact,p_items,p_note,p_link_token,p_payment_method,p_key)
$$;
revoke all on function public.submit_public_order_v2(date,text,jsonb,jsonb,text,text,uuid),public.submit_store_link_order_v2(date,text,jsonb,jsonb,text,text,text,uuid) from public,authenticated;
grant execute on function public.submit_public_order_v2(date,text,jsonb,jsonb,text,text,uuid),public.submit_store_link_order_v2(date,text,jsonb,jsonb,text,text,text,uuid) to anon,authenticated;

-- Unlinked public orders receive their store only during review. At that point,
-- snapshot that store's effective dated discount before approving the order.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('public.review_public_order(uuid,bigint,uuid,boolean,text,uuid)'::regprocedure) into definition;
 old_fragment='update public.customer_orders set store_id=p_store where id=p_order returning * into o;';
 new_fragment='if o.store_id is distinct from p_store then update public.customer_order_items i set discount_rate=coalesce((select offer.discount_rate from private.commercial_offer(p_store,i.product_id,o.delivery_date) offer),0) where i.order_id=p_order; end if; '||old_fragment;
 if strpos(definition,old_fragment)=0 then raise exception 'PUBLIC_ORDER_STORE_DISCOUNT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

drop function public.order_review_queue(integer,integer);
create function public.order_review_queue(p_offset integer default 0,p_limit integer default 25)
returns table(
 id uuid,version bigint,store_id uuid,customer_id uuid,delivery_date date,shift text,status text,note text,
 guest_name text,guest_phone text,guest_address text,store_code text,store_name text,customer_payment_method text
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_FILTER';end if;
 return query select o.id,o.version,o.store_id,o.customer_id,o.delivery_date,o.shift,o.status,o.note,
  o.guest_name,o.guest_phone,o.guest_address,s.code,s.name,o.customer_payment_method
 from public.customer_orders o left join public.stores s on s.id=o.store_id
 order by o.created_at desc,o.id desc offset p_offset limit p_limit;
end $$;
revoke all on function public.order_review_queue(integer,integer) from public,anon,authenticated;
grant execute on function public.order_review_queue(integer,integer) to authenticated;
commit;
