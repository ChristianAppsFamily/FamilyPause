-- Pre-signup lead capture, separate from auth.users / workspaces.
-- source stays flexible for later church / membership-org distribution.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  source text not null default 'plan_guide',
  created_at timestamptz not null default now(),
  constraint leads_email_source_key unique (email, source),
  constraint leads_source_format check (source ~ '^[a-z0-9_]{2,80}$')
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_source_idx on public.leads (source);

alter table public.leads enable row level security;

comment on table public.leads is 'Pre-signup captures (guide, waitlists, partners). Not auth users.';
comment on column public.leads.source is 'Flexible origin, e.g. plan_guide or plan_guide_church_partner_x.';
