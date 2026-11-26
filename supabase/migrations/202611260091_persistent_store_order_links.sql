begin;
-- Bearer tokens are recoverable only through permission-checked RPCs.
alter table private.public_order_links add column saved_token text;
alter table private.public_order_links add constraint public_order_link_saved_token_valid
 check(saved_token is null or (saved_token ~ '^[0-9a-f]{64}$' and token_hash=encode(sha256(convert_to(saved_token,'UTF8')),'hex')));
-- Recover the newest active link from its original request receipt.
-- Other legacy URLs remain valid: this migration never revokes links.
with recoverable as (
 select distinct on(l.store_id) l.id,k.result->>'token' token
 from private.public_order_links l join public.idempotency_keys k
 on k.operation='order:link:create' and k.result->>'link_id'=l.id::text
 where l.revoked_at is null and k.result->>'token' ~ '^[0-9a-f]{64}$'
 and l.token_hash=encode(sha256(convert_to(k.result->>'token','UTF8')),'hex')
 order by l.store_id,l.created_at desc,l.id
)
update private.public_order_links l set saved_token=r.token from recoverable r where l.id=r.id;
create unique index public_order_link_one_saved_active_store on private.public_order_links(store_id)
 where revoked_at is null and saved_token is not null;
create or replace function public.create_public_order_link(p_store uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;token text;link_id uuid;store public.stores;existing private.public_order_links;result jsonb;
begin
 if not private.can('orders','create') or not private.can('stores','view') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:link:create',jsonb_build_object('store',p_store));
 select * into strict store from public.stores where id=p_store and active for update;
 if cached is not null then
  if not exists(select 1 from private.public_order_links where id::text=cached->>'link_id' and store_id=p_store and revoked_at is null) then raise exception 'LINK_REVOKED';end if;
  return cached;
 end if;
 select * into existing from private.public_order_links where store_id=p_store and revoked_at is null and saved_token is not null;
 if found then
  if existing.created_by<>auth.uid() and not private.can('admin','manage') then raise exception 'FORBIDDEN';end if;
  token=existing.saved_token;link_id=existing.id;
 else
  token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into private.public_order_links(token_hash,saved_token,store_id,created_by)
  values(encode(sha256(convert_to(token,'UTF8')),'hex'),token,p_store,auth.uid()) returning id into link_id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,after_row)
  values(auth.uid(),'CREATE','public_order_links',link_id,jsonb_build_object('store_id',store.id,'store_code',store.code,'store_name',store.name));
 end if;
 result=jsonb_build_object('link_id',link_id,'token',token,'store_id',store.id,'store_code',store.code,'store_name',store.name);
 return private.finish_request(p_key,result);
end $$;
create function public.public_order_links_v2()
returns table(link_id uuid,store_id uuid,store_code text,store_name text,created_at timestamptz,token text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('orders','create') or not private.can('stores','view') then raise exception 'FORBIDDEN';end if;
 return query select l.id,l.store_id,s.code,s.name,l.created_at,l.saved_token
 from private.public_order_links l join public.stores s on s.id=l.store_id
 where l.revoked_at is null and l.saved_token is not null and s.active
 and (l.created_by=auth.uid() or private.can('admin','manage')) order by s.code,l.id;
end $$;
revoke all on function public.public_order_links_v2() from public,anon,authenticated;
grant execute on function public.public_order_links_v2() to authenticated;
notify pgrst,'reload schema';
commit;
