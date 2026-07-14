-- Elon-cut onboarding support + post-subscribe digital deck offer claims
-- Run in Supabase SQL Editor (or via migration tooling).

-- New workspaces: warm default name + owner-only people list
create or replace function create_owner_workspace(p_name text default 'Member')
returns workspaces as $$
declare
  ws workspaces;
  owner_name text := coalesce(nullif(trim(p_name), ''), 'Member');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into workspaces (name, owner_id, family_context)
    values (
      'Our Family',
      auth.uid(),
      jsonb_build_object(
        'people', jsonb_build_array(owner_name),
        'kids', '[]'::jsonb,
        'businesses', '[]'::jsonb,
        'categories', '["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health"]'::jsonb
      )
    )
    returning * into ws;
  insert into workspace_members (workspace_id, user_id, role, display_name)
    values (ws.id, auth.uid(), 'owner', owner_name)
    on conflict (workspace_id, user_id) do nothing;
  return ws;
end;
$$ language plpgsql security definer;

-- One-time $4.97 digital deck bump after Family/Pro checkout (24h, single parent session)
create table if not exists deck_offer_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_session_id text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists deck_offer_claims_workspace_idx on deck_offer_claims (workspace_id);

alter table deck_offer_claims enable row level security;

-- Service role (webhooks / edge) bypasses RLS; no client policies needed for claims.
