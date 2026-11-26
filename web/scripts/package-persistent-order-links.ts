import fs from 'node:fs/promises';
import {buildPersistentOrderLinksUpdate} from '../lib/deploy/persistent-order-links-update';
const sql=await fs.readFile('../supabase/migrations/202611260091_persistent_store_order_links.sql','utf8');
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PERSISTENT_STORE_LINKS.sql',buildPersistentOrderLinksUpdate(sql));
console.log('Prepared output/CHIFAA_PERSISTENT_STORE_LINKS.sql; no cloud changes applied.');
