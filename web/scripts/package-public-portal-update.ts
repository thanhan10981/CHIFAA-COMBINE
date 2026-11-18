import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildPublicPortalUpdate} from '../lib/deploy/public-portal-update';
const sql=buildPublicPortalUpdate(await fs.readFile('../supabase/migrations/202611180035_public_order_portal.sql','utf8'));
await fs.writeFile('../output/CHIFAA_PATCH_CONG_DAT_HANG_CONG_KHAI_DEV.sql',sql);
console.log(JSON.stringify({file:'output/CHIFAA_PATCH_CONG_DAT_HANG_CONG_KHAI_DEV.sql',sha256:createHash('sha256').update(sql).digest('hex'),cloudExecuted:false}));
