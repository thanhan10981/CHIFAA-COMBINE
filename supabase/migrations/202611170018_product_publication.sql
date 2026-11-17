begin;
create function private.product_publication_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and new.published and (TG_OP='INSERT' or not old.published) and not private.can('products','approve') then raise exception 'FORBIDDEN_PUBLICATION';end if;
 return new;
end $$;
create trigger product_publication before insert or update on public.products for each row execute function private.product_publication_guard();
revoke all on function private.product_publication_guard() from public;
commit;
