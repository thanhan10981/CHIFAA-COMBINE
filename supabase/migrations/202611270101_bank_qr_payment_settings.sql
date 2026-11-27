begin;
set local lock_timeout='5s';

alter table public.bank_accounts
 add column bank_bin text,
 add column account_number text,
 add column account_holder text;
alter table public.bank_accounts
 add constraint bank_accounts_qr_details_complete check(
  (bank_bin is null and account_number is null and account_holder is null)
  or (kind='bank' and bank_bin ~ '^[0-9]{6}$' and account_number ~ '^[A-Za-z0-9]{6,19}$' and length(trim(account_holder)) between 5 and 70)
 );

create function public.save_payment_bank_account(p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; result jsonb; current_version bigint;
begin
 if not private.can('admin','manage') then raise exception 'FORBIDDEN';end if;
 if p_id is null or p_key is null or jsonb_typeof(p_input)<>'object'
   or exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(array['bank_bin','account_number','account_holder'])))
   or not(p_input?'bank_bin' and p_input?'account_number' and p_input?'account_holder') then raise exception 'INVALID_PAYMENT_BANK_ACCOUNT';end if;
 if coalesce(p_input->>'bank_bin','') !~ '^[0-9]{6}$' or coalesce(p_input->>'account_number','') !~ '^[A-Za-z0-9]{6,19}$'
   or length(trim(coalesce(p_input->>'account_holder',''))) not between 5 and 70 then raise exception 'INVALID_PAYMENT_BANK_ACCOUNT';end if;
 cached=private.begin_request(p_key,'payment:bank-account',jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));
 if cached is not null then return cached;end if;
 select version into current_version from public.bank_accounts where id=p_id and kind='bank' for update;
 if current_version is null then raise exception 'BANK_ACCOUNT_NOT_FOUND';end if;
 if p_expected_version is null or p_expected_version<>current_version then raise exception 'VERSION_CONFLICT';end if;
 update public.bank_accounts set bank_bin=p_input->>'bank_bin',account_number=p_input->>'account_number',account_holder=trim(p_input->>'account_holder'),version=version+1,updated_at=now(),updated_by=auth.uid()
 where id=p_id returning to_jsonb(bank_accounts.*) into result;
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.save_payment_bank_account(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_payment_bank_account(uuid,bigint,jsonb,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
