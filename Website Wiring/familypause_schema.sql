-- ============================================================
-- FAMILYPAUSE — Supabase SQL Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── WORKSPACES ────────────────────────────────────────────────
-- One workspace = one family
create table workspaces (
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
  created_at    timestamptz default now()
);

-- ── WORKSPACE MEMBERS ─────────────────────────────────────────
-- Links user accounts to a workspace (Spence + Amanda share one)
create table workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text default 'member' check (role in ('owner', 'member')),
  display_name  text,
  joined_at     timestamptz default now(),
  unique(workspace_id, user_id)
);

-- ── SESSIONS ─────────────────────────────────────────────────
-- Each weekly meeting = one session row
create table sessions (
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

-- Auto-update updated_at on any change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Users can only see data from their own workspace

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table sessions enable row level security;

-- Workspaces: visible if you are a member
create policy "workspace_select" on workspaces
  for select using (
    id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_insert" on workspaces
  for insert with check (owner_id = auth.uid());

create policy "workspace_update" on workspaces
  for update using (owner_id = auth.uid());

-- Workspace members: see your own workspace's members
create policy "members_select" on workspace_members
  for select using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "members_insert" on workspace_members
  for insert with check (user_id = auth.uid());

-- Sessions: see/edit if you belong to that workspace
create policy "sessions_select" on sessions
  for select using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "sessions_insert" on sessions
  for insert with check (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

create policy "sessions_update" on sessions
  for update using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );

-- ── REALTIME ─────────────────────────────────────────────────
-- Enable realtime on sessions so both devices sync live
alter publication supabase_realtime add table sessions;

-- ── INVITE CODE FUNCTION ──────────────────────────────────────
-- Call this to join a workspace via invite link
create or replace function join_workspace_by_code(
  invite text,
  display text default 'Member'
)
returns uuid as $$
declare
  ws_id uuid;
begin
  select id into ws_id from workspaces where invite_code = invite;
  if ws_id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into workspace_members (workspace_id, user_id, role, display_name)
  values (ws_id, auth.uid(), 'member', display)
  on conflict (workspace_id, user_id) do nothing;
  return ws_id;
end;
$$ language plpgsql security definer;
