import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildMaterialTableUpdate} from '../lib/deploy/material-table-update';
const sql=buildMaterialTableUpdate(await fs.readFile('../supabase/migrations/202611180034_material_table_edit.sql','utf8'));
await fs.writeFile('../output/CHIFAA_PATCH_DANH_MUC_VAT_TU_GON_DEV.sql',sql);
console.log(JSON.stringify({file:'output/CHIFAA_PATCH_DANH_MUC_VAT_TU_GON_DEV.sql',sha256:createHash('sha256').update(sql).digest('hex'),cloudExecuted:false}));
