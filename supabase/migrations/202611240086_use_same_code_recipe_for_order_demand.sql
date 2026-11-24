begin;
set local lock_timeout='5s';

-- Keep material-demand planning consistent with the commercial catalog's
-- same-code recipe lookup. Use a saved product conversion when available;
-- otherwise allow an identity conversion only when recipe output and sale
-- units are exactly the same. Never infer a conversion between unlike units.
create or replace function private.planning_needs(p_date date,p_lines jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item jsonb;link record;needs jsonb='[]';part jsonb;
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>100 then raise exception 'INVALID_LINES';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'product_id' having count(*)>1) then raise exception 'DUPLICATE_PRODUCT';end if;
 for item in select value from jsonb_array_elements(p_lines) loop
  if item->>'quantity' is null or (item->>'quantity') !~ '^\d+(\.\d{1,6})?$' or (item->>'quantity')::numeric>=1e14 then raise exception 'INVALID_QUANTITY';end if;
  if not exists(select 1 from public.products where id=(item->>'product_id')::uuid and not archived) then raise exception 'INVALID_PRODUCT';end if;
  if (item->>'quantity')::numeric=0 then continue;end if;

  select selected.recipe_version_id,selected.output_quantity_per_product,
   product.id product_id,product.code,product.name,selected.issue
  into link
  from public.products product
  left join lateral(
   select l.recipe_version_id,l.output_quantity_per_product
   from public.product_recipe_links l
   join public.recipe_versions v on v.id=l.recipe_version_id
   where l.product_id=product.id and l.effective_from<=p_date and v.effective_from<=p_date and v.status='published'
   order by l.effective_from desc,v.revision desc limit 1
  ) explicit_link on true
  left join lateral(
   select v.id recipe_version_id,
    case
     when source_ratio.value ~ '^[0-9]+(\.[0-9]{1,6})?$' and source_ratio.value::numeric>0 then source_ratio.value::numeric
     when lower(btrim(output_unit.code))=lower(btrim(product.sale_unit)) then 1::numeric
    end output_quantity_per_product
   from public.recipes recipe
   join public.recipe_versions v on v.recipe_id=recipe.id and v.status='published' and v.effective_from<=p_date
   join public.material_units output_unit on output_unit.id=v.output_unit_id
   left join lateral(
    select source_data->>'productQuantity' value
    from private.catalog_sources
    where entity='recipe:source' and entity_id=v.id
    order by recorded_at desc limit 1
   ) source_ratio on true
   where explicit_link.recipe_version_id is null and recipe.code=product.code
    and recipe.kind='product' and not recipe.archived
   order by v.effective_from desc,v.revision desc limit 1
  ) same_code on true
  cross join lateral(
   select coalesce(explicit_link.recipe_version_id,same_code.recipe_version_id) recipe_version_id,
    case when explicit_link.recipe_version_id is not null then explicit_link.output_quantity_per_product
     else same_code.output_quantity_per_product end output_quantity_per_product,
    case when explicit_link.recipe_version_id is null and same_code.recipe_version_id is not null
      and same_code.output_quantity_per_product is null then 'PRODUCT_RECIPE_RATIO_REQUIRED' end issue
   ) selected
  where product.id=(item->>'product_id')::uuid and not product.archived;

  if link.recipe_version_id is null then
   needs=needs||jsonb_build_array(jsonb_build_object('product_id',item->>'product_id','issue','PUBLISHED_PRODUCT_RECIPE_REQUIRED'));
   continue;
  end if;
  if link.output_quantity_per_product is null then
   needs=needs||jsonb_build_array(jsonb_build_object('product_id',link.product_id,'product_code',link.code,'product_name',link.name,'issue','PRODUCT_RECIPE_RATIO_REQUIRED'));
   continue;
  end if;
  begin
   select coalesce(jsonb_agg(jsonb_build_object('material_id',b.material_id,'unit_id',b.unit_id,'quantity',b.quantity::text,'product_id',link.product_id,'product_code',link.code,'product_name',link.name,'recipe_version_id',link.recipe_version_id,'output_factor',link.output_quantity_per_product::text,'calculated_on',p_date)),'[]') into part
   from private.bom(link.recipe_version_id,(item->>'quantity')::numeric*link.output_quantity_per_product,p_date) b;
   if part='[]'::jsonb then raise exception 'EMPTY_RECIPE';end if;
   needs=needs||part;
  exception when raise_exception then
   if SQLERRM not in ('UNIT_NEEDS_VERIFICATION','RECIPE_NEEDS_REVIEW','CHILD_OUTPUT_UNIT_MISMATCH','EMPTY_RECIPE') then raise;end if;
   needs=needs||jsonb_build_array(jsonb_build_object('product_id',link.product_id,'product_name',link.name,'issue',SQLERRM));
  end;
 end loop;
 return needs;
end $$;

commit;
