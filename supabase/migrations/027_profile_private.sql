-- 027: FIX privacy — sposta date_of_birth e terms_accepted_at fuori da
-- profiles, in una tabella privata.
--
-- Perché: la policy "Public reads professional profile names" (migration
-- 003) espone l'INTERA riga di profiles per chiunque sia professionista —
-- RLS è per riga, non per colonna. Aggiungendo date_of_birth a profiles
-- (migration 021/024), la data di nascita dei professionisti è diventata
-- leggibile da chiunque con la anon key. Verificato il 2026-07-18 con
-- `set role anon`: le date di nascita uscivano in chiaro.
--
-- Fix: profile_private con RLS stretta (ognuno legge solo la propria
-- riga; lo staff admin/cs legge tutto per la pagina Analisi). Nessuna
-- policy di insert/update: scrive solo il trigger handle_new_user
-- (security definer). Le colonne esposte vengono eliminate da profiles.
--
-- Idempotente: create if not exists, drop-then-create per policy/trigger,
-- insert con on conflict, drop column if exists.

create table if not exists public.profile_private (
  user_id uuid primary key references public.users (id) on delete cascade,
  date_of_birth date,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

drop policy if exists "User reads own private profile" on public.profile_private;
create policy "User reads own private profile" on public.profile_private
  for select using (user_id = (select auth.uid()));

drop policy if exists "Staff reads private profiles" on public.profile_private;
create policy "Staff reads private profiles" on public.profile_private
  for select using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role in ('admin', 'cs')
    )
  );

-- Migra i dati esistenti prima di eliminare le colonne.
insert into public.profile_private (user_id, date_of_birth, terms_accepted_at)
select p.user_id, p.date_of_birth, p.terms_accepted_at
from public.profiles p
where p.date_of_birth is not null or p.terms_accepted_at is not null
on conflict (user_id) do nothing;

-- Trigger di signup aggiornato: full_name resta in profiles, i dati
-- sensibili vanno in profile_private. Va sostituito PRIMA del drop delle
-- colonne, altrimenti ogni nuova iscrizione fallirebbe.
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

  insert into public.profile_private (user_id, date_of_birth, terms_accepted_at)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    case
      when nullif(new.raw_user_meta_data->>'terms_accepted_at', '') is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      else null
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rimuovi le colonne esposte.
alter table public.profiles drop column if exists date_of_birth;
alter table public.profiles drop column if exists terms_accepted_at;
