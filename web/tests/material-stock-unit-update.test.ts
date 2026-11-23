import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { database, asUser, identities } from './database-fixture';
import { buildMaterialStockUnitUpdate, materialStockUnitMigrations } from '../lib/deploy/material-stock-unit-update';

async function patch() {
 return buildMaterialStockUnitUpdate(await Promise.all(materialStockUnitMigrations.map(async name => ({
  name,
  sql: await fs.readFile('../supabase/migrations/' + name, 'utf8'),
 }))));
}

test('installs 067 and 068 atomically on a database with the 064-066 foundation', async () => {
 const db = await database('202611230066_material_unit_package_bridge.sql');
 try {
  const sql = await patch();
  await db.exec(sql);
  assert.notEqual((await db.query<{ factor: string | null }>("select to_regprocedure('private.material_stock_conversion_factor(uuid,uuid,uuid,date)')::text factor")).rows[0].factor, null);
  assert.notEqual((await db.query<{ factor: string | null }>("select to_regprocedure('private.material_package_transition_factor(uuid,uuid,uuid,date,uuid,uuid,numeric,boolean)')::text factor")).rows[0].factor, null);
  await assert.rejects(() => db.exec(sql), /CHIFAA_MATERIAL_STOCK_UPDATE_PARTIAL_OR_ALREADY_APPLIED/);
 } finally { await db.close(); }
});

test('verified old and new package ratios allow a blank stock transition factor', async () => {
 const db = await database('202611230066_material_unit_package_bridge.sql');
 try {
  await db.exec(await patch());
  const units = Object.fromEntries((await db.query<{ id: string; code: string }>("insert into material_units(code,name,dimension) values ('TEST-OLD-BAG','Túi','package'),('TEST-NEW-BAG','Bì','package'),('TEST-PIECE','Cái','count') returning id,code")).rows.map(row => [row.code, row.id]));
  const oldBag = units['TEST-OLD-BAG'], newBag = units['TEST-NEW-BAG'], piece = units['TEST-PIECE'];
  const material = (await db.query<{ id: string; version: string }>('insert into materials(code,name,purchase_unit_id,usage_unit_id) values(\'TEST-STOCK-INFERENCE\',\'Package inference\',$1,$1) returning id,version', [oldBag])).rows[0];
  await asUser(db, identities.admin, () => db.query('select resolve_material($1,$2,$3,$4::jsonb,$5)', [material.id, material.version, '2026-11-18', JSON.stringify({ purchase_unit_id: oldBag, usage_unit_id: oldBag, basis_unit_id: oldBag, verification: 'needs_verification', package_unit_id: oldBag, package_content_unit_id: piece, package_quantity: '200', package_verified: true, evidence: 'Previously verified package label', issue: '' }), crypto.randomUUID()]));
  const current = (await db.query<{ version: string }>('select version from materials where id=$1', [material.id])).rows[0];
  await asUser(db, identities.admin, () => db.query('select resolve_material($1,$2,$3,$4::jsonb,$5)', [material.id, current.version, '2026-11-23', JSON.stringify({ purchase_unit_id: newBag, usage_unit_id: newBag, basis_unit_id: newBag, verification: 'needs_verification', package_unit_id: newBag, package_content_unit_id: piece, package_quantity: '100', package_verified: true, stock_conversion_factor: null, formula_unit_id: null, formula_quantity: null, evidence: 'Verified new package label', issue: '' }), crypto.randomUUID()]));
  const saved = (await db.query<{ factor: string; from_unit: string }>('select stock_conversion_factor::text factor,stock_conversion_from_unit_id as from_unit from material_resolutions where material_id=$1 order by revision desc limit 1', [material.id])).rows[0];
  assert.equal(Number(saved.factor), 2);
  assert.equal(saved.from_unit, oldBag);
 } finally { await db.close(); }
});

test('preflight refuses missing migration 066 before applying either transition migration', async () => {
 const db = await database('202611230065_material_formula_specific_unit_conversion.sql');
 try {
  const sql = await patch();
  await assert.rejects(() => db.exec(sql), /CHIFAA_MATERIAL_MIGRATION_066_REQUIRED/);
  await db.exec('rollback');
  assert.equal((await db.query<{ present: number }>("select count(*)::int present from information_schema.columns where table_schema='public' and table_name='material_resolutions' and column_name='stock_conversion_factor'")).rows[0].present, 0);
 } finally { await db.close(); }
});

test('failed 068 patch rolls back the 067 transition schema as one update', async () => {
 const db = await database('202611230066_material_unit_package_bridge.sql');
 try {
  const sql = (await patch()).replace("old_fragment='if[[:space:]]+stock_factor[[:space:]]+is[[:space:]]+null[[:space:]]+then';", "old_fragment='DOES_NOT_MATCH';");
  await assert.rejects(() => db.exec(sql), /MATERIAL_PACKAGE_TRANSITION_RESOLVE_PATCH_MISMATCH/);
  await db.exec('rollback');
  assert.equal((await db.query<{ present: number }>("select count(*)::int present from information_schema.columns where table_schema='public' and table_name='material_resolutions' and column_name='stock_conversion_factor'")).rows[0].present, 0);
 } finally { await db.close(); }
});
