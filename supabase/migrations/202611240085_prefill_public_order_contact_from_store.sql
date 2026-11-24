begin;
set local lock_timeout='5s';

-- A bearer order link may prefill only the linked store's public order contact.
-- The catalog remains scoped to that store and no store list is exposed.
create or replace function public.public_order_catalog_linked(
 p_date date,p_offset integer,p_limit integer,p_link_token text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target_store uuid;store_name text;store_address text;store_contact text;rows jsonb;total bigint;
begin
 if p_date is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
  or p_link_token is null or p_link_token!~'^[0-9a-f]{64}$' then raise exception 'INVALID_FILTER';end if;
 select l.store_id,s.name,s.address,s.contact into target_store,store_name,store_address,store_contact
 from private.public_order_links l join public.stores s on s.id=l.store_id
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
 return jsonb_build_object('rows',rows,'total',total::text,
  'store_contact',jsonb_build_object('name',store_name,'phone',coalesce(store_contact,''),'address',coalesce(store_address,'')));
end $$;
revoke all on function public.public_order_catalog_linked(date,integer,integer,text) from public,authenticated;
grant execute on function public.public_order_catalog_linked(date,integer,integer,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
