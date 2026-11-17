import fs from 'node:fs/promises';
const sql=(await fs.readFile('../supabase/migrations/202611170026_monthly_employee_allowances.sql','utf8')).trim().replace(/^begin;/,'').replace(/commit;$/,'');
const patch=`-- CHIFAA DEV 026: monthly employee allowances; run AFTER025.
-- One complete DO as postgres. No data re-import, no rewrite of historical wages/shifts.
do $patch026$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170026);
 if to_regclass('public.product_prices') is null then raise exception 'PATCH_025_REQUIRED';end if;
 if to_regclass('public.employee_monthly_allowances') is not null then raise exception 'PATCH_026_ALREADY_PRESENT';end if;
 execute $migration026$${sql}$migration026$;
end $patch026$;
`;
await fs.writeFile('../output/CHIFAA_PATCH_PHU_CAP_THANG_DEV.sql',patch);console.log('Prepared output/CHIFAA_PATCH_PHU_CAP_THANG_DEV.sql; cloudExecuted=false');
