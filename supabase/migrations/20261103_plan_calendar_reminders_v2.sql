-- Plan Add-to-Calendar + email reminders v2
-- workspace timezone, dual recipients, kinds, attempts, claim RPC

alter table public.workspaces
  add column if not exists timezone text default 'America/Los_Angeles',
  add column if not exists reminder_emails_enabled boolean default true;

comment on column public.workspaces.timezone is
  'IANA timezone for plan item reminder send_at math and ICS TZID.';
comment on column public.workspaces.reminder_emails_enabled is
  'When false, plan-item reminder emails are not sent.';

-- Evolve plan_item_reminders
alter table public.plan_item_reminders
  add column if not exists recipient text not null default 'holder'
    check (recipient in ('holder', 'spouse')),
  add column if not exists kind text not null default 'reminder'
    check (kind in ('reminder', 'checkin')),
  add column if not exists attempts integer not null default 0,
  add column if not exists send_at timestamptz,
  add column if not exists reminder_choice text,
  add column if not exists added_to_calendar_at timestamptz,
  add column if not exists recurring boolean not null default false;

update public.plan_item_reminders
set send_at = remind_at
where send_at is null and remind_at is not null;

alter table public.plan_item_reminders
  alter column send_at set default now();

-- Backfill any remaining nulls
update public.plan_item_reminders
set send_at = coalesce(send_at, remind_at, now())
where send_at is null;

-- Accept both canceled spellings
alter table public.plan_item_reminders drop constraint if exists plan_item_reminders_status_check;
alter table public.plan_item_reminders
  add constraint plan_item_reminders_status_check
  check (status in ('pending', 'sent', 'failed', 'canceled', 'cancelled', 'claiming'));

create index if not exists plan_item_reminders_pending_send_at_idx
  on public.plan_item_reminders (status, send_at)
  where status = 'pending';

create index if not exists plan_item_reminders_card_pending_idx
  on public.plan_item_reminders (workspace_id, card_id)
  where status = 'pending';

-- Claim due rows with SKIP LOCKED (service role / security definer)
create or replace function public.claim_due_plan_reminders(batch_limit integer default 50)
returns setof public.plan_item_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.plan_item_reminders
    where status = 'pending'
      and send_at <= now()
      and attempts < 3
    order by send_at asc
    for update skip locked
    limit greatest(1, least(coalesce(batch_limit, 50), 200))
  ),
  claimed as (
    update public.plan_item_reminders r
    set
      status = 'claiming',
      attempts = r.attempts + 1,
      updated_at = now()
    from due
    where r.id = due.id
    returning r.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_due_plan_reminders(integer) from public;
grant execute on function public.claim_due_plan_reminders(integer) to service_role;

-- Optional pg_cron every 5 minutes (requires extensions; no-op if unavailable)
do $$
begin
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_net/pg_cron not available: %', sqlerrm;
end $$;

-- Cron job is documented in DEPLOY.md; operators set project URL + secret:
-- select cron.schedule(
--   'send-due-plan-reminders',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/send-due-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.reminder_cron_secret'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
