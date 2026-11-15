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
