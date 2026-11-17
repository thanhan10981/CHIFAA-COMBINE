begin;
create function public.pay_loan(p_loan uuid,p_account uuid,p_date date,p_principal bigint,p_interest bigint,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; loan public.loans; already_paid numeric; payment uuid;
begin
 if not private.can('loans','approve') or not private.can('cash','create') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'loan:pay',jsonb_build_object('loan',p_loan,'account',p_account,'date',p_date,'principal',p_principal,'interest',p_interest));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);select * into strict loan from public.loans where id=p_loan for update;
 if p_principal is null or p_interest is null or p_principal<0 or p_interest<0 or p_principal+p_interest<=0 or p_date<loan.borrowed_on then raise exception 'INVALID_LOAN_PAYMENT';end if;
 select coalesce(sum(principal_vnd),0) into already_paid from public.loan_payments where loan_id=p_loan;
 if already_paid+p_principal>loan.principal_vnd then raise exception 'LOAN_PRINCIPAL_OVERPAYMENT';end if;
 insert into public.loan_payments(loan_id,paid_on,principal_vnd,interest_vnd) values(p_loan,p_date,p_principal,p_interest) returning id into payment;
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,loan_payment_id,note) values(p_account,p_date,'out',p_principal+p_interest,payment,'Trả gốc và lãi nhập tay');
 return private.finish_request(p_key,jsonb_build_object('payment_id',payment,'principal_vnd',p_principal::text,'interest_vnd',p_interest::text));
end $$;
create function public.post_expense(p_account uuid,p_date date,p_category text,p_amount bigint,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; expense uuid;
begin
 if not private.can('expenses','approve') or not private.can('cash','create') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'expense:post',jsonb_build_object('account',p_account,'date',p_date,'category',p_category,'amount',p_amount,'note',p_note));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);if p_amount is null or p_amount<0 or length(trim(coalesce(p_note,'')))<3 then raise exception 'INVALID_EXPENSE';end if;
 insert into public.expenses(spent_on,category,amount_vnd,note,status) values(p_date,p_category,p_amount,p_note,'posted') returning id into expense;
 if p_amount>0 then insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,expense_id,note) values(p_account,p_date,'out',p_amount,expense,p_note);end if;
 return private.finish_request(p_key,jsonb_build_object('expense_id',expense,'amount_vnd',p_amount::text));
end $$;
revoke all on function public.pay_loan(uuid,uuid,date,bigint,bigint,uuid),public.post_expense(uuid,date,text,bigint,text,uuid) from public;
grant execute on function public.pay_loan(uuid,uuid,date,bigint,bigint,uuid),public.post_expense(uuid,date,text,bigint,text,uuid) to authenticated;
commit;
