begin;
alter table public.employees alter column department_id drop not null;
alter table public.employees add column phone text, add column note text;
alter table public.employee_pay_rates add column allowance_confirmed boolean not null default false;
create table private.catalog_sources(entity text not null,entity_id uuid,source_hash text not null,source_data jsonb not null,recorded_at timestamptz not null default now(),unique(entity,entity_id,source_hash));
alter table private.catalog_sources enable row level security;

create table public.product_prices(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id),price_vnd bigint not null check(price_vnd>=0),effective_from date not null,evidence text not null check(length(trim(evidence))>=5),unique(product_id,effective_from),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create table public.store_discount_policies(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),effective_from date not null,common_rate numeric(8,6) not null check(common_rate between 0 and 1),enabled boolean not null default true,note text not null,evidence text not null check(length(trim(evidence))>=5),unique(store_id,effective_from),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create table public.store_discount_policy_items(
 id uuid primary key default gen_random_uuid(),policy_id uuid not null references public.store_discount_policies(id),product_id uuid not null references public.products(id),eligible boolean not null,override_rate numeric(8,6) check(override_rate between 0 and 1),unique(policy_id,product_id),check(eligible or override_rate is null),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
do $$declare tab text;begin
 foreach tab in array array['product_prices','store_discount_policies','store_discount_policy_items'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('create policy catalog_read on public.%I for select to authenticated using((select private.can(''prices'',''view'')))',tab);
  execute format('create trigger catalog_audit before insert or update or delete on public.%I for each row execute function private.record_change(''prices'')',tab);
  execute format('grant select on public.%I to authenticated',tab);
  insert into private.table_modules values(tab,'prices');
 end loop;
end $$;
create function private.commercial_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'TERMS_IMMUTABLE: append a new effective date';end $$;
create trigger price_immutable before update or delete on public.product_prices for each row execute function private.commercial_immutable();
create trigger policy_immutable before update or delete on public.store_discount_policies for each row execute function private.commercial_immutable();
create trigger policy_item_immutable before update or delete on public.store_discount_policy_items for each row execute function private.commercial_immutable();
create function private.product_unit_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.sale_unit is distinct from old.sale_unit and(exists(select 1 from public.customer_order_items where product_id=old.id) or exists(select 1 from public.sales_lines where product_id=old.id) or exists(select 1 from public.product_recipe_links where product_id=old.id)) then raise exception 'PRODUCT_UNIT_HAS_HISTORY';end if;
 return new;end $$;
create trigger product_unit_guard before update on public.products for each row execute function private.product_unit_guard();

-- Shared offer source for internal catalogues and portal order snapshots.
create function private.commercial_offer(p_store uuid,p_product uuid,p_date date) returns table(price_vnd bigint,discount_rate numeric) language sql stable security definer set search_path='' as $$
 select coalesce((select x.price_vnd from public.store_product_prices x where x.store_id=p_store and x.product_id=p_product and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1),(select x.price_vnd from public.product_prices x where x.product_id=p_product and x.effective_from<=p_date order by x.effective_from desc limit 1)),
 case when pol.id is not null then case when pol.enabled and item.eligible then coalesce(item.override_rate,pol.common_rate) else 0 end else coalesce((select x.rate from public.store_discounts x where x.store_id=p_store and x.product_id=p_product and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1),0) end
 from (select 1) seed left join lateral(select x.* from public.store_discount_policies x where x.store_id=p_store and x.effective_from<=p_date order by x.effective_from desc limit 1) pol on true left join public.store_discount_policy_items item on item.policy_id=pol.id and item.product_id=p_product;
$$;
create or replace function public.portal_catalog(p_store uuid,p_date date) returns table(product_id uuid,code text,name text,sale_unit text,price_vnd text,discount_rate text) language plpgsql stable security definer set search_path='' as $$begin
 if not private.owns_store(p_store) or p_date is null then raise exception 'FORBIDDEN';end if;
 return query select p.id,p.code,p.name,p.sale_unit,offer.price_vnd::text,offer.discount_rate::text from public.products p cross join lateral private.commercial_offer(p_store,p.id,p_date) offer where p.published and not p.archived and offer.price_vnd is not null order by p.code;
end $$;

create function public.commercial_catalog(p_kind text,p_date date,p_search text,p_status text,p_offset integer,p_limit integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare module text;result jsonb;total bigint;metrics jsonb;
begin
 module=case p_kind when 'stores' then 'stores' when 'products' then 'products' when 'employees' then 'employees' when 'discounts' then 'prices' end;
 if module is null or not private.can(module,'view') or(p_kind='discounts' and not private.can('stores','view')) then raise exception 'FORBIDDEN';end if;
 if p_date is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_search,''))>100 or coalesce(p_status,'') not in ('','active','inactive','missing') then raise exception 'INVALID_FILTER';end if;
 if p_kind in ('stores','discounts') then
  with data as(select s.*,pol.id policy_id,pol.effective_from,pol.common_rate::text,pol.enabled,pol.note policy_note,(select count(*) from public.store_discount_policy_items i where i.policy_id=pol.id and i.eligible)::text eligible_count from public.stores s left join lateral(select x.* from public.store_discount_policies x where x.store_id=s.id and x.effective_from<=p_date order by x.effective_from desc limit 1) pol on private.can('prices','view')),filtered as(select * from data where (coalesce(p_search,'')='' or strpos(lower(code||' '||name),lower(p_search))>0) and(case coalesce(p_status,'') when 'active' then active when 'inactive' then not active when 'missing' then policy_id is null else true end))
  select count(*),coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('version',x.version::text,'common_rate',case when private.can('prices','view') then x.common_rate else null end,'policy_id',case when private.can('prices','view') then x.policy_id else null end,'items',case when private.can('prices','view') then(select coalesce(jsonb_agg(jsonb_build_object('product_id',i.product_id,'eligible',i.eligible,'override_rate',i.override_rate::text)),'[]') from public.store_discount_policy_items i where i.policy_id=x.policy_id) else '[]'::jsonb end)) from(select * from filtered order by code,id offset p_offset limit p_limit) x),'[]') into total,result from filtered;
  select jsonb_build_object('total',count(*),'active',count(*) filter(where active),'missing',count(*) filter(where nullif(trim(address),'') is null),'policies',case when private.can('prices','view') then(select count(distinct store_id) from public.store_discount_policies where effective_from<=p_date) else null end) into metrics from public.stores;
 elsif p_kind='products' then
  with data as(select p.*,price.price_vnd::text,price.effective_from price_date,link.recipe_version_id,link.output_quantity_per_product::text from public.products p left join lateral(select x.* from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) price on private.can('prices','view') left join lateral(select x.* from public.product_recipe_links x where x.product_id=p.id and x.effective_from<=p_date order by x.effective_from desc limit 1) link on private.can('recipes','view')),filtered as(select * from data where(coalesce(p_search,'')='' or strpos(lower(code||' '||name),lower(p_search))>0) and(case coalesce(p_status,'') when 'active' then not archived when 'inactive' then archived when 'missing' then price_vnd is null else true end))
  select count(*),coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('version',x.version::text,'legacy_cost',case when private.can('materials','view') then(select source_data->>'cost' from private.catalog_sources where entity='products' and entity_id=x.id order by recorded_at desc limit 1) else null end)) from(select * from filtered order by code,id offset p_offset limit p_limit) x),'[]') into total,result from filtered;
  select jsonb_build_object('total',count(*),'active',count(*) filter(where not archived),'published',count(*) filter(where published and not archived),'missing',case when private.can('prices','view') then count(*) filter(where not exists(select 1 from public.product_prices x where x.product_id=p.id and x.effective_from<=p_date)) else null end) into metrics from public.products p;
 else
  with data as(select e.*,d.name department_name,pay.hourly_vnd::text,case when pay.allowance_confirmed then pay.daily_allowance_vnd::text else null end daily_allowance_vnd,pay.effective_from pay_date from public.employees e left join public.departments d on d.id=e.department_id left join lateral(select x.* from public.employee_pay_rates x where x.employee_id=e.id and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1) pay on private.can('payroll','view')),filtered as(select * from data where(coalesce(p_search,'')='' or strpos(lower(code||' '||name),lower(p_search))>0) and(case coalesce(p_status,'') when 'active' then active when 'inactive' then not active when 'missing' then department_id is null else true end))
  select count(*),coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('version',x.version::text)) from(select * from filtered order by code,id offset p_offset limit p_limit) x),'[]') into total,result from filtered;
  select jsonb_build_object('total',count(*),'active',count(*) filter(where active),'missing',count(*) filter(where department_id is null),'departments',count(distinct department_id)) into metrics from public.employees;
 end if;
 return jsonb_build_object('rows',result,'total',total::text,'metrics',metrics);
end $$;

create function public.save_commercial_catalog(p_kind text,p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;cached jsonb;base jsonb;
begin
 if p_kind not in ('stores','products','employees') or p_kind is null then raise exception 'INVALID_KIND';end if;
 if not private.can(p_kind,case when p_id is null then 'create' else 'edit' end) then raise exception 'FORBIDDEN';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or length(trim(coalesce(p_input->>'code','')))=0 or length(trim(coalesce(p_input->>'name','')))=0 or length(p_input->>'code')>50 or length(p_input->>'name')>250 then raise exception 'INVALID_FIELDS';end if;
 if p_kind='products' and coalesce((p_input->>'published')::boolean,false) and not exists(select 1 from public.products where id=p_id and published) and not private.can('products','approve') then raise exception 'FORBIDDEN_PUBLICATION';end if;
 if p_kind='employees' and(exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['code','name','department_id','active','phone','note'])) or length(coalesce(p_input->>'phone',''))>40 or length(coalesce(p_input->>'note',''))>2000) then raise exception 'INVALID_FIELDS';end if;
 cached=private.begin_request(p_key,'commercial:'||p_kind,jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170025);
 base=case when p_kind='employees' then p_input-'phone'-'note' else p_input end;
 result=public.save_catalog(p_kind,p_id,p_expected_version,base,gen_random_uuid());
 if p_kind='employees' then update public.employees set phone=nullif(trim(p_input->>'phone'),''),note=nullif(trim(p_input->>'note'),'') where id=(result->>'id')::uuid returning to_jsonb(employees.*) into result;end if;
 return private.finish_request(p_key,jsonb_build_object('id',result->>'id','version',result->>'version'));
end $$;

create function public.save_commercial_terms(p_kind text,p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare module text;tab text;cached jsonb;ver bigint;result uuid;day date;item jsonb;rate numeric;amount bigint;parent uuid;
begin
 module=case p_kind when 'pay' then 'payroll' when 'price' then 'prices' when 'store_price' then 'prices' when 'discount' then 'prices' when 'recipe' then 'recipes' end;
 tab=case p_kind when 'pay' then 'employees' when 'price' then 'products' when 'store_price' then 'stores' when 'discount' then 'stores' when 'recipe' then 'products' end;
 if module is null or not private.can(module,'create') or not private.can(module,'approve') or not private.can(tab,'view') then raise exception 'FORBIDDEN';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or length(trim(coalesce(p_input->>'evidence','')))<5 or length(p_input->>'evidence')>2000 or exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['date','evidence','amount','allowance','product_id','common_rate','enabled','note','items','recipe_version_id','quantity'])) then raise exception 'INVALID_FIELDS';end if;
 day=coalesce(nullif(p_input->>'date','')::date,'0001-01-01');if day<'0001-01-01'::date then raise exception 'INVALID_DATE';end if;
 if p_kind<>'discount' and nullif(p_input->>'date','') is null then raise exception 'DATE_REQUIRED';end if;
 cached=private.begin_request(p_key,'commercial-terms:'||p_kind,jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170025);
 execute format('select version from public.%I where id=$1 for update',tab) into ver using p_id;
 if ver is null or p_expected_version is null or ver<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if p_kind in ('price','store_price','pay') then
  if coalesce(p_input->>'amount','')!~'^[0-9]{1,15}$' then raise exception 'INVALID_MONEY';end if;amount=(p_input->>'amount')::bigint;
 end if;
 if p_kind='price' then insert into public.product_prices(product_id,price_vnd,effective_from,evidence) values(p_id,amount,day,p_input->>'evidence') returning id into result;
 elsif p_kind='store_price' then
  if not private.can('products','view') then raise exception 'FORBIDDEN';end if;
  insert into public.store_product_prices(store_id,product_id,price_vnd,effective_from) values(p_id,(p_input->>'product_id')::uuid,amount,day) returning id into result;
 elsif p_kind='pay' then
  if coalesce(p_input->>'allowance','')!~'^[0-9]{1,15}$' then raise exception 'INVALID_MONEY';end if;
  insert into public.employee_pay_rates(employee_id,hourly_vnd,daily_allowance_vnd,allowance_confirmed,effective_from) values(p_id,amount,(p_input->>'allowance')::bigint,true,day) returning id into result;
 elsif p_kind='recipe' then
  if not exists(select 1 from public.recipe_versions where id=(p_input->>'recipe_version_id')::uuid and status='published' and effective_from<=day) then raise exception 'PUBLISHED_RECIPE_REQUIRED';end if;
  if coalesce(p_input->>'quantity','')!~'^[0-9]+(\.[0-9]{1,6})?$' then raise exception 'INVALID_QUANTITY';end if;
  insert into public.product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values(p_id,(p_input->>'recipe_version_id')::uuid,(p_input->>'quantity')::numeric,day) returning id into result;
 else
  if not private.can('products','view') then raise exception 'FORBIDDEN';end if;
  if coalesce(p_input->>'common_rate','')!~'^[0-9]+(\.[0-9]{1,6})?$' then raise exception 'INVALID_RATE';end if;rate=(p_input->>'common_rate')::numeric;
  if jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items')>1000 then raise exception 'INVALID_ITEMS';end if;
  if exists(select 1 from jsonb_array_elements(p_input->'items') i where not exists(select 1 from public.products where id=(i->>'product_id')::uuid and not archived)) or (select count(distinct i->>'product_id') from jsonb_array_elements(p_input->'items') i)<>(select count(*) from public.products where not archived) or jsonb_array_length(p_input->'items')<>(select count(*) from public.products where not archived) then raise exception 'PRODUCT_LIST_CHANGED';end if;
  insert into public.store_discount_policies(store_id,effective_from,common_rate,enabled,note,evidence) values(p_id,day,rate,coalesce((p_input->>'enabled')::boolean,true),coalesce(p_input->>'note',''),p_input->>'evidence') returning id into result;
  for item in select * from jsonb_array_elements(p_input->'items') loop
   if jsonb_typeof(item->'eligible') is distinct from 'boolean' then raise exception 'INVALID_ITEMS';end if;
   insert into public.store_discount_policy_items(policy_id,product_id,eligible,override_rate) values(result,(item->>'product_id')::uuid,(item->>'eligible')::boolean,nullif(item->>'override_rate','')::numeric);
  end loop;
 end if;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('terms:'||p_kind,result,p_key::text,p_input);
 execute format('update public.%I set updated_at=now() where id=$1 returning version',tab) into ver using p_id;
 return private.finish_request(p_key,jsonb_build_object('id',result,'version',ver::text));
end $$;

create function public.commercial_history(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if p_kind='pay' then
  if not private.can('payroll','view') or not private.can('employees','view') then raise exception 'FORBIDDEN';end if;
  select jsonb_agg(to_jsonb(x)||jsonb_build_object('hourly_vnd',x.hourly_vnd::text,'daily_allowance_vnd',case when x.allowance_confirmed then x.daily_allowance_vnd::text else null end)) into result from(select * from public.employee_pay_rates where employee_id=p_id order by effective_from desc limit 100) x;
 elsif p_kind='price' then
  if not private.can('prices','view') or not private.can('products','view') then raise exception 'FORBIDDEN';end if;
  select jsonb_agg(to_jsonb(x)||jsonb_build_object('price_vnd',x.price_vnd::text)) into result from(select * from public.product_prices where product_id=p_id order by effective_from desc limit 100) x;
 elsif p_kind='store_price' then
  if not private.can('prices','view') or not private.can('stores','view') then raise exception 'FORBIDDEN';end if;
  select jsonb_agg(jsonb_build_object('id',x.id,'effective_from',x.effective_from,'price_vnd',x.price_vnd::text,'product',p.code||' · '||p.name)) into result from(select * from public.store_product_prices where store_id=p_id order by effective_from desc limit 100) x join public.products p on p.id=x.product_id;
 elsif p_kind='recipe' then
  if not private.can('recipes','view') or not private.can('products','view') then raise exception 'FORBIDDEN';end if;
  select jsonb_agg(to_jsonb(x)||jsonb_build_object('output_quantity_per_product',x.output_quantity_per_product::text,'recipe',r.code||' · '||r.name||' · Bản '||v.revision::text)) into result from(select * from public.product_recipe_links where product_id=p_id order by effective_from desc limit 100) x join public.recipe_versions v on v.id=x.recipe_version_id join public.recipes r on r.id=v.recipe_id;
 elsif p_kind='discount' then
  if not private.can('prices','view') then raise exception 'FORBIDDEN';end if;
  select jsonb_agg(to_jsonb(x)||jsonb_build_object('common_rate',x.common_rate::text,'items',(select jsonb_agg(jsonb_build_object('product',p.code||' · '||p.name,'eligible',i.eligible,'override_rate',i.override_rate::text)) from public.store_discount_policy_items i join public.products p on p.id=i.product_id where i.policy_id=x.id))) into result from(select * from public.store_discount_policies where store_id=p_id order by effective_from desc limit 100) x;
 else raise exception 'INVALID_KIND';end if;
 select coalesce(jsonb_agg(value||jsonb_build_object('evidence',coalesce(value->>'evidence',(select source_data->>'evidence' from private.catalog_sources where entity='terms:'||p_kind and entity_id=(value->>'id')::uuid order by recorded_at desc limit 1)))),'[]') into result from jsonb_array_elements(coalesce(result,'[]'));
 return result;end $$;

revoke all on function private.commercial_offer(uuid,uuid,date),private.commercial_immutable(),private.product_unit_guard() from public;
revoke all on function public.commercial_catalog(text,date,text,text,integer,integer),public.save_commercial_catalog(text,uuid,bigint,jsonb,uuid),public.save_commercial_terms(text,uuid,bigint,jsonb,uuid),public.commercial_history(text,uuid) from public;
grant execute on function public.commercial_catalog(text,date,text,text,integer,integer),public.save_commercial_catalog(text,uuid,bigint,jsonb,uuid),public.save_commercial_terms(text,uuid,bigint,jsonb,uuid),public.commercial_history(text,uuid) to authenticated;
commit;
