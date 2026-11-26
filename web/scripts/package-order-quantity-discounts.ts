import fs from 'node:fs/promises';
import {buildOrderQuantityDiscountsUpdate} from '../lib/deploy/order-quantity-discounts-update';
const links=await fs.readFile('../supabase/migrations/202611260091_persistent_store_order_links.sql','utf8');
const discounts=await fs.readFile('../supabase/migrations/202611260092_order_quantity_discounts.sql','utf8');
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_ORDER_LINKS_AND_DISCOUNTS.sql',buildOrderQuantityDiscountsUpdate(links,discounts));
console.log('Prepared output/CHIFAA_ORDER_LINKS_AND_DISCOUNTS.sql; no cloud SQL applied.');
