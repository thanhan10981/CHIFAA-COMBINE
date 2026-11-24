begin;
set local lock_timeout='5s';

-- Link topping consumption to the delivery and inventory issue that consumed it.
alter table public.customer_order_item_toppings
 add column inventory_movement_id uuid references public.inventory_movements(id),
 add column delivery_id uuid references public.deliveries(id),
 add column consumed_at timestamptz;

-- Topping material needs follow the production plan's assigned ingredient
-- warehouse. These are requirement estimates; they do not post inventory.
create function private.plan_order_topping_material_needs(p_warehouse uuid,p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
  'material_id',b.material_id,'unit_id',b.unit_id,'quantity',b.quantity::text,
  'product_id',i.product_id,'product_code',i.product_code,'product_name',i.product_name,
  'recipe_version_id',t.topping_version_id,'topping_code',t.topping_code,
  'topping_name',t.topping_name,'topping_quantity',t.quantity::text,
  'calculated_on',p_date,'source','scheduled_order_topping'
 ) order by i.product_code,t.topping_code,b.material_id),'[]'::jsonb) into result
 from public.customer_order_item_toppings t
 join public.customer_order_items i on i.id=t.order_item_id and i.cancelled_at is null
 join public.customer_orders o on o.id=i.order_id and o.delivery_date=p_date and o.status='scheduled'
 join public.production_plans p on p.id=o.plan_id and p.ingredient_warehouse_id=p_warehouse and p.delivery_date=p_date and p.status in('approved','completed')
 cross join lateral private.bom(t.topping_version_id,t.quantity,p_date) b
 where t.topping_version_id is not null and t.consumed_at is null;
 return result;
end $$;
revoke all on function private.plan_order_topping_material_needs(uuid,date) from public,anon,authenticated;

-- Include scheduled customer topping allocations in the plan preview and the
-- inventory planning views without duplicating the normal product BOM.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.production_plan_requirements(uuid,date,uuid,text,jsonb)'::regprocedure) into definition;
 old_fragment='needs=needs||private.planning_needs(p_date,approved);';
 new_fragment=old_fragment||' needs=needs||private.plan_order_topping_material_needs(p_warehouse,p_date);';
 if strpos(definition,old_fragment)=0 then raise exception 'PLAN_PREVIEW_TOPPING_NEEDS_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.inventory_workspace(uuid,date,date,text,text,text,integer)'::regprocedure) into definition;
 old_fragment='complete=planned and not exists(select 1 from jsonb_array_elements(needs) x where x ? ''issue'');';
 new_fragment='needs=needs||private.plan_order_topping_material_needs(p_warehouse,p_need_date); '||old_fragment;
 if strpos(definition,old_fragment)=0 then raise exception 'INVENTORY_WORKSPACE_TOPPING_NEEDS_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.production_material_workspace_before029(uuid,date,date,text)'::regprocedure) into definition;
 old_fragment='needs=coalesce(head.needs,''[]'')||private.planning_needs(p_to,approved);';
 new_fragment=old_fragment||' needs=needs||private.plan_order_topping_material_needs(p_warehouse,p_to);';
 if strpos(definition,old_fragment)=0 then raise exception 'PRODUCTION_WORKSPACE_TOPPING_NEEDS_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Delivery is the operational confirmation for toppings: require an assigned
-- production plan and issue its exact topping BOM from that plan's ingredient
-- warehouse in the same transaction as delivery, sales and receivable posting.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.fulfill_order_delivery(uuid,bigint,uuid)'::regprocedure) into definition;
 old_fragment='declare cached jsonb; current_order public.customer_orders; item record; delivery_id uuid; available numeric; sales_id uuid; receivable_id uuid; revenue numeric; result jsonb;';
 new_fragment='declare cached jsonb; current_order public.customer_orders; item record; delivery_id uuid; available numeric; sales_id uuid; receivable_id uuid; revenue numeric; result jsonb; topping_movement uuid; topping_lines jsonb; topping_count integer; topping_warehouse uuid;';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_TOPPING_DELIVERY_DECLARATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$insert into public.delivery_items(delivery_id,product_id,quantity)
  select delivery_id,product_id,quantity from public.customer_order_items where order_id=p_order and cancelled_at is null order by product_id;$old$;
 new_fragment=$new$insert into public.delivery_items(delivery_id,product_id,quantity)
  select delivery_id,product_id,quantity from public.customer_order_items where order_id=p_order and cancelled_at is null order by product_id;
 select count(*) into topping_count from public.customer_order_item_toppings t join public.customer_order_items i on i.id=t.order_item_id where i.order_id=p_order and i.cancelled_at is null and t.topping_version_id is not null and t.quantity>0 and t.consumed_at is null;
 if topping_count>0 then
  if current_order.plan_id is null then raise exception 'ORDER_TOPPING_PRODUCTION_PLAN_REQUIRED';end if;
  select ingredient_warehouse_id into topping_warehouse from public.production_plans where id=current_order.plan_id and delivery_date=current_order.delivery_date and status in('approved','completed');
  if topping_warehouse is null or not exists(select 1 from public.warehouses where id=topping_warehouse and active and kind='ingredient') then raise exception 'ORDER_TOPPING_INGREDIENT_WAREHOUSE_REQUIRED';end if;
  select coalesce(jsonb_agg(jsonb_build_object('material_id',x.material_id,'unit_id',x.unit_id,'quantity',(-x.quantity)::text) order by x.material_id),'[]'::jsonb) into topping_lines
  from(select b.material_id,bm.usage_unit_id unit_id,sum(private.convert_quantity(b.material_id,b.unit_id,bm.usage_unit_id,b.quantity)) quantity
   from public.customer_order_item_toppings t join public.customer_order_items i on i.id=t.order_item_id
   cross join lateral private.bom(t.topping_version_id,t.quantity,current_order.delivery_date) b
   join public.materials bm on bm.id=b.material_id and not bm.archived
   where i.order_id=p_order and i.cancelled_at is null and t.topping_version_id is not null and t.quantity>0 and t.consumed_at is null
   group by b.material_id,bm.usage_unit_id) x where x.quantity>0;
  if jsonb_array_length(topping_lines)>0 then
   topping_movement=private.insert_movement(topping_warehouse,current_order.delivery_date,'issue',topping_lines,'Xuất nguyên liệu topping theo đơn hàng '||p_order::text,null);
   update public.customer_order_item_toppings set inventory_movement_id=topping_movement,delivery_id=(select d.id from public.deliveries d where d.order_id=p_order and d.status='posted' order by d.created_at desc limit 1),consumed_at=now()
    where order_item_id in(select id from public.customer_order_items where order_id=p_order and cancelled_at is null) and topping_version_id is not null and quantity>0 and consumed_at is null;
  end if;
 end if;$new$||substring(definition from strpos(definition,old_fragment)+length(old_fragment));
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_TOPPING_DELIVERY_ISSUE_PATCH_MISMATCH';end if;
 execute definition;
end
$patch$;

revoke all on function private.plan_order_topping_material_needs(uuid,date) from public,anon,authenticated;
commit;
