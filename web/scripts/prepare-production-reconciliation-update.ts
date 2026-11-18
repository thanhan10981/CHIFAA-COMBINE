import fs from 'node:fs/promises';
import {buildProductionReconciliationUpdate} from '../lib/deploy/production-reconciliation-update';
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PATCH_DOI_SOAT_SAN_XUAT_DEV.sql',buildProductionReconciliationUpdate(await fs.readFile('../supabase/migrations/202611180029_production_reconciliation.sql','utf8')));
console.log('Prepared output/CHIFAA_PATCH_DOI_SOAT_SAN_XUAT_DEV.sql; cloudExecuted=false');
