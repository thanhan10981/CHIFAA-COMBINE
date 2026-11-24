begin;
set local lock_timeout='5s';

-- private.record_change() is shared by these tables. It requires every audited
-- row to expose id, version, created_at/created_by and updated_at/updated_by.
-- The initial topping migration omitted part of that contract, so inserts
-- failed when a recipe save tried to record its selected toppings.
alter table public.recipe_topping_options
 add column if not exists id uuid default gen_random_uuid(),
 add column if not exists updated_at timestamptz not null default now(),
 add column if not exists updated_by uuid references auth.users(id);
update public.recipe_topping_options set id=gen_random_uuid() where id is null;
alter table public.recipe_topping_options alter column id set not null;
create unique index if not exists recipe_topping_options_id_key on public.recipe_topping_options(id);

alter table public.customer_order_item_toppings
 add column if not exists version bigint not null default 1 check(version>0),
 add column if not exists updated_at timestamptz not null default now(),
 add column if not exists updated_by uuid references auth.users(id);

commit;
