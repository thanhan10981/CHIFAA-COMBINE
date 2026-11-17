begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id), display_name text not null default '',
  enabled boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.roles (id text primary key, name text not null);
create table public.permissions (module text not null, action text not null check(action in ('view','create','edit','approve','export','manage')), primary key(module,action));
create table public.role_permissions (role_id text references public.roles(id), module text, action text, primary key(role_id,module,action), foreign key(module,action) references public.permissions);
create table public.user_roles (user_id uuid references public.profiles(id), role_id text references public.roles(id), primary key(user_id,role_id));
create table public.user_permissions (user_id uuid references public.profiles(id), module text, action text, allowed boolean not null, primary key(user_id,module,action), foreign key(module,action) references public.permissions);
create table public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table public.audit_logs (id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null, table_name text not null, record_id uuid, before_row jsonb, after_row jsonb, at timestamptz not null default now());
create index audit_logs_at_idx on public.audit_logs(at desc,id desc);
create table public.idempotency_keys (actor_id uuid references auth.users(id), key uuid, operation text not null, fingerprint text not null, result jsonb, created_at timestamptz not null default now(), primary key(actor_id,key));
create table public.data_versions (module text primary key, version bigint not null default 1, updated_at timestamptz not null default now());
create table private.table_modules(table_name text primary key,module text not null);
insert into private.table_modules values('profiles','admin');
create table public.import_jobs (id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id), source_hash text not null, mapping_version text not null, state text not null default 'staged' check(state in ('staged','reviewed','applied','failed')), totals jsonb, created_at timestamptz not null default now(), unique(source_hash,mapping_version));
create table public.import_errors (id bigint generated always as identity primary key, job_id uuid not null references public.import_jobs(id), sheet text not null, row_number integer not null, code text not null, message text not null);

insert into public.roles values ('admin','Quản trị'),('accountant','Kế toán'),('manager','Quản lý'),('production','Sản xuất'),('warehouse','Kho'),('sales','Bán hàng'),('customer','Khách hàng');
insert into public.permissions select m,a from unnest(array['dashboard','materials','products','stores','employees','prices','recipes','requirements','production','inventory','counts','orders','deliveries','returns','kiosk','sales','payments','receivables','loans','cash','expenses','assets','attendance','payroll','targets','reports','strategy','admin','audit','imports','documents']) m cross join unnest(array['view','create','edit','approve','export','manage']) a;
insert into public.role_permissions select 'admin',module,action from public.permissions;

create function private.can(p_module text,p_action text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.enabled)
    and coalesce((select u.allowed from public.user_permissions u where u.user_id=(select auth.uid()) and u.module=p_module and u.action=p_action),
      exists(select 1 from public.user_roles u join public.role_permissions r on r.role_id=u.role_id where u.user_id=(select auth.uid()) and r.module=p_module and r.action=p_action));
$$;
revoke all on function private.can(text,text) from public;
grant execute on function private.can(text,text) to authenticated;

create function public.my_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',auth.uid(),'enabled',coalesce((select enabled from public.profiles where id=auth.uid()),false),
  'permissions',coalesce((select jsonb_agg(jsonb_build_object('module',module,'action',action) order by module,action) from public.permissions where private.can(module,action)),'[]'::jsonb));
$$;
revoke all on function public.my_access() from public;
grant execute on function public.my_access() to authenticated;

create function private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'HISTORY_IMMUTABLE: archive or reverse instead of delete'; end if;
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.created_at<>old.created_at or new.created_by is distinct from old.created_by then raise exception 'IMMUTABLE_IDENTITY'; end if;
  new.version=old.version+1;
 else new.version=1; new.created_by=auth.uid(); end if;
 new.updated_at=now(); new.updated_by=auth.uid();
 insert into public.audit_logs(actor_id,action,table_name,record_id,before_row,after_row)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,new.id,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 insert into public.data_versions(module) values(TG_ARGV[0]) on conflict(module) do update set version=public.data_versions.version+1,updated_at=now();
 return new;
end $$;
revoke all on function private.record_change() from public;

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or private.can('admin','view'));
alter table public.roles enable row level security;
create policy roles_read on public.roles for select to authenticated using(private.can('admin','view'));
alter table public.permissions enable row level security;
create policy permissions_read on public.permissions for select to authenticated using(true);
alter table public.role_permissions enable row level security;
create policy role_permissions_read on public.role_permissions for select to authenticated using(private.can('admin','view'));
alter table public.user_roles enable row level security;
create policy user_roles_read on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or private.can('admin','view'));
alter table public.user_permissions enable row level security;
create policy user_permissions_read on public.user_permissions for select to authenticated using(user_id=(select auth.uid()) or private.can('admin','view'));
create function private.audit_visible(p_table text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select private.can(module,'view') from private.table_modules where table_name=p_table),false);
$$;
revoke all on function private.audit_visible(text) from public;grant execute on function private.audit_visible(text) to authenticated;
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated using((select private.can('audit','view')) and private.audit_visible(table_name));
alter table public.app_settings enable row level security;
create policy settings_read on public.app_settings for select to authenticated using(private.can('admin','view'));
alter table public.data_versions enable row level security;
create policy versions_read on public.data_versions for select to authenticated using(private.can(module,'view'));
alter table public.idempotency_keys enable row level security;
alter table public.import_jobs enable row level security;
create policy import_jobs_read on public.import_jobs for select to authenticated using(private.can('imports','view'));
alter table public.import_errors enable row level security;
create policy import_errors_read on public.import_errors for select to authenticated using(private.can('imports','view'));
grant select on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
-- No API role can mutate the permission graph or business tables directly.
commit;
