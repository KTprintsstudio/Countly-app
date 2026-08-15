-- Suppliers (Standard tier) — run in Supabase SQL Editor after previous migrations

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);

create table supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  purchase_date date not null default current_date,
  notes text,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid')),
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;
alter table supplier_purchases enable row level security;

create policy "suppliers_own_business" on suppliers
  for all using (business_id = auth_business_id());

create policy "supplier_purchases_own_business" on supplier_purchases
  for all using (business_id = auth_business_id());
