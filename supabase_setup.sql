-- ============================================================
-- FamilyPause — COMPLETE Supabase setup
-- Run this ONCE in the Supabase SQL Editor (Dashboard ▸ SQL Editor ▸ New query).
-- Safe to re-run: uses "if not exists" / "drop policy if exists" throughout.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── WORKSPACES (one workspace = one family) ───────────────────
create table if not exists workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My Family',
  invite_code   text unique not null default substring(gen_random_uuid()::text, 1, 8),
  owner_id      uuid references auth.users(id) on delete cascade,
  family_context jsonb default '{
    "people": ["Spence", "Amanda"],
    "kids": [],
    "businesses": [],
    "categories": ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health"]
  }'::jsonb,
  -- card-deck columns
  cards_unlocked       boolean default false,
  unlocked_deck_years  integer[] default '{}',
  deck_unlocked_at     timestamptz,
  created_at    timestamptz default now()
);

-- ── WORKSPACE MEMBERS ─────────────────────────────────────────
create table if not exists workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text default 'member' check (role in ('owner', 'member')),
  display_name  text,
  joined_at     timestamptz default now(),
  unique(workspace_id, user_id)
);

-- ── SESSIONS (one weekly meeting = one row) ───────────────────
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  meeting_date  date not null default current_date,
  transcript    text,
  input_mode    text check (input_mode in ('record', 'paste')),
  cards         jsonb default '[]'::jsonb,
  status        text default 'review' check (status in ('input', 'processing', 'review', 'complete')),
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────
create table if not exists subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid references workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_sub_id      text,
  plan               text default 'free',
  trial_started_at   timestamptz default now(),
  trial_ends_at      timestamptz default now() + interval '7 days',
  active             boolean default true,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ── DECK CODES (physical/digital card-deck unlock) ────────────
create table if not exists deck_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  deck_year    integer default 2026,
  batch        text,
  redeemed_by  uuid references auth.users(id),
  redeemed_at  timestamptz,
  created_at   timestamptz default now()
);

-- ── updated_at trigger on sessions ────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists sessions_updated_at on sessions;
create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table sessions          enable row level security;
alter table subscriptions     enable row level security;
alter table deck_codes        enable row level security;

-- Workspaces
drop policy if exists "workspace_select" on workspaces;
create policy "workspace_select" on workspaces for select using (
  id in (select workspace_id from workspace_members where user_id = auth.uid())
);
drop policy if exists "workspace_insert" on workspaces;
create policy "workspace_insert" on workspaces for insert with check (owner_id = auth.uid());
drop policy if exists "workspace_update" on workspaces;
create policy "workspace_update" on workspaces for update using (
  id in (select workspace_id from workspace_members where user_id = auth.uid())
);
drop policy if exists "workspace_delete" on workspaces;
create policy "workspace_delete" on workspaces for delete using (owner_id = auth.uid());

-- Workspace members
-- NOTE: this policy is NON-recursive (user_id = auth.uid()). The original brief's
-- version queried workspace_members from inside its own policy, which Postgres
-- rejects with "infinite recursion detected in policy" and breaks login.
drop policy if exists "members_select" on workspace_members;
create policy "members_select" on workspace_members for select using (user_id = auth.uid());
drop policy if exists "members_insert" on workspace_members;
create policy "members_insert" on workspace_members for insert with check (user_id = auth.uid());

-- Sessions
drop policy if exists "sessions_select" on sessions;
create policy "sessions_select" on sessions for select using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);
drop policy if exists "sessions_insert" on sessions;
create policy "sessions_insert" on sessions for insert with check (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);
drop policy if exists "sessions_update" on sessions;
create policy "sessions_update" on sessions for update using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);

-- Subscriptions (members of the workspace)
drop policy if exists "subs_select" on subscriptions;
create policy "subs_select" on subscriptions for select using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);
drop policy if exists "subs_write" on subscriptions;
create policy "subs_write" on subscriptions for all using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);

-- Deck codes: any signed-in user may look up a code and redeem it
drop policy if exists "deck_select" on deck_codes;
create policy "deck_select" on deck_codes for select using (auth.role() = 'authenticated');
drop policy if exists "deck_update" on deck_codes;
create policy "deck_update" on deck_codes for update using (auth.role() = 'authenticated');

-- ── REALTIME on sessions (live spouse sync) ───────────────────
do $$ begin
  alter publication supabase_realtime add table sessions;
exception when duplicate_object then null; end $$;

-- ── join_workspace_by_code() — used by invite links ───────────
create or replace function join_workspace_by_code(invite text, display text default 'Member')
returns uuid as $$
declare ws_id uuid;
begin
  select id into ws_id from workspaces where invite_code = invite;
  if ws_id is null then raise exception 'Invalid invite code'; end if;
  insert into workspace_members (workspace_id, user_id, role, display_name)
  values (ws_id, auth.uid(), 'member', display)
  on conflict (workspace_id, user_id) do nothing;
  return ws_id;
end;
$$ language plpgsql security definer;

-- ── DEV: test deck-unlock code ────────────────────────────────
insert into deck_codes (code, deck_year, batch)
values ('FP-2026-TEST-0001', 2026, 'dev-test')
on conflict (code) do nothing;
