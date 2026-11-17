begin;
create function public.production_options(p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('production','view') then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('warehouses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.warehouses where active and kind='ingredient'),
 'products',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'recipe_version_id',l.recipe_version_id)),'[]') from public.products p join lateral(select x.recipe_version_id from public.product_recipe_links x join public.recipe_versions v on v.id=x.recipe_version_id where x.product_id=p.id and x.effective_from<=p_date and v.effective_from<=p_date and v.status='published' order by x.effective_from desc limit 1) l on true where not p.archived));
end $$;
revoke all on function public.production_options(date) from public;grant execute on function public.production_options(date) to authenticated;
commit;
