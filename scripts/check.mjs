import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
async function walk(dir){const entries=await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(dir+'/'+e.name):dir+'/'+e.name))).flat();}
const files=[...(await walk('src')),...(await walk('scripts')),...(await walk('tests')),'verifier/server.mjs'].filter(f=>/\.(m?js)$/.test(f));
let failed=false;for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status){console.error(f,r.stderr);failed=true;}}
if(failed)process.exit(1);console.log('Syntax checked '+files.length+' JavaScript files.');
