import fs from 'node:fs/promises';import {spawnSync}from'node:child_process';
try{const config=JSON.parse(await fs.readFile('.clasp.json','utf8'));if(!config.scriptId||config.rootDir!=='dist')throw new Error('Invalid clasp config');await fs.access('dist/Code.gs');}catch(_){console.error('Cần build và tạo .clasp.json với scriptId thật, rootDir: dist. Xem docs/CAI_DAT_GOOGLE.md.');process.exit(1);}
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['@google/clasp','push'],{stdio:'inherit',shell:process.platform==='win32'});process.exit(result.status??1);
