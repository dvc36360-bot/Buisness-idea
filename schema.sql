-- JACT Motorcycle database schema for Supabase.
-- Run the complete file in Supabase Dashboard > SQL Editor.
-- Public users can read active products and create booking/order requests.
-- Only users listed in admin_users can manage products, bookings and orders.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  service_type text not null,
  bike_make text not null,
  bike_model text,
  preferred_date date not null,
  preferred_time text,
  location text,
  details text not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  notes text,
  total numeric(10,2) not null default 0 check (total >= 0),
  status text not null default 'new'
    check (status in ('new','contacted','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.bookings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Admin membership is readable only by the signed-in user themselves.
drop policy if exists "Admins can read own membership" on public.admin_users;
create policy "Admins can read own membership" on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

-- Public catalogue: only active items. Admins can see all and manage everything.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
for select to anon, authenticated
using (active = true or exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products" on public.products
for insert to authenticated with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
drop policy if exists "Admins update products" on public.products;
create policy "Admins update products" on public.products
for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products" on public.products
for delete to authenticated using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- Public can submit a booking request; only admins can read/change requests.
drop policy if exists "Public can submit bookings" on public.bookings;
create policy "Public can submit bookings" on public.bookings
for insert to anon, authenticated with check (
  char_length(customer_name) between 1 and 100 and
  char_length(phone) between 5 and 30 and
  char_length(details) between 1 and 1500 and status = 'pending'
);
drop policy if exists "Admins manage bookings" on public.bookings;
create policy "Admins manage bookings" on public.bookings
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- Public can submit order headers and order lines; only admins can read/manage them.
drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders" on public.orders
for insert to anon, authenticated with check (
  char_length(customer_name) between 1 and 100 and
  char_length(customer_phone) between 5 and 30 and status = 'new'
);
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Public can add order items" on public.order_items;
create policy "Public can add order items" on public.order_items
for insert to anon, authenticated with check (
  exists (select 1 from public.orders o where o.id = order_id and o.status = 'new')
);
drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items" on public.order_items
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

grant select on public.products to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant insert on public.order_items to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select, update on public.bookings to authenticated;
grant select, update on public.orders to authenticated;
grant select, update, delete on public.order_items to authenticated;

-- IMPORTANT: create the admin user in Supabase Authentication > Users first.
-- Then run this query separately, replacing the email with JACT's authorised admin email:
-- insert into public.admin_users (user_id)
-- select id from auth.users where lower(email) = lower('JACT_ADMIN_EMAIL@example.com')
-- on conflict (user_id) do nothing;


-- Apply the upgrade migration below for new installations too.
-- JACT Motorcycle upgrade migration
-- Run once in Supabase Dashboard > SQL Editor.
-- Safe for the existing project: adds compatible booking fields and secures public order creation.

-- 1) Align booking fields with the public form and admin dashboard.
alter table public.bookings add column if not exists bike_make text;
alter table public.bookings add column if not exists bike_model text;
alter table public.bookings add column if not exists service_type text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='motorcycle'
  ) then
    execute 'update public.bookings set bike_make = motorcycle where bike_make is null and motorcycle is not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='service'
  ) then
    execute 'update public.bookings set service_type = service where service_type is null and service is not null';
    execute 'alter table public.bookings alter column service drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='motorcycle'
  ) then
    execute 'alter table public.bookings alter column motorcycle drop not null';
  end if;
end $$;

-- 2) Replace the old order status check with the new statuses.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in ('new','paid','in_progress','canceled','contacted','completed','cancelled'));

-- 3) Keep public catalogue reads simple; do not query admin_users from the anon policy.
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Admins can read all products" on public.products;

create policy "Public can read active products"
on public.products for select to anon, authenticated
using (active = true);

create policy "Admins can read all products"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid())
  )
);

-- 4) Public customers must not SELECT order records or insert arbitrary totals.
drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Public can add order items" on public.order_items;

revoke insert, select, update, delete on public.orders from anon;
revoke insert, select, update, delete on public.order_items from anon;
revoke insert on public.orders from authenticated;
revoke insert on public.order_items from authenticated;

grant select, update, delete on public.orders to authenticated;
grant select, update, delete on public.order_items to authenticated;
grant delete on public.bookings to authenticated;

-- 5) Create orders securely on the server using live catalogue prices.
create or replace function public.create_public_order(
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item_count integer;
  v_valid_count integer;
  v_total numeric(10,2);
begin
  if nullif(trim(p_customer_name), '') is null
     or char_length(trim(p_customer_name)) > 100 then
    raise exception 'Please enter a valid customer name.';
  end if;

  if nullif(trim(p_customer_phone), '') is null
     or char_length(trim(p_customer_phone)) > 30 then
    raise exception 'Please enter a valid phone number.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Your enquiry basket is empty.';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Your basket must contain between 1 and 50 items.';
  end if;

  select count(*), coalesce(sum(p.price * x.quantity), 0)
    into v_valid_count, v_total
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  join public.products p on p.id = x.product_id and p.active = true
  where x.quantity between 1 and 99;

  if v_valid_count <> v_item_count then
    raise exception 'One or more products are unavailable. Refresh the catalogue and try again.';
  end if;

  insert into public.orders(customer_name, customer_phone, notes, total, status)
  values (trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_notes), ''), v_total, 'new')
  returning id into v_order_id;

  insert into public.order_items(order_id, product_id, product_name, quantity, unit_price)
  select v_order_id, p.id, p.name, x.quantity, p.price
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  join public.products p on p.id = x.product_id and p.active = true
  where x.quantity between 1 and 99;

  return v_order_id;
end;
$$;

revoke all on function public.create_public_order(text,text,text,jsonb) from public;
grant execute on function public.create_public_order(text,text,text,jsonb) to anon, authenticated;

-- 6) Push subscription storage (server-side access only).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  role text not null,
  channel_id text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions add column if not exists channel_id text;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Confirm the existing policies still protect booking/order data.
