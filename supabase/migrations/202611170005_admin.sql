begin;
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict do nothing;return new;end $$;
-- Identity does not imply permission. New users stay disabled until approved.
create trigger chifaa_profile_after_signup after insert on auth.users for each row execute function private.new_profile();
revoke all on function private.new_profile() from public;

create function public.admin_assign_user(p_user uuid,p_enabled boolean,p_roles text[],p_overrides jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; before_state jsonb; after_state jsonb; item jsonb;
begin
 if not private.can('admin','manage') then raise exception 'FORBIDDEN'; end if;
 cached=private.begin_request(p_key,'admin:assign',jsonb_build_object('user',p_user,'enabled',p_enabled,'roles',p_roles,'permissions',p_overrides));if cached is not null then return cached; end if;
 perform pg_advisory_xact_lock(170012);
 if jsonb_typeof(p_overrides)<>'array' or jsonb_array_length(p_overrides)>200 then raise exception 'INVALID_PERMISSIONS'; end if;
 select jsonb_build_object('enabled',p.enabled,'roles',(select jsonb_agg(role_id) from public.user_roles where user_id=p.id),'overrides',(select jsonb_agg(jsonb_build_object('module',module,'action',action,'allowed',allowed)) from public.user_permissions where user_id=p.id)) into before_state from public.profiles p where p.id=p_user for update;
 if before_state is null then raise exception 'USER_NOT_FOUND'; end if;
 update public.profiles set enabled=p_enabled,updated_at=now() where id=p_user;
 delete from public.user_roles where user_id=p_user;
 insert into public.user_roles(user_id,role_id) select p_user,unnest(p_roles);
 delete from public.user_permissions where user_id=p_user;
 for item in select value from jsonb_array_elements(p_overrides) loop
  insert into public.user_permissions values(p_user,item->>'module',item->>'action',(item->>'allowed')::boolean);
 end loop;
 if not exists(select 1 from public.profiles p join public.user_roles u on u.user_id=p.id join public.role_permissions rp on rp.role_id=u.role_id and rp.module='admin' and rp.action='manage' where p.enabled and coalesce((select allowed from public.user_permissions up where up.user_id=p.id and up.module='admin' and up.action='manage'),true)) then raise exception 'LAST_ADMIN_REQUIRED'; end if;
 after_state=jsonb_build_object('enabled',p_enabled,'roles',p_roles,'permissions',p_overrides);
 insert into public.audit_logs(actor_id,action,table_name,record_id,before_row,after_row) values(auth.uid(),'GRANT_UPDATE','profiles',p_user,before_state,after_state);
 return private.finish_request(p_key,after_state);
end $$;
revoke all on function public.admin_assign_user(uuid,boolean,text[],jsonb,uuid) from public;
grant execute on function public.admin_assign_user(uuid,boolean,text[],jsonb,uuid) to authenticated;
commit;
