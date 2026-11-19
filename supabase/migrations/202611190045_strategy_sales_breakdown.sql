begin;

-- Read-only breakdowns for the live business strategy page.
-- Sales reversal/cancellation and returned quantities remain separate concepts.
create or replace function public.strategy_sales_breakdown(p_start date,p_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare stores_result jsonb;products_result jsonb;
begin
 if not private.can('dashboard','view') then raise exception 'FORBIDDEN';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_end<p_start or p_end-p_start>365 then raise exception 'INVALID_STRATEGY_PERIOD';end if;
 if not private.can('sales','view') then
  return jsonb_build_object('available',false,'stores','[]'::jsonb,'products','[]'::jsonb);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'store_id',s.store_id,'name',case when private.can('stores','view') then st.name end,
   'revenue_vnd',s.revenue_vnd::text,'complete',s.complete,'document_count',s.document_count
  ) order by s.revenue_vnd desc nulls last,s.document_count desc),'[]'::jsonb)
  into stores_result
 from (
  select d.store_id,count(distinct d.id)::integer document_count,
   case when count(l.id)>0 and count(l.id)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) end revenue_vnd,
   count(l.id)>0 and count(l.id)=count(l.net_revenue_vnd) complete
  from public.sales_documents d left join public.sales_lines l on l.document_id=d.id
  where d.status='posted' and d.sold_on between p_start and p_end
  group by d.store_id
 ) s left join public.stores st on st.id=s.store_id;
 select coalesce(jsonb_agg(jsonb_build_object(
   'product_id',p.product_id,'code',case when private.can('products','view') then pr.code end,
   'name',case when private.can('products','view') then pr.name end,
   'revenue_vnd',p.revenue_vnd::text,'complete',p.complete,'sold_quantity',p.sold_quantity::text,
   'returned_quantity',p.returned_quantity::text,'line_count',p.line_count
  ) order by p.revenue_vnd desc nulls last,p.line_count desc),'[]'::jsonb)
  into products_result
 from (
  select l.product_id,count(*)::integer line_count,
   case when count(*)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) end revenue_vnd,
   count(*)=count(l.net_revenue_vnd) complete,sum(l.sold) sold_quantity,sum(l.returned) returned_quantity
  from public.sales_documents d join public.sales_lines l on l.document_id=d.id
  where d.status='posted' and d.sold_on between p_start and p_end
  group by l.product_id
 ) p left join public.products pr on pr.id=p.product_id;
 return jsonb_build_object('available',true,'stores',stores_result,'products',products_result,'updated_at',now());
end $$;

revoke all on function public.strategy_sales_breakdown(date,date) from public,anon;
grant execute on function public.strategy_sales_breakdown(date,date) to authenticated;

commit;
