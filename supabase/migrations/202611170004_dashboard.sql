begin;
create function public.dashboard_summary(p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare revenue numeric; received numeric; produced numeric; hours numeric;
begin
 if not private.can('dashboard','view') then raise exception 'FORBIDDEN'; end if;
 if p_date is null then raise exception 'INVALID_DATE'; end if;
 if private.can('sales','view') then select case when count(*)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) else null end into revenue from public.sales_documents d join public.sales_lines l on l.document_id=d.id where d.status='posted' and d.sold_on=p_date; end if;
 if private.can('payments','view') then select sum(amount_vnd) into received from public.payment_receipts where status='posted' and received_on=p_date; end if;
 if private.can('production','view') then select sum(l.main_quantity+l.extra_quantity) into produced from public.production_batches b join public.production_batch_lines l on l.batch_id=b.id where b.status='posted' and b.produced_on=p_date; end if;
 if private.can('attendance','view') then select sum(extract(epoch from(ends_at-starts_at))/3600-break_minutes/60.0) into hours from public.attendance_shifts where status='posted' and department_snapshot='SX' and (starts_at at time zone 'Asia/Ho_Chi_Minh')::date=p_date; end if;
 return jsonb_build_object('net_revenue_vnd',revenue::text,'received_vnd',received::text,'produced',produced::text,'production_hours',hours::text,'updated_at',now(),'completeness',case when revenue is null or received is null or produced is null or hours is null then 'Chưa đủ dữ liệu' else 'Đủ nguồn trong kỳ' end);
end $$;
revoke all on function public.dashboard_summary(date) from public;
grant execute on function public.dashboard_summary(date) to authenticated;
commit;
