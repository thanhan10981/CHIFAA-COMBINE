begin;
set local lock_timeout='5s';

insert into private.table_modules(table_name,module) values('audit_logs','audit') on conflict do nothing;

-- Keep detailed audit history for 30 days, then prune it automatically.
-- Each non-empty purge writes a fresh audit record with the cutoff and count.
create function private.purge_expired_audit_logs()
returns bigint language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz:=statement_timestamp()-interval '30 days'; deleted_count bigint;
begin
 delete from public.audit_logs where at<cutoff;
 get diagnostics deleted_count=row_count;
 if deleted_count>0 then
  insert into public.audit_logs(actor_id,action,table_name,record_id,after_row)
  values(auth.uid(),'AUDIT_RETENTION_PURGE','audit_logs',null,
   jsonb_build_object('retention_days',30,'deleted_count',deleted_count,'cutoff',cutoff));
 end if;
 return deleted_count;
end $$;
revoke all on function private.purge_expired_audit_logs() from public,anon,authenticated;

-- The interactive action is restricted to administrators. Direct table writes
-- remain unavailable to browser roles; cleanup always uses the fixed 30-day cutoff.
create function public.clean_expired_audit_logs()
returns jsonb language plpgsql security definer set search_path='' as $$
declare deleted_count bigint;
begin
 if not private.can('admin','manage') then raise exception 'FORBIDDEN';end if;
 deleted_count=private.purge_expired_audit_logs();
 return jsonb_build_object('deleted_count',deleted_count,'retention_days',30);
end $$;
revoke all on function public.clean_expired_audit_logs() from public,anon;
grant execute on function public.clean_expired_audit_logs() to authenticated;

-- Run daily at 03:15 UTC. Existing named jobs are replaced idempotently.
do $schedule$
declare existing_job bigint;
begin
 -- pg_cron is available on Supabase but not in embedded PostgreSQL test runs.
 -- Keep the retention RPC usable everywhere; install the recurring job only
 -- where the extension is provided by the server.
 if not exists(select 1 from pg_available_extensions where name='pg_cron') then return;end if;
 execute 'create extension if not exists pg_cron with schema pg_catalog';
 for existing_job in select jobid from cron.job where jobname='audit-log-retention-30-days' loop
  perform cron.unschedule(existing_job);
 end loop;
 perform cron.schedule('audit-log-retention-30-days','15 3 * * *','select private.purge_expired_audit_logs();');
end
$schedule$;

commit;
