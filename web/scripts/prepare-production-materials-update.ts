import fs from 'node:fs/promises';
import {buildProductionMaterialsUpdate} from '../lib/deploy/production-materials-update';
const patch=buildProductionMaterialsUpdate(await fs.readFile('../supabase/migrations/202611180028_production_materials.sql','utf8'));
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PATCH_SAN_XUAT_NGUYEN_LIEU_DEV.sql',patch);
console.log('Prepared output/CHIFAA_PATCH_SAN_XUAT_NGUYEN_LIEU_DEV.sql; cloudExecuted=false');
