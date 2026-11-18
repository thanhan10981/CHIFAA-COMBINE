import fs from 'node:fs/promises';
import {buildEntryCompactUpdate,buildPromoteEntryCash} from '../lib/deploy/entry-compact-update';
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PATCH_NHAP_LIEU_GON_DEV.sql',buildEntryCompactUpdate(await fs.readFile('../supabase/migrations/202611180033_entry_compact_actions.sql','utf8')));
await fs.writeFile('../output/CHIFAA_AP_DUNG_DU_LIEU_THAT_DEV.sql',buildPromoteEntryCash());
console.log('Prepared DEV033 logic and cash promotion SQL; cloudExecuted=false');
