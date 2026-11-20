begin;

-- Order reviewers can see the assigned store name for each order without
-- needing broad read access to the stores directory.
create function public.order_review_queue(p_offset integer default 0,p_limit integer default 25)
returns table(
 id uuid,version bigint,store_id uuid,customer_id uuid,delivery_date date,shift text,status text,note text,
 guest_name text,guest_phone text,guest_address text,store_code text,store_name text
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_FILTER';end if;
 return query
 select o.id,o.version,o.store_id,o.customer_id,o.delivery_date,o.shift,o.status,o.note,
  o.guest_name,o.guest_phone,o.guest_address,s.code,s.name
 from public.customer_orders o left join public.stores s on s.id=o.store_id
 order by o.created_at desc,o.id desc offset p_offset limit p_limit;
end $$;

revoke all on function public.order_review_queue(integer,integer) from public,anon,authenticated;
grant execute on function public.order_review_queue(integer,integer) to authenticated;

commit;
