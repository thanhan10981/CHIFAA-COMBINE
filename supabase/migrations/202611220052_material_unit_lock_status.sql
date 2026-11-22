begin;

-- Expose only the material's current usage unit and whether the existing
-- server-side unit-change guard applies. The UI uses this to keep users from
-- attempting an unsafe base-unit change while still allowing package ratios.
create or replace function public.material_cost_basis(p_material uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p record; m public.materials; usage_cost numeric; purchase_cost numeric; factor numeric;
begin
 if not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null then raise exception 'INVALID_DATE';end if;
 select * into strict m from public.materials where id=p_material;select * into p from private.effective_material_price(p_material,p_date);
 if p.verification='verified' and p.amount is not null then
  begin factor=private.convert_quantity_at(p_material,p.basis_unit_id,m.usage_unit_id,1,p_date);usage_cost=round(p.amount/factor,6);
  exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;end;
  begin factor=private.convert_quantity_at(p_material,p.basis_unit_id,m.purchase_unit_id,1,p_date);purchase_cost=round(p.amount/factor,6);
  exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;end;
 end if;
 return jsonb_build_object(
  'amount',p.amount::text,
  'basis_unit',(select code from public.material_units where id=p.basis_unit_id),
  'usage_unit',(select code from public.material_units where id=m.usage_unit_id),
  'usage_unit_id',m.usage_unit_id::text,
  'usage_unit_locked',exists(select 1 from public.inventory_movement_lines where material_id=p_material) or exists(select 1 from public.recipe_items where material_id=p_material),
  'purchase_unit',(select code from public.material_units where id=m.purchase_unit_id),
  'usage_cost_vnd',usage_cost::text,
  'purchase_cost_vnd',purchase_cost::text,
  'official_ready',usage_cost is not null,
  'verification',p.verification,
  'issue',p.issue
 );
end $$;

revoke all on function public.material_cost_basis(uuid,date) from public,anon;
grant execute on function public.material_cost_basis(uuid,date) to authenticated;

commit;
