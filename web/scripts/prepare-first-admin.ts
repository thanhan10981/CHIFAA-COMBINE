import fs from 'node:fs/promises';
import path from 'node:path';
import {buildFirstAdminSql} from '../lib/deploy/first-admin';

const position=process.argv.indexOf('--email');
const email=position<0?(process.argv.slice(2).find(value=>!value.startsWith('-'))??''):process.argv[position+1]??'';
const sql=buildFirstAdminSql(email);
const target=path.resolve('../output/CHIFAA_FIRST_ADMIN_DEV.sql');
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,sql,'utf8');
console.log(JSON.stringify({file:'output/CHIFAA_FIRST_ADMIN_DEV.sql',executedOnCloud:false,requiresSqlEditorOwner:true}));
