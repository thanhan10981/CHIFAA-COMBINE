-- A paged count worksheet and its concurrency token share one statement snapshot.
create function public.stock_count_snapshot(p_warehouse uuid,p_date date,p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; token text;
begin
 if not private.can('counts','view') or not private.can('inventory','view') then raise exception 'FORBIDDEN'; end if;
 if p_date is null or p_offset is null or p_offset<0 or length(coalesce(p_search,''))>100 then raise exception 'INVALID_FILTER'; end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED'; end if;
 select coalesce((select version from public.data_versions where module='inventory'),0)::text into token;
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') into rows from (
  select m.id,m.code,m.name,u.id unit_id,u.code unit_code,
   (select sum(l.quantity)::text from public.inventory_movement_lines l join public.inventory_movements v on v.id=l.movement_id
    where l.material_id=m.id and v.warehouse_id=p_warehouse and v.moved_on<=p_date) quantity
  from public.materials m join public.material_units u on u.id=m.usage_unit_id
  where not m.archived and (coalesce(p_search,'')='' or lower(m.code) like lower(p_search)||'%' or lower(m.name) like lower(p_search)||'%')
  order by m.code,m.id limit 51 offset p_offset
 ) page;
 return jsonb_build_object('inventory_version',token,'rows',rows);
end $$;
revoke all on function public.stock_count_snapshot(uuid,date,text,integer) from public,anon;
grant execute on function public.stock_count_snapshot(uuid,date,text,integer) to authenticated;

create or replace function public.post_stock_count(p_warehouse uuid,p_date date,p_lines jsonb,p_inventory_version bigint,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; count_id uuid; line jsonb; expected numeric; counted numeric; movement uuid; adjustments jsonb='[]'; current_version bigint;
begin
 if not private.can('counts','approve') or not private.can('inventory','create') then raise exception 'FORBIDDEN'; end if;
 cached=private.begin_request(p_key,'count:post',jsonb_build_object('warehouse',p_warehouse,'date',p_date,'lines',p_lines,'version',p_inventory_version));
 if cached is not null then return cached; end if;
 perform private.assert_open(p_date);
 if not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='ingredient') then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_warehouse::text,0));
 select version into current_version from public.data_versions where module='inventory';
 if p_inventory_version is null or coalesce(current_version,0)<>p_inventory_version then raise exception 'INVENTORY_VERSION_CONFLICT'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'INVALID_COUNT_LINES'; end if;
 if jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>200 then raise exception 'INVALID_COUNT_LINES'; end if;
 insert into public.stock_counts(warehouse_id,counted_on,status) values(p_warehouse,p_date,'draft') returning id into count_id;
 for line in select value from jsonb_array_elements(p_lines) loop
  if coalesce(line->>'counted_quantity','') !~ '^[0-9]+([.][0-9]{1,6})?$' then raise exception 'INVALID_COUNT_QUANTITY'; end if;
  if not exists(select 1 from public.materials where id=(line->>'material_id')::uuid and not archived and usage_unit_id is not null) then raise exception 'MATERIAL_STANDARD_UNIT_REQUIRED'; end if;
  select coalesce(sum(l.quantity),0) into expected from public.inventory_movement_lines l join public.inventory_movements m on m.id=l.movement_id
   where l.material_id=(line->>'material_id')::uuid and m.warehouse_id=p_warehouse and m.moved_on<=p_date;
  counted=(line->>'counted_quantity')::numeric;
  insert into public.stock_count_lines(count_id,material_id,expected_quantity,counted_quantity) values(count_id,(line->>'material_id')::uuid,expected,counted);
  if counted<>expected then adjustments=adjustments||jsonb_build_array(jsonb_build_object('material_id',line->>'material_id','unit_id',(select usage_unit_id from public.materials where id=(line->>'material_id')::uuid),'quantity',counted-expected,'unit_cost',null)); end if;
 end loop;
 if jsonb_array_length(adjustments)>0 then movement=private.insert_movement(p_warehouse,p_date,'adjustment',adjustments,'Kiểm kê',null); end if;
 update public.stock_counts set status='posted',movement_id=movement where id=count_id;
 return private.finish_request(p_key,jsonb_build_object('count_id',count_id,'movement_id',movement));
end $$;
