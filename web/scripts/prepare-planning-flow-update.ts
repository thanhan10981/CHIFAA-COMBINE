import fs from 'node:fs/promises';
import {buildPlanningFlowUpdate} from '../lib/deploy/planning-flow-update';
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PATCH_KE_HOACH_NHU_CAU_DEV.sql',buildPlanningFlowUpdate(await fs.readFile('../supabase/migrations/202611180031_plan_requirement_preview.sql','utf8')));
console.log('Prepared output/CHIFAA_PATCH_KE_HOACH_NHU_CAU_DEV.sql; cloudExecuted=false');
