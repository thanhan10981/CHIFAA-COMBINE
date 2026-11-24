-- Read-only diagnosis for the recipe -> order topping connection.
-- Run with an authorized database administrator session. No customer data,
-- ingredient quantities, prices or costs are returned.
select
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipe_topping_options' and column_name='topping_version_id') as migration_081_column_present,
 to_regprocedure('private.publish_recipe_tree(uuid,uuid[],boolean)') is not null as migration_082_publisher_present;

select p.code product_code,linked.recipe_version_id linked_version,
 configured.id latest_effective_version,configured.status latest_effective_status,
 configured.effective_from,configured.revision,
 coalesce(options.selected_count,0) selected_toppings,
 coalesce(options.toppings,'[]'::jsonb) toppings
from public.products p
left join lateral(
 select l.recipe_version_id,v.recipe_id
 from public.product_recipe_links l join public.recipe_versions v on v.id=l.recipe_version_id
 where l.product_id=p.id and l.effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date and v.status='published' and v.effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date
 order by l.effective_from desc,v.revision desc limit 1
) linked on true
left join lateral(
 select v.* from public.recipes r join public.recipe_versions v on v.recipe_id=r.id
 where r.kind='product' and not r.archived
  and ((linked.recipe_id is not null and r.id=linked.recipe_id) or (linked.recipe_id is null and r.code=p.code))
  and v.status in('draft','published') and v.effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date
 order by v.effective_from desc,v.revision desc limit 1
) configured on true
left join lateral(
 select count(*) selected_count,jsonb_agg(jsonb_build_object(
  'code',r.code,'name',r.name,'archived',r.archived,
  'selected_version',to_jsonb(o)->>'topping_version_id',
  'selected_status',v.status,'selected_effective_from',v.effective_from
 ) order by o.sort_order,r.code) toppings
 from public.recipe_topping_options o join public.recipes r on r.id=o.topping_recipe_id
 left join public.recipe_versions v on v.id=nullif(to_jsonb(o)->>'topping_version_id','')::uuid
 where o.parent_version_id=configured.id
) options on true
where p.published and not p.archived
order by p.code;

select public.public_order_topping_catalog((now() at time zone 'Asia/Ho_Chi_Minh')::date) as public_topping_catalog;
