begin;
create function public.revise_recipe(p_recipe uuid,p_expected_version bigint,p_effective date,p_output numeric,p_unit uuid,p_items jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_recipe public.recipes; revision integer; version_id uuid; item jsonb;
begin
 if not private.can('recipes','edit') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'recipe:revise',jsonb_build_object('recipe',p_recipe,'expected',p_expected_version,'effective',p_effective,'output',p_output,'unit',p_unit,'items',p_items));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);
 select * into strict current_recipe from public.recipes where id=p_recipe for update;
 if current_recipe.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'INVALID_RECIPE_ITEMS';end if;
 select coalesce(max(v.revision),0)+1 into revision from public.recipe_versions v where v.recipe_id=p_recipe;
 insert into public.recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values(p_recipe,revision,p_effective,p_output,p_unit) returning id into version_id;
 for item in select value from jsonb_array_elements(p_items) loop
  insert into public.recipe_items(recipe_version_id,material_id,child_version_id,quantity,unit_id) values(version_id,(item->>'material_id')::uuid,(item->>'child_version_id')::uuid,(item->>'quantity')::numeric,(item->>'unit_id')::uuid);
 end loop;
 update public.recipes set name=name where id=p_recipe;
 return private.finish_request(p_key,jsonb_build_object('recipe_id',p_recipe,'version_id',version_id,'revision',revision));
end $$;
revoke all on function public.revise_recipe(uuid,bigint,date,numeric,uuid,jsonb,uuid) from public;
grant execute on function public.revise_recipe(uuid,bigint,date,numeric,uuid,jsonb,uuid) to authenticated;
commit;
