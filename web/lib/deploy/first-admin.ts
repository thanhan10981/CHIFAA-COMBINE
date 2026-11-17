/** Owner-run maintenance SQL. Never expose this as a browser-callable RPC. */
export function buildFirstAdminSql(email:string) {
 const normalized=email.trim().toLowerCase();
 if(normalized.length>254||!/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(normalized)) throw new Error('A valid confirmed owner email is required');
 const literal="'"+normalized.replaceAll("'","''")+"'";
 return `-- CHIFAA DEV: bootstrap the first Admin for the explicitly named owner.
-- Run as postgres in Supabase SQL Editor AFTER the owner signed in with Google.
-- No business data is imported. Existing managers must use the Admin screen.
begin;
set local lock_timeout='5s';
do $bootstrap$
declare target uuid; matches integer; confirmed boolean; before_state jsonb;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED'; end if;
 perform pg_advisory_xact_lock(170012);
 select count(*),(array_agg(id))[1],bool_and(email_confirmed_at is not null) into matches,target,confirmed
 from auth.users where lower(email)=${literal};
 if matches<>1 then raise exception 'OWNER_AUTH_ACCOUNT_NOT_UNIQUE: sign in once and verify the exact owner email'; end if;
 if confirmed is not true then raise exception 'OWNER_EMAIL_NOT_CONFIRMED'; end if;
 if exists(select 1 from public.user_permissions where user_id=target and not allowed) then
  raise exception 'OWNER_HAS_PERMISSION_OVERRIDES: review existing permissions instead of overwriting';
 end if;
 -- Re-running the same successful bootstrap never creates a second audit/grant.
 if exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=target and p.enabled and r.role_id='admin') then return; end if;
 if exists(
  select 1 from public.profiles p where p.enabled and coalesce(
   (select u.allowed from public.user_permissions u where u.user_id=p.id and u.module='admin' and u.action='manage'),
   exists(select 1 from public.user_roles r join public.role_permissions rp on rp.role_id=r.role_id where r.user_id=p.id and rp.module='admin' and rp.action='manage')
  )
 ) then raise exception 'ADMIN_ALREADY_INITIALIZED: use the existing Admin account'; end if;
 select to_jsonb(p) into before_state from public.profiles p where p.id=target for update;
 insert into public.profiles(id,enabled) values(target,true)
 on conflict(id) do update set enabled=true,updated_at=now();
 insert into public.user_roles(user_id,role_id) values(target,'admin') on conflict do nothing;
 insert into public.audit_logs(actor_id,action,table_name,record_id,before_row,after_row)
 values(null,'ADMIN_BOOTSTRAP','profiles',target,before_state,jsonb_build_object('enabled',true,'role','admin','method','owner_sql_editor'));
end $bootstrap$;
commit;
select p.id,p.enabled,r.role_id from public.profiles p join public.user_roles r on r.user_id=p.id
join auth.users u on u.id=p.id where lower(u.email)=${literal} and r.role_id='admin';
`;
}
