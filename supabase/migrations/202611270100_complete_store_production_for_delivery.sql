begin;
set local lock_timeout='5s';

create or replace function public.complete_store_production_for_delivery(
 p_warehouse uuid,p_date date,p_delivery date,p_lines jsonb,p_store uuid,p_orders uuid[],p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; produced jsonb; readiness jsonb;
begin
 if not private.can('orders','view') or not private.can('production','view') or not private.can('production','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 if p_key is null then raise exception 'INVALID_STORE_PRODUCTION_SOURCE';end if;
 cached=private.begin_request(p_key,'production:store-complete-for-delivery',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'delivery',p_delivery,'store',p_store,'orders',p_orders,'lines',p_lines));
 if cached is not null then return cached;end if;
 -- This workflow records the user's completion confirmation time; no work duration is inferred.
 produced=public.post_store_production_run(p_warehouse,p_date,transaction_timestamp(),transaction_timestamp(),p_delivery,p_lines,
  'Xác nhận đã hoàn tất sản xuất theo đơn đã duyệt',p_store,p_orders,gen_random_uuid());
 readiness=public.confirm_store_production_ready(p_delivery,p_store,'Đã sản xuất và chuẩn bị đủ theo đơn đã duyệt',gen_random_uuid());
 return private.finish_request(p_key,jsonb_build_object('status','ready','production',produced,'readiness',readiness));
end $$;
revoke all on function public.complete_store_production_for_delivery(uuid,date,date,jsonb,uuid,uuid[],uuid) from public,anon;
grant execute on function public.complete_store_production_for_delivery(uuid,date,date,jsonb,uuid,uuid[],uuid) to authenticated;

notify pgrst,'reload schema';
commit;
