begin;
create function private.begin_request(p_key uuid,p_operation text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.idempotency_keys; fingerprint text;
begin
 if auth.uid() is null or p_key is null then raise exception 'UNAUTHENTICATED'; end if;
 fingerprint=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 insert into public.idempotency_keys(actor_id,key,operation,fingerprint) values(auth.uid(),p_key,p_operation,fingerprint) on conflict do nothing;
 select * into strict r from public.idempotency_keys where actor_id=auth.uid() and key=p_key for update;
 if r.operation<>p_operation or r.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return r.result;
end $$;
create function private.finish_request(p_key uuid,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin update public.idempotency_keys set result=p_result where actor_id=auth.uid() and key=p_key; return p_result; end $$;
revoke all on function private.begin_request(uuid,text,jsonb), private.finish_request(uuid,jsonb) from public;

create function public.save_catalog(p_table text,p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare columns text[]; module text; cached jsonb; result jsonb; current_version bigint; assignments text; row_id uuid=coalesce(p_id,gen_random_uuid());
begin
 case p_table
 when 'materials' then module='materials'; columns=array['code','name','category','purchase_unit_id','usage_unit_id','minimum_quantity','price_status','archived'];
 when 'material_units' then module='materials'; columns=array['code','name','dimension','archived'];
 when 'unit_conversions' then module='materials'; columns=array['material_id','from_unit_id','to_unit_id','factor','verified','evidence'];
 when 'material_prices' then module='materials'; columns=array['material_id','basis_unit_id','amount','effective_from','effective_to','verification','source_reference'];
 when 'products' then module='products'; columns=array['code','name','sale_unit','published','archived'];
 when 'stores' then module='stores'; columns=array['code','name','address','contact','active'];
 when 'departments' then module='employees'; columns=array['code','name'];
 when 'employees' then module='employees'; columns=array['code','name','department_id','active'];
 when 'suppliers' then module='materials'; columns=array['code','name','contact','archived'];
 when 'warehouses' then module='inventory'; columns=array['code','name','kind','active'];
 else raise exception 'UNSUPPORTED_CATALOG'; end case;
 if not private.can(module,case when p_id is null then 'create' else 'edit' end) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(p_input)<>'object' or p_input='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(columns))) then raise exception 'INVALID_FIELDS'; end if;
 if p_table='materials' and p_input->>'price_status'='verified' and not exists(select 1 from public.material_prices p where p.material_id=p_id and p.verification='verified' and p.amount is not null) then raise exception 'VERIFIED_PRICE_ROW_REQUIRED';end if;
 cached=private.begin_request(p_key,'catalog:'||p_table,jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached; end if;
 if p_id is null then
  select string_agg(format('%I',key),',') into assignments from jsonb_object_keys(p_input) key;
  execute format('insert into public.%I(id,%s) select $2,%s from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I.*)',p_table,assignments,assignments,p_table,p_table) into result using p_input,row_id;
 else
  execute format('select version from public.%I where id=$1 for update',p_table) into current_version using p_id;
  if current_version is null then raise exception 'NOT_FOUND'; end if;
  if p_expected_version is null or p_expected_version<>current_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_table='material_prices' and exists(select 1 from public.material_prices where id=p_id and verification='verified') then raise exception 'PRICE_VERSION_IMMUTABLE';end if;
  if p_table='unit_conversions' and exists(select 1 from public.unit_conversions c where c.id=p_id and (exists(select 1 from public.inventory_movement_lines l where l.material_id=c.material_id) or exists(select 1 from public.recipe_items i where i.material_id=c.material_id))) then raise exception 'UNIT_MIGRATION_REQUIRED';end if;
  -- A base unit cannot be relabeled after its stock/recipe history exists.
  if p_table='materials' and p_input?'usage_unit_id' and exists(select 1 from public.materials m where m.id=p_id and m.usage_unit_id is distinct from (p_input->>'usage_unit_id')::uuid) and
    (exists(select 1 from public.inventory_movement_lines where material_id=p_id) or exists(select 1 from public.recipe_items where material_id=p_id)) then raise exception 'UNIT_MIGRATION_REQUIRED'; end if;
  select string_agg(format('%I=v.%I',key,key),',') into assignments from jsonb_object_keys(p_input) key;
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) v where t.id=$2 returning to_jsonb(t.*)',p_table,assignments,p_table) into result using p_input,p_id;
 end if;
 return private.finish_request(p_key,result);
end $$;

create function private.recipe_cycle_guard() returns trigger language plpgsql set search_path='' as $$
begin
 -- Serialize graph modifications, including links changed in concurrent sessions.
 perform pg_advisory_xact_lock(170011);
 if (select status from public.recipe_versions where id=new.recipe_version_id)<>'draft' then raise exception 'RECIPE_VERSION_IMMUTABLE'; end if;
 if new.child_version_id is not null and exists(
  with recursive graph(id,path) as (
   select new.child_version_id,array[new.child_version_id]
   union all select i.child_version_id,g.path||i.child_version_id from graph g join public.recipe_items i on i.recipe_version_id=g.id
   where i.child_version_id is not null and not i.child_version_id=any(g.path)
  ) select 1 from graph where id=new.recipe_version_id
 ) then raise exception 'RECIPE_CYCLE'; end if;
 return new;
end $$;
create trigger recipe_cycle before insert or update on public.recipe_items for each row execute function private.recipe_cycle_guard();

create function public.save_recipe(p_recipe jsonb,p_items jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; recipe_id uuid; version_id uuid; item jsonb; result jsonb;
begin
 if not private.can('recipes','create') then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>200 then raise exception 'INVALID_RECIPE_ITEMS'; end if;
 cached=private.begin_request(p_key,'recipe:create',jsonb_build_object('recipe',p_recipe,'items',p_items));if cached is not null then return cached; end if;
 perform pg_advisory_xact_lock(170011);
 insert into public.recipes(code,name,kind) values(p_recipe->>'code',p_recipe->>'name',p_recipe->>'kind') returning id into recipe_id;
 insert into public.recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values(recipe_id,1,(p_recipe->>'effective_from')::date,(p_recipe->>'output_quantity')::numeric,(p_recipe->>'output_unit_id')::uuid) returning id into version_id;
 for item in select value from jsonb_array_elements(p_items) loop
  insert into public.recipe_items(recipe_version_id,material_id,child_version_id,quantity,unit_id) values(version_id,(item->>'material_id')::uuid,(item->>'child_version_id')::uuid,(item->>'quantity')::numeric,(item->>'unit_id')::uuid);
 end loop;
 result=jsonb_build_object('recipe_id',recipe_id,'version_id',version_id);
 return private.finish_request(p_key,result);
end $$;

create function private.convert_quantity(p_material uuid,p_from uuid,p_to uuid,p_quantity numeric) returns numeric language plpgsql stable security definer set search_path='' as $$
declare factor numeric;
begin
 if p_from=p_to then return p_quantity; end if;
 select c.factor into factor from public.unit_conversions c where c.material_id=p_material and c.from_unit_id=p_from and c.to_unit_id=p_to and c.verified;
 if factor is null then raise exception 'UNIT_NEEDS_VERIFICATION'; end if;
 return p_quantity*factor;
end $$;
create function private.bom(p_version uuid,p_quantity numeric,p_date date) returns table(material_id uuid,unit_id uuid,quantity numeric,unit_cost numeric) language plpgsql stable security definer set search_path='' as $$
declare r record; child record; price record; converted numeric;
begin
 if p_quantity<=0 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.recipe_versions where id=p_version) then raise exception 'RECIPE_NOT_FOUND'; end if;
 for r in select i.*,v.output_quantity from public.recipe_items i join public.recipe_versions v on v.id=i.recipe_version_id where i.recipe_version_id=p_version loop
  if r.child_version_id is not null then
   if not exists(select 1 from public.recipe_versions v where v.id=r.child_version_id and v.output_unit_id=r.unit_id) then raise exception 'CHILD_OUTPUT_UNIT_MISMATCH'; end if;
   for child in select * from private.bom(r.child_version_id,p_quantity*r.quantity/r.output_quantity,p_date) loop
    material_id=child.material_id;unit_id=child.unit_id;quantity=child.quantity;unit_cost=child.unit_cost;return next;
   end loop;
  else
   select m.usage_unit_id into unit_id from public.materials m where m.id=r.material_id;
   material_id=r.material_id;quantity=private.convert_quantity(r.material_id,r.unit_id,unit_id,p_quantity*r.quantity/r.output_quantity);
   select * into price from public.material_prices p where p.material_id=r.material_id and p.effective_from<=p_date and(p.effective_to is null or p.effective_to>=p_date) order by effective_from desc,id limit 1;
   unit_cost=null;
   if price.verification='verified' and price.amount is not null then
    converted=private.convert_quantity(r.material_id,price.basis_unit_id,unit_id,1);
    unit_cost=price.amount/converted;
   end if;
   return next;
  end if;
 end loop;
end $$;
create function public.recipe_bom(p_version uuid,p_quantity numeric,p_date date) returns table(material_id uuid,unit_id uuid,quantity numeric,unit_cost numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('recipes','view') or not private.can('materials','view') then raise exception 'FORBIDDEN'; end if;
 return query select b.material_id,b.unit_id,sum(b.quantity),case when count(*)=count(b.unit_cost) then max(b.unit_cost) else null end from private.bom(p_version,p_quantity,p_date) b group by b.material_id,b.unit_id;
end $$;
revoke all on function public.save_catalog(text,uuid,bigint,jsonb,uuid),public.save_recipe(jsonb,jsonb,uuid),public.recipe_bom(uuid,numeric,date) from public;
grant execute on function public.save_catalog(text,uuid,bigint,jsonb,uuid),public.save_recipe(jsonb,jsonb,uuid),public.recipe_bom(uuid,numeric,date) to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.can(text,text) to authenticated;
grant execute on function private.audit_visible(text) to authenticated;
commit;
