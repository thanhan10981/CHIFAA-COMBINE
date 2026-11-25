import Decimal from 'decimal.js';

export type ConfirmedRecipeSaleLink={productCode:string;recipeCode:string;saleUnit:string;outputUnit:string;quantity:string;evidence:string};
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
function checkedLinks(links:ConfirmedRecipeSaleLink[]){
 if(!links.length||links.length>20||new Set(links.map(link=>link.productCode)).size!==links.length)throw new Error('Provide distinct confirmed product codes.');
 for(const link of links){
  if([link.productCode,link.recipeCode,link.saleUnit,link.outputUnit].some(value=>!value.trim()||value.length>50)||link.evidence.trim().length<5||link.evidence.length>2000||!/^\d{1,12}(?:\.\d{1,6})?$/.test(link.quantity)||new Decimal(link.quantity).lte(0))throw new Error('A confirmed product, recipe, units, positive ratio and evidence are required.');
 }
 return literal(JSON.stringify(links))+'::jsonb';
}

/** Owner-run data correction only. No cloud connection or actor impersonation. */
export function buildRecipeSaleLinkCorrection(date:string,links:ConfirmedRecipeSaleLink[]){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.startsWith('0000')||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('An explicit delivery/effective date YYYY-MM-DD is required.');
 const input=checkedLinks(links),day=literal(date)+'::date';
 return `-- CHIFAA: apply explicitly confirmed one-batch-per-sale recipe links.
-- Effective date: ${date}. Verify it matches the report delivery date.
-- Saved links apply from this date onward; they do not expire the next day.
-- The evidence field is an audit note, not a quantity calculation rule.
-- Run only in an authorized owner SQL Editor session. No schema migration.
-- Inserts missing dated links; existing different same-day links are refused.
-- Preserves recipes, material ratios, orders, stock and posted snapshots.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $correct_links$
declare item jsonb;product public.products;recipe public.recipe_versions;active record;same_day public.product_recipe_links;
 new_link public.product_recipe_links;unit_code text;needs jsonb;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170011);
 perform pg_advisory_xact_lock(170025);
 perform private.assert_open(${day});
 for item in select value from jsonb_array_elements(${input}) loop
  select * into product from public.products where code=item->>'productCode' and not archived for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND: %',item->>'productCode';end if;
  if lower(btrim(product.sale_unit))<>lower(btrim(item->>'saleUnit')) then raise exception 'SALE_UNIT_MISMATCH: %',product.code;end if;
  select v.* into recipe from public.recipe_versions v join public.recipes r on r.id=v.recipe_id
   where r.code=item->>'recipeCode' and r.kind='product' and not r.archived and v.status='published' and v.effective_from<=${day}
   order by v.effective_from desc,v.revision desc limit 1 for update of v,r;
  if not found then raise exception 'PUBLISHED_RECIPE_REQUIRED: %',item->>'recipeCode';end if;
  select code into unit_code from public.material_units where id=recipe.output_unit_id;
  if lower(btrim(unit_code))<>lower(btrim(item->>'outputUnit')) or recipe.output_quantity<>(item->>'quantity')::numeric
   then raise exception 'CONFIRMED_BATCH_OUTPUT_MISMATCH: %',product.code;end if;
  select l.*,v.recipe_id,v.output_unit_id into active from public.product_recipe_links l join public.recipe_versions v on v.id=l.recipe_version_id
   where l.product_id=product.id and l.effective_from<=${day} and v.effective_from<=${day} and v.status='published'
   order by l.effective_from desc,v.revision desc limit 1;
  if active.id is not null then
   if active.recipe_id<>recipe.recipe_id then raise exception 'OTHER_RECIPE_LINK_REQUIRES_REVIEW: %',product.code;end if;
   if active.output_unit_id=recipe.output_unit_id and active.output_quantity_per_product=(item->>'quantity')::numeric then continue;end if;
  end if;
  select * into same_day from public.product_recipe_links where product_id=product.id and effective_from=${day} for update;
  if found then raise exception 'SAME_DAY_RECIPE_LINK_CONFLICT: %',product.code;end if;
  insert into public.product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from)
   values(product.id,recipe.id,(item->>'quantity')::numeric,${day}) returning * into new_link;
  insert into private.catalog_sources(entity,entity_id,source_hash,source_data)
   values('terms:recipe',new_link.id,'confirmed-sale-link:'||new_link.id::text,
    jsonb_build_object('date',${day},'evidence',item->>'evidence','recipe_version_id',recipe.id,
     'quantity',item->>'quantity','method','owner_sql_editor','sql_session_user',session_user));
  -- Match the commercial RPC's optimistic-version and cache invalidation contract.
  update public.products set updated_at=now() where id=product.id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,before_row,after_row)
   values(auth.uid(),'CONFIRMED_RECIPE_SALE_LINK','product_recipe_links',new_link.id,
    case when active.id is not null then to_jsonb(active) end,
    to_jsonb(new_link)||jsonb_build_object('evidence',item->>'evidence','method','owner_sql_editor',
     'sql_session_user',session_user,'previous_link_id',active.id,'product_code',product.code,'recipe_code',item->>'recipeCode'));
  needs=private.planning_needs(${day},jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity','1')));
  if exists(select 1 from jsonb_array_elements(needs) n where n->>'issue' in('PRODUCT_RECIPE_RATIO_REQUIRED','PUBLISHED_PRODUCT_RECIPE_REQUIRED'))
   then raise exception 'RECIPE_SALE_LINK_VALIDATION_FAILED: %',product.code;end if;
 end loop;
end $correct_links$;
commit;
select p.code,p.sale_unit,l.effective_from,l.output_quantity_per_product::text as output_per_sale,
 r.code as recipe_code,v.revision,u.code as output_unit,
 private.planning_needs(${day},jsonb_build_array(jsonb_build_object('product_id',p.id,'quantity','1'))) as one_sale_demand
from public.products p
join lateral(select l.* from public.product_recipe_links l join public.recipe_versions v on v.id=l.recipe_version_id
 where l.product_id=p.id and l.effective_from<=${day} and v.effective_from<=${day} and v.status='published'
 order by l.effective_from desc,v.revision desc limit 1) l on true
join public.recipe_versions v on v.id=l.recipe_version_id join public.recipes r on r.id=v.recipe_id
join public.material_units u on u.id=v.output_unit_id
where p.code in(select value->>'productCode' from jsonb_array_elements(${input})) order by p.code;
`;
}

export function buildRecipeSaleLinkDiagnosis(links:ConfirmedRecipeSaleLink[]){
 const input=checkedLinks(links);
 return `-- CHIFAA read-only: inspect current links and report dates for confirmed products.
with expected as(select value item from jsonb_array_elements(${input})),dates as(
 select distinct o.delivery_date,p.id product_id from public.customer_orders o
 join public.customer_order_items i on i.order_id=o.id and i.cancelled_at is null
 join public.products p on p.id=i.product_id join expected e on p.code=e.item->>'productCode'
 where o.status in('approved','scheduled','fulfilled')
)
select p.code,p.sale_unit,d.delivery_date,l.effective_from link_from,l.output_quantity_per_product::text saved_ratio,
 r.code linked_recipe,v.status linked_status,v.effective_from recipe_from,u.code recipe_unit,
 e.item->>'quantity' confirmed_ratio,
 private.planning_needs(d.delivery_date,jsonb_build_array(jsonb_build_object('product_id',p.id,'quantity','1'))) one_sale_demand
from expected e join public.products p on p.code=e.item->>'productCode'
join dates d on d.product_id=p.id
left join lateral(select l.* from public.product_recipe_links l where l.product_id=p.id and l.effective_from<=d.delivery_date
 order by l.effective_from desc limit 1) l on true
left join public.recipe_versions v on v.id=l.recipe_version_id left join public.recipes r on r.id=v.recipe_id
left join public.material_units u on u.id=v.output_unit_id
order by d.delivery_date desc,p.code;
`;
}
