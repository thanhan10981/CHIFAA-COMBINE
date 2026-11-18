import fs from 'node:fs/promises';
import {buildInventoryUpdate} from '../lib/deploy/inventory-update';
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PATCH_KHO_NHAP_XUAT_DEV.sql',buildInventoryUpdate(await fs.readFile('../supabase/migrations/202611180030_inventory_workspace.sql','utf8')));
console.log('Prepared output/CHIFAA_PATCH_KHO_NHAP_XUAT_DEV.sql; cloudExecuted=false');
