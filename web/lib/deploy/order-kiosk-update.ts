export const orderKioskMigrations = [
 '202611170021_kiosk_workflow.sql',
 '202611170022_workflow_guards.sql',
 '202611230061_order_settlement_returns.sql',
 '202611230062_public_order_review_guard.sql',
] as const;

type Migration = { name: string; sql: string };

/** Bundle the missing kiosk foundation and order updates for the existing schema. */
export function buildOrderKioskUpdate(migrations: Migration[]) {
 if (migrations.length !== orderKioskMigrations.length || migrations.some((item, index) => item.name !== orderKioskMigrations[index])) {
  throw new Error('Order kiosk update requires migrations 021, 022, 061 and 062 in order');
 }

 const sections = migrations.map(({ name, sql }) => {
  const text = sql.replace(/^\uFEFF/, '').trim();
  if (!/^begin\s*;/i.test(text) || !/commit\s*;$/i.test(text)) throw new Error(`Migration must be transaction wrapped: ${name}`);
  const body = text.replace(/^begin\s*;\s*/i, '').replace(/\s*commit\s*;$/i, '');
  if (/^\s*(?:begin|commit|rollback)\s*;/im.test(body)) throw new Error(`Unexpected transaction boundary: ${name}`);
  return `-- Migration: ${name}\n${body}`;
 });

 return `-- CHIFAA: install the missing kiosk workflow and order settlement update.
-- Target: existing database with migrations 056-060 present, order return-support
-- tables present, and kiosk_return_lots/kiosk_action/kiosk_report not installed.
-- On the user's only Supabase branch (main / PRODUCTION), this changes live schema.
-- Review the target and take a database backup before running. One transaction;
-- any error rolls back the whole package. SQL Editor does not update CLI migration history.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
do $guard$
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED'; end if;
 if to_regprocedure('public.stock_count_snapshot(uuid,date,text,integer)') is null then raise exception 'CHIFAA_BASE_SCHEMA_REQUIRED'; end if;
 if to_regprocedure('public.fulfill_order_delivery(uuid,bigint,uuid)') is null
  or to_regprocedure('public.order_delivery_detail(uuid)') is null
  or to_regprocedure('public.order_customer_summary(date)') is null
  or to_regprocedure('public.dashboard_summary(date)') is null
  or to_regprocedure('public.strategy_sales_breakdown(date,date)') is null then
  raise exception 'CHIFAA_ORDER_MIGRATIONS_056_060_REQUIRED';
 end if;
 if to_regclass('public.order_return_supports') is null or to_regclass('public.order_return_support_lines') is null
  or to_regclass('public.kiosk_sales') is null or to_regclass('public.kiosk_sale_items') is null then
  raise exception 'CHIFAA_ORDER_AND_KIOSK_BASE_REQUIRED';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='sales_documents' and column_name='delivery_id') then
  raise exception 'CHIFAA_ORDER_MIGRATION_060_REQUIRED';
 end if;
 if to_regclass('public.kiosk_return_lots') is not null
  or to_regprocedure('public.kiosk_action(text,uuid,bigint,date,jsonb,uuid)') is not null
  or to_regprocedure('public.kiosk_report(date,date,integer,integer)') is not null
  or to_regclass('public.order_return_credit_applications') is not null
  or to_regclass('public.order_revenue_adjustments') is not null
  or exists(select 1 from information_schema.columns where table_schema='public' and table_name='order_return_supports' and column_name='disposition')
  or exists(select 1 from information_schema.columns where table_schema='public' and table_name='sales_documents' and column_name='delivery_payment_method') then
  raise exception 'CHIFAA_ORDER_KIOSK_PATCH_PARTIAL_OR_ALREADY_APPLIED';
 end if;
end $guard$;
${sections.join('\n\n')}
commit;
`;
}
