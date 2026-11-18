import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildPublicOrderLinksUpdate} from '../lib/deploy/public-order-links-update';
const sql=buildPublicOrderLinksUpdate(await fs.readFile('../supabase/migrations/202611180036_store_order_links.sql','utf8'));
await fs.writeFile('../output/CHIFAA_PATCH_LINK_DIEM_BAN_DEV.sql',sql);
console.log(JSON.stringify({file:'output/CHIFAA_PATCH_LINK_DIEM_BAN_DEV.sql',sha256:createHash('sha256').update(sql).digest('hex'),cloudExecuted:false}));
