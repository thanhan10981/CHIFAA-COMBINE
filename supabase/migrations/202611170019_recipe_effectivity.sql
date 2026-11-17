begin;
create function private.recipe_effectivity_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and (TG_OP='INSERT' or old.status<>'published') and exists(
  select 1 from public.recipe_items i join public.recipe_versions child on child.id=i.child_version_id where i.recipe_version_id=new.id and (child.status<>'published' or child.effective_from>new.effective_from)
 ) then raise exception 'CHILD_RECIPE_NOT_EFFECTIVE';end if;
 return new;
end $$;
create trigger recipe_effectivity before insert or update on public.recipe_versions for each row execute function private.recipe_effectivity_guard();
revoke all on function private.recipe_effectivity_guard() from public;
commit;
