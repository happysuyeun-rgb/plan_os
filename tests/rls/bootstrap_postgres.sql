-- ONLY for disposable PostgreSQL CI database; NEVER run against Plan OS Supabase.
-- Minimal Supabase auth emulation sufficient to apply real migrations
-- 001..016 (017 DRAFT excluded) and to run the B-01 role/JWT matrices.
create role authenticated nologin;
create role anon nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Migrations 015/016 call auth.role() (present in real Supabase, absent in
-- plain PostgreSQL). Emulate it from the synthetic JWT claim used in tests.
create function auth.role()
returns text
language sql
stable
as $$
  select case
    when coalesce(current_setting('request.jwt.claim.role', true), '') <> ''
      then current_setting('request.jwt.claim.role', true)
    when coalesce(current_setting('request.jwt.claim.sub', true), '') <> ''
      then 'authenticated'
    else 'anon'
  end
$$;

grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.role() to authenticated, anon;
