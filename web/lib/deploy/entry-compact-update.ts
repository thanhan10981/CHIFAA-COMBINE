export function buildEntryCompactUpdate(migration:string){
 const sql=migration.trim();if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 return `-- DEV033 AFTER032. Owner SQL Editor, run ENTIRE file. No physical history deletion.\ndo $patch033$ begin\n if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;\n perform pg_advisory_xact_lock(170032);\n if to_regclass('public.entry_journal') is null then raise exception 'PATCH_032_REQUIRED';end if;\n if to_regclass('public.entry_changes') is not null then raise exception 'PATCH_033_ALREADY_PRESENT';end if;\n execute $migration033$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration033$;\nend $patch033$;\nnotify pgrst,'reload schema';\nselect '033_READY' as status;\n`;
}
export function buildPromoteEntryCash(){return `-- DEV: promote the supplied historical cash rows already archived by032.
-- Original dates and amounts; no invented store/sale allocation or opening balance.
-- Deterministic journal IDs prevent reimport after an edit/delete.
do $cash033$ declare source record;account_id uuid;ledger_id uuid;row_id uuid;account_kind text;account_code text;direction text;cash_note text;begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regclass('public.entry_changes') is null then raise exception 'PATCH_033_REQUIRED';end if;
 perform pg_advisory_xact_lock(170032);
 for source in select * from private.entry_source_rows where source_key like 'v9LegacyCash:%' order by business_date,source_key loop
 row_id=md5('cash033:'||source.source_hash||':'||source.source_key)::uuid;
 if exists(select 1 from public.entry_journal where id=row_id) then continue;end if;
 if source.business_date is null or coalesce(source.payload->>'amount','')!~'^\\d{1,15}$' or(source.payload->>'amount')::bigint<=0 then raise exception 'INVALID_SOURCE_CASH';end if;
 account_kind=case source.payload->>'account' when 'Tiền mặt' then 'cash' when 'Ngân hàng' then 'bank' end;
 direction=case source.payload->>'type' when 'Thu' then 'in' when 'Chi' then 'out' end;
 if account_kind is null or direction is null then raise exception 'SOURCE_ACCOUNT_MAPPING_REQUIRED';end if;
 select case when count(*)=1 then min(id::text)::uuid end into account_id from public.bank_accounts where kind=account_kind and not archived;
 if account_id is null then
 account_code=case account_kind when 'cash' then 'LS-TM' else 'LS-NH' end;
 insert into public.bank_accounts(code,name,kind) values(account_code,source.payload->>'account',account_kind) on conflict(code) do update set code=excluded.code returning id into account_id;
 if not exists(select 1 from public.bank_accounts where id=account_id and kind=account_kind and not archived) then raise exception 'SOURCE_ACCOUNT_CONFLICT';end if;
 end if;
 cash_note=coalesce(source.payload->>'category','Thu chi')||' · '||coalesce(source.payload->>'note','');
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,note) values(account_id,source.business_date,direction,(source.payload->>'amount')::bigint,cash_note) returning id into ledger_id;
 insert into public.entry_journal(id,module,action,business_date,input,result) values(row_id,'cash','cash',source.business_date,jsonb_build_object('account_id',account_id,'category',case direction when 'in' then 'other_in' else 'other_out' end,'amount',source.payload->>'amount','note',cash_note,'source_hash',source.source_hash,'source_key',source.source_key),jsonb_build_object('id',ledger_id));
 end loop;
end $cash033$;
select '033_DATA_READY' as status;
`;}
