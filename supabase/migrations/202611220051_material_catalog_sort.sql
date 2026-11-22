begin;

-- Keep the existing RPC available for older clients. Build the ordered RPC
-- from its current definition so receipt pricing, scope checks and columns
-- stay identical as the catalog evolves.
do $upgrade$
declare definition text; function_start integer; returns_start integer;
begin
 select pg_get_functiondef('public.material_catalog(date,text,text,integer,integer)'::regprocedure) into definition;
 function_start=position('CREATE OR REPLACE FUNCTION public.material_catalog(' in definition);
 returns_start=position(' RETURNS jsonb' in definition);
 if function_start=0 or returns_start<=function_start then raise exception 'MATERIAL_CATALOG_SORT_SIGNATURE_MISMATCH';end if;
 definition=substr(definition,1,function_start-1)||
  'CREATE OR REPLACE FUNCTION public.material_catalog_sorted(p_date date, p_search text DEFAULT ''''::text, p_category text DEFAULT ''''::text, p_sort text DEFAULT ''default''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100)'||
  substr(definition,returns_start);

 definition=replace(definition,'if p_date is null or p_offset is null',
  'if p_date is null or p_sort is null or p_sort not in (''default'',''name_asc'',''name_desc'',''newest'',''oldest'') or p_offset is null');
 definition=replace(definition,'m.catalog_order,','m.catalog_order,m.created_at,');
 definition=replace(definition,
  $old$jsonb_agg(to_jsonb(page) order by page.catalog_order nulls last,page.code)$old$,
  $new$jsonb_agg(to_jsonb(page)-'created_at' order by
   case when p_sort='default' then page.catalog_order end nulls last,
   case when p_sort='name_asc' then lower(page.name) end asc,
   case when p_sort='name_desc' then lower(page.name) end desc,
   case when p_sort='newest' then page.created_at end desc,
   case when p_sort='oldest' then page.created_at end asc,
   page.code,page.id)$new$);
 definition=replace(definition,
  $old$order by m.catalog_order nulls last,m.code,m.id limit p_limit offset p_offset$old$,
  $new$order by
   case when p_sort='default' then m.catalog_order end nulls last,
   case when p_sort='name_asc' then lower(m.name) end asc,
   case when p_sort='name_desc' then lower(m.name) end desc,
   case when p_sort='newest' then m.created_at end desc,
   case when p_sort='oldest' then m.created_at end asc,
   m.code,m.id limit p_limit offset p_offset$new$);

 if definition not like '%p_sort is null%' or definition not like '%page.created_at%' or definition not like '%m.created_at%' or definition like '%jsonb_agg(to_jsonb(page) order by page.catalog_order nulls last,page.code)%' then raise exception 'MATERIAL_CATALOG_SORT_PATCH_FAILED';end if;
 execute definition;
end $upgrade$;

revoke all on function public.material_catalog_sorted(date,text,text,text,integer,integer) from public,anon;
grant execute on function public.material_catalog_sorted(date,text,text,text,integer,integer) to authenticated;

commit;
