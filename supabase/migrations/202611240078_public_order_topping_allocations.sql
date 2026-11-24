begin;
set local lock_timeout='5s';

-- A public order may allocate one optional topping recipe to each product unit.
-- The existing quantity column now means portions assigned to this topping,
-- not a copy of the whole product line quantity.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid)'::regprocedure) into definition;
 old_fragment=$old$if exists(select 1 from jsonb_array_elements(p_items) as item_row(value) where jsonb_typeof(item_row.value) is distinct from 'object' or jsonb_typeof(coalesce(item_row.value->'toppings','[]'::jsonb)) is distinct from 'array') then raise exception 'INVALID_ORDER_ITEMS';end if;$old$;
 new_fragment=$new$if exists(select 1 from jsonb_array_elements(p_items) as item_row(value) where jsonb_typeof(item_row.value) is distinct from 'object' or jsonb_typeof(coalesce(item_row.value->'toppings','[]'::jsonb)) is distinct from 'array') then raise exception 'INVALID_ORDER_ITEMS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) as i(value) cross join lateral jsonb_array_elements(coalesce(i.value->'toppings','[]'::jsonb)) as t(value) where jsonb_typeof(t.value) is distinct from 'object' or coalesce(t.value->>'version_id','')='' or coalesce(t.value->>'quantity','') !~ '^[1-9][0-9]{0,5}$') then raise exception 'INVALID_TOPPING_ALLOCATION';end if;
 if exists(select 1 from jsonb_array_elements(p_items) with ordinality as i(value,ordinality) cross join lateral jsonb_array_elements(coalesce(i.value->'toppings','[]'::jsonb)) as t(value) group by i.ordinality,i.value->>'product_id',i.value->>'quantity' having sum((t.value->>'quantity')::numeric)>(i.value->>'quantity')::numeric) then raise exception 'TOPPING_ALLOCATION_EXCEEDS_ORDER_QUANTITY';end if;
 if exists(select 1 from jsonb_array_elements(p_items) i cross join lateral jsonb_array_elements(coalesce(i.value->'toppings','[]'::jsonb)) as t(value) group by i.value->>'product_id',t.value->>'version_id' having count(*)>1) then raise exception 'DUPLICATE_TOPPING';end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'TOPPING_ALLOCATION_VALIDATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='values(order_item,option_version,topping_row.code,topping_row.name,topping_row.unit_code,(item->>''quantity'')::numeric,';
 new_fragment='values(order_item,option_version,topping_row.code,topping_row.name,topping_row.unit_code,(topping->>''quantity'')::numeric,';
 if strpos(definition,old_fragment)=0 then raise exception 'TOPPING_ALLOCATION_QUANTITY_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Keep the chosen counts when staff edits a submitted product quantity; do not
-- silently scale every topping to the new product count.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)'::regprocedure) into definition;
 old_fragment='update public.customer_order_item_toppings set quantity=p_quantity where order_item_id=line.id;';
 new_fragment='if exists(select 1 from public.customer_order_item_toppings where order_item_id=line.id group by order_item_id having sum(quantity)>p_quantity) then raise exception ''TOPPING_ALLOCATION_EXCEEDS_ORDER_QUANTITY'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'TOPPING_ALLOCATION_ORDER_EDIT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- The order review material preview includes the selected topping recipes for
-- approved, unplanned orders. These are requirements only; they do not post a
-- stock issue or production entry.
create function private.order_topping_material_needs(p_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
  'material_id',b.material_id,'unit_id',b.unit_id,'quantity',b.quantity::text,
  'product_id',i.product_id,'product_code',i.product_code,'product_name',i.product_name,
  'recipe_version_id',t.topping_version_id,'topping_code',t.topping_code,
  'topping_name',t.topping_name,'topping_quantity',t.quantity::text,'calculated_on',p_date
 ) order by i.product_code,t.topping_code,b.material_id),'[]'::jsonb) into result
 from public.customer_order_item_toppings t
 join public.customer_order_items i on i.id=t.order_item_id and i.cancelled_at is null
 join public.customer_orders o on o.id=i.order_id and o.delivery_date=p_date and o.status in('approved','scheduled') and o.plan_id is null
 cross join lateral private.bom(t.topping_version_id,t.quantity,p_date) b
 where t.topping_version_id is not null;
 return result;
end $$;
revoke all on function private.order_topping_material_needs(date) from public,anon,authenticated;

do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.order_material_demand(date)'::regprocedure) into definition;
 old_fragment='needs=private.planning_needs(p_date,lines);';
 new_fragment='needs=private.planning_needs(p_date,lines)||private.order_topping_material_needs(p_date);';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_TOPPING_DEMAND_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

commit;
