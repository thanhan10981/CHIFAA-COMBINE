begin;
set local lock_timeout='5s';

-- A missing recipe-unit conversion blocks publication because the BOM cannot
-- be calculated safely. Include the exact material and units in the database
-- error so the editor can direct the owner to the resolution that is missing.
do $patch$
declare definition text;old_fragment text;new_fragment text;
begin
 select pg_get_functiondef('private.bom(uuid,numeric,date)'::regprocedure) into definition;
 old_fragment='material_id=r.material_id;quantity=private.recipe_convert_quantity_at(r.material_id,r.unit_id,unit_id,p_quantity*r.quantity/r.output_quantity,p_date);';
 new_fragment=$new$material_id=r.material_id;
   begin
    quantity=private.recipe_convert_quantity_at(r.material_id,r.unit_id,unit_id,p_quantity*r.quantity/r.output_quantity,p_date);
   exception when raise_exception then
    if SQLERRM='UNIT_NEEDS_VERIFICATION' then
     raise exception using message=format('UNIT_NEEDS_VERIFICATION|material=%s|from=%s|to=%s',
      (select m.code from public.materials m where m.id=r.material_id),
      (select u.code from public.material_units u where u.id=r.unit_id),
      (select u.code from public.material_units u where u.id=unit_id));
    end if;
    raise;
   end;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'RECIPE_BOM_UNIT_DIAGNOSTIC_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

commit;
