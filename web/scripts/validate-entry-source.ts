import fs from 'node:fs/promises';
import {database} from '../tests/database-fixture';
import {extractDraftEntry,buildEntrySourceImport} from '../lib/deploy/draft-entry-source';
const filename=process.argv[2];if(!filename)throw new Error('HTML path required');
const source=extractDraftEntry(await fs.readFile(filename,'utf8')),archive=buildEntrySourceImport(source),db=await database();
try{
 await db.exec(archive.sql);await db.exec(archive.sql);
 const count=async(table:string)=>(await db.query<{n:number}>('select count(*)::integer n from '+table)).rows[0].n;
 const result={hash:source.hash,sourceRows:await count('private.entry_source_rows'),loans:await count('public.loans'),targets:await count('public.targets'),sales:await count('public.sales_documents'),cash:await count('public.cash_ledger'),attendance:await count('public.attendance_shifts'),stock:await count('public.inventory_movements'),replayPassed:true,cloudExecuted:false};
 if(result.loans!==2||result.cash!==0||result.sales!==0||result.attendance!==0||result.stock!==0)throw new Error('Unexpected source effects');
 await fs.writeFile('../output/nhap-lieu-import-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.close();}
