import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildDevBootstrap} from '../lib/deploy/bootstrap';

const root=path.resolve('..');
const directory=path.join(root,'supabase/migrations');
const names=(await fs.readdir(directory)).filter(name=>name.endsWith('.sql')).sort();
const migrations=await Promise.all(names.map(async name=>({name,sql:await fs.readFile(path.join(directory,name),'utf8')})));
const sql=buildDevBootstrap(migrations);
const destination=path.join(root,'output/CHIFAA_SUPABASE_DEV.sql');
await fs.mkdir(path.dirname(destination),{recursive:true});
await fs.writeFile(destination,sql,'utf8');
console.log(JSON.stringify({file:'output/CHIFAA_SUPABASE_DEV.sql',migrations:names.length,sha256:createHash('sha256').update(sql).digest('hex'),freshDevOnly:true,cloudExecuted:false}));
