begin;
-- Public visitors can use only the catalog/submit RPCs, never read order/contact tables.
alter table public.customer_orders alter column customer_id drop not null, alter column store_id drop not null;
alter table public.customer_orders add column guest_name text,add column guest_phone text,add column guest_address text;
alter table public.customer_orders add constraint customer_order_identity check(
 (customer_id is not null and store_id is not null and guest_name is null and guest_phone is null and guest_address is null)
 or(customer_id is null and length(trim(guest_name)) between 2 and 120 and guest_phone~'^[+]?[0-9]{8,15}$' and length(trim(guest_address)) between 5 and 500 and guest_name is not null and guest_phone is not null and guest_address is not null));
alter table public.customer_order_items add column product_name text,add column product_code text,add column sale_unit text;
create table private.public_order_requests(key uuid primary key,fingerprint text not null,result jsonb,created_at timestamptz not null default now());
alter table private.public_order_requests enable row level security;
revoke all on private.public_order_requests from public,anon,authenticated;

create function public.public_order_catalog(p_date date,p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;total bigint;
begin
 if p_date is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_FILTER';end if;
 select count(*) into total from public.products where published and not archived;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.code,page.product_id),'[]') into rows from(
  select p.id product_id,p.code,p.name,p.sale_unit,price.price_vnd::text
  from public.products p left join lateral(select x.price_vnd from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) price on true
  where p.published and not p.archived order by p.code,p.id offset p_offset limit p_limit
 ) page;
 return jsonb_build_object('rows',rows,'total',total::text);
end $$;

create function public.submit_public_order(p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fingerprint text;request private.public_order_requests;order_id uuid;item jsonb;product record;policy jsonb;total numeric;capacity numeric;counter integer;
 phone text;customer_name text;address text;response jsonb;today date=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if p_key is null or p_contact is null or jsonb_typeof(p_contact) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_contact) k where k<>all(array['name','phone','address'])) then raise exception 'INVALID_CONTACT';end if;
 customer_name=trim(p_contact->>'name');phone=regexp_replace(p_contact->>'phone','[[:space:]().-]','','g');address=trim(p_contact->>'address');
 if customer_name is null or length(customer_name) not between 2 and 120 or phone is null or phone!~'^[+]?[0-9]{8,15}$' or address is null or length(address) not between 5 and 500 then raise exception 'INVALID_CONTACT';end if;
 if p_date is null or p_date<today or p_date>today+365 or p_shift is null or length(trim(p_shift)) not between 1 and 60 or length(coalesce(p_note,''))>2000 then raise exception 'INVALID_ORDER';end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_ORDER_ITEMS';end if;
 if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'INVALID_ORDER_ITEMS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x) is distinct from 'object') then raise exception 'INVALID_ORDER_ITEMS';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if exists(select 1 from jsonb_object_keys(item) k where k<>all(array['product_id','quantity','price_vnd'])) or coalesce(item->>'quantity','')!~'^[1-9][0-9]{0,5}$' or item->>'product_id' is null then raise exception 'INVALID_ORDER_ITEMS';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items) x group by (x->>'product_id')::uuid having count(*)>1) then raise exception 'DUPLICATE_PRODUCT';end if;
 fingerprint=encode(sha256(convert_to(jsonb_build_object('date',p_date,'shift',p_shift,'contact',p_contact,'items',p_items,'note',p_note)::text,'UTF8')),'hex');
 insert into private.public_order_requests(key,fingerprint) values(p_key,fingerprint) on conflict do nothing;
 select * into strict request from private.public_order_requests where key=p_key for update;
 if request.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 if request.result is not null then return request.result;end if;
 -- Per-contact and global accepted-request limits bound unauthenticated submissions.
 insert into private.rate_limits(actor_id,operation,bucket,requests) values(md5(phone)::uuid,'public-order-phone',date_trunc('minute',now()),1)
 on conflict(actor_id,operation,bucket) do update set requests=private.rate_limits.requests+1 returning requests into counter;
 if counter>5 then raise exception 'RATE_LIMIT';end if;
 insert into private.rate_limits(actor_id,operation,bucket,requests) values('00000000-0000-4000-8000-000000000035','public-order-global',date_trunc('minute',now()),1)
 on conflict(actor_id,operation,bucket) do update set requests=private.rate_limits.requests+1 returning requests into counter;
 if counter>60 then raise exception 'RATE_LIMIT';end if;
 perform pg_advisory_xact_lock(hashtextextended('orders:'||p_date::text,0));
 select value into policy from public.app_settings where key='order_policy';
 if policy?'cutoff_local' and p_date=today and(now() at time zone 'Asia/Ho_Chi_Minh')::time>(policy->>'cutoff_local')::time then raise exception 'ORDER_CUTOFF';end if;
 capacity=(policy->>'daily_capacity')::numeric;
 select sum((x->>'quantity')::numeric) into total from jsonb_array_elements(p_items) x;
 if capacity is not null and capacity<(select coalesce(sum(i.quantity),0) from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.delivery_date=p_date and o.status not in('cancelled','rejected'))+total then raise exception 'DAILY_CAPACITY';end if;
 insert into public.customer_orders(delivery_date,shift,note,guest_name,guest_phone,guest_address) values(p_date,trim(p_shift),p_note,customer_name,phone,address) returning id into order_id;
 for item in select value from jsonb_array_elements(p_items) loop
  select p.id,p.name,p.code,p.sale_unit,price.price_vnd into product from public.products p
  join lateral(select x.price_vnd from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) price on true
  where p.id=(item->>'product_id')::uuid and p.published and not p.archived for share of p;
  if product.id is null then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
  if item->>'price_vnd' is distinct from product.price_vnd::text then raise exception 'PRICE_CHANGED';end if;
  insert into public.customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,product_name,product_code,sale_unit)
  values(order_id,product.id,(item->>'quantity')::numeric,product.price_vnd,0,product.name,product.code,product.sale_unit);
 end loop;
 insert into public.order_status_history(order_id,to_status,note) values(order_id,'submitted','Public portal; contact is supplied by visitor, not a verified store identity.');
 response=jsonb_build_object('order_id',order_id,'status','submitted');
 update private.public_order_requests set result=response where key=p_key;
 return response;
end $$;

-- Existing authenticated ordering keeps its ownership rules; guests never receive read access.
do $upgrade$ declare definition text;begin
 select pg_get_functiondef('public.review_order(uuid,bigint,boolean,text,uuid)'::regprocedure) into definition;
 definition=replace(definition,'new_status=case when p_approve', 'if p_approve and current_order.store_id is null then raise exception ''STORE_REQUIRED'';end if; new_status=case when p_approve');
 definition=replace(definition,'insert into public.notifications(user_id,order_id,title) values', 'if current_order.customer_id is not null then insert into public.notifications(user_id,order_id,title) values');
 definition=replace(definition,'''Đơn hàng bị từ chối'' end);','''Đơn hàng bị từ chối'' end);end if;');
 if definition not like '%STORE_REQUIRED%' or definition not like '%customer_id is not null then insert%' then raise exception 'REVIEW_UPGRADE_MISMATCH';end if;
 execute definition;
end $upgrade$;
create function public.review_public_order(p_order uuid,p_expected_version bigint,p_store uuid,p_approve boolean,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;o public.customer_orders;result jsonb;
begin
 if not private.can('orders','approve') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:public-review',jsonb_build_object('order',p_order,'version',p_expected_version,'store',p_store,'approve',p_approve,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict o from public.customer_orders where id=p_order for update;
 if p_expected_version is null or o.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if o.customer_id is not null or o.status<>'submitted' then raise exception 'INVALID_ORDER_STATUS';end if;
 if p_approve then
  if p_store is null or not exists(select 1 from public.stores where id=p_store and active) then raise exception 'ACTIVE_STORE_REQUIRED';end if;
  update public.customer_orders set store_id=p_store where id=p_order returning * into o;
 end if;
 result=public.review_order(p_order,o.version,p_approve,p_reason,gen_random_uuid());
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.public_order_catalog(date,integer,integer),public.submit_public_order(date,text,jsonb,jsonb,text,uuid),public.review_public_order(uuid,bigint,uuid,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.public_order_catalog(date,integer,integer),public.submit_public_order(date,text,jsonb,jsonb,text,uuid) to anon,authenticated;
grant execute on function public.review_public_order(uuid,bigint,uuid,boolean,text,uuid) to authenticated;
commit;
