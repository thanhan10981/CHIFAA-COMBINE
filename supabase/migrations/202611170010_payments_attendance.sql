begin;
create function public.post_payment(p_store uuid,p_account uuid,p_date date,p_amount bigint,p_allocations jsonb,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; receipt uuid; allocation jsonb; debt public.receivables; paid numeric; allocated numeric; ledger uuid;
begin
 if not private.can('payments','approve') or not private.can('cash','create') or not private.can('receivables','edit') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'payment:post',jsonb_build_object('store',p_store,'account',p_account,'date',p_date,'amount',p_amount,'allocations',p_allocations,'note',p_note));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);
 if p_amount is null or p_amount<=0 or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)>200 then raise exception 'INVALID_PAYMENT';end if;
 select coalesce(sum((value->>'amount_vnd')::numeric),0) into allocated from jsonb_array_elements(p_allocations);
 if allocated<>p_amount then raise exception 'PAYMENT_ALLOCATION_REQUIRED';end if;
 -- Stable lock ordering prevents two concurrent receipts over-allocating a debt.
 perform 1 from public.receivables where id in(select (value->>'receivable_id')::uuid from jsonb_array_elements(p_allocations)) order by id for update;
 insert into public.payment_receipts(store_id,account_id,received_on,amount_vnd,status,note) values(p_store,p_account,p_date,p_amount,'posted',p_note) returning id into receipt;
 for allocation in select value from jsonb_array_elements(p_allocations) loop
  select * into strict debt from public.receivables where id=(allocation->>'receivable_id')::uuid;
  if debt.store_id<>p_store then raise exception 'DEBT_STORE_MISMATCH';end if;
  select coalesce(sum(a.amount_vnd),0) into paid from public.receipt_allocations a join public.payment_receipts r on r.id=a.receipt_id where a.receivable_id=debt.id and r.status='posted';
  if paid+(allocation->>'amount_vnd')::numeric>debt.amount_vnd+coalesce((select sum(amount_vnd) from public.debt_adjustments where receivable_id=debt.id),0) then raise exception 'DEBT_OVERPAYMENT';end if;
  insert into public.receipt_allocations(receipt_id,receivable_id,amount_vnd) values(receipt,debt.id,(allocation->>'amount_vnd')::bigint);
 end loop;
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,receipt_id,note) values(p_account,p_date,'in',p_amount,receipt,p_note) returning id into ledger;
 return private.finish_request(p_key,jsonb_build_object('receipt_id',receipt,'ledger_id',ledger,'amount_vnd',p_amount::text));
end $$;

create function public.post_attendance(p_employee uuid,p_start timestamptz,p_end timestamptz,p_break integer,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; employee public.employees; pay public.employee_pay_rates; shift_id uuid; department text; business_date date;
begin
 if not private.can('attendance','approve') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'attendance:post',jsonb_build_object('employee',p_employee,'start',p_start,'end',p_end,'break',p_break));if cached is not null then return cached;end if;
 business_date=(p_start at time zone 'Asia/Ho_Chi_Minh')::date;perform private.assert_open(business_date);
 perform pg_advisory_xact_lock(hashtextextended(p_employee::text,0));
 select * into strict employee from public.employees where id=p_employee and active;
 select code into department from public.departments where id=employee.department_id;
 if exists(select 1 from public.attendance_shifts s where s.employee_id=p_employee and s.status='posted' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'SHIFT_OVERLAP';end if;
 select * into pay from public.employee_pay_rates where employee_id=p_employee and effective_from<=business_date and(effective_to is null or effective_to>=business_date) order by effective_from desc limit 1;
 if pay.id is null then raise exception 'PAY_RATE_MISSING';end if;
 insert into public.attendance_shifts(employee_id,starts_at,ends_at,break_minutes,department_snapshot,status) values(p_employee,p_start,p_end,p_break,department,'posted') returning id into shift_id;
 insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,default_daily_allowance_vnd) values(shift_id,pay.hourly_vnd,pay.daily_allowance_vnd);
 -- Default allowance is snapshotted but not automatically paid: the owner must
 -- confirm whether it is per calendar day, business day or shift first.
 return private.finish_request(p_key,jsonb_build_object('shift_id',shift_id,'hours',((extract(epoch from(p_end-p_start))/60-p_break)/60)::text,'status','posted'));
end $$;
revoke all on function public.post_payment(uuid,uuid,date,bigint,jsonb,text,uuid),public.post_attendance(uuid,timestamptz,timestamptz,integer,uuid) from public;
grant execute on function public.post_payment(uuid,uuid,date,bigint,jsonb,text,uuid),public.post_attendance(uuid,timestamptz,timestamptz,integer,uuid) to authenticated;
commit;
