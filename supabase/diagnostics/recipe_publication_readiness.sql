-- Read-only: run in an authorized SQL Editor session, before/after release.
-- No publication, business writes, prices, ingredient quantities or contacts.
select
 to_regprocedure('private.order_demand_formula_units(jsonb,date)') is not null as migration_088_present,
 to_regprocedure('private.recipe_formula_line(uuid,uuid,numeric,date)') is not null as migration_089_present,
 to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)') is not null as migration_090_present;

-- A conversion starting today cannot validate an older draft's original date.
select m.code material_code,stock.code current_stock_unit,
 r.effective_from verification_effective_from,dated_stock.code verified_stock_unit,
 r.formula_verified,formula.code formula_unit
from public.materials m
join public.material_units stock on stock.id=m.usage_unit_id
left join lateral(
 select v.* from public.material_resolutions v where v.material_id=m.id
  and v.effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date
 order by v.effective_from desc,v.revision desc limit 1
) r on true
left join public.material_units dated_stock on dated_stock.id=r.usage_unit_id
left join public.material_units formula on formula.id=r.formula_unit_id
where not m.archived
order by m.code;

-- Show direct draft dependencies, including toppings, retaining exact pins.
with edges as(
 select recipe_version_id parent_id,child_version_id child_id,'component' relation
 from public.recipe_items where child_version_id is not null
 union all
 select parent_version_id,topping_version_id,'topping' from public.recipe_topping_options
)
select parent.code parent_code,pv.revision parent_revision,pv.effective_from parent_date,
 e.relation,child.code child_code,cv.status child_status,cv.effective_from child_date
from edges e
join public.recipe_versions pv on pv.id=e.parent_id and pv.status='draft'
join public.recipes parent on parent.id=pv.recipe_id and not parent.archived
join public.recipe_versions cv on cv.id=e.child_id
join public.recipes child on child.id=cv.recipe_id
order by parent.code,pv.revision,e.relation,child.code;
