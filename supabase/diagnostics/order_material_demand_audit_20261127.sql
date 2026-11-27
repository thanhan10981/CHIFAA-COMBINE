-- Read-only audit of order demand for 2026-11-27.
-- Uses the same date-effective recipe resolution, BOM and formula-unit
-- conversion functions used by the order material summary.
-- Run in the Supabase SQL Editor. This file does not update business data.

with params as (
  select date '2026-11-27' as need_date
),
order_products as (
  select i.product_id, p.code as product_code, p.name as product_name,
         sum(i.quantity)::numeric as order_quantity
  from public.customer_order_items i
  join public.customer_orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join params d
  where i.cancelled_at is null
    and o.delivery_date = d.need_date
    and o.status in ('approved', 'scheduled', 'fulfilled')
  group by i.product_id, p.code, p.name
),
order_lines as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('product_id', product_id, 'quantity', order_quantity::text)
      order by product_code
    ),
    '[]'::jsonb
  ) as lines
  from order_products
),
needs as (
  select n.value as line
  from params d
  cross join order_lines o
  cross join lateral jsonb_array_elements(
    private.order_demand_formula_units(
      private.planning_needs(d.need_date, o.lines)
      || private.order_topping_material_needs(d.need_date),
      d.need_date
    )
  ) as n(value)
)
select
  n.line->>'product_code' as product_code,
  n.line->>'product_name' as product_name,
  op.order_quantity,
  n.line->>'recipe_version_id' as recipe_version_id,
  r.code as recipe_code,
  rv.revision as recipe_revision,
  n.line->>'output_factor' as output_quantity_per_product,
  m.code as material_code,
  m.name as material_name,
  u.code as demand_unit,
  sum((n.line->>'quantity')::numeric) as demand_quantity
from needs n
join public.materials m on m.id = (n.line->>'material_id')::uuid
join public.material_units u on u.id = (n.line->>'unit_id')::uuid
left join order_products op on op.product_id = (n.line->>'product_id')::uuid
left join public.recipe_versions rv on rv.id = (n.line->>'recipe_version_id')::uuid
left join public.recipes r on r.id = rv.recipe_id
group by
  n.line->>'product_code', n.line->>'product_name', op.order_quantity,
  n.line->>'recipe_version_id', r.code, rv.revision,
  n.line->>'output_factor', m.code, m.name, u.code
order by m.code, n.line->>'product_code';

-- Run this second query separately to list products whose recipe or unit
-- prevented a complete demand calculation.
with params as (
  select date '2026-11-27' as need_date
),
order_products as (
  select i.product_id, p.code as product_code, p.name as product_name,
         sum(i.quantity)::numeric as order_quantity
  from public.customer_order_items i
  join public.customer_orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join params d
  where i.cancelled_at is null
    and o.delivery_date = d.need_date
    and o.status in ('approved', 'scheduled', 'fulfilled')
  group by i.product_id, p.code, p.name
),
order_lines as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('product_id', product_id, 'quantity', order_quantity::text)
      order by product_code
    ),
    '[]'::jsonb
  ) as lines
  from order_products
),
needs as (
  select n.value as line
  from params d
  cross join order_lines o
  cross join lateral jsonb_array_elements(
    private.order_demand_formula_units(
      private.planning_needs(d.need_date, o.lines)
      || private.order_topping_material_needs(d.need_date),
      d.need_date
    )
  ) as n(value)
)
select
  line->>'product_code' as product_code,
  line->>'product_name' as product_name,
  line->>'recipe_version_id' as recipe_version_id,
  line->>'output_factor' as output_quantity_per_product,
  line->>'issue' as issue,
  line->>'issue_detail' as issue_detail
from needs
where line ? 'issue'
order by line->>'product_code', line->>'issue';

-- Run this third query separately to trace EVERY active recipe item for ALL
-- ordered products. Keep parent-to-child lines as well as material lines:
-- material-only output cannot distinguish a wrong sale factor from a wrong
-- parent recipe quantity/output. Raw line quantities keep their recipe units.
with recursive params as (
  select date '2026-11-27' as need_date
),
order_products as (
  select i.product_id, p.code as product_code, p.name as product_name, p.sale_unit,
         sum(i.quantity)::numeric as order_quantity
  from public.customer_order_items i
  join public.customer_orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join params d
  where i.cancelled_at is null
    and o.delivery_date = d.need_date
    and o.status in ('approved', 'scheduled', 'fulfilled')
  group by i.product_id, p.code, p.name, p.sale_unit
),
selected as (
  select op.*,
         coalesce(explicit_link.recipe_version_id, same_code.recipe_version_id) as root_version_id,
         case when explicit_link.recipe_version_id is not null
           then explicit_link.output_quantity_per_product
           else same_code.output_quantity_per_product
         end as root_output_factor,
         root_recipe.code as root_recipe_code,
         root_version.revision as root_revision,
         root_version.output_quantity as root_output_quantity,
         root_output_unit.code as root_output_unit,
         explicit_link.id as root_link_id,
         explicit_link.effective_from as root_link_effective_from,
         case
           when explicit_link.recipe_version_id is not null then 'product_recipe_links'
           when same_code.saved_product_quantity ~ '^[0-9]+(\.[0-9]{1,6})?$'
            and same_code.saved_product_quantity::numeric > 0 then 'recipe:source.productQuantity'
           when same_code.recipe_version_id is not null
            and same_code.output_quantity_per_product is not null then 'matching_output_and_sale_units'
           else 'unresolved'
         end as root_factor_source
  from order_products op
  cross join params d
  left join lateral (
    select link.id, link.effective_from, link.recipe_version_id,
           link.output_quantity_per_product
    from public.product_recipe_links link
    join public.recipe_versions linked_version
      on linked_version.id = link.recipe_version_id
     and linked_version.status = 'published'
     and linked_version.effective_from <= d.need_date
    where link.product_id = op.product_id
      and link.effective_from <= d.need_date
    order by link.effective_from desc, linked_version.revision desc
    limit 1
  ) explicit_link on true
  left join lateral (
    select version.id as recipe_version_id,
           source_ratio.value as saved_product_quantity,
           case
             when source_ratio.value ~ '^[0-9]+(\.[0-9]{1,6})?$'
              and source_ratio.value::numeric > 0 then source_ratio.value::numeric
             when lower(btrim(output_unit.code)) = lower(btrim(op.sale_unit)) then 1::numeric
           end as output_quantity_per_product
    from public.recipes recipe
    join public.recipe_versions version
      on version.recipe_id = recipe.id
     and version.status = 'published'
     and version.effective_from <= d.need_date
    join public.material_units output_unit on output_unit.id = version.output_unit_id
    left join lateral (
      select source_data->>'productQuantity' as value
      from private.catalog_sources
      where entity = 'recipe:source' and entity_id = version.id
      order by recorded_at desc
      limit 1
    ) source_ratio on true
    where explicit_link.recipe_version_id is null
      and recipe.code = op.product_code
      and recipe.kind = 'product'
      and not recipe.archived
    order by version.effective_from desc, version.revision desc
    limit 1
  ) same_code on true
  left join public.recipe_versions root_version
    on root_version.id = coalesce(explicit_link.recipe_version_id, same_code.recipe_version_id)
  left join public.recipes root_recipe on root_recipe.id = root_version.recipe_id
  left join public.material_units root_output_unit on root_output_unit.id = root_version.output_unit_id
),
recipe_tree as (
  select s.product_id, s.product_code, s.product_name, s.sale_unit, s.order_quantity,
         s.root_version_id, s.root_recipe_code, s.root_revision,
         s.root_output_quantity, s.root_output_unit, s.root_output_factor,
         s.root_link_id, s.root_link_effective_from, s.root_factor_source,
         v.id as recipe_version_id, r.code as recipe_code,
         v.revision, v.output_quantity, v.output_unit_id,
         s.root_output_factor as recipe_factor_per_product,
         0 as depth, array[v.id]::uuid[] as version_path
  from selected s
  join public.recipe_versions v on v.id = s.root_version_id
  join public.recipes r on r.id = v.recipe_id

  union all

  select t.product_id, t.product_code, t.product_name, t.sale_unit, t.order_quantity,
         t.root_version_id, t.root_recipe_code, t.root_revision,
         t.root_output_quantity, t.root_output_unit, t.root_output_factor,
         t.root_link_id, t.root_link_effective_from, t.root_factor_source,
         child.id, child_recipe.code,
         child.revision, child.output_quantity, child.output_unit_id,
         t.recipe_factor_per_product * item.quantity / t.output_quantity,
         t.depth + 1, t.version_path || child.id
  from recipe_tree t
  join public.recipe_items item on item.recipe_version_id = t.recipe_version_id
  join public.recipe_versions child on child.id = item.child_version_id
  join public.recipes child_recipe on child_recipe.id = child.recipe_id
  where item.child_version_id is not null
    and not child.id = any(t.version_path)
),
formula_lines as (
  select t.product_code, t.product_name, t.sale_unit, t.order_quantity,
         t.root_recipe_code, t.root_revision, t.root_version_id,
         t.root_output_quantity, t.root_output_unit, t.root_output_factor,
         t.root_link_id, t.root_link_effective_from, t.root_factor_source,
         t.depth, t.version_path, t.recipe_code, t.revision,
         t.recipe_version_id, t.output_quantity as recipe_output_quantity,
         output_unit.code as recipe_output_unit,
         t.recipe_factor_per_product,
         case when item.child_version_id is not null then 'child_recipe'
              else 'material' end as component_type,
         coalesce(child_recipe.code, material.code) as component_code,
         coalesce(child_recipe.name, material.name) as component_name,
         child.id as child_version_id, child.revision as child_revision,
         child.output_quantity as child_output_quantity,
         child_output_unit.code as child_output_unit,
         material.code as material_code, material.name as material_name,
         item.quantity as line_quantity, line_unit.code as line_unit,
         t.recipe_factor_per_product * item.quantity / t.output_quantity
           as component_quantity_per_product_in_line_unit,
         t.order_quantity * t.recipe_factor_per_product * item.quantity / t.output_quantity
           as component_quantity_for_orders_in_line_unit
  from recipe_tree t
  join public.recipe_items item on item.recipe_version_id = t.recipe_version_id
  left join public.materials material on material.id = item.material_id
  left join public.recipe_versions child on child.id = item.child_version_id
  left join public.recipes child_recipe on child_recipe.id = child.recipe_id
  left join public.material_units child_output_unit on child_output_unit.id = child.output_unit_id
  join public.material_units line_unit on line_unit.id = item.unit_id
  join public.material_units output_unit on output_unit.id = t.output_unit_id
)
select *
from formula_lines
order by product_code, depth, version_path, recipe_code, component_type, component_code;
