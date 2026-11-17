begin;
create function public.publish_recipe(p_version uuid,p_expected_version bigint,p_product uuid,p_output_per_product numeric,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_row public.recipe_versions; item record;
begin
 if not private.can('recipes','approve') then raise exception 'FORBIDDEN'; end if;
 cached=private.begin_request(p_key,'recipe:publish',jsonb_build_object('version',p_version,'expected',p_expected_version,'product',p_product,'output',p_output_per_product));if cached is not null then return cached; end if;
 perform pg_advisory_xact_lock(170011);
 select * into strict current_row from public.recipe_versions where id=p_version for update;
 if current_row.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if current_row.status<>'draft' then raise exception 'RECIPE_VERSION_IMMUTABLE';end if;
 if not exists(select 1 from public.recipe_items where recipe_version_id=p_version) then raise exception 'EMPTY_RECIPE';end if;
 for item in select * from public.recipe_items where recipe_version_id=p_version loop
  if item.child_version_id is not null and not exists(select 1 from public.recipe_versions where id=item.child_version_id and status='published') then raise exception 'PUBLISH_CHILD_FIRST';end if;
 end loop;
 -- Unit ambiguities block publication; missing prices remain explicit NULL COGS.
 perform * from private.bom(p_version,1,current_row.effective_from);
 update public.recipe_versions set status='published' where id=p_version;
 if p_product is not null then
  insert into public.product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values(p_product,p_version,p_output_per_product,current_row.effective_from);
 end if;
 return private.finish_request(p_key,jsonb_build_object('version_id',p_version,'status','published'));
end $$;
revoke all on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) from public;
grant execute on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) to authenticated;
commit;
