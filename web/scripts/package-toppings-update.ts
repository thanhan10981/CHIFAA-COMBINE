import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildToppingsUpdate,toppingMigrations} from '../lib/deploy/toppings-update';

const migrations=await Promise.all(toppingMigrations.map(async name=>({name,sql:await fs.readFile(path.resolve('../supabase/migrations',name),'utf8')})));
const sql=buildToppingsUpdate(migrations),destination=path.resolve('../output/CHIFAA_TOPPINGS_081_083.sql');
await fs.mkdir(path.dirname(destination),{recursive:true});
await fs.writeFile(destination,sql,'utf8');
console.log(JSON.stringify({file:'output/CHIFAA_TOPPINGS_081_083.sql',sha256:createHash('sha256').update(sql).digest('hex'),cloudExecuted:false}));
