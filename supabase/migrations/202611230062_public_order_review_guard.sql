begin;
set local lock_timeout = '5s';

-- The order-kiosk repair package reapplies legacy migration 022 after the
-- public-order migration 035. Restore 035's review guards so a public guest
-- order does not try to create a notification for a NULL customer_id.
do $patch$
declare
 definition text;
 old_fragment text;
 new_fragment text;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED'; end if;
 if to_regprocedure('public.review_order(uuid,bigint,boolean,text,uuid)') is null then raise exception 'REVIEW_ORDER_REQUIRED'; end if;

 select pg_get_functiondef('public.review_order(uuid,bigint,boolean,text,uuid)'::regprocedure) into definition;

 if strpos(definition,'raise exception ''STORE_REQUIRED''')=0 then
  old_fragment='new_status=case when p_approve';
  new_fragment='if p_approve and current_order.store_id is null then raise exception ''STORE_REQUIRED'';end if; new_status=case when p_approve';
  if strpos(definition,old_fragment)=0 then raise exception 'PUBLIC_ORDER_REVIEW_STORE_GUARD_PATCH_MISMATCH'; end if;
  definition=replace(definition,old_fragment,new_fragment);
 end if;

 if strpos(definition,'if current_order.customer_id is not null then insert into public.notifications')=0 then
  old_fragment='insert into public.notifications(user_id,order_id,title) values';
  new_fragment='if current_order.customer_id is not null then insert into public.notifications(user_id,order_id,title) values';
  if strpos(definition,old_fragment)=0 then raise exception 'PUBLIC_ORDER_REVIEW_NOTIFICATION_PATCH_MISMATCH'; end if;
  definition=replace(definition,old_fragment,new_fragment);

  if strpos(definition,'end);end if;')=0 then
   old_fragment='end);';
   new_fragment='end);end if;';
   if strpos(definition,old_fragment)=0 then raise exception 'PUBLIC_ORDER_REVIEW_NOTIFICATION_CLOSE_PATCH_MISMATCH'; end if;
   if length(definition)-length(replace(definition,old_fragment,''))<>length(old_fragment) then raise exception 'PUBLIC_ORDER_REVIEW_NOTIFICATION_CLOSE_PATCH_AMBIGUOUS'; end if;
   definition=replace(definition,old_fragment,new_fragment);
  end if;
 end if;

 if strpos(definition,'raise exception ''STORE_REQUIRED''')=0
  or strpos(definition,'if current_order.customer_id is not null then insert into public.notifications')=0
  or strpos(definition,'end);end if;')=0 then
  raise exception 'PUBLIC_ORDER_REVIEW_GUARD_VALIDATION_FAILED';
 end if;

 execute definition;
end
$patch$;

commit;
