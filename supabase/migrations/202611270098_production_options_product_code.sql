begin;
-- Include stable product codes for the shared menu display order.
-- Preserve the existing permission checks, recipe selection and grants.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.production_options(date)'::regprocedure) into definition;
 if position('''id'',p.id,''name'',p.name' in definition)=0 then
  raise exception 'PRODUCTION_OPTIONS_DEFINITION_CHANGED';
 end if;
 definition:=replace(definition,'''id'',p.id,''name'',p.name','''id'',p.id,''code'',p.code,''name'',p.name');
 execute definition;
end $$;
commit;
