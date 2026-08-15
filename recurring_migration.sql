-- Recurring transactions (Pro tier) — run in Supabase SQL Editor

create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null default 0,
  payee text,
  payment_method text not null default 'cash' check (payment_method in ('cash','mobile_money','bank','card','other')),
  day_of_month integer not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table recurring_expenses enable row level security;

create policy "recurring_expenses_own_business" on recurring_expenses
  for all using (business_id = auth_business_id());

-- Link generated expenses back to the template that created them,
-- so we never generate the same month's expense twice.
alter table expenses add column if not exists recurring_expense_id uuid references recurring_expenses(id) on delete set null;
