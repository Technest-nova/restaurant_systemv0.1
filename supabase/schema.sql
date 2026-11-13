-- Restaurant Profit Analyzer · Supabase schema (draft for the backend phase)
-- Mirrors src/lib/types.ts. One restaurant per auth user in the MVP.

create table public.restaurants (
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

create table public.delivery_platforms (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  platform text not null check (platform in ('deliveroo','uber_eats','just_eat')),
  enabled boolean not null default true,
  commission_pct numeric(5,2) not null default 30,
  fixed_fee_per_order numeric(10,2) not null default 0,
  primary key (restaurant_id, platform)
);

create table public.ingredients (
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

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  menu_price numeric(10,2) not null,
  delivery_price numeric(10,2),       -- null = menu_price * (1 + uplift)
  packaging_cost numeric(10,2),       -- null = restaurant default
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(12,3) not null,
  unit text not null check (unit in ('kg','g','l','ml','each')),
  waste_pct numeric(5,2) not null default 0
);

create table public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text not null check (source in ('generic','square')),
  file_name text not null,
  period_start date not null,
  period_end date not null,
  row_count int not null,
  created_at timestamptz not null default now()
);

create table public.sales_rows (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.sales_imports(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sale_date date not null,
  pos_name text not null,
  channel text not null check (channel in ('in_house','deliveroo','uber_eats','just_eat')),
  quantity numeric(10,2) not null,
  gross_sales numeric(12,2) not null
);
create index on public.sales_rows (restaurant_id, sale_date);

create table public.item_mappings (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  pos_name text not null,
  dish_id uuid references public.dishes(id) on delete cascade, -- null + ignored=true means "Ignore"
  ignored boolean not null default false,
  primary key (restaurant_id, pos_name)
);

create table public.scenario_notes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  status text not null check (status in ('trialing','active','past_due','canceled')) default 'trialing',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  paddle_customer_id text,
  paddle_subscription_id text,
  updated_at timestamptz not null default now()
);

-- Row level security: owners see only their restaurant's rows
alter table public.restaurants enable row level security;
create policy "own restaurant" on public.restaurants for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['delivery_platforms','ingredients','dishes','sales_imports','sales_rows','item_mappings','scenario_notes','subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid())) with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))', t);
  end loop;
end $$;

alter table public.recipe_lines enable row level security;
create policy "own rows" on public.recipe_lines for all
  using (dish_id in (select d.id from public.dishes d join public.restaurants r on r.id = d.restaurant_id where r.owner_id = auth.uid()))
  with check (dish_id in (select d.id from public.dishes d join public.restaurants r on r.id = d.restaurant_id where r.owner_id = auth.uid()));

-- subscriptions should only be written by the Paddle webhook (service role), so restrict client writes:
drop policy "own rows" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));
