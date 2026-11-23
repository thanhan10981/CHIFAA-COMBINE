begin;
set local lock_timeout = '5s';

do $guard$
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED'; end if;
 if to_regclass('storage.objects') is null or to_regclass('public.products') is null then
  raise exception 'CHIFAA_PRODUCT_IMAGE_BASE_REQUIRED';
 end if;
 if to_regprocedure('private.can(text,text)') is null then
  raise exception 'CHIFAA_PERMISSION_HELPER_REQUIRED';
 end if;
 if not exists (
  select 1 from pg_policies
  where schemaname='storage' and tablename='objects'
    and policyname='product_images_edit' and cmd='INSERT'
 ) then raise exception 'PRODUCT_IMAGE_UPLOAD_POLICY_REQUIRED'; end if;
end
$guard$;

-- Evaluate product existence as the trusted function owner. A direct EXISTS
-- against public.products inside Storage RLS can be filtered by products RLS.
create or replace function private.product_image_upload_allowed(p_name text)
returns boolean
language sql stable security definer set search_path=''
as $$
 select coalesce(
  private.can('products','edit')
  and p_name ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$'
  and exists (
   select 1 from public.products p
   where p.id::text=lower(split_part(p_name,'/',1))
  ),
  false
 );
$$;
revoke all on function private.product_image_upload_allowed(text) from public,anon;
grant execute on function private.product_image_upload_allowed(text) to authenticated;

drop policy product_images_edit on storage.objects;
create policy product_images_edit on storage.objects for insert to authenticated
 with check (
  bucket_id='product-images'
  and (select private.product_image_upload_allowed(name))
 );

commit;
