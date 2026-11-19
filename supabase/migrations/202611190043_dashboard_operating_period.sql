begin;

-- Read the existing permission-aware daily snapshot over a bounded period.
-- Keep financial math in PostgreSQL and preserve null for days without source rows.
create or replace function public.dashboard_period_summary(p_start date,p_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;unit_count integer;unit_label text;unit_consistent boolean;
begin
 if not private.can('dashboard','view') then raise exception 'FORBIDDEN';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_end<p_start or p_end-p_start>365 then raise exception 'INVALID_DASHBOARD_PERIOD';end if;
 select coalesce(jsonb_agg(public.dashboard_summary(d::date) order by d),'[]'::jsonb)
  into result from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d;
 if private.can('production','view') then
  select count(distinct p.sale_unit),max(p.sale_unit) into unit_count,unit_label
  from public.production_batches b join public.production_batch_lines l on l.batch_id=b.id
  join public.products p on p.id=l.product_id
  where b.status='posted' and b.produced_on between p_start and p_end;
  unit_consistent=coalesce(unit_count,0)<=1;
 else unit_consistent=false;unit_label=null;
 end if;
 return jsonb_build_object('start',p_start,'end',p_end,'days',result,'production_unit_consistent',unit_consistent,
  'production_unit',case when unit_consistent then unit_label end,'updated_at',now());
end $$;

revoke all on function public.dashboard_period_summary(date,date) from public,anon;
grant execute on function public.dashboard_period_summary(date,date) to authenticated;

commit;
