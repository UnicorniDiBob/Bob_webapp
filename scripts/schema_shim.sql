-- Supabase platform shim: the pieces a hosted Supabase project provides before
-- any project migration runs. Not part of Bob's schema; only here so the repo's
-- files can be replayed on a bare Postgres.

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin noinherit createrole; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin noinherit; end if;
end $$;

create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists storage;
create schema if not exists extensions;
create schema if not exists graphql_public;
create schema if not exists realtime;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants ALL on public objects to anon/authenticated and relies on RLS
-- to restrict; default privileges make it apply to tables created later too.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- auth.users: only the columns Bob's migrations reference.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255),
  encrypted_password varchar(255),
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable
as $$ select nullif(current_setting('request.jwt.claim.role', true), '')::text $$;
create or replace function auth.email() returns text language sql stable
as $$ select nullif(current_setting('request.jwt.claim.email', true), '')::text $$;
create or replace function auth.jwt() returns jsonb language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

-- storage: buckets + objects, enough for bucket inserts and object policies.
create table if not exists storage.buckets (
  id text primary key, name text not null, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  public boolean default false, avif_autodetection boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(), metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language plpgsql stable
as $$ begin return (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1]; end $$;

-- supabase_realtime publication, referenced by 019.
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- migration history table, so a replay can record itself like the platform does.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
