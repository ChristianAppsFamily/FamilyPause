-- Founding member offer: public config + workspace metadata

alter table public.workspaces
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '0'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "app_config_public_read" on public.app_config;
create policy "app_config_public_read" on public.app_config
  for select
  to anon, authenticated
  using (true);

insert into public.app_config (key, value)
values ('subscriber_count', '0'::jsonb)
on conflict (key) do nothing;

update public.app_config
set value = to_jsonb((
  select count(*)::int
  from public.subscriptions
  where active = true
    and plan in ('family', 'pro')
    and stripe_sub_id is not null
)),
updated_at = now()
where key = 'subscriber_count'
  and coalesce((value #>> '{}')::int, 0) = 0;

create or replace function public.increment_subscriber_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.app_config (key, value, updated_at)
  values ('subscriber_count', '1'::jsonb, now())
  on conflict (key) do update
    set value = to_jsonb(coalesce((public.app_config.value #>> '{}')::int, 0) + 1),
        updated_at = now()
  returning coalesce((value #>> '{}')::int, 0) into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_subscriber_count() from public;
grant execute on function public.increment_subscriber_count() to service_role;
