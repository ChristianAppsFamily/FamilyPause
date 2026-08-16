-- Allow the Vercel send-guide route to record a lead after a successful Resend
-- delivery, using the anon key already present on Vercel. Duplicate (email, source)
-- rows are skipped so a re-request only resends the guide.

create or replace function public.upsert_guide_lead(
  p_email text,
  p_first_name text default null,
  p_source text default 'plan_guide'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_source text := lower(trim(coalesce(nullif(p_source, ''), 'plan_guide')));
  v_first text := nullif(trim(coalesce(p_first_name, '')), '');
begin
  if v_email is null
    or length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email';
  end if;

  if v_source !~ '^[a-z0-9_]{2,80}$' then
    v_source := 'plan_guide';
  end if;

  if v_first is not null then
    v_first := left(v_first, 80);
  end if;

  insert into public.leads (email, first_name, source)
  values (v_email, v_first, v_source)
  on conflict (email, source) do update
    set first_name = coalesce(excluded.first_name, public.leads.first_name)
    where excluded.first_name is not null
      and excluded.first_name is distinct from public.leads.first_name;
end;
$$;

revoke all on function public.upsert_guide_lead(text, text, text) from public;
grant execute on function public.upsert_guide_lead(text, text, text) to anon, authenticated, service_role;
