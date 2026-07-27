-- Weekly FamilyPause reminder preferences (Pacific local day/time)

alter table public.workspaces
  add column if not exists reminder_day integer not null default 0
    check (reminder_day >= 0 and reminder_day <= 6),
  add column if not exists reminder_time text not null default '18:00';

comment on column public.workspaces.reminder_day is '0=Sunday .. 6=Saturday (Pacific local)';
comment on column public.workspaces.reminder_time is 'HH:MM 24h Pacific local, e.g. 18:00';

create index if not exists workspaces_reminder_idx
  on public.workspaces (reminder_day, reminder_time);
