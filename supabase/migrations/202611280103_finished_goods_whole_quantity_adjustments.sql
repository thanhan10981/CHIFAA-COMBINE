begin;
set local lock_timeout='5s';

alter table public.finished_goods_stock_adjustments
 add constraint finished_goods_stock_adjustments_after_quantity_integer
 check(after_quantity=trunc(after_quantity));

notify pgrst,'reload schema';
commit;
