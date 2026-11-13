-- Restaurant Profit Analyzer · full database setup
-- Safe to run more than once (idempotent). Paste into Supabase → SQL Editor → Run.
-- Creates tables, indexes, row-level security, and a trigger that provisions a
-- restaurant + 14-day trial + default delivery platforms for every new user.

/* ───────────── tables ───────────── */

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  country text not null check (country in ('UK','AU')) default 'UK',
  currency text not null check (currency in ('GBP','AUD')) default 'GBP',
  prices_include_tax boolean not null default true,
  tax_rate numeric(5,2) not null default 20,
  target_food_cost_pct numeric(5,2) not null default 30,
  packaging_cost_default numeric(10,2) not null default 0.45,
  avg_dishes_per_order numeric(4,2) not null default 1.5,
  delivery_price_uplift_pct numeric(5,2) not null default 15,
  report_day text not null default 'Mon',
  report_email text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_platforms (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  platform text not null check (platform in ('deliveroo','uber_eats','just_eat')),
  enabled boolean not null default true,
  commission_pct numeric(5,2) not null default 30,
  fixed_fee_per_order numeric(10,2) not null default 0,
  primary key (restaurant_id, platform)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  pack_size numeric(12,3) not null check (pack_size > 0),
  unit text not null check (unit in ('kg','g','l','ml','each')),
  pack_price numeric(10,2) not null check (pack_price >= 0),
  supplier text,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  menu_price numeric(10,2) not null,
  delivery_price numeric(10,2),
  packaging_cost numeric(10,2),
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(12,3) not null,
  unit text not null check (unit in ('kg','g','l','ml','each')),
  waste_pct numeric(5,2) not null default 0
);

create table if not exists public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text not null check (source in ('generic','square')),
  file_name text not null,
  period_start date not null,
  period_end date not null,
  row_count int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_rows (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.sales_imports(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sale_date date not null,
  pos_name text not null,
  channel text not null check (channel in ('in_house','deliveroo','uber_eats','just_eat')),
  quantity numeric(10,2) not null,
  gross_sales numeric(12,2) not null
);

create table if not exists public.item_mappings (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  pos_name text not null,
  dish_id uuid references public.dishes(id) on delete cascade,
  ignored boolean not null default false,
  primary key (restaurant_id, pos_name)
);

create table if not exists public.scenario_notes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  status text not null check (status in ('trialing','active','past_due','canceled')) default 'trialing',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  paddle_customer_id text,
  paddle_subscription_id text,
  updated_at timestamptz not null default now()
);

/* ───────────── indexes (FKs used by RLS + reads) ───────────── */

create index if not exists sales_rows_restaurant_date_idx on public.sales_rows (restaurant_id, sale_date);
create index if not exists sales_rows_import_idx on public.sales_rows (import_id);
create index if not exists recipe_lines_dish_idx on public.recipe_lines (dish_id);
create index if not exists recipe_lines_ingredient_idx on public.recipe_lines (ingredient_id);
create index if not exists ingredients_restaurant_idx on public.ingredients (restaurant_id);
create index if not exists dishes_restaurant_idx on public.dishes (restaurant_id);
create index if not exists sales_imports_restaurant_idx on public.sales_imports (restaurant_id);
create index if not exists item_mappings_dish_idx on public.item_mappings (dish_id);
create index if not exists scenario_notes_restaurant_idx on public.scenario_notes (restaurant_id);

/* ───────────── helper: current user's restaurant ids ───────────── */

create or replace function public.my_restaurant_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select id from public.restaurants where owner_id = (select auth.uid()) $$;

revoke all on function public.my_restaurant_ids() from public;
grant execute on function public.my_restaurant_ids() to authenticated;

/* ───────────── row level security ───────────── */

alter table public.restaurants enable row level security;
drop policy if exists "own restaurant" on public.restaurants;
create policy "own restaurant" on public.restaurants for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['delivery_platforms','ingredients','dishes','sales_imports','sales_rows','item_mappings','scenario_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (restaurant_id in (select public.my_restaurant_ids()))
         with check (restaurant_id in (select public.my_restaurant_ids()))', t);
  end loop;
end $$;

alter table public.recipe_lines enable row level security;
drop policy if exists "own rows" on public.recipe_lines;
create policy "own rows" on public.recipe_lines for all to authenticated
  using (dish_id in (select d.id from public.dishes d where d.restaurant_id in (select public.my_restaurant_ids())))
  with check (dish_id in (select d.id from public.dishes d where d.restaurant_id in (select public.my_restaurant_ids())));

-- Subscriptions are read-only for users. Only the server (secret key / Paddle webhook) writes them.
alter table public.subscriptions enable row level security;
drop policy if exists "own rows" on public.subscriptions;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select to authenticated
  using (restaurant_id in (select public.my_restaurant_ids()));

/* ───────────── provision new users ───────────── */

create or replace function public.provision_restaurant(p_user_id uuid, p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare rid uuid;
begin
  select id into rid from public.restaurants where owner_id = p_user_id;
  if rid is null then
    insert into public.restaurants (owner_id, report_email) values (p_user_id, p_email) returning id into rid;
  end if;

  insert into public.subscriptions (restaurant_id) values (rid) on conflict do nothing;

  insert into public.delivery_platforms (restaurant_id, platform, enabled, commission_pct, fixed_fee_per_order) values
    (rid, 'deliveroo', true, 30, 0),
    (rid, 'uber_eats', true, 30, 0.99),
    (rid, 'just_eat',  true, 14, 0.50)
  on conflict do nothing;

  return rid;
end $$;

revoke all on function public.provision_restaurant(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.provision_restaurant(new.id, new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Self-heal for signed-in users created before this trigger existed.
create or replace function public.ensure_my_restaurant()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
declare em text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select email into em from auth.users where id = uid;
  return public.provision_restaurant(uid, em);
end $$;

revoke all on function public.ensure_my_restaurant() from public, anon;
grant execute on function public.ensure_my_restaurant() to authenticated;

-- Backfill any users that already exist.
do $$
declare u record;
begin
  for u in select id, email from auth.users where id not in (select owner_id from public.restaurants) loop
    perform public.provision_restaurant(u.id, u.email);
  end loop;
end $$;

/* ───────────── table privileges ───────────── */

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.restaurants, public.delivery_platforms, public.ingredients, public.dishes, public.recipe_lines,
  public.sales_imports, public.sales_rows, public.item_mappings, public.scenario_notes
  to authenticated;
grant select on public.subscriptions to authenticated;
revoke all on all tables in schema public from anon;
