import fs from 'node:fs/promises';
import {buildProductionPlanningFix} from '../lib/deploy/production-planning-fix';
const sql=await fs.readFile('../supabase/migrations/202611260093_production_planning_sources.sql','utf8');
await fs.mkdir('../output',{recursive:true});
await fs.writeFile('../output/CHIFAA_PRODUCTION_PLANNING_FIX.sql',buildProductionPlanningFix(sql));
console.log('Prepared output/CHIFAA_PRODUCTION_PLANNING_FIX.sql; no cloud SQL applied.');
