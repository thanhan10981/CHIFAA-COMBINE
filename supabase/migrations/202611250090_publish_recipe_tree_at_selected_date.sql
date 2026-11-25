begin;
set local lock_timeout='5s';

-- Corrections may be published more than once on a business date. Every
-- revision keeps its identity and published contents; dated lookups already
-- order by effective_from,revision. Posted batches keep their version IDs.
drop index public.recipe_published_date;

-- Repoint the active same-day sale conversion with the normal row audit.
-- The previous recipe version and posted production snapshots stay intact.
do $patch$
declare d text;old_fragment text;
begin
 select pg_get_functiondef('private.publish_recipe(uuid,bigint,uuid,numeric,uuid)'::regprocedure) into d;
 old_fragment='values(p_product,p_version,p_output_per_product,current_row.effective_from);';
 if strpos(d,old_fragment)=0 then raise exception 'RECIPE_SAME_DAY_LINK_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,$new$values(p_product,p_version,p_output_per_product,current_row.effective_from)
   on conflict(product_id,effective_from) do update
   set recipe_version_id=excluded.recipe_version_id,output_quantity_per_product=excluded.output_quantity_per_product;$new$);
 select pg_get_functiondef('public.publish_recipe(uuid,bigint,uuid,numeric,uuid)'::regprocedure) into d;
 old_fragment='and linked.status=''published'' and linked.effective_from<=parent_version.effective_from';
 if strpos(d,old_fragment)=0 then raise exception 'RECIPE_LINK_OUTPUT_UNIT_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,old_fragment||' and linked.output_unit_id=parent_version.output_unit_id');
end $patch$;

-- Preserve an established source sale/output ratio when editing in the same
-- output unit. This is provenance, never a new inferred sale conversion.
do $patch$
declare d text;old_fragment text;
begin
 select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) into d;
 old_fragment='perform private.publish_recipe_tree((item->>''version_id'')::uuid,array[new_version]::uuid[],true);';
 if strpos(d,old_fragment)=0 then raise exception 'RECIPE_SAVED_TOPPING_DATE_PATCH_MISMATCH';end if;
 d=replace(d,old_fragment,$new$item=item||jsonb_build_object('prepared_version_id',private.prepare_recipe_publication(
    (item->>'version_id')::uuid,(p_recipe->>'effective_from')::date,p_key,array[new_version]::uuid[]));
   update public.recipe_topping_options set topping_version_id=(item->>'prepared_version_id')::uuid
    where parent_version_id=new_version and topping_version_id=(item->>'version_id')::uuid;
   perform private.publish_recipe_tree((item->>'prepared_version_id')::uuid,array[new_version]::uuid[],true);$new$);
 old_fragment='return private.finish_request(p_key,result);';
 if strpos(d,old_fragment)=0 then raise exception 'RECIPE_SOURCE_RATIO_COPY_PATCH_MISMATCH';end if;
 execute replace(d,old_fragment,$new$if p_id is not null then
  update private.catalog_sources current_source
  set source_data=previous.source_data||current_source.source_data
  from lateral(
   select s.source_data from private.catalog_sources s
   join public.recipe_versions rv on rv.id=s.entity_id
   where s.entity='recipe:source' and rv.recipe_id=p_id and rv.id<>new_version
    and rv.effective_from<=(p_recipe->>'effective_from')::date
    and rv.output_unit_id=(p_recipe->>'output_unit_id')::uuid
   order by rv.effective_from desc,rv.revision desc,s.recorded_at desc limit 1
  ) previous
  where current_source.entity='recipe:source' and current_source.entity_id=new_version and current_source.source_hash=p_key::text;
 end if;
 return private.finish_request(p_key,result);$new$);
end $patch$;

-- Prepare only the selected graph. Older drafts are copied forward instead
-- of changing their original dates or applying future material ratios to the
-- past. Published children remain pinned. One request reuses a shared copy.
create function private.prepare_recipe_publication(
 p_version uuid,p_date date,p_request uuid,p_path uuid[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare source public.recipe_versions;source_recipe public.recipes;line record;option_row record;
 prepared uuid;child uuid;next_revision integer;copy_required boolean;
 child_map jsonb='{}';topping_map jsonb='{}';copy_hash text;
begin
 if p_version=any(coalesce(p_path,array[]::uuid[])) then raise exception 'RECIPE_CYCLE';end if;
 select * into strict source from public.recipe_versions where id=p_version for update;
 select * into strict source_recipe from public.recipes where id=source.recipe_id for update;
 if source_recipe.archived then raise exception 'RECIPE_ARCHIVED';end if;
 if source.effective_from>p_date then raise exception 'RECIPE_PUBLICATION_DATE_BEFORE_SOURCE';end if;
 if source.status='published' then return p_version;end if;
 if source.status<>'draft' then raise exception 'PUBLISH_CHILD_FIRST';end if;
 copy_hash=auth.uid()::text||':'||p_request::text||':'||p_version::text;
 select s.entity_id into prepared from private.catalog_sources s
 where s.entity='recipe:publication-copy' and s.source_hash=copy_hash;
 if prepared is not null then return prepared;end if;

 copy_required=source.effective_from<p_date;
 for line in select * from public.recipe_items where recipe_version_id=p_version and child_version_id is not null order by sort_order,id loop
  child=private.prepare_recipe_publication(line.child_version_id,p_date,p_request,coalesce(p_path,array[]::uuid[])||p_version);
  child_map=child_map||jsonb_build_object(line.child_version_id::text,child);
  copy_required=copy_required or child<>line.child_version_id;
 end loop;
 for option_row in select * from public.recipe_topping_options where parent_version_id=p_version order by sort_order,topping_recipe_id loop
  if option_row.topping_version_id is null then raise exception 'TOPPING_RECIPE_NOT_PUBLISHABLE';end if;
  child=private.prepare_recipe_publication(option_row.topping_version_id,p_date,p_request,coalesce(p_path,array[]::uuid[])||p_version);
  topping_map=topping_map||jsonb_build_object(option_row.topping_version_id::text,child);
  copy_required=copy_required or child<>option_row.topping_version_id;
 end loop;
 if not copy_required then return p_version;end if;
 if not private.can('recipes','edit') then raise exception 'FORBIDDEN';end if;

 select coalesce(max(rv.revision),0)+1 into next_revision from public.recipe_versions rv where rv.recipe_id=source.recipe_id;
 insert into public.recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id,review_issue)
 values(source.recipe_id,next_revision,p_date,source.output_quantity,source.output_unit_id,source.review_issue) returning id into prepared;
 insert into public.recipe_items(recipe_version_id,material_id,child_version_id,quantity,unit_id,cost_exempt,sort_order)
 select prepared,i.material_id,case when i.child_version_id is not null then (child_map->>i.child_version_id::text)::uuid end,
  i.quantity,i.unit_id,i.cost_exempt,i.sort_order from public.recipe_items i where i.recipe_version_id=p_version order by i.sort_order,i.id;
 insert into public.recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order)
 select prepared,u.label,u.quantity,u.unit_label,u.issue,u.sort_order from public.recipe_unresolved_items u where u.recipe_version_id=p_version;
 insert into public.recipe_topping_options(parent_version_id,topping_recipe_id,topping_version_id,sort_order)
 select prepared,o.topping_recipe_id,(topping_map->>o.topping_version_id::text)::uuid,o.sort_order
 from public.recipe_topping_options o where o.parent_version_id=p_version;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data)
 select 'recipe:source',prepared,copy_hash,s.source_data||jsonb_build_object('publication_copy_of',p_version,'publication_date',p_date)
 from private.catalog_sources s where s.entity='recipe:source' and s.entity_id=p_version order by s.recorded_at desc limit 1;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data)
 values('recipe:publication-copy',prepared,copy_hash,jsonb_build_object('audit_source','recipe_publication_forward_revision',
  'previous_version_id',p_version,'previous_effective_from',source.effective_from,'effective_from',p_date,'request_key',p_request,'actor_id',auth.uid()));
 -- Optimistic editors must reload after a new revision was created.
 update public.recipes set name=name where id=source.recipe_id;
 return prepared;
end $$;
revoke all on function private.prepare_recipe_publication(uuid,date,uuid,uuid[]) from public,anon,authenticated;

create function public.publish_recipe_at(
 p_version uuid,p_expected_version bigint,p_effective_from date,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;source public.recipe_versions;prepared uuid;prepared_version bigint;result jsonb;linked record;
begin
 if not private.can('recipes','approve') or not private.can('recipes','edit') or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_effective_from is null or not isfinite(p_effective_from) then raise exception 'INVALID_DATE';end if;
 cached=private.begin_request(p_key,'recipe:publish-at',jsonb_build_object('version',p_version,'expected',p_expected_version,'effective_from',p_effective_from));
 if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);
 select * into strict source from public.recipe_versions where id=p_version for update;
 if p_expected_version is null or source.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if source.status<>'draft' then raise exception 'RECIPE_VERSION_IMMUTABLE';end if;
 prepared=private.prepare_recipe_publication(p_version,p_effective_from,p_key,array[]::uuid[]);
 select version into strict prepared_version from public.recipe_versions where id=prepared;
 result=public.publish_recipe(prepared,prepared_version,null,null,gen_random_uuid());
 -- Keep every currently established sale conversion for this recipe, even
 -- when the commercial product code differs. A product switched to another
 -- recipe is not selected. Preserve each factor and audit the active link.
 for linked in
  select active.*,rv.output_unit_id from(
   select distinct on(l.product_id) l.* from public.product_recipe_links l
   join public.recipe_versions rv on rv.id=l.recipe_version_id
   where l.effective_from<=p_effective_from and rv.effective_from<=p_effective_from and rv.status='published'
   order by l.product_id,l.effective_from desc
  ) active join public.recipe_versions rv on rv.id=active.recipe_version_id
  join public.products product on product.id=active.product_id and not product.archived
  where rv.recipe_id=source.recipe_id and active.recipe_version_id<>prepared
 loop
  if not private.can('products','view') then raise exception 'PRODUCT_LINK_PERMISSION_REQUIRED';end if;
  if linked.output_unit_id<>source.output_unit_id then raise exception 'PRODUCT_RECIPE_RATIO_REQUIRED';end if;
  insert into public.product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from)
  values(linked.product_id,prepared,linked.output_quantity_per_product,p_effective_from)
  on conflict(product_id,effective_from) do update
   set recipe_version_id=excluded.recipe_version_id,output_quantity_per_product=excluded.output_quantity_per_product;
 end loop;
 result=result||jsonb_build_object('recipe_id',source.recipe_id,'effective_from',p_effective_from,'prepared_from_version_id',p_version);
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.publish_recipe_at(uuid,bigint,date,uuid) from public,anon;
grant execute on function public.publish_recipe_at(uuid,bigint,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
