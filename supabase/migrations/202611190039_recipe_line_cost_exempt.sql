begin;

-- An explicit recipe-line decision may waive cost while retaining physical BOM quantity.
alter table public.recipe_items add column cost_exempt boolean not null default false;

create or replace function private.bom(p_version uuid,p_quantity numeric,p_date date)
returns table(material_id uuid,unit_id uuid,quantity numeric,unit_cost numeric)
language plpgsql stable security definer set search_path='' as $$
declare r record;child record;price record;converted numeric;
begin
 if p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'INVALID_QUANTITY';end if;
 if not exists(select 1 from public.recipe_versions where id=p_version) then raise exception 'RECIPE_NOT_FOUND';end if;
 if exists(select 1 from public.recipe_versions where id=p_version and review_issue<>'') or exists(select 1 from public.recipe_unresolved_items where recipe_version_id=p_version) then raise exception 'RECIPE_NEEDS_REVIEW';end if;
 for r in select i.*,v.output_quantity from public.recipe_items i join public.recipe_versions v on v.id=i.recipe_version_id where i.recipe_version_id=p_version loop
  if r.child_version_id is not null then
   if not exists(select 1 from public.recipe_versions v where v.id=r.child_version_id and v.output_unit_id=r.unit_id) then raise exception 'CHILD_OUTPUT_UNIT_MISMATCH';end if;
   for child in select * from private.bom(r.child_version_id,p_quantity*r.quantity/r.output_quantity,p_date) loop
    material_id=child.material_id;unit_id=child.unit_id;quantity=child.quantity;unit_cost=case when r.cost_exempt then 0 else child.unit_cost end;return next;
   end loop;
  else
   select m.usage_unit_id into unit_id from public.materials m where m.id=r.material_id;
   material_id=r.material_id;quantity=private.convert_quantity_at(r.material_id,r.unit_id,unit_id,p_quantity*r.quantity/r.output_quantity,p_date);
   unit_cost=null;
   if r.cost_exempt then unit_cost=0;
   else
    select * into price from private.effective_material_price(r.material_id,p_date);
    if price.verification='verified' and price.amount is not null then
     begin converted=private.convert_quantity_at(r.material_id,price.basis_unit_id,unit_id,1,p_date);unit_cost=price.amount/converted;
     exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;end;
    end if;
   end if;
   return next;
  end if;
 end loop;
end $$;

create or replace function public.recipe_cost(p_version uuid,p_quantity numeric,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not private.can('recipes','view') or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity='NaN'::numeric or p_date is null or not isfinite(p_date) then raise exception 'INVALID_COST_REQUEST';end if;
 begin
  with amounts as(select b.material_id,b.unit_id,sum(b.quantity) quantity,case when count(*)=count(b.unit_cost) then sum(b.quantity*b.unit_cost)/nullif(sum(b.quantity),0) end unit_cost from private.bom(p_version,p_quantity,p_date) b group by b.material_id,b.unit_id),lines as(
   select a.*,m.code,m.name,u.code unit_code,round(a.quantity*a.unit_cost) line_cost from amounts a join public.materials m on m.id=a.material_id join public.material_units u on u.id=a.unit_id)
  select jsonb_build_object('quantity',p_quantity::text,'price_date',p_date,'total_vnd',case when count(*)>0 and count(*)=count(unit_cost) then sum(line_cost)::text end,'complete',count(*)>0 and count(*)=count(unit_cost),'lines',coalesce(jsonb_agg(jsonb_build_object('material_id',material_id,'code',code,'name',name,'unit',unit_code,'quantity',quantity::text,'unit_cost_vnd',unit_cost::text,'line_cost_vnd',line_cost::text) order by code),'[]')) into result from lines;
 exception when raise_exception then
  if SQLERRM not in ('UNIT_NEEDS_VERIFICATION','RECIPE_NEEDS_REVIEW','CHILD_OUTPUT_UNIT_MISMATCH') then raise;end if;
  result=jsonb_build_object('quantity',p_quantity::text,'price_date',p_date,'total_vnd',null,'complete',false,'lines','[]'::jsonb,'issue',SQLERRM);
 end;return result;
end $$;

-- The same material may be both cost-bearing and exempt in one BOM. Use a weighted unit cost when callers aggregate lines.
do $$
declare f record;definition text;updated text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and (p.prosrc like '%max(b.unit_cost)%' or p.prosrc like '%max(unit_cost)%') loop
  definition=pg_get_functiondef(f.oid);updated=definition;
  updated=replace(updated,'case when count(*)=count(b.unit_cost) then max(b.unit_cost) else null end','case when count(*)=count(b.unit_cost) then sum(b.quantity*b.unit_cost)/nullif(sum(b.quantity),0) else null end');
  updated=replace(updated,'case when count(*)=count(b.unit_cost) then max(b.unit_cost) end','case when count(*)=count(b.unit_cost) then sum(b.quantity*b.unit_cost)/nullif(sum(b.quantity),0) end');
  updated=replace(updated,'case when count(*)=count(unit_cost) then max(unit_cost) else null end','case when count(*)=count(unit_cost) then sum(quantity*unit_cost)/nullif(sum(quantity),0) else null end');
  if updated<>definition then execute updated;end if;
 end loop;
end $$;

create or replace function public.recipe_detail(p_version uuid,p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.recipe_versions;r record;lines jsonb='[]';price record;factor numeric;unit_cost numeric;line_cost numeric;converted numeric;issue text;child_cost jsonb;result jsonb;cost_allowed boolean;
begin
 if not private.can('recipes','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 select * into strict v from public.recipe_versions where id=p_version;cost_allowed=private.can('materials','view');
 for r in select i.*,m.code material_code,m.name material_name,u.code unit_code,mu.code stock_unit,c.recipe_id child_recipe,cr.code child_code,cr.name child_name,c.output_quantity child_output,c.status child_status
  from public.recipe_items i left join public.materials m on m.id=i.material_id join public.material_units u on u.id=i.unit_id left join public.material_units mu on mu.id=m.usage_unit_id
  left join public.recipe_versions c on c.id=i.child_version_id left join public.recipes cr on cr.id=c.recipe_id where i.recipe_version_id=p_version order by i.sort_order,i.created_at,i.id loop
  unit_cost=null;line_cost=null;converted=null;issue='';child_cost=null;
  if r.material_id is not null and cost_allowed then
   begin
    converted=private.convert_quantity_at(r.material_id,r.unit_id,(select usage_unit_id from public.materials where id=r.material_id),r.quantity,p_date);
    if r.cost_exempt then unit_cost=0;line_cost=0;
    else select * into price from private.effective_material_price(r.material_id,p_date);
     if price.verification='verified' and price.amount is not null then factor=private.convert_quantity_at(r.material_id,price.basis_unit_id,r.unit_id,1,p_date);unit_cost=price.amount/factor;line_cost=round(r.quantity*unit_cost);
     else issue='Chờ xác minh đơn giá';end if;
    end if;
   exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;issue='Chờ xác minh quy đổi';end;
  elsif r.child_version_id is not null and cost_allowed then
   if r.unit_id is distinct from(select output_unit_id from public.recipe_versions where id=r.child_version_id) then issue='Đơn vị không khớp đầu ra công thức con';
   elsif r.cost_exempt then unit_cost=0;line_cost=0;
   else child_cost=public.recipe_cost(r.child_version_id,r.quantity,p_date);
    if (child_cost->>'complete')::boolean then line_cost=(child_cost->>'total_vnd')::numeric;unit_cost=line_cost/r.quantity;else issue='Công thức con chưa đủ dữ liệu';end if;
   end if;
  end if;
  lines=lines||jsonb_build_array(jsonb_build_object('id',r.id,'type',case when r.material_id is not null then 'material' else 'recipe' end,'target_id',coalesce(r.material_id,r.child_version_id),'recipe_id',r.child_recipe,'code',coalesce(r.material_code,r.child_code),'name',coalesce(r.material_name,r.child_name),'quantity',r.quantity::text,'unit_id',r.unit_id,'unit',r.unit_code,'per_output',round(r.quantity/v.output_quantity,9)::text,'converted',converted::text,'stock_unit',r.stock_unit,'unit_cost_vnd',round(unit_cost,6)::text,'line_cost_vnd',line_cost::text,'cost_exempt',r.cost_exempt,'issue',issue,'child_status',r.child_status,'sort_order',r.sort_order));
 end loop;
 for r in select * from public.recipe_unresolved_items where recipe_version_id=p_version order by sort_order loop
  lines=lines||jsonb_build_array(jsonb_build_object('id',r.id,'type','unresolved','name',r.label,'quantity',r.quantity::text,'unit',r.unit_label,'issue',r.issue,'sort_order',r.sort_order));
 end loop;
 select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer),'[]') into lines from jsonb_array_elements(lines);
 result=jsonb_build_object('version',jsonb_build_object('id',v.id,'revision',v.revision,'effective_from',v.effective_from,'status',v.status,'output_quantity',v.output_quantity::text,'output_unit_id',v.output_unit_id,'output_unit',(select code from public.material_units where id=v.output_unit_id),'review_issue',v.review_issue),'lines',lines,
  'cost',case when cost_allowed then public.recipe_cost(p_version,v.output_quantity,p_date) end,
  'source',case when cost_allowed then(select s.source_data from private.catalog_sources s where s.entity='recipe:source' and s.entity_id=p_version order by s.recorded_at desc limit 1) end,
  'products',case when private.can('products','view') then(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'quantity',l.output_quantity_per_product::text)),'[]'::jsonb) from public.product_recipe_links l join public.products p on p.id=l.product_id where l.recipe_version_id=p_version) else '[]'::jsonb end);
 return result;
end $$;

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
  if coalesce(item->>'cost_exempt','false') not in ('true','false') then raise exception 'INVALID_RECIPE_ITEMS';end if;
 end loop;
 cached=private.begin_request(p_key,'recipe:full-revision',jsonb_build_object('id',p_id,'expected',p_expected_version,'recipe',p_recipe,'items',p_items,'evidence',nullif(trim(coalesce(p_evidence,'')),'')));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);
 if p_id is null then result=public.save_recipe(p_recipe,p_items,gen_random_uuid());
 else
  result=public.revise_recipe(p_id,p_expected_version,(p_recipe->>'effective_from')::date,(p_recipe->>'output_quantity')::numeric,(p_recipe->>'output_unit_id')::uuid,p_items,gen_random_uuid());
  update public.recipes set name=trim(p_recipe->>'name'),kind=p_recipe->>'kind' where id=p_id;
  new_version=(result->>'version_id')::uuid;
  with changed as (update public.recipe_items i set child_version_id=new_version where i.child_version_id in(select old.id from public.recipe_versions old where old.recipe_id=p_id and old.id<>new_version) and i.recipe_version_id in(select parent.id from public.recipe_versions parent where parent.status='draft') and i.unit_id=(select v.output_unit_id from public.recipe_versions v where v.id=new_version) returning i.recipe_version_id)
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data) select 'recipe:link-refresh',recipe_version_id,p_key::text||':'||recipe_version_id::text,jsonb_build_object('audit_source','recipe_child_revision','child_recipe_id',p_id,'child_version_id',new_version) from changed group by recipe_version_id;
 end if;
 new_version=(result->>'version_id')::uuid;
 for item in select value||jsonb_build_object('_ordinality',ordinality) from jsonb_array_elements(p_items) with ordinality as x(value,ordinality) loop
  update public.recipe_items set cost_exempt=coalesce((item->>'cost_exempt')::boolean,false) where recipe_version_id=new_version and sort_order=(item->>'_ordinality')::integer;
 end loop;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('recipe:source',new_version,p_key::text,jsonb_build_object('evidence',nullif(trim(coalesce(p_evidence,'')),''),'audit_source','recipe_editor','recipe',p_recipe,'items',p_items,'previous_recipe_id',p_id));
 return private.finish_request(p_key,result);
end $$;

revoke all on function public.recipe_detail(uuid,date),public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid) from public;
grant execute on function public.recipe_detail(uuid,date),public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid) to authenticated;

commit;
