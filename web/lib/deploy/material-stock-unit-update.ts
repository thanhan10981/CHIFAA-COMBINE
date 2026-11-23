export const materialStockUnitMigrations = [
 '202611230067_material_stock_unit_transition.sql',
 '202611230068_material_package_transition_inference.sql',
] as const;

type Migration = { name: string; sql: string };

/** Bundle the stock-unit transition and package inference migrations atomically. */
export function buildMaterialStockUnitUpdate(migrations: Migration[]) {
 if (migrations.length !== materialStockUnitMigrations.length || migrations.some((item, index) => item.name !== materialStockUnitMigrations[index])) {
  throw new Error('Material stock update requires migrations 067 and 068 in order');
 }

 const sections = migrations.map(({ name, sql }) => {
  const text = sql.replace(/^\uFEFF/, '').trim();
  if (!/^begin\s*;/i.test(text) || !/commit\s*;$/i.test(text)) throw new Error(`Migration must be transaction wrapped: ${name}`);
  const body = text.replace(/^begin\s*;\s*/i, '').replace(/\s*commit\s*;$/i, '');
  if (/^\s*(?:begin|commit|rollback)\s*;/im.test(body)) throw new Error(`Unexpected transaction boundary: ${name}`);
  return `-- Migration: ${name}\n${body}`;
 });

 return `-- CHIFAA: install stock-unit transitions and verified-package inference together.
-- Requires the material formula/package bridge schema from migrations 064-066.
-- SQL Editor does not update Supabase CLI migration history.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
do $guard$
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED'; end if;
 if to_regclass('public.material_resolutions') is null
  or to_regprocedure('public.resolve_material(uuid,bigint,date,jsonb,uuid)') is null
  or to_regprocedure('public.save_material_table(uuid,bigint,jsonb,uuid)') is null then
  raise exception 'CHIFAA_MATERIAL_BASE_SCHEMA_REQUIRED';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='material_resolutions' and column_name='formula_unit_id')
  or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='material_resolutions' and column_name='formula_quantity')
  or to_regprocedure('private.unit_conversion_factor_at(uuid,uuid,uuid,date)') is null then
  raise exception 'CHIFAA_MATERIAL_MIGRATIONS_064_065_REQUIRED';
 end if;
 if to_regprocedure('private.material_package_conversion_factor(uuid,uuid,uuid,uuid,numeric,boolean)') is null then
  raise exception 'CHIFAA_MATERIAL_MIGRATION_066_REQUIRED';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='material_resolutions' and column_name in ('stock_conversion_from_unit_id','stock_conversion_factor'))
  or to_regprocedure('private.material_stock_conversion_factor(uuid,uuid,uuid,date)') is not null
  or to_regprocedure('private.material_package_transition_factor(uuid,uuid,uuid,date,uuid,uuid,numeric,boolean)') is not null then
  raise exception 'CHIFAA_MATERIAL_STOCK_UPDATE_PARTIAL_OR_ALREADY_APPLIED';
 end if;
end
$guard$;
${sections.join('\n\n')}
commit;
`;
}
