-- When a child recipe is revised, keep editable parent drafts linked to the
-- newly saved child version. Published recipes and production snapshots remain
-- pinned to the exact version they were created with.
begin;

create or replace function public.save_recipe_revision(
 p_id uuid,p_expected_version bigint,p_recipe jsonb,p_items jsonb,p_evidence text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;result jsonb;item jsonb;new_version uuid;
begin
 if not private.can('recipes',case when p_id is null then 'create' else 'edit' end) or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_recipe) is distinct from 'object' or coalesce(p_recipe->>'effective_from','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_id is null and length(trim(coalesce(p_recipe->>'code',''))) not between 1 and 100) or not exists(select 1 from public.material_units where id=(p_recipe->>'output_unit_id')::uuid and not archived) then raise exception 'INVALID_RECIPE';end if;
 if length(trim(coalesce(p_evidence,'')))>2000 or length(trim(coalesce(p_recipe->>'name',''))) not between 1 and 300 or p_recipe->>'kind' not in ('product','rice','sauce','packaging') or coalesce(p_recipe->>'output_quantity','')!~'^[0-9]{1,12}(\.[0-9]{1,6})?$' or (p_recipe->>'output_quantity')::numeric<=0 then raise exception 'INVALID_RECIPE';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'INVALID_RECIPE_ITEMS';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if coalesce(item->>'quantity','')!~'^[0-9]{1,12}(\.[0-9]{1,6})?$' or (item->>'quantity')::numeric<=0 then raise exception 'INVALID_QUANTITY';end if;
  if item->>'material_id' is not null and not exists(select 1 from public.materials where id=(item->>'material_id')::uuid and not archived) then raise exception 'MATERIAL_NOT_FOUND';end if;
  if item->>'child_version_id' is not null and not exists(select 1 from public.recipe_versions v join public.recipes r on r.id=v.recipe_id where v.id=(item->>'child_version_id')::uuid and not r.archived) then raise exception 'RECIPE_NOT_FOUND';end if;
 end loop;
 cached=private.begin_request(p_key,'recipe:full-revision',jsonb_build_object('id',p_id,'expected',p_expected_version,'recipe',p_recipe,'items',p_items,'evidence',nullif(trim(coalesce(p_evidence,'')),'')));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);
 if p_id is null then result=public.save_recipe(p_recipe,p_items,gen_random_uuid());
 else
  result=public.revise_recipe(p_id,p_expected_version,(p_recipe->>'effective_from')::date,(p_recipe->>'output_quantity')::numeric,(p_recipe->>'output_unit_id')::uuid,p_items,gen_random_uuid());
  update public.recipes set name=trim(p_recipe->>'name'),kind=p_recipe->>'kind' where id=p_id;
  new_version=(result->>'version_id')::uuid;
  with changed as (
   update public.recipe_items i set child_version_id=new_version
   where i.child_version_id in(select old.id from public.recipe_versions old where old.recipe_id=p_id and old.id<>new_version)
    and i.recipe_version_id in(select parent.id from public.recipe_versions parent where parent.status='draft')
    and i.unit_id=(select v.output_unit_id from public.recipe_versions v where v.id=new_version)
   returning i.recipe_version_id
  )
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data)
   select 'recipe:link-refresh',recipe_version_id,p_key::text||':'||recipe_version_id::text,
    jsonb_build_object('audit_source','recipe_child_revision','child_recipe_id',p_id,'child_version_id',new_version)
   from changed group by recipe_version_id;
 end if;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('recipe:source',(result->>'version_id')::uuid,p_key::text,jsonb_build_object('evidence',nullif(trim(coalesce(p_evidence,'')),''),'audit_source','recipe_editor','recipe',p_recipe,'items',p_items,'previous_recipe_id',p_id));
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid) from public;
grant execute on function public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid) to authenticated;

commit;
