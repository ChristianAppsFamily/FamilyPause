-- ============================================================
-- FamilyPause — COMPLETE Supabase setup
-- Run this ONCE in the Supabase SQL Editor (Dashboard ▸ SQL Editor ▸ New query).
-- Safe to re-run: uses "if not exists" / "drop policy if exists" throughout.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Invite-code generator: FP-XXXX-XXXX (uppercase, no ambiguous chars) ───────
create or replace function gen_invite_code()
returns text as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I,O,0,1
  part text;
  i int;
begin
  part := '';
  for i in 1..8 loop
    if i = 5 then part := part || '-'; end if;
    part := part || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return 'FP-' || part;  -- e.g. FP-A8F3-K2M9
end;
$$ language plpgsql volatile;

-- ── WORKSPACES (one workspace = one family) ───────────────────
create table if not exists workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My Family',
  invite_code   text unique not null default gen_invite_code(),
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
drop policy if exists "sessions_delete" on sessions;
create policy "sessions_delete" on sessions for delete using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);

-- Subscriptions: members can read; only workspace owner can write
drop policy if exists "subs_select" on subscriptions;
create policy "subs_select" on subscriptions for select using (
  workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
);
drop policy if exists "subs_write" on subscriptions;
create policy "subs_write" on subscriptions for all using (
  workspace_id in (select id from workspaces where owner_id = auth.uid())
);

-- Deck codes: any authenticated user may look up a code; only the redeemer may update (must be unredeemed)
drop policy if exists "deck_select" on deck_codes;
create policy "deck_select" on deck_codes for select using (auth.role() = 'authenticated');
drop policy if exists "deck_update" on deck_codes;
create policy "deck_update" on deck_codes for update
  using (auth.role() = 'authenticated')
  with check (redeemed_by is null or redeemed_by = auth.uid());

-- ── REALTIME on sessions (live spouse sync) ───────────────────
do $$ begin
  alter publication supabase_realtime add table sessions;
exception when duplicate_object then null; end $$;

-- ── GRANTS (belt-and-suspenders; Supabase usually sets these) ─
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- ── create_owner_workspace() ──────────────────────────────────
-- Creates a workspace + owner membership in ONE server-side call.
-- SECURITY DEFINER so it bypasses the client-side RLS/grant timing issues
-- that otherwise cause "permission denied for table workspace_members" at signup.
create or replace function create_owner_workspace(p_name text default 'My Family')
returns workspaces as $$
declare ws workspaces;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into workspaces (name, owner_id)
    values (coalesce(nullif(p_name, ''), 'My Family') || '''s Family', auth.uid())
    returning * into ws;
  insert into workspace_members (workspace_id, user_id, role, display_name)
    values (ws.id, auth.uid(), 'owner', coalesce(nullif(p_name, ''), 'Member'))
    on conflict (workspace_id, user_id) do nothing;
  return ws;
end;
$$ language plpgsql security definer;

-- ── join_workspace_by_code() — used by invite links ───────────
-- Ensure EXISTING workspaces tables adopt the new FP-XXXX-XXXX default
-- (create-table-if-not-exists won't change an already-created column default).
alter table workspaces alter column invite_code set default gen_invite_code();

create or replace function join_workspace_by_code(invite text, display text default 'Member')
returns uuid as $$
declare ws_id uuid;
begin
  -- Case-insensitive match so FP-XXXX codes work whatever case the user typed
  -- (and old lowercase-hex codes still resolve).
  select id into ws_id from workspaces where upper(invite_code) = upper(trim(invite));
  if ws_id is null then raise exception 'Invalid invite code'; end if;
  insert into workspace_members (workspace_id, user_id, role, display_name)
  values (ws_id, auth.uid(), 'member', display)
  on conflict (workspace_id, user_id) do nothing;
  return ws_id;
end;
$$ language plpgsql security definer;

-- ── Faith Mode + Family Name columns (AI service v2) ─────────
-- Run once. Safe to re-run — IF NOT EXISTS guards are implicit via add column if not exists.
alter table workspaces
  add column if not exists faith_mode  boolean default false,
  add column if not exists family_name text,
  add column if not exists first_session_completed boolean default false,
  add column if not exists sounds_enabled boolean default true;

-- ── Performance indexes ───────────────────────────────────────
create index if not exists workspace_members_user_id_idx on workspace_members(user_id);
create index if not exists sessions_workspace_id_idx on sessions(workspace_id);

-- ── Google Calendar OAuth (per member) ─────────────────────────
alter table workspace_members
  add column if not exists google_calendar_token text,
  add column if not exists google_calendar_refresh_token text,
  add column if not exists google_calendar_connected_at timestamptz,
  add column if not exists google_calendar_email text;

drop policy if exists "members_update" on workspace_members;
create policy "members_update" on workspace_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── updated_at trigger on subscriptions ──────────────────────
drop trigger if exists subscriptions_updated_at on subscriptions;
create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

-- ── Stripe webhook idempotency ───────────────────────────────
create table if not exists stripe_webhook_events (
  id          text primary key,
  event_type  text not null,
  processed_at timestamptz default now()
);
alter table stripe_webhook_events enable row level security;
-- No client policies — service role only (edge function).

-- One subscription row per workspace (webhook upserts by workspace_id).
create unique index if not exists subscriptions_workspace_id_unique on subscriptions(workspace_id);

-- ── DEV: test deck-unlock code ────────────────────────────────
insert into deck_codes (code, deck_year, batch)
values ('FP-2026-TEST-0001', 2026, 'dev-test')
on conflict (code) do nothing;
