begin;
set local lock_timeout='5s';

create table public.finished_goods_stock_adjustments(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id),
 business_date date not null,
 quantity_delta numeric(20,6) not null check(quantity_delta<>0),
 before_quantity numeric(20,6) not null check(before_quantity>=0),
 after_quantity numeric(20,6) not null check(after_quantity>=0),
 reason text not null check(length(trim(reason)) between 5 and 1000),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 check(after_quantity-before_quantity=quantity_delta)
);
create index finished_goods_adjustments_product_day on public.finished_goods_stock_adjustments(product_id,business_date,created_at);
alter table public.finished_goods_stock_adjustments enable row level security;
revoke all on public.finished_goods_stock_adjustments from public,anon,authenticated;
insert into private.table_modules values('finished_goods_stock_adjustments','production');
create policy finished_goods_stock_adjustments_read on public.finished_goods_stock_adjustments for select to authenticated using((select private.can('production','view')));
grant select on public.finished_goods_stock_adjustments to authenticated;
create trigger finished_goods_stock_adjustments_audit before insert or update or delete on public.finished_goods_stock_adjustments for each row execute function private.record_change('production');
create trigger finished_goods_stock_adjustments_immutable before update or delete on public.finished_goods_stock_adjustments for each row execute function private.production_material_immutable();

create or replace function private.finished_goods_balance(p_product uuid,p_date date) returns numeric
language sql stable security definer set search_path='' as $$
 select
  coalesce((select sum(l.main_quantity+l.extra_quantity-l.rejected_quantity)
   from public.production_batch_lines l join public.production_batches b on b.id=l.batch_id
   where l.product_id=p_product and b.status='posted' and coalesce(b.delivery_date,b.produced_on)<=p_date),0)
  +coalesce((select sum(a.quantity_delta) from public.finished_goods_stock_adjustments a where a.product_id=p_product and a.business_date<=p_date),0)
  -coalesce((select sum(i.quantity) from public.delivery_items i join public.deliveries d on d.id=i.delivery_id
   where i.product_id=p_product and d.status='posted' and d.delivery_date<=p_date),0)
  -coalesce((select sum(l.delivered) from public.sales_lines l join public.sales_documents d on d.id=l.document_id
   where l.product_id=p_product and d.status='posted' and d.sold_on<=p_date
    and not exists(select 1 from public.deliveries x where x.id=d.delivery_id and x.status='posted')),0)
$$;
revoke all on function private.finished_goods_balance(uuid,date) from public,anon,authenticated;

create or replace function private.finished_goods_min_balance(p_product uuid,p_date date) returns numeric
language sql stable security definer set search_path='' as $$
 with movements as(
  select coalesce(b.delivery_date,b.produced_on) movement_date,sum(l.main_quantity+l.extra_quantity-l.rejected_quantity) delta
  from public.production_batch_lines l join public.production_batches b on b.id=l.batch_id
  where l.product_id=p_product and b.status='posted' and coalesce(b.delivery_date,b.produced_on)>p_date group by 1
  union all
  select a.business_date,sum(a.quantity_delta) from public.finished_goods_stock_adjustments a
  where a.product_id=p_product and a.business_date>p_date group by a.business_date
  union all
  select d.delivery_date,-sum(i.quantity) from public.delivery_items i join public.deliveries d on d.id=i.delivery_id
  where i.product_id=p_product and d.status='posted' and d.delivery_date>p_date group by d.delivery_date
  union all
  select d.sold_on,-sum(l.delivered) from public.sales_lines l join public.sales_documents d on d.id=l.document_id
  where l.product_id=p_product and d.status='posted' and d.sold_on>p_date
   and not exists(select 1 from public.deliveries x where x.id=d.delivery_id and x.status='posted') group by d.sold_on
 ),daily as(select movement_date,sum(delta) delta from movements group by movement_date),base as(
  select private.finished_goods_balance(p_product,p_date) quantity
 ),running as(
  select base.quantity+sum(daily.delta) over(order by daily.movement_date rows between unbounded preceding and current row) quantity
  from daily cross join base
 ) select least(base.quantity,coalesce((select min(quantity) from running),base.quantity)) from base
$$;
revoke all on function private.finished_goods_min_balance(uuid,date) from public,anon,authenticated;

create function public.finished_goods_stock_workspace(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('production','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'product_id',p.id,'code',p.code,'name',p.name,'unit',p.sale_unit,
  'quantity',private.finished_goods_balance(p.id,p_date)::text,
  'last_adjustment',(select max(a.created_at) from public.finished_goods_stock_adjustments a where a.product_id=p.id and a.business_date<=p_date)) order by p.name,p.code)
  from public.products p where not p.archived or private.finished_goods_balance(p.id,p_date)<>0),'[]'::jsonb);
end $$;
revoke all on function public.finished_goods_stock_workspace(date) from public,anon;
grant execute on function public.finished_goods_stock_workspace(date) to authenticated;

create function public.adjust_finished_goods_stock(p_product uuid,p_date date,p_expected_quantity numeric,p_quantity numeric,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_quantity numeric; delta numeric; result jsonb; adjustment_id uuid;
begin
 if not private.can('production','view') or not private.can('production','edit') then raise exception 'FORBIDDEN';end if;
 if p_product is null or p_date is null or not isfinite(p_date) or p_key is null
  or p_expected_quantity is null or p_quantity is null or p_expected_quantity<0 or p_quantity<0
  or scale(p_expected_quantity)>6 or scale(p_quantity)>6 or p_expected_quantity>99999999999999.999999 or p_quantity>99999999999999.999999
  or length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_FINISHED_GOODS_ADJUSTMENT';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_date between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 cached=private.begin_request(p_key,'production:finished-goods-adjust',jsonb_build_object('product',p_product,'date',p_date,'expected',p_expected_quantity,'quantity',p_quantity,'reason',trim(p_reason)));
 if cached is not null then return cached;end if;
 perform 1 from public.products where id=p_product for update;
 if not found then raise exception 'PRODUCT_NOT_FOUND';end if;
 current_quantity=private.finished_goods_balance(p_product,p_date);
 if current_quantity<>p_expected_quantity then raise exception 'FINISHED_GOODS_VERSION_CONFLICT';end if;
 delta=p_quantity-current_quantity;
 if delta=0 then
  return private.finish_request(p_key,jsonb_build_object('id',null,'quantity',current_quantity::text,'delta','0','unchanged',true));
 end if;
 if private.finished_goods_min_balance(p_product,p_date)+delta<0 then raise exception 'FINISHED_GOODS_ADJUSTMENT_BELOW_COMMITTED_STOCK';end if;
 insert into public.finished_goods_stock_adjustments(product_id,business_date,quantity_delta,before_quantity,after_quantity,reason,created_by)
 values(p_product,p_date,delta,current_quantity,p_quantity,trim(p_reason),auth.uid()) returning id into adjustment_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,before_row,after_row)
 values(auth.uid(),'FINISHED_GOODS_STOCK_ADJUSTED','finished_goods_stock_adjustments',adjustment_id,
  jsonb_build_object('product_id',p_product,'business_date',p_date,'quantity',current_quantity::text),
  jsonb_build_object('product_id',p_product,'business_date',p_date,'quantity',p_quantity::text,'delta',delta::text,'reason',trim(p_reason)));
 result=jsonb_build_object('id',adjustment_id,'quantity',p_quantity::text,'delta',delta::text,'unchanged',false);
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.adjust_finished_goods_stock(uuid,date,numeric,numeric,text,uuid) from public,anon;
grant execute on function public.adjust_finished_goods_stock(uuid,date,numeric,numeric,text,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
