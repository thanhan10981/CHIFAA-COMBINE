import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
async function walk(dir){const entries=await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(dir+'/'+e.name):dir+'/'+e.name))).flat();}
const files=[...(await walk('src')),...(await walk('scripts')),...(await walk('tests'))].filter(f=>/\.(m?js)$/.test(f));
let failed=false;for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status){console.error(f,r.stderr);failed=true;}}
// Apps Script rejects logical assignment even when the local Node parser accepts it.
for(const f of files.filter(f=>f.startsWith('src/server/')||f.startsWith('src/shared/'))){if(/(?:\?\?|\|\||&&)=/.test(await fs.readFile(f,'utf8'))){console.error(f,'Apps Script: replace logical assignment with an explicit conditional');failed=true;}}
if(failed)process.exit(1);console.log('Syntax checked '+files.length+' JavaScript files.');
