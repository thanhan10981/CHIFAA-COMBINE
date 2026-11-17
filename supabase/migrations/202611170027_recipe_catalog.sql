begin;
-- Multiple draft revisions may share a date. Only one version can be published for that date.
alter table public.recipe_versions drop constraint recipe_versions_recipe_id_effective_from_key;
create unique index recipe_published_date on public.recipe_versions(recipe_id,effective_from) where status='published';
alter table public.recipe_versions add column review_issue text not null default '';
alter table public.recipe_items add column sort_order integer not null default 0;
create function private.recipe_item_order() returns trigger language plpgsql set search_path='' as $$begin
 if new.sort_order=0 then select coalesce(max(sort_order),0)+1 into new.sort_order from public.recipe_items where recipe_version_id=new.recipe_version_id;end if;return new;end $$;
create trigger recipe_item_order before insert on public.recipe_items for each row execute function private.recipe_item_order();
-- Incomplete source lines stay visible, never disappear from an imported BOM.
create table public.recipe_unresolved_items(
 id uuid primary key default gen_random_uuid(),recipe_version_id uuid not null references public.recipe_versions(id),
 label text not null,quantity numeric(20,6),unit_label text not null default '',issue text not null,sort_order integer not null,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
alter table public.recipe_unresolved_items enable row level security;
create policy unresolved_recipe_read on public.recipe_unresolved_items for select to authenticated using((select private.can('recipes','view')));
grant select on public.recipe_unresolved_items to authenticated;
insert into private.table_modules values('recipe_unresolved_items','recipes');
create trigger unresolved_recipe_audit before insert or update or delete on public.recipe_unresolved_items for each row execute function private.record_change('recipes');
create function private.unresolved_recipe_guard() returns trigger language plpgsql set search_path='' as $$begin
 if (select status from public.recipe_versions where id=coalesce(new.recipe_version_id,old.recipe_version_id))<>'draft' then raise exception 'RECIPE_VERSION_IMMUTABLE';end if;
 return coalesce(new,old);end $$;
create trigger unresolved_recipe_guard before insert or update or delete on public.recipe_unresolved_items for each row execute function private.unresolved_recipe_guard();

alter function private.bom(uuid,numeric,date) rename to bom_before_027;
revoke all on function private.bom_before_027(uuid,numeric,date) from public,authenticated;
create function private.bom(p_version uuid,p_quantity numeric,p_date date) returns table(material_id uuid,unit_id uuid,quantity numeric,unit_cost numeric) language plpgsql stable security definer set search_path='' as $$begin
 if exists(select 1 from public.recipe_versions where id=p_version and review_issue<>'') or exists(select 1 from public.recipe_unresolved_items where recipe_version_id=p_version) then raise exception 'RECIPE_NEEDS_REVIEW';end if;
 return query select * from private.bom_before_027(p_version,p_quantity,p_date);
end $$;
create or replace function public.recipe_cost(p_version uuid,p_quantity numeric,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not private.can('recipes','view') or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity='NaN'::numeric or p_date is null or not isfinite(p_date) then raise exception 'INVALID_COST_REQUEST';end if;
 begin
 with amounts as(select b.material_id,b.unit_id,sum(b.quantity) quantity,case when count(*)=count(b.unit_cost) then max(b.unit_cost) end unit_cost from private.bom(p_version,p_quantity,p_date) b group by b.material_id,b.unit_id),lines as(
 select a.*,m.code,m.name,u.code unit_code,round(a.quantity*a.unit_cost) line_cost from amounts a join public.materials m on m.id=a.material_id join public.material_units u on u.id=a.unit_id)
 select jsonb_build_object('quantity',p_quantity::text,'price_date',p_date,'total_vnd',case when count(*)>0 and count(*)=count(unit_cost) then sum(line_cost)::text end,'complete',count(*)>0 and count(*)=count(unit_cost),'lines',coalesce(jsonb_agg(jsonb_build_object('material_id',material_id,'code',code,'name',name,'unit',unit_code,'quantity',quantity::text,'unit_cost_vnd',unit_cost::text,'line_cost_vnd',line_cost::text) order by code),'[]')) into result from lines;
 exception when raise_exception then
 if SQLERRM not in ('UNIT_NEEDS_VERIFICATION','RECIPE_NEEDS_REVIEW','CHILD_OUTPUT_UNIT_MISMATCH') then raise;end if;
 result=jsonb_build_object('quantity',p_quantity::text,'price_date',p_date,'total_vnd',null,'complete',false,'lines','[]'::jsonb,'issue',SQLERRM);
 end;return result;end $$;

create function public.recipe_catalog(p_kind text,p_date date,p_search text,p_offset integer,p_limit integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;total integer;begin
 if not private.can('recipes','view') then raise exception 'FORBIDDEN';end if;
 if p_kind not in ('product','sauce','rice','packaging') or p_date is null or not isfinite(p_date) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'INVALID_QUERY';end if;
 select count(*) into total from public.recipes r where not r.archived and r.kind=p_kind and (r.name ilike '%'||coalesce(p_search,'')||'%' or r.code ilike '%'||coalesce(p_search,'')||'%');
 select coalesce(jsonb_agg(to_jsonb(t) order by t.name,t.id),'[]') into rows from(
 select r.id,r.code,r.name,r.kind,r.version::text,v.id version_id,v.revision,v.status,v.effective_from,v.output_quantity::text,u.code output_unit,v.review_issue,
 coalesce((select l.output_quantity_per_product::text from public.product_recipe_links l where l.recipe_version_id=v.id order by effective_from desc limit 1),(select s.source_data->>'productQuantity' from private.catalog_sources s where s.entity='recipe:source' and s.entity_id=v.id order by recorded_at desc limit 1),'1') sale_quantity,
 case when private.can('products','view') then(select p.sale_unit from public.products p where p.code=r.code) end sale_unit,
 case when private.can('materials','view') then(select s.source_data->>'reference' from private.catalog_sources s where s.entity='recipe:source' and s.entity_id=v.id order by recorded_at desc limit 1) end source_reference,
 case when v.id is not null and private.can('materials','view') then public.recipe_cost(v.id,v.output_quantity,p_date) end cost
 from public.recipes r left join lateral(select * from public.recipe_versions where recipe_id=r.id and effective_from<=p_date order by effective_from desc,revision desc limit 1) v on true
 left join public.material_units u on u.id=v.output_unit_id
 where not r.archived and r.kind=p_kind and(r.name ilike '%'||coalesce(p_search,'')||'%' or r.code ilike '%'||coalesce(p_search,'')||'%')
 order by r.name,r.id offset p_offset limit p_limit) t;
 return jsonb_build_object('rows',rows,'total',total,'stats',jsonb_build_object('products',(select count(*) from public.recipes where kind='product' and not archived),'batches',(select count(*) from public.recipes where kind in ('sauce','rice','packaging') and not archived),
 'materials',case when private.can('materials','view') then(select count(*) from public.materials where not archived) end,
 'unpriced',case when private.can('materials','view') then(select count(*) from public.materials m left join lateral private.effective_material_price(m.id,p_date) p on true where not m.archived and(p.verification is distinct from 'verified' or p.amount is null)) end));
end $$;

create function public.recipe_detail(p_version uuid,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.recipe_versions;r record;lines jsonb='[]';price record;factor numeric;unit_cost numeric;line_cost numeric;converted numeric;issue text;child_cost jsonb;result jsonb;cost_allowed boolean;
begin
 if not private.can('recipes','view') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE';end if;
 select * into strict v from public.recipe_versions where id=p_version;
 cost_allowed=private.can('materials','view');
 for r in select i.*,m.code material_code,m.name material_name,u.code unit_code,mu.code stock_unit,c.recipe_id child_recipe,cr.code child_code,cr.name child_name,c.output_quantity child_output,c.status child_status
 from public.recipe_items i left join public.materials m on m.id=i.material_id join public.material_units u on u.id=i.unit_id left join public.material_units mu on mu.id=m.usage_unit_id
 left join public.recipe_versions c on c.id=i.child_version_id left join public.recipes cr on cr.id=c.recipe_id where i.recipe_version_id=p_version order by i.sort_order,i.created_at,i.id loop
 unit_cost=null;line_cost=null;converted=null;issue='';child_cost=null;
 if r.material_id is not null and cost_allowed then
 begin
 select * into price from private.effective_material_price(r.material_id,p_date);
 converted=private.convert_quantity_at(r.material_id,r.unit_id,(select usage_unit_id from public.materials where id=r.material_id),r.quantity,p_date);
 if price.verification='verified' and price.amount is not null then
 factor=private.convert_quantity_at(r.material_id,price.basis_unit_id,r.unit_id,1,p_date);unit_cost=price.amount/factor;line_cost=round(r.quantity*unit_cost);
 else issue='Chờ xác minh đơn giá';end if;
 exception when raise_exception then if SQLERRM<>'UNIT_NEEDS_VERIFICATION' then raise;end if;issue='Chờ xác minh quy đổi';end;
 elsif r.child_version_id is not null and cost_allowed then
 if r.unit_id is distinct from(select output_unit_id from public.recipe_versions where id=r.child_version_id) then issue='Đơn vị không khớp đầu ra công thức con';
 else child_cost=public.recipe_cost(r.child_version_id,r.quantity,p_date);
 if (child_cost->>'complete')::boolean then line_cost=(child_cost->>'total_vnd')::numeric;unit_cost=line_cost/r.quantity;else issue='Công thức con chưa đủ dữ liệu';end if;end if;
 end if;
 lines=lines||jsonb_build_array(jsonb_build_object('id',r.id,'type',case when r.material_id is not null then 'material' else 'recipe' end,'target_id',coalesce(r.material_id,r.child_version_id),'recipe_id',r.child_recipe,'code',coalesce(r.material_code,r.child_code),'name',coalesce(r.material_name,r.child_name),'quantity',r.quantity::text,'unit_id',r.unit_id,'unit',r.unit_code,'per_output',round(r.quantity/v.output_quantity,9)::text,'converted',converted::text,'stock_unit',r.stock_unit,'unit_cost_vnd',round(unit_cost,6)::text,'line_cost_vnd',line_cost::text,'issue',issue,'child_status',r.child_status,'sort_order',r.sort_order));
 end loop;
 for r in select * from public.recipe_unresolved_items where recipe_version_id=p_version order by sort_order loop
 lines=lines||jsonb_build_array(jsonb_build_object('id',r.id,'type','unresolved','name',r.label,'quantity',r.quantity::text,'unit',r.unit_label,'issue',r.issue,'sort_order',r.sort_order));end loop;
 select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer),'[]') into lines from jsonb_array_elements(lines);
 result=jsonb_build_object('version',jsonb_build_object('id',v.id,'revision',v.revision,'effective_from',v.effective_from,'status',v.status,'output_quantity',v.output_quantity::text,'output_unit_id',v.output_unit_id,'output_unit',(select code from public.material_units where id=v.output_unit_id),'review_issue',v.review_issue),'lines',lines,
 'cost',case when cost_allowed then public.recipe_cost(p_version,v.output_quantity,p_date) end,
 'source',case when cost_allowed then(select s.source_data from private.catalog_sources s where s.entity='recipe:source' and s.entity_id=p_version order by s.recorded_at desc limit 1) end,
 'products',case when private.can('products','view') then(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'quantity',l.output_quantity_per_product::text)),'[]') from public.product_recipe_links l join public.products p on p.id=l.product_id where l.recipe_version_id=p_version) else '[]'::jsonb end);
 return result;
end $$;
create function public.update_recipe_metadata(p_recipe uuid,p_expected_version bigint,p_name text,p_kind text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare cached jsonb;ver bigint;begin
 if not private.can('recipes','edit') then raise exception 'FORBIDDEN';end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 300 or p_kind not in ('product','sauce','rice','packaging') then raise exception 'INVALID_FIELDS';end if;
 cached=private.begin_request(p_key,'recipe:metadata',jsonb_build_object('id',p_recipe,'version',p_expected_version,'name',p_name,'kind',p_kind));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);select version into ver from public.recipes where id=p_recipe for update;
 if p_expected_version is null or ver is null or ver<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 update public.recipes set name=trim(p_name),kind=p_kind where id=p_recipe returning version into ver;
 return private.finish_request(p_key,jsonb_build_object('id',p_recipe,'version',ver::text));end $$;
create function public.save_recipe_revision(p_id uuid,p_expected_version bigint,p_recipe jsonb,p_items jsonb,p_evidence text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare cached jsonb;result jsonb;item jsonb;begin
 if not private.can('recipes',case when p_id is null then 'create' else 'edit' end) or not private.can('materials','view') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_recipe) is distinct from 'object' or coalesce(p_recipe->>'effective_from','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_id is null and length(trim(coalesce(p_recipe->>'code',''))) not between 1 and 100) or not exists(select 1 from public.material_units where id=(p_recipe->>'output_unit_id')::uuid and not archived) then raise exception 'INVALID_RECIPE';end if;
 if length(trim(coalesce(p_evidence,''))) not between 5 and 2000 or length(trim(coalesce(p_recipe->>'name',''))) not between 1 and 300 or p_recipe->>'kind' not in ('product','rice','sauce','packaging') or coalesce(p_recipe->>'output_quantity','')!~'^[0-9]{1,12}(\.[0-9]{1,6})?$' or (p_recipe->>'output_quantity')::numeric<=0 then raise exception 'INVALID_RECIPE';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'INVALID_RECIPE_ITEMS';end if;
 for item in select * from jsonb_array_elements(p_items) loop
 if coalesce(item->>'quantity','')!~'^[0-9]{1,12}(\.[0-9]{1,6})?$' or (item->>'quantity')::numeric<=0 then raise exception 'INVALID_QUANTITY';end if;
 if item->>'material_id' is not null and not exists(select 1 from public.materials where id=(item->>'material_id')::uuid and not archived) then raise exception 'MATERIAL_NOT_FOUND';end if;
 if item->>'child_version_id' is not null and not exists(select 1 from public.recipe_versions v join public.recipes r on r.id=v.recipe_id where v.id=(item->>'child_version_id')::uuid and not r.archived) then raise exception 'RECIPE_NOT_FOUND';end if;
 end loop;
 cached=private.begin_request(p_key,'recipe:full-revision',jsonb_build_object('id',p_id,'expected',p_expected_version,'recipe',p_recipe,'items',p_items,'evidence',p_evidence));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);
 if p_id is null then result=public.save_recipe(p_recipe,p_items,gen_random_uuid());
 else result=public.revise_recipe(p_id,p_expected_version,(p_recipe->>'effective_from')::date,(p_recipe->>'output_quantity')::numeric,(p_recipe->>'output_unit_id')::uuid,p_items,gen_random_uuid());
 update public.recipes set name=trim(p_recipe->>'name'),kind=p_recipe->>'kind' where id=p_id;end if;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('recipe:source',(result->>'version_id')::uuid,p_key::text,jsonb_build_object('evidence',trim(p_evidence),'recipe',p_recipe,'items',p_items,'previous_recipe_id',p_id));
 return private.finish_request(p_key,result);end $$;
alter function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) set schema private;
revoke all on function private.publish_recipe(uuid,bigint,uuid,numeric,uuid) from public,authenticated;
create function public.publish_recipe(p_version uuid,p_expected_version bigint,p_product uuid,p_output_per_product numeric,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.can('recipes','approve') or(p_product is not null and not private.can('products','view')) then raise exception 'FORBIDDEN';end if;
 if p_product is not null and not exists(select 1 from public.products where id=p_product and not archived) then raise exception 'PRODUCT_NOT_FOUND';end if;
 return private.publish_recipe(p_version,p_expected_version,p_product,p_output_per_product,p_key);end $$;
revoke all on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) from public;
grant execute on function public.publish_recipe(uuid,bigint,uuid,numeric,uuid) to authenticated;
revoke all on function public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid) from public;
grant execute on function public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid) to authenticated;
revoke all on function public.recipe_catalog(text,date,text,integer,integer),public.recipe_detail(uuid,date),public.update_recipe_metadata(uuid,bigint,text,text,uuid) from public;
grant execute on function public.recipe_catalog(text,date,text,integer,integer),public.recipe_detail(uuid,date),public.update_recipe_metadata(uuid,bigint,text,text,uuid) to authenticated;
revoke all on function private.bom(uuid,numeric,date),private.unresolved_recipe_guard(),private.recipe_item_order() from public;
commit;
