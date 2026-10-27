-- Per-item email reminders (Add to Calendar via ICS). Distinct from workspace weekly meeting nudges.

create table if not exists public.plan_item_reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  card_id text not null,
  title text not null,
  description text,
  event_date date not null,
  event_time text,
  date_only boolean not null default false,
  reminder_offset_minutes integer not null check (reminder_offset_minutes >= 0),
  remind_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'canceled')),
  sent_at timestamptz,
  last_error text,
  ics_uid text not null,
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_item_reminders is
  'Email reminders for kept plan items; remind_at is when Resend should send Add-to-Calendar mail.';
comment on column public.plan_item_reminders.reminder_offset_minutes is
  'Minutes before event start (0 = at start). All-day events use 09:00 Pacific as start.';
comment on column public.plan_item_reminders.access_token is
  'Public token for GET /api/calendar-ics without auth.';

create unique index if not exists plan_item_reminders_access_token_uidx
  on public.plan_item_reminders (access_token);

create index if not exists plan_item_reminders_pending_idx
  on public.plan_item_reminders (status, remind_at)
  where status = 'pending';

create index if not exists plan_item_reminders_workspace_idx
  on public.plan_item_reminders (workspace_id);

alter table public.plan_item_reminders enable row level security;

drop policy if exists "plan_reminders_select" on public.plan_item_reminders;
create policy "plan_reminders_select" on public.plan_item_reminders
  for select using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

drop policy if exists "plan_reminders_insert" on public.plan_item_reminders;
create policy "plan_reminders_insert" on public.plan_item_reminders
  for insert with check (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

-- Updates (sent/failed) and cron reads use the service role, which bypasses RLS.
