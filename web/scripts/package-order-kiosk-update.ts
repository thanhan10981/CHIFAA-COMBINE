import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildOrderKioskUpdate, orderKioskMigrations } from '../lib/deploy/order-kiosk-update';

const root = path.resolve('..');
const migrations = await Promise.all(orderKioskMigrations.map(async name => ({
 name,
 sql: await fs.readFile(path.join(root, 'supabase/migrations', name), 'utf8'),
})));
const sql = buildOrderKioskUpdate(migrations);
const destination = path.join(root, 'output/CHIFAA_PATCH_ORDER_KIOSK.sql');
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, sql, 'utf8');
console.log(JSON.stringify({
 file: 'output/CHIFAA_PATCH_ORDER_KIOSK.sql',
 migrations: orderKioskMigrations,
 sha256: createHash('sha256').update(sql).digest('hex'),
 cloudExecuted: false,
}));
