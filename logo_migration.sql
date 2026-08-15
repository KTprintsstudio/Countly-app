-- Run this AFTER schema.sql — adds logo support for each business.
-- Supabase → SQL Editor → New query → paste → Run

-- 1. Add a logo_url column to businesses
alter table businesses add column if not exists logo_url text;

-- 2. Create a storage bucket for logos (public so they display without extra auth)
insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do nothing;

-- 3. Storage policies: any logged-in user can upload/update only their OWN business's logo folder
create policy "logo_upload_own_business"
  on storage.objects for insert
  with check (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] = auth_business_id()::text
  );

create policy "logo_update_own_business"
  on storage.objects for update
  using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] = auth_business_id()::text
  );

create policy "logo_public_read"
  on storage.objects for select
  using (bucket_id = 'business-logos');
