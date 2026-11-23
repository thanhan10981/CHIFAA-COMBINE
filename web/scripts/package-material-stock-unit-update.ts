import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildMaterialStockUnitUpdate, materialStockUnitMigrations } from '../lib/deploy/material-stock-unit-update';

const root = path.resolve('..');
const migrations = await Promise.all(materialStockUnitMigrations.map(async name => ({
 name,
 sql: await fs.readFile(path.join(root, 'supabase/migrations', name), 'utf8'),
})));
const sql = buildMaterialStockUnitUpdate(migrations);
const destination = path.join(root, 'output/CHIFAA_PATCH_MATERIAL_STOCK_UNIT.sql');
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, sql, 'utf8');
console.log(JSON.stringify({
 file: 'output/CHIFAA_PATCH_MATERIAL_STOCK_UNIT.sql',
 migrations: materialStockUnitMigrations,
 prerequisiteMigrations: ['202611230064_material_formula_unit_conversion.sql', '202611230065_material_formula_specific_unit_conversion.sql', '202611230066_material_unit_package_bridge.sql'],
 sha256: createHash('sha256').update(sql).digest('hex'),
 cloudExecuted: false,
}));
