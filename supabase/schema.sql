-- Phase 0: health-check table only. Run this in the Supabase SQL editor.
create table if not exists public.health_check (
  id bigint generated always as identity primary key,
  status text not null default 'ok',
  checked_at timestamptz not null default now()
);

-- Seed one row so /api/health has something to select.
insert into public.health_check (status)
select 'ok'
where not exists (select 1 from public.health_check);
