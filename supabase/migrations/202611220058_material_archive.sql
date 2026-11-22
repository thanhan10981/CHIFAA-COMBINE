begin;

-- Removing a material from the live catalog is an archive, never a physical
-- delete. Keep its recipe, price, stock and audit references intact.
create function private.guard_material_archive_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare today date=(now() at time zone 'Asia/Ho_Chi_Minh')::date; quantity numeric; has_stock_records boolean;
begin
 if new.archived and not old.archived then
  if new.usage_unit_id is not null then
   quantity=private.inventory_quantity(null,today,new.id,new.usage_unit_id);
  end if;
  has_stock_records=exists(
   select 1 from public.inventory_movement_lines l
   join public.inventory_movements v on v.id=l.movement_id
   join public.warehouses w on w.id=v.warehouse_id
   where l.material_id=new.id and w.kind='ingredient' and v.moved_on<=today
  ) or exists(
   select 1 from public.stock_count_lines l
   join public.stock_counts c on c.id=l.count_id
   join public.warehouses w on w.id=c.warehouse_id
   where l.material_id=new.id and w.kind='ingredient' and c.status='posted' and c.counted_on<=today
  );
  if quantity is null and has_stock_records then raise exception 'MATERIAL_STOCK_UNRESOLVED';end if;
  if quantity is not null and quantity<>0 then raise exception 'MATERIAL_HAS_STOCK';end if;
  if exists(
   select 1 from public.inventory_movement_lines l
   join public.inventory_movements v on v.id=l.movement_id
   join public.warehouses w on w.id=v.warehouse_id
   where l.material_id=new.id and w.kind='ingredient' and v.moved_on>today
  ) or exists(
   select 1 from public.stock_count_lines l
   join public.stock_counts c on c.id=l.count_id
   join public.warehouses w on w.id=c.warehouse_id
   where l.material_id=new.id and w.kind='ingredient' and c.status='posted' and c.counted_on>today
  ) then raise exception 'MATERIAL_FUTURE_STOCK_MOVEMENTS';end if;
 end if;
 return new;
end $$;
create trigger materials_archive_stock_guard before update of archived on public.materials
 for each row execute function private.guard_material_archive_stock();

-- Serialize new stock lines against an archive update. If an archive wins the
-- row lock, a later posting sees the archived state and must stop.
create function private.guard_active_material_stock_line() returns trigger
language plpgsql security definer set search_path='' as $$
declare is_archived boolean;
begin
 select archived into is_archived from public.materials where id=new.material_id for update;
 if not found or is_archived then raise exception 'MATERIAL_ARCHIVED';end if;
 return new;
end $$;
create trigger inventory_movement_material_active before insert on public.inventory_movement_lines
 for each row execute function private.guard_active_material_stock_line();
create trigger stock_count_material_active before insert on public.stock_count_lines
 for each row execute function private.guard_active_material_stock_line();

create function public.set_material_archived(p_id uuid,p_expected_version bigint,p_archived boolean,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_material public.materials; result jsonb;
begin
 if not private.can('materials','edit') then raise exception 'FORBIDDEN';end if;
 if p_id is null or p_expected_version is null or p_archived is null or p_key is null then raise exception 'INVALID_REQUEST';end if;
 cached=private.begin_request(p_key,'material:archive',jsonb_build_object('id',p_id,'version',p_expected_version,'archived',p_archived));
 if cached is not null then return cached;end if;
 select * into strict current_material from public.materials where id=p_id for update;
 if current_material.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if current_material.archived=p_archived then raise exception using message=case when p_archived then 'MATERIAL_ALREADY_ARCHIVED' else 'MATERIAL_NOT_ARCHIVED' end;end if;
 update public.materials set archived=p_archived where id=p_id returning to_jsonb(materials.*) into result;
 return private.finish_request(p_key,result);
end $$;

revoke all on function private.guard_material_archive_stock(),private.guard_active_material_stock_line() from public,anon,authenticated;
revoke all on function public.set_material_archived(uuid,bigint,boolean,uuid) from public,anon;
grant execute on function public.set_material_archived(uuid,bigint,boolean,uuid) to authenticated;

commit;
