export const kioskMigrations=['202611170021_kiosk_workflow.sql','202611170022_workflow_guards.sql'] as const;
export function buildKioskUpdate(migrations:{name:string;sql:string}[]){
 if(migrations.length!==kioskMigrations.length||migrations.some((item,index)=>item.name!==kioskMigrations[index]))throw new Error('Kiosk update requires migrations 021 and 022 in order');
 const sections=migrations.map(({name,sql})=>{
  const text=sql.trim();if(!/^begin\s*;/i.test(text)||!/commit\s*;$/i.test(text))throw new Error('Migration must be transaction wrapped');
  const body=text.replace(/^begin\s*;\s*/i,'').replace(/\s*commit\s*;$/i,'');
  if(/^\s*(?:begin|commit|rollback)\s*;/im.test(body))throw new Error('Unexpected transaction boundary');
  return '-- Migration: '+name+'\n'+body;
 });
 return `-- CHIFAA DEV: forward update AFTER the original 20-migration installation.
-- Run once as postgres in the existing DEV project's SQL Editor.
-- No business history is imported or overwritten. Do not rerun the fresh bootstrap.
-- SQL Editor does not register CLI history; reconcile before any future db push.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $guard$
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regprocedure('public.stock_count_snapshot(uuid,date,text,integer)') is null then raise exception 'CHIFAA_BASE_20_REQUIRED';end if;
 if to_regclass('public.kiosk_return_lots') is not null then raise exception 'CHIFAA_KIOSK_PATCH_ALREADY_APPLIED: use versioned migrations';end if;
end $guard$;
${sections.join('\n\n')}
commit;
`;
}
