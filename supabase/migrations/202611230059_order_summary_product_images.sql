begin;

alter table public.products add column image_path text;
alter table public.products add constraint products_image_path_check
 check(image_path is null or image_path ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy product_images_public_read on storage.objects for select to anon,authenticated
 using(bucket_id='product-images');
create policy product_images_edit on storage.objects for insert to authenticated
 with check(bucket_id='product-images' and private.can('products','edit') and
  name ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$' and
  exists(select 1 from public.products p where p.id::text=lower(split_part(name,'/',1))));
create policy product_images_replace on storage.objects for update to authenticated
 using(bucket_id='product-images' and private.can('products','edit'))
 with check(bucket_id='product-images' and private.can('products','edit'));
create policy product_images_remove on storage.objects for delete to authenticated
 using(bucket_id='product-images' and private.can('products','edit'));

create function public.save_product_image(p_product uuid,p_expected_version bigint,p_path text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;current_product public.products;result jsonb;
begin
 if not private.can('products','edit') then raise exception 'FORBIDDEN';end if;
 if p_product is null or p_expected_version is null or p_key is null or
   (p_path is not null and (p_path !~ ('^'||p_product::text||'/[A-Za-z0-9._-]{1,120}$') or
    not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_path))) then raise exception 'INVALID_PRODUCT_IMAGE';end if;
 cached=private.begin_request(p_key,'product:image',jsonb_build_object('product',p_product,'version',p_expected_version,'path',p_path));
 if cached is not null then return cached;end if;
 select * into strict current_product from public.products where id=p_product for update;
 if current_product.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 update public.products set image_path=p_path,version=version+1 where id=p_product returning jsonb_build_object('id',id,'version',version::text,'image_path',image_path) into result;
 return private.finish_request(p_key,result);
end $$;

create or replace function public.public_order_catalog(p_date date,p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;total bigint;
begin
 if p_date is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_FILTER';end if;
 select count(*) into total from public.products where published and not archived;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.code,page.product_id),'[]') into rows from(
  select p.id product_id,p.code,p.name,p.sale_unit,p.image_path,price.price_vnd::text
  from public.products p left join lateral(select x.price_vnd from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) price on true
  where p.published and not p.archived order by p.code,p.id offset p_offset limit p_limit
 ) page;
 return jsonb_build_object('rows',rows,'total',total::text);
end $$;

drop function public.portal_catalog(uuid,date);
create function public.portal_catalog(p_store uuid,p_date date)
returns table(product_id uuid,code text,name text,sale_unit text,price_vnd text,discount_rate text,image_path text)
language plpgsql stable security definer set search_path='' as $$begin
 if not private.owns_store(p_store) or p_date is null then raise exception 'FORBIDDEN';end if;
 return query select p.id,p.code,p.name,p.sale_unit,offer.price_vnd::text,offer.discount_rate::text,p.image_path
 from public.products p cross join lateral private.commercial_offer(p_store,p.id,p_date) offer
 where p.published and not p.archived and offer.price_vnd is not null order by p.code;
end $$;

create function public.order_customer_summary(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare order_rows jsonb;store_columns jsonb;product_rows jsonb;
begin
 if not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',o.id,'code',left(replace(o.id::text,'-',''),8),'store_id',o.store_id,'store_code',s.code,'store_name',s.name,
  'store_phone',s.contact,'customer_name',o.guest_name,'customer_phone',coalesce(o.guest_phone,s.contact),
  'delivery_date',o.delivery_date,'shift',o.shift,'status',o.status,'note',o.note,
  'total_quantity',coalesce(lines.total_quantity,0)::text,'discount_vnd',coalesce(lines.discount_vnd,0)::bigint::text,
  'discount_rate',coalesce(lines.discount_rate,0)::text,
  'order_total_vnd',coalesce(lines.order_total_vnd,0)::bigint::text,
  'old_deduction_vnd',null,'cash_received_vnd',case when private.can('payments','view') then coalesce(pay.cash_vnd,0)::text end,
  'bank_received_vnd',case when private.can('payments','view') then coalesce(pay.bank_vnd,0)::text end,
  'payment_method',case when private.can('payments','view') then coalesce(pay.method,'Chưa ghi nhận') end,
  'outstanding_vnd',case when private.can('receivables','view') then pay.balance_vnd::text end,
  'items',coalesce(lines.items,'[]'::jsonb)
 ) order by o.delivery_date,o.created_at,o.id),'[]') into order_rows
 from public.customer_orders o left join public.stores s on s.id=o.store_id
 left join lateral(
  select sum(i.quantity) total_quantity,
   sum(round(i.quantity*i.price_vnd)-round(i.quantity*i.price_vnd*(1-i.discount_rate))) discount_vnd,
   sum(i.quantity*i.price_vnd*i.discount_rate)/nullif(sum(i.quantity*i.price_vnd),0) discount_rate,
   sum(round(i.quantity*i.price_vnd*(1-i.discount_rate))) order_total_vnd,
   jsonb_agg(jsonb_build_object('product_id',i.product_id,'code',coalesce(i.product_code,p.code),'name',coalesce(i.product_name,p.name),
    'quantity',i.quantity::text,'unit',coalesce(i.sale_unit,p.sale_unit),'price_vnd',i.price_vnd::text,
    'discount_rate',i.discount_rate::text,'line_total_vnd',round(i.quantity*i.price_vnd*(1-i.discount_rate))::bigint::text)
    order by coalesce(i.product_code,p.code),i.id) items
  from public.customer_order_items i join public.products p on p.id=i.product_id where i.order_id=o.id
 ) lines on true
 left join lateral(
  select sum(ra.amount_vnd) filter(where a.kind='cash') cash_vnd,sum(ra.amount_vnd) filter(where a.kind='bank') bank_vnd,
   case when count(distinct a.kind)>1 then 'Tiền mặt + chuyển khoản' when max(a.kind)='cash' then 'Tiền mặt' when max(a.kind)='bank' then 'Chuyển khoản' end method,
   max(r.amount_vnd+coalesce(adj.amount_vnd,0)-coalesce(alloc.amount_vnd,0)) balance_vnd
  from public.deliveries d join public.sales_documents sd on sd.delivery_id=d.id and sd.status='posted'
  join public.receivables r on r.sales_document_id=sd.id
  left join lateral(select sum(pa.amount_vnd) amount_vnd from public.receipt_allocations pa join public.payment_receipts pr on pr.id=pa.receipt_id where pa.receivable_id=r.id and pr.status='posted' and pr.received_on<=p_date) alloc on true
  left join lateral(select sum(da.amount_vnd) amount_vnd from public.debt_adjustments da where da.receivable_id=r.id and da.adjustment_on<=p_date) adj on true
  left join public.receipt_allocations ra on ra.receivable_id=r.id
  left join public.payment_receipts rp on rp.id=ra.receipt_id and rp.status='posted' and rp.received_on<=p_date
  left join public.bank_accounts a on a.id=rp.account_id
  where d.order_id=o.id and d.delivery_date<=p_date
 ) pay on private.can('payments','view') or private.can('receivables','view')
 where o.delivery_date=p_date;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'phone',s.contact) order by s.code),'[]')
 into store_columns from public.stores s where s.active and exists(
  select 1 from public.customer_orders o where o.store_id=s.id and o.delivery_date=p_date and o.status in('approved','scheduled','fulfilled'));
 select coalesce(jsonb_agg(jsonb_build_object('product_id',x.product_id,'code',x.code,'name',x.name,'unit',x.unit,
  'total_quantity',x.total_quantity::text,'by_store',x.by_store) order by x.code,x.product_id),'[]') into product_rows
 from(
  select p.id product_id,p.code,p.name,p.sale_unit unit,
   (select sum(i.quantity) from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
    where i.product_id=p.id and o.delivery_date=p_date and o.status in('approved','scheduled','fulfilled')) total_quantity,
   (select coalesce(jsonb_object_agg(z.store_id::text,z.quantity::text),'{}') from(
     select o.store_id,sum(i.quantity) quantity from public.customer_order_items i
     join public.customer_orders o on o.id=i.order_id where i.product_id=p.id and o.delivery_date=p_date
      and o.status in('approved','scheduled','fulfilled') and o.store_id is not null group by o.store_id) z) by_store
  from public.products p where exists(select 1 from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
   where i.product_id=p.id and o.delivery_date=p_date and o.status in('approved','scheduled','fulfilled'))
 ) x;
 return jsonb_build_object('date',p_date,'orders',order_rows,'stores',store_columns,'products',product_rows,
  'planned_quantity_total',(select coalesce(sum((p->>'total_quantity')::numeric),0)::text from jsonb_array_elements(product_rows) p));
end $$;

create function public.order_material_demand(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lines jsonb;needs jsonb;result jsonb;
begin
 if not private.can('orders','view') or not private.can('requirements','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',x.product_id,'quantity',x.quantity::text)),'[]') into lines
 from(select i.product_id,sum(i.quantity) quantity from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
  where o.delivery_date=p_date and o.status in('approved','scheduled') and o.plan_id is null group by i.product_id) x;
 needs=private.planning_needs(p_date,lines);
 select jsonb_build_object(
  'date',p_date,
  'products',lines,
  'issues',(select coalesce(jsonb_agg(n),'[]') from jsonb_array_elements(needs) n where n ? 'issue'),
  'materials',(select coalesce(jsonb_agg(jsonb_build_object(
   'material_id',x.material_id,'code',m.code,'name',m.name,'unit_code',u.code,'quantity',x.quantity::text,
   'stock_quantity',stock.quantity::text,'minimum_quantity',m.minimum_quantity::text,
   'shortage_quantity',case when stock.quantity is null then null else greatest(x.quantity-stock.quantity,0)::text end,
   'status',case when stock.quantity is null then 'unknown' when stock.quantity<x.quantity then 'insufficient'
     when m.minimum_quantity is not null and stock.quantity-x.quantity<m.minimum_quantity then 'low' else 'ok' end,
   'sources',x.sources
  ) order by m.code),'[]') from(
   select (n->>'material_id')::uuid material_id,(n->>'unit_id')::uuid unit_id,
    sum((n->>'quantity')::numeric) quantity,
    jsonb_agg(jsonb_build_object('product_id',n->>'product_id','product_code',n->>'product_code','product_name',n->>'product_name','quantity',n->>'quantity')) sources
   from jsonb_array_elements(needs) n where not (n ? 'issue') group by 1,2
  ) x join public.materials m on m.id=x.material_id join public.material_units u on u.id=x.unit_id
   left join lateral(select case when exists(select 1 from public.inventory_movement_lines ml
     join public.inventory_movements im on im.id=ml.movement_id join public.warehouses w on w.id=im.warehouse_id
     where ml.material_id=x.material_id and ml.unit_id=x.unit_id and im.status='posted' and im.moved_on<=p_date and w.kind='ingredient')
    then (select coalesce(sum(ml.quantity),0) from public.inventory_movement_lines ml join public.inventory_movements im on im.id=ml.movement_id
     join public.warehouses w on w.id=im.warehouse_id where ml.material_id=x.material_id and ml.unit_id=x.unit_id and im.status='posted' and im.moved_on<=p_date and w.kind='ingredient') end quantity) stock on true
  )
 ) into result;
 return result;
end $$;

revoke all on function public.save_product_image(uuid,bigint,text,uuid),public.public_order_catalog(date,integer,integer),
 public.portal_catalog(uuid,date),public.order_customer_summary(date),public.order_material_demand(date) from public,anon;
grant execute on function public.save_product_image(uuid,bigint,text,uuid) to authenticated;
grant execute on function public.public_order_catalog(date,integer,integer) to anon,authenticated;
grant execute on function public.portal_catalog(uuid,date),public.order_customer_summary(date),public.order_material_demand(date) to authenticated;

commit;
