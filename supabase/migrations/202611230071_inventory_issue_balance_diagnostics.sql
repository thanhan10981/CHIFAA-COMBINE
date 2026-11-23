begin;
set local lock_timeout='5s';

-- A backdated movement can expose a negative balance at or after its date,
-- but an already-negative balance strictly before that date is not changed by
-- this posting. Receipts must also remain possible to repair a shortage.
-- Keep the historical conversion/price logic in insert_movement and patch only
-- the chronological balance guard.
do $patch$
declare definition text;old_declaration text;new_declaration text;old_check text;new_check text;
begin
 select pg_get_functiondef('private.insert_movement(uuid,date,text,jsonb,text,uuid)'::regprocedure) into definition;
 old_declaration='declare movement_id uuid; line jsonb; standard uuid; delta numeric; closing numeric;';
 new_declaration='declare movement_id uuid; line jsonb; standard uuid; delta numeric; closing numeric; deficient_date date; balance_on_date numeric; material_code text; material_name text; unit_code text;';
 old_check=$old$select min(q) into closing from (
   select sum(sum(l.quantity)) over(order by v.moved_on) q from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id
   where v.warehouse_id=p_warehouse and l.material_id=(line->>'material_id')::uuid group by v.moved_on
  ) balances;
  if closing<0 then raise exception 'INSUFFICIENT_STOCK'; end if;$old$;
 new_check=$new$select q,moved_on into closing,deficient_date from (
   select sum(sum(l.quantity)) over(order by v.moved_on) q,v.moved_on from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id
   where v.warehouse_id=p_warehouse and l.material_id=(line->>'material_id')::uuid group by v.moved_on
  ) balances where moved_on>=p_date and q<0 order by moved_on limit 1;
  if delta<0 and deficient_date is not null then
   select m.code,m.name,u.code into material_code,material_name,unit_code
    from public.materials m join public.material_units u on u.id=standard where m.id=(line->>'material_id')::uuid;
   select coalesce(sum(l.quantity),0) into balance_on_date from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id
    where v.warehouse_id=p_warehouse and l.material_id=(line->>'material_id')::uuid and v.moved_on<=p_date;
   raise exception using message='INSUFFICIENT_STOCK',detail=jsonb_build_object(
    'material_code',material_code,'material_name',material_name,'unit_code',unit_code,
    'transaction_date',p_date,'requested_quantity',abs(delta)::text,
    'available_quantity',(balance_on_date-delta)::text,
    'shortage_quantity',abs(closing)::text,'negative_balance_date',deficient_date,
    'projected_balance',closing::text)::text;
  end if;$new$;
 if strpos(definition,old_declaration)=0 then raise exception 'INVENTORY_BALANCE_DIAGNOSTIC_DECLARATION_PATCH_MISMATCH';end if;
 if strpos(definition,old_check)=0 then raise exception 'INVENTORY_BALANCE_DIAGNOSTIC_CHECK_PATCH_MISMATCH';end if;
 definition=replace(definition,old_declaration,new_declaration);
 definition=replace(definition,old_check,new_check);
 execute definition;
end
$patch$;

revoke all on function private.insert_movement(uuid,date,text,jsonb,text,uuid) from public,anon,authenticated;
commit;
