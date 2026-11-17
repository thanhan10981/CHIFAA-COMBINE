type Migration = {name:string; sql:string};

/** Fresh DEV only. Existing installations must use versioned CLI migrations. */
export function buildDevBootstrap(migrations:Migration[]) {
 if(!migrations.length) throw new Error('No migrations found');
 const names=new Set<string>();
 const sections=migrations.map(({name,sql})=>{
  if(!/^\d+_[a-z0-9_]+\.sql$/.test(name)||names.has(name)) throw new Error('Invalid or duplicate migration filename');
  names.add(name);
  let body=sql.replace(/^\uFEFF/,'').trim();
  body=body.replace(/^(?:--[^\n]*(?:\n|$)|\s)*/,'').trim();
  const wrapped=/^begin\s*;/i.test(body);
  if(wrapped) {
   if(!/commit\s*;$/i.test(body)) throw new Error(`Unmatched transaction: ${name}`);
   body=body.replace(/^begin\s*;\s*/i,'').replace(/\s*commit\s*;$/i,'');
  }
  if(/^\s*(?:begin|commit|rollback)\s*;/im.test(body)) throw new Error(`Unexpected transaction boundary: ${name}`);
  return `-- Migration: ${name}\n${body}`;
 });
 return `-- CHIFAA COMBINE: fresh Supabase DEV bootstrap only.
-- Run once in SQL Editor on the NEW DEV project. No historical data is imported.
-- One transaction: an error rolls back the entire installation.
-- SQL Editor does not register CLI migration history. Read ONLINE_DEPLOY.md before future db push.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
do $guard$
begin
 if to_regnamespace('private') is not null or to_regclass('public.profiles') is not null then
  raise exception 'CHIFAA_DEV_NOT_EMPTY: use versioned migrations; do not overwrite an existing installation';
 end if;
end $guard$;
${sections.join('\n\n')}
commit;
-- Structure only: accounts, Google OAuth and permissions still require setup.
`;
}
