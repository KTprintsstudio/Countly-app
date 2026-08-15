-- Adds subscription plan tracking to each business.
-- Run in Supabase SQL Editor after reset_and_setup.sql

alter table businesses add column if not exists plan text not null default 'basic'
  check (plan in ('basic', 'standard', 'pro'));
