begin;
set local lock_timeout='5s';

-- recipe_detail already declares a PL/pgSQL row variable named `v` for the
-- selected recipe version. The topping query must not reuse `v` as a SQL
-- table alias or PostgreSQL reports SQLSTATE 42702 when the detail is read.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.recipe_detail(uuid,date)'::regprocedure) into definition;
 old_fragment='select v.* from public.recipe_versions v where v.recipe_id=tr.id and v.status='||quote_literal('published')||' and v.effective_from<=p_date order by v.effective_from desc,v.revision desc limit 1';
 new_fragment='select topping_version.* from public.recipe_versions topping_version where topping_version.recipe_id=tr.id and topping_version.status='||quote_literal('published')||' and topping_version.effective_from<=p_date order by topping_version.effective_from desc,topping_version.revision desc limit 1';
 if strpos(definition,old_fragment)>0 then
  execute replace(definition,old_fragment,new_fragment);
 elsif strpos(definition,new_fragment)=0 then
  raise exception 'RECIPE_TOPPING_DETAIL_ALIAS_PATCH_MISMATCH';
 end if;
end
$patch$;

commit;
