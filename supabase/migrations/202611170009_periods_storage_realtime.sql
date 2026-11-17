begin;
create or replace function private.assert_open(p_date date) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(170013);
 if p_date is null then raise exception 'INVALID_DATE';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_date between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
end $$;
create function public.set_accounting_period(p_start date,p_end date,p_closed boolean,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; period uuid;
begin
 if not private.can('cash','manage') then raise exception 'FORBIDDEN';end if;
 if p_start is null or p_end is null or p_end<p_start or length(trim(coalesce(p_reason,'')))<5 then raise exception 'PERIOD_REASON_REQUIRED';end if;
 cached=private.begin_request(p_key,'period:set',jsonb_build_object('start',p_start,'end',p_end,'closed',p_closed,'reason',p_reason));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170013);
 if exists(select 1 from public.accounting_periods where (starts_on,ends_on)<>(p_start,p_end) and daterange(starts_on,ends_on,'[]')&&daterange(p_start,p_end,'[]')) then raise exception 'PERIOD_OVERLAP';end if;
 insert into public.accounting_periods(starts_on,ends_on,status,closed_by,closed_at) values(p_start,p_end,case when p_closed then 'closed' else 'open' end,case when p_closed then auth.uid() end,case when p_closed then now() end)
 on conflict(starts_on,ends_on) do update set status=excluded.status,closed_by=excluded.closed_by,closed_at=excluded.closed_at returning id into period;
 insert into public.audit_logs(actor_id,action,table_name,record_id,after_row) values(auth.uid(),case when p_closed then 'PERIOD_CLOSED' else 'PERIOD_REOPENED' end,'accounting_periods',period,jsonb_build_object('reason',p_reason));
 return private.finish_request(p_key,jsonb_build_object('period_id',period,'closed',p_closed));
end $$;
revoke all on function public.set_accounting_period(date,date,boolean,text,uuid) from public;
grant execute on function public.set_accounting_period(date,date,boolean,text,uuid) to authenticated;

-- Supabase supplies Storage and Realtime. Local PostgreSQL tests deliberately
-- do not pretend these services exist: their hosted integration remains a gate.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
  execute 'create policy chifaa_documents_read on storage.objects for select to authenticated using(bucket_id=''documents'' and (storage.foldername(name))[1]=auth.uid()::text and private.can(''documents'',''view''))';
  execute 'create policy chifaa_documents_upload on storage.objects for insert to authenticated with check(bucket_id=''documents'' and (storage.foldername(name))[1]=auth.uid()::text and private.can(''documents'',''create''))';
 end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='customer_orders') then alter publication supabase_realtime add table public.customer_orders;end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications;end if;
 end if;
end $$;
commit;
