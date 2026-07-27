-- À la carte session packs

alter table public.workspaces
  add column if not exists sessions_remaining integer not null default 0,
  add column if not exists session_packs_purchased integer not null default 0;

comment on column public.workspaces.sessions_remaining is 'Prepaid à la carte distill sessions remaining';
comment on column public.workspaces.session_packs_purchased is 'Analytics: number of session packs purchased';
