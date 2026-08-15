-- Goals (Pro tier) — run in Supabase SQL Editor

create table goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  goal_type text not null check (goal_type in ('sales', 'profit', 'expenses')),
  target_amount numeric(12,2) not null default 0,
  period_start date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now(),
  unique (business_id, goal_type, period_start)
);

alter table goals enable row level security;

create policy "goals_own_business" on goals
  for all using (business_id = auth_business_id());
