-- BACKFILLED 2026-07-16: applied live on 2026-06-03, recovered verbatim from
-- supabase_migrations.schema_migrations. Historical record — do not edit.

-- 1) Crea automaticamente users + profiles quando un nuovo utente si registra in auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'customer')
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Permetti all'utente loggato di inserire la propria riga in profiles (fallback).
drop policy if exists "User inserts own profile" on public.profiles;
create policy "User inserts own profile" on public.profiles
  for insert with check (user_id = auth.uid());

-- 3) Permetti al cliente di inserire i messaggi delle proprie richieste.
drop policy if exists "User inserts own request_messages" on public.request_messages;
create policy "User inserts own request_messages" on public.request_messages
  for insert with check (
    request_id in (select id from public.requests where customer_id = auth.uid())
  );

-- 4) Permetti al cliente di inserire i collegamenti richiesta-professionista.
drop policy if exists "User inserts own request_professionals" on public.request_professionals;
create policy "User inserts own request_professionals" on public.request_professionals
  for insert with check (
    request_id in (select id from public.requests where customer_id = auth.uid())
  );

-- 5) Permetti al cliente di aggiornare lo stato delle proprie richieste (es. da draft a sent).
drop policy if exists "User updates own requests" on public.requests;
create policy "User updates own requests" on public.requests
  for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());
