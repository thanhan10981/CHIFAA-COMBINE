begin;
-- Forward repair for validation gaps reproduced during the system audit.
-- Enable account setup for cash/bank kiosk receipts without direct table writes.

create or replace function public.publish_recipe(p_version uuid,p_expected_version bigint,p_product uuid,p_output_per_product numeric,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_row public.recipe_versions; item record;
begin
 if not private.can('recipes','approve') then raise exception 'FORBIDDEN'; end if;
 cached=private.begin_request(p_key,'recipe:publish',jsonb_build_object('version',p_version,'expected',p_expected_version,'product',p_product,'output',p_output_per_product));if cached is not null then return cached; end if;
 perform pg_advisory_xact_lock(170011);
 select * into strict current_row from public.recipe_versions where id=p_version for update;
 if p_expected_version is null or current_row.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
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

create or replace function public.revise_recipe(p_recipe uuid,p_expected_version bigint,p_effective date,p_output numeric,p_unit uuid,p_items jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_recipe public.recipes; revision integer; version_id uuid; item jsonb;
begin
 if not private.can('recipes','edit') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'recipe:revise',jsonb_build_object('recipe',p_recipe,'expected',p_expected_version,'effective',p_effective,'output',p_output,'unit',p_unit,'items',p_items));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170011);
 select * into strict current_recipe from public.recipes where id=p_recipe for update;
 if p_expected_version is null or current_recipe.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'INVALID_RECIPE_ITEMS';end if;
 select coalesce(max(v.revision),0)+1 into revision from public.recipe_versions v where v.recipe_id=p_recipe;
 insert into public.recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values(p_recipe,revision,p_effective,p_output,p_unit) returning id into version_id;
 for item in select value from jsonb_array_elements(p_items) loop
  insert into public.recipe_items(recipe_version_id,material_id,child_version_id,quantity,unit_id) values(version_id,(item->>'material_id')::uuid,(item->>'child_version_id')::uuid,(item->>'quantity')::numeric,(item->>'unit_id')::uuid);
 end loop;
 update public.recipes set name=name where id=p_recipe;
 return private.finish_request(p_key,jsonb_build_object('recipe_id',p_recipe,'version_id',version_id,'revision',revision));
end $$;

create or replace function public.review_order(p_order uuid,p_expected_version bigint,p_approve boolean,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_order public.customer_orders; new_status text;
begin
 if not private.can('orders','approve') then raise exception 'FORBIDDEN';end if;
 if p_approve is null then raise exception 'INVALID_APPROVAL';end if;
 cached=private.begin_request(p_key,'order:review',jsonb_build_object('order',p_order,'version',p_expected_version,'approve',p_approve,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict current_order from public.customer_orders where id=p_order for update;
 if p_expected_version is null or current_order.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if current_order.status<>'submitted' then raise exception 'INVALID_ORDER_STATUS';end if;
 new_status=case when p_approve then 'approved' else 'rejected' end;
 if not p_approve and length(trim(coalesce(p_reason,'')))<3 then raise exception 'REJECTION_REASON_REQUIRED';end if;
 update public.customer_orders set status=new_status,rejection_reason=case when p_approve then null else p_reason end where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status,note) values(p_order,current_order.status,new_status,p_reason);
 insert into public.notifications(user_id,order_id,title) values(current_order.customer_id,p_order,case when p_approve then 'Đơn hàng đã được duyệt' else 'Đơn hàng bị từ chối' end);
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'status',new_status));
end $$;

create or replace function public.schedule_order(p_order uuid,p_plan uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_order public.customer_orders; plan public.production_plans;
begin
 if not private.can('orders','approve') or not private.can('production','edit') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:schedule',jsonb_build_object('order',p_order,'plan',p_plan));if cached is not null then return cached;end if;
 select * into strict current_order from public.customer_orders where id=p_order for update;
 if current_order.status<>'approved' or current_order.plan_id is not null then raise exception 'ORDER_ALREADY_LINKED_OR_NOT_APPROVED';end if;
 select * into strict plan from public.production_plans where id=p_plan for update;
 if plan.delivery_date<>current_order.delivery_date or plan.shift<>current_order.shift or plan.status='cancelled' then raise exception 'PLAN_MISMATCH';end if;
 -- Reserve capacity across all linked orders. The locked plan serializes allocations.
 -- Linking does not increase manually entered plan quantities.
 if exists(select 1 from public.customer_order_items i where i.order_id=p_order and i.quantity+(select coalesce(sum(x.quantity),0) from public.customer_order_items x join public.customer_orders o on o.id=x.order_id where o.plan_id=p_plan and o.status not in ('cancelled','rejected') and x.product_id=i.product_id)>(select coalesce(sum(l.planned_quantity),0) from public.production_plan_lines l where l.plan_id=p_plan and l.product_id=i.product_id)) then raise exception 'PLAN_QUANTITY_INSUFFICIENT';end if;
 update public.customer_orders set plan_id=p_plan,status='scheduled' where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status) values(p_order,'approved','scheduled');
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'plan_id',p_plan,'status','scheduled','plan_quantity_changed',false));
end $$;

create or replace function public.save_catalog(p_table text,p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare columns text[]; module text; cached jsonb; result jsonb; current_version bigint; assignments text; row_id uuid=coalesce(p_id,gen_random_uuid());
begin
 case p_table
 when 'bank_accounts' then module='cash'; columns=array['code','name','kind','archived'];
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
 if ((p_table='unit_conversions' and coalesce((p_input->>'verified')::boolean,false)) or(p_table='material_prices' and p_input->>'verification'='verified') or(p_table='materials' and p_input->>'price_status'='verified')) and not private.can('materials','approve') then raise exception 'FORBIDDEN_VERIFICATION';end if;
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
  if p_table='bank_accounts' and p_input?'kind' and exists(select 1 from public.bank_accounts a where a.id=p_id and a.kind is distinct from p_input->>'kind') and exists(select 1 from public.cash_ledger l where l.account_id=p_id) then raise exception 'BANK_ACCOUNT_KIND_IMMUTABLE';end if;
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
commit;
