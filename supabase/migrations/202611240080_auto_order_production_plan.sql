begin;
set local lock_timeout='5s';

-- Approval automatically reserves the ordered quantity in the delivery-date
-- production plan. This is planning only: production and inventory posting
-- remain separate confirmed actions.
create function private.auto_schedule_approved_order(p_order uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.customer_orders; plan public.production_plans; warehouse_id uuid; warehouse_count integer; order_lines jsonb; needs jsonb; topping record; v_plan_id uuid;
begin
 if not private.can('orders','approve') or not private.can('production','edit') or not private.can('production','approve') then raise exception 'FORBIDDEN';end if;
 select * into strict o from public.customer_orders where id=p_order for update;
 if o.status<>'approved' or o.plan_id is not null then raise exception 'ORDER_NOT_READY_FOR_AUTO_PLAN';end if;
 if not exists(select 1 from public.customer_order_items where order_id=p_order and cancelled_at is null) then raise exception 'ORDER_ITEMS_REQUIRED';end if;

 select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity::text) order by product_id),'[]'::jsonb)
 into order_lines from(select product_id,sum(quantity) quantity from public.customer_order_items where order_id=p_order and cancelled_at is null group by product_id)x;
 needs=private.planning_needs(o.delivery_date,order_lines);
 if exists(select 1 from jsonb_array_elements(needs) n where n ? 'issue') then raise exception 'ORDER_PRODUCTION_RECIPE_OR_RATIO_REQUIRED';end if;

 -- Toppings use their own recipes and are included in this plan's material
 -- requirement. Reject incomplete/empty recipes before approving the order.
 for topping in
  select t.topping_version_id,t.quantity from public.customer_order_item_toppings t
  join public.customer_order_items i on i.id=t.order_item_id
  where i.order_id=p_order and i.cancelled_at is null and t.topping_version_id is not null and t.quantity>0
 loop
  if not exists(select 1 from private.bom(topping.topping_version_id,topping.quantity,o.delivery_date)) then raise exception 'ORDER_TOPPING_RECIPE_REQUIRED';end if;
 end loop;

 perform pg_advisory_xact_lock(hashtextextended('order-production-plan:'||o.delivery_date::text||':'||o.shift,0));
 select * into plan from public.production_plans where delivery_date=o.delivery_date and shift=o.shift for update;
 if plan.id is not null then
  if plan.status in('cancelled','completed') or exists(select 1 from public.production_batches b where b.plan_id=plan.id and b.status='posted') then raise exception 'ORDER_PLAN_CLOSED';end if;
  v_plan_id=plan.id;
  if plan.ingredient_warehouse_id is not null then
   select id into warehouse_id from public.warehouses where id=plan.ingredient_warehouse_id and active and kind='ingredient';
   if warehouse_id is null then raise exception 'ORDER_PLAN_INGREDIENT_WAREHOUSE_INACTIVE';end if;
  end if;
 else
  v_plan_id=gen_random_uuid();
 end if;

 if warehouse_id is null then
  select count(*),(array_agg(id order by id))[1] into warehouse_count,warehouse_id from public.warehouses where active and kind='ingredient';
  if warehouse_count=0 then raise exception 'ACTIVE_INGREDIENT_WAREHOUSE_REQUIRED';end if;
  if warehouse_count>1 then raise exception 'MULTIPLE_ACTIVE_INGREDIENT_WAREHOUSES';end if;
 end if;

 if plan.id is null then
  -- No production date is configured separately for portal orders; reserve
  -- production for the requested delivery date and shift.
  insert into public.production_plans(id,delivery_date,production_date,shift,status,ingredient_warehouse_id)
  values(v_plan_id,o.delivery_date,o.delivery_date,o.shift,'approved',warehouse_id);
 else
  update public.production_plans set status='approved',ingredient_warehouse_id=warehouse_id where id=v_plan_id;
 end if;

 -- The production workspace treats its manual plan as quantities beyond
 -- approved orders, so reserve each approved order additively exactly once.
 insert into public.production_plan_lines(plan_id,product_id,planned_quantity)
  select v_plan_id,product_id,sum(quantity) from public.customer_order_items where order_id=p_order and cancelled_at is null group by product_id
  on conflict(plan_id,product_id) do update set planned_quantity=public.production_plan_lines.planned_quantity+excluded.planned_quantity;
 update public.customer_orders set plan_id=v_plan_id,status='scheduled' where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status,note) values(p_order,'approved','scheduled','Tự động gắn kế hoạch sản xuất theo món đã đặt');
 return v_plan_id;
end $$;
revoke all on function private.auto_schedule_approved_order(uuid) from public,anon,authenticated;

-- Both staff orders and public-link orders pass through review_order. The
-- request stays atomic: if a plan, warehouse, or recipe is missing, approval
-- and its notification/history roll back together.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.review_order(uuid,bigint,boolean,text,uuid)'::regprocedure) into definition;
 old_fragment='declare cached jsonb; current_order public.customer_orders; new_status text;';
 new_fragment=old_fragment||' automatic_plan uuid;';
 if strpos(definition,old_fragment)=0 then raise exception 'AUTO_ORDER_PLAN_REVIEW_DECLARATION_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='where id=p_order;';
 new_fragment=old_fragment||' if p_approve then automatic_plan=private.auto_schedule_approved_order(p_order); end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'AUTO_ORDER_PLAN_REVIEW_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='jsonb_build_object(''order_id'',p_order,''status'',new_status)';
 new_fragment='jsonb_build_object(''order_id'',p_order,''status'',case when p_approve then ''scheduled'' else new_status end,''plan_id'',automatic_plan)';
 if strpos(definition,old_fragment)=0 then raise exception 'AUTO_ORDER_PLAN_REVIEW_RESULT_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

revoke all on function private.auto_schedule_approved_order(uuid) from public,anon,authenticated;
commit;
