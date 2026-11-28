begin;
set local lock_timeout='5s';

alter table public.finished_goods_stock_adjustments
 add column ingredient_movement_id uuid references public.inventory_movements(id),
 add column recipe_version_id uuid references public.recipe_versions(id),
 add column ingredient_warehouse_id uuid references public.warehouses(id),
 add column ingredient_movement_kind text check(ingredient_movement_kind in ('issue','receipt')),
 add column ingredient_lines jsonb not null default '[]'::jsonb,
 add constraint finished_goods_adjustments_ingredient_lines_array check(jsonb_typeof(ingredient_lines)='array');

create or replace function public.adjust_finished_goods_stock(
 p_product uuid,p_date date,p_expected_quantity numeric,p_quantity numeric,p_reason text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 cached jsonb; current_quantity numeric; delta numeric; result jsonb;
 adjustment_id uuid; movement_id uuid; ingredient_warehouse uuid; warehouse_count integer;
 recipe record; ingredient_kind text; ingredient_lines jsonb; movement_lines jsonb;
begin
 if not private.can('production','view') or not private.can('production','edit') or not private.can('inventory','create') then raise exception 'FORBIDDEN';end if;
 if p_product is null or p_date is null or not isfinite(p_date) or p_key is null
  or p_expected_quantity is null or p_quantity is null or p_expected_quantity<0 or p_quantity<0
  or scale(p_expected_quantity)>6 or scale(p_quantity)>6 or p_expected_quantity>99999999999999.999999 or p_quantity>99999999999999.999999
  or length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_FINISHED_GOODS_ADJUSTMENT';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_date between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 cached=private.begin_request(p_key,'production:finished-goods-adjust',jsonb_build_object('product',p_product,'date',p_date,'expected',p_expected_quantity,'quantity',p_quantity,'reason',trim(p_reason)));
 if cached is not null then return cached;end if;

 -- Serialize against production posting and corrections before comparing the balance.
 perform pg_advisory_xact_lock(170011);
 perform 1 from public.products where id=p_product for update;
 if not found then raise exception 'PRODUCT_NOT_FOUND';end if;
 current_quantity=private.finished_goods_balance(p_product,p_date);
 if current_quantity<>p_expected_quantity then raise exception 'FINISHED_GOODS_VERSION_CONFLICT';end if;
 delta=p_quantity-current_quantity;
 if delta=0 then
  return private.finish_request(p_key,jsonb_build_object('id',null,'quantity',current_quantity::text,'delta','0','unchanged',true,'ingredient_movement_id',null));
 end if;
 if private.finished_goods_min_balance(p_product,p_date)+delta<0 then raise exception 'FINISHED_GOODS_ADJUSTMENT_BELOW_COMMITTED_STOCK';end if;

 select count(*)::integer,(array_agg(id order by id))[1] into warehouse_count,ingredient_warehouse
 from public.warehouses where active and kind='ingredient';
 if warehouse_count<>1 then raise exception 'INGREDIENT_WAREHOUSE_REQUIRED';end if;
 select * into recipe from private.production_recipe_choice(p_product,p_date);
 if not found or recipe.recipe_version_id is null then raise exception 'PUBLISHED_PRODUCT_RECIPE_REQUIRED';end if;
 if recipe.issue is not null then raise exception '%',recipe.issue;end if;
 if recipe.output_quantity_per_product is null or recipe.output_quantity_per_product<=0 then raise exception 'PRODUCT_RECIPE_RATIO_REQUIRED';end if;

 ingredient_kind=case when delta>0 then 'issue' else 'receipt' end;
 select
  jsonb_agg(jsonb_build_object('material_id',b.material_id,'unit_id',b.unit_id,'quantity',b.quantity::text,'unit_cost',b.unit_cost::numeric(20,6)::text) order by b.material_id,b.unit_id),
  jsonb_agg(jsonb_build_object('material_id',b.material_id,'unit_id',b.unit_id,
   'quantity',(case when delta>0 then -b.quantity else b.quantity end)::text,'unit_cost',b.unit_cost::numeric(20,6)::text) order by b.material_id,b.unit_id)
 into ingredient_lines,movement_lines
 from(
  select material_id,unit_id,sum(quantity)::numeric(20,6) quantity,
   case when count(*)=count(unit_cost) then max(unit_cost) else null end unit_cost
  from private.bom(recipe.recipe_version_id,abs(delta)*recipe.output_quantity_per_product,p_date)
  group by material_id,unit_id
 ) b;
 if ingredient_lines is null or jsonb_array_length(ingredient_lines)=0 then raise exception 'EMPTY_RECIPE';end if;

 adjustment_id=gen_random_uuid();
 movement_id=private.insert_movement(ingredient_warehouse,p_date,ingredient_kind,movement_lines,
  'Điều chỉnh nguyên liệu theo tồn thành phẩm '||adjustment_id::text||': '||trim(p_reason),null);
 insert into public.finished_goods_stock_adjustments(
  id,product_id,business_date,quantity_delta,before_quantity,after_quantity,reason,
  ingredient_movement_id,recipe_version_id,ingredient_warehouse_id,ingredient_movement_kind,ingredient_lines,created_by
 ) values(
  adjustment_id,p_product,p_date,delta,current_quantity,p_quantity,trim(p_reason),
  movement_id,recipe.recipe_version_id,ingredient_warehouse,ingredient_kind,ingredient_lines,auth.uid()
 );
 insert into public.audit_logs(actor_id,action,table_name,record_id,before_row,after_row)
 values(auth.uid(),'FINISHED_GOODS_STOCK_ADJUSTED','finished_goods_stock_adjustments',adjustment_id,
  jsonb_build_object('product_id',p_product,'business_date',p_date,'quantity',current_quantity::text),
  jsonb_build_object('product_id',p_product,'business_date',p_date,'quantity',p_quantity::text,'delta',delta::text,
   'reason',trim(p_reason),'ingredient_movement_id',movement_id,'ingredient_warehouse_id',ingredient_warehouse,
   'ingredient_movement_kind',ingredient_kind,'recipe_version_id',recipe.recipe_version_id,'ingredient_lines',ingredient_lines));
 result=jsonb_build_object('id',adjustment_id,'quantity',p_quantity::text,'delta',delta::text,'unchanged',false,
  'ingredient_movement_id',movement_id,'ingredient_movement_kind',ingredient_kind,'recipe_version_id',recipe.recipe_version_id,
  'ingredient_warehouse_id',ingredient_warehouse,'ingredient_lines',ingredient_lines);
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.adjust_finished_goods_stock(uuid,date,numeric,numeric,text,uuid) from public,anon;
grant execute on function public.adjust_finished_goods_stock(uuid,date,numeric,numeric,text,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
