begin;
set local lock_timeout='5s';

-- Order review is a customer-order decision. Missing recipe/conversion data
-- leaves the approved order unscheduled so it can be corrected in planning;
-- it must not roll back approval or its audit/notification records.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('public.review_order(uuid,bigint,boolean,text,uuid)'::regprocedure) into definition;
 old_fragment='automatic_plan=private.auto_schedule_approved_order(p_order);';
 new_fragment=$new$begin
  automatic_plan=private.auto_schedule_approved_order(p_order);
 exception when sqlstate 'P0001' then
  if sqlerrm not in('ORDER_PRODUCTION_RECIPE_OR_RATIO_REQUIRED','ORDER_TOPPING_RECIPE_REQUIRED') then raise;end if;
  automatic_plan=null;
 end;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_REVIEW_OPTIONAL_PLAN_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment='case when p_approve then ''scheduled'' else new_status end';
 new_fragment='case when p_approve and automatic_plan is not null then ''scheduled'' else new_status end';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_REVIEW_OPTIONAL_PLAN_STATUS_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Product counts in an order are whole pieces. Keep the server guard even
-- though the review form also uses a 1-step integer input.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid)'::regprocedure) into definition;
 old_fragment='p_quantity<=0 or p_quantity>999999999999';
 new_fragment='p_quantity<=0 or p_quantity<>trunc(p_quantity) or p_quantity>999999999999';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_ITEM_INTEGER_QUANTITY_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

commit;
