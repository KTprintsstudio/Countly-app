-- Staff accounts (Standard tier) — run in Supabase SQL Editor

-- Update the signup trigger: if a new user's metadata contains
-- "joining_business_id", attach them to that business with the given role
-- instead of creating a brand new business for them.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
  joining_id text;
begin
  joining_id := new.raw_user_meta_data->>'joining_business_id';

  if joining_id is not null then
    insert into profiles (id, business_id, full_name, role)
    values (
      new.id,
      joining_id::uuid,
      new.raw_user_meta_data->>'full_name',
      coalesce(new.raw_user_meta_data->>'role', 'cashier')
    );
  else
    insert into businesses (name) values (coalesce(new.raw_user_meta_data->>'business_name', 'My Business'))
      returning id into new_business_id;

    insert into profiles (id, business_id, full_name, role)
    values (new.id, new_business_id, new.raw_user_meta_data->>'full_name', 'owner');
  end if;

  return new;
end;
$$;
