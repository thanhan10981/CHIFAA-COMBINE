begin;

-- Store links are bearer capabilities. Keep only a SHA-256 digest in the database.
create table private.public_order_links(
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique,
 store_id uuid not null references public.stores(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
alter table private.public_order_links enable row level security;
revoke all on private.public_order_links from public,anon,authenticated;

create function public.create_public_order_link(p_store uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;token text;link_id uuid;store public.stores;result jsonb;
begin
 if not private.can('orders','create') or not private.can('stores','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:link:create',jsonb_build_object('store',p_store));if cached is not null then return cached;end if;
 select * into strict store from public.stores where id=p_store and active;
 token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into private.public_order_links(token_hash,store_id,created_by)
 values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_store,auth.uid()) returning id into link_id;
 result=jsonb_build_object('link_id',link_id,'token',token,'store_id',store.id,'store_code',store.code,'store_name',store.name);
 insert into public.audit_logs(actor_id,action,table_name,record_id,after_row)
 values(auth.uid(),'CREATE','public_order_links',link_id,jsonb_build_object('store_id',store.id,'store_code',store.code,'store_name',store.name));
 return private.finish_request(p_key,result);
end $$;

create function public.public_order_links()
returns table(link_id uuid,store_id uuid,store_code text,store_name text,created_at timestamptz,revoked_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('orders','create') or not private.can('stores','view') then raise exception 'FORBIDDEN';end if;
 return query select l.id,l.store_id,s.code,s.name,l.created_at,l.revoked_at
 from private.public_order_links l join public.stores s on s.id=l.store_id
 where l.created_by=auth.uid() or private.can('admin','manage')
 order by l.created_at desc limit 100;
end $$;

create function public.revoke_public_order_link(p_link uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;l private.public_order_links;result jsonb;was_active boolean=false;
begin
 if not private.can('orders','create') or not private.can('stores','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:link:revoke',jsonb_build_object('link',p_link));if cached is not null then return cached;end if;
 update private.public_order_links set revoked_at=now() where id=p_link and revoked_at is null returning * into l;
 was_active=found;
 if not was_active then
  select * into strict l from private.public_order_links where id=p_link;
 end if;
 if l.revoked_at is not null and l.created_by<>auth.uid() and not private.can('admin','manage') then raise exception 'FORBIDDEN';end if;
 if l.revoked_at is null then raise exception 'LINK_NOT_REVOKED';end if;
 if was_active then
  insert into public.audit_logs(actor_id,action,table_name,record_id,after_row)
  values(auth.uid(),'REVOKE','public_order_links',l.id,jsonb_build_object('store_id',l.store_id,'revoked_at',l.revoked_at));
 end if;
 result=jsonb_build_object('link_id',l.id,'revoked',true);
 return private.finish_request(p_key,result);
end $$;

-- Keep the original public RPC signature for already-open portal sessions.
create function private.submit_public_order_core(p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_link_token text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fingerprint text;request private.public_order_requests;order_id uuid;item jsonb;product record;policy jsonb;total numeric;capacity numeric;counter integer;
 phone text;customer_name text;address text;response jsonb;target_store_id uuid;today date=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
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
 if p_link_token is not null and p_link_token!~'^[0-9a-f]{64}$' then raise exception 'INVALID_LINK';end if;
 if p_link_token is null then
  fingerprint=encode(sha256(convert_to(jsonb_build_object('date',p_date,'shift',p_shift,'contact',p_contact,'items',p_items,'note',p_note)::text,'UTF8')),'hex');
 else
  fingerprint=encode(sha256(convert_to(jsonb_build_object('date',p_date,'shift',p_shift,'contact',p_contact,'items',p_items,'note',p_note,'link_token_hash',encode(sha256(convert_to(p_link_token,'UTF8')),'hex'))::text,'UTF8')),'hex');
 end if;
 insert into private.public_order_requests(key,fingerprint) values(p_key,fingerprint) on conflict do nothing;
 select * into strict request from private.public_order_requests where key=p_key for update;
 if request.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 if request.result is not null then return request.result;end if;
 if p_link_token is not null then
  select l.store_id into target_store_id from private.public_order_links l join public.stores s on s.id=l.store_id
  where l.token_hash=encode(sha256(convert_to(p_link_token,'UTF8')),'hex') and l.revoked_at is null and s.active;
  if target_store_id is null then raise exception 'INVALID_LINK';end if;
 end if;
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
 insert into public.customer_orders(store_id,delivery_date,shift,note,guest_name,guest_phone,guest_address)
 values(target_store_id,p_date,trim(p_shift),p_note,customer_name,phone,address) returning id into order_id;
 for item in select value from jsonb_array_elements(p_items) loop
  select p.id,p.name,p.code,p.sale_unit,price.price_vnd into product from public.products p
  join lateral(select x.price_vnd from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) price on true
  where p.id=(item->>'product_id')::uuid and p.published and not p.archived for share of p;
  if product.id is null then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
  if item->>'price_vnd' is distinct from product.price_vnd::text then raise exception 'PRICE_CHANGED';end if;
  insert into public.customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,product_name,product_code,sale_unit)
  values(order_id,product.id,(item->>'quantity')::numeric,product.price_vnd,0,product.name,product.code,product.sale_unit);
 end loop;
 insert into public.order_status_history(order_id,to_status,note)
 values(order_id,'submitted',case when target_store_id is null then 'Public portal; contact is supplied by visitor, not a verified store identity.' else 'Store order link; visitor contact is supplied by the visitor, not a verified store identity.' end);
 response=jsonb_build_object('order_id',order_id,'status','submitted');
 update private.public_order_requests set result=response where key=p_key;
 return response;
end $$;

create or replace function public.submit_public_order(p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_key uuid)
returns jsonb language sql security definer set search_path='' as $$
 select private.submit_public_order_core(p_date,p_shift,p_contact,p_items,p_note,null,p_key)
$$;
create function public.submit_store_link_order(p_date date,p_shift text,p_contact jsonb,p_items jsonb,p_note text,p_link_token text,p_key uuid)
returns jsonb language sql security definer set search_path='' as $$
 select private.submit_public_order_core(p_date,p_shift,p_contact,p_items,p_note,p_link_token,p_key)
$$;

revoke all on function private.submit_public_order_core(date,text,jsonb,jsonb,text,text,uuid) from public,anon,authenticated;
revoke all on function public.create_public_order_link(uuid,uuid),public.public_order_links(),public.revoke_public_order_link(uuid,uuid),public.submit_public_order(date,text,jsonb,jsonb,text,uuid),public.submit_store_link_order(date,text,jsonb,jsonb,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_public_order_link(uuid,uuid),public.public_order_links(),public.revoke_public_order_link(uuid,uuid) to authenticated;
grant execute on function public.submit_public_order(date,text,jsonb,jsonb,text,uuid),public.submit_store_link_order(date,text,jsonb,jsonb,text,text,uuid) to anon,authenticated;
commit;
