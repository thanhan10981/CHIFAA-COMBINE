import fs from 'node:fs/promises';
import {buildPromoteEntryCash} from '../lib/deploy/entry-compact-update';
import {database} from '../tests/database-fixture';
import {extractDraftEntry,buildEntrySourceImport} from '../lib/deploy/draft-entry-source';
const filename=process.argv[2];if(!filename)throw new Error('HTML path required');
const source=extractDraftEntry(await fs.readFile(filename,'utf8')),archive=buildEntrySourceImport(source),db=await database();
try{
 await db.exec(archive.sql);await db.exec(archive.sql);
 const promote=process.argv.includes('--promote-cash');if(promote){await db.exec(buildPromoteEntryCash());await db.exec(buildPromoteEntryCash());}
 const count=async(table:string)=>(await db.query<{n:number}>('select count(*)::integer n from '+table)).rows[0].n;
 const result={hash:source.hash,sourceRows:await count('private.entry_source_rows'),loans:await count('public.loans'),targets:await count('public.targets'),sales:await count('public.sales_documents'),cash:await count('public.cash_ledger'),attendance:await count('public.attendance_shifts'),stock:await count('public.inventory_movements'),replayPassed:true,cloudExecuted:false};
 if(result.loans!==2||result.cash!==(promote?(source.values.v9LegacyCash as unknown[]).length:0)||result.sales!==0||result.attendance!==0||result.stock!==0)throw new Error('Unexpected source effects');
 await fs.writeFile(promote?'../output/nhap-lieu-real-data-validation.json':'../output/nhap-lieu-import-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.close();}
