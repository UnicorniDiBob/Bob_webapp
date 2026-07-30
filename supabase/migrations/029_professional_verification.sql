-- 029: livelli di verifica dei professionisti (blocco 10).
--
-- Tre livelli, con etichette utente e nomi tecnici distinti:
--   'none'                → "Iscritto"  (nessun controllo)
--   'vat_verified'        → "Pro"       (P.IVA riscontrata attiva a una data)
--   'documents_verified'  → "Pro+"      (documenti e abilitazioni esaminati)
--
-- Perché nomi tecnici diversi dalle etichette: nel DB esiste già
-- professionals.subscription_tier con valori free/pro/business. Usare 'pro'
-- anche qui renderebbe il codice ambiguo (un pro può essere "Pro" di verifica
-- e "free" di abbonamento). Le etichette italiane vivono solo nella UI.
--
-- Relazione con professionals.verification_status (unverified/pending/verified),
-- che resta in uso per il flusso manuale dell'admin: quel campo indica se lo
-- staff ha approvato il profilo, questo indica QUALE controllo documentale è
-- stato superato. Il badge pubblico "Pro+" richiederà entrambi.
--
-- IMPORTANTE (privacy): la partita IVA di una ditta individuale è dato
-- personale. Sta quindi in tabella separata con RLS stretta, non in
-- professionals (che ha lettura pubblica ex migration 003). Pubblicamente si
-- espone solo il livello e la data, mai il numero.
--
-- Idempotente: create table if not exists, drop-then-create per policy.

-- 1) Dati e stato di verifica: una riga per professionista.
create table if not exists public.professional_verification (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  level text not null default 'none'
    check (level in ('none', 'vat_verified', 'documents_verified')),
  -- Dati fiscali dichiarati dal professionista (non pubblici).
  vat_number text,
  -- Esito dell'ultimo riscontro sulla P.IVA.
  vat_checked_at timestamptz,
  vat_active boolean,
  vat_holder_name text,
  -- Snapshot della risposta del fornitore dati, come prova di cosa risultava
  -- a quella data (senza questo il livello non è difendibile).
  vat_check_source text,
  vat_check_payload jsonb,
  -- Esito dell'esame documentale (livello Pro+).
  documents_checked_at timestamptz,
  documents_note text,
  updated_at timestamptz not null default now()
);

alter table public.professional_verification enable row level security;

create index if not exists professional_verification_level_idx
  on public.professional_verification (level);

-- Il professionista vede la propria riga (per sapere a che punto è).
drop policy if exists "Pro reads own verification" on public.professional_verification;
create policy "Pro reads own verification" on public.professional_verification
  for select using (
    professional_id in (
      select id from public.professionals where user_id = (select auth.uid())
    )
  );

-- Lo staff legge tutto (coda di verifica in admin).
drop policy if exists "Staff reads verification" on public.professional_verification;
create policy "Staff reads verification" on public.professional_verification
  for select using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role in ('admin', 'cs')
    )
  );

-- Nessuna policy di insert/update: si scrive solo da server (service role) o
-- tramite le funzioni sotto. Il professionista non può promuoversi da sé.

-- 2) Vista pubblica: espone SOLO livello e data, mai la partita IVA.
--    security_invoker=off (default per le viste) farebbe aggirare la RLS: qui
--    serve, perché il dato esposto è volutamente pubblico e minimale.
drop view if exists public.professional_verification_public;
create view public.professional_verification_public
with (security_invoker = off) as
select
  professional_id,
  level,
  case
    when level = 'documents_verified' then documents_checked_at
    when level = 'vat_verified' then vat_checked_at
    else null
  end as verified_at
from public.professional_verification;

grant select on public.professional_verification_public to anon, authenticated;

-- 3) Registro degli eventi di verifica: chi ha fatto cosa e quando.
--    Serve come prova (e per l'obbligo di motivazione verso i pro, Reg. P2B).
create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  event text not null
    check (event in ('vat_submitted', 'vat_check_ok', 'vat_check_failed',
                     'documents_submitted', 'level_granted', 'level_revoked')),
  from_level text,
  to_level text,
  note text,
  actor_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.verification_events enable row level security;

create index if not exists verification_events_professional_idx
  on public.verification_events (professional_id, created_at desc);

drop policy if exists "Staff reads verification events" on public.verification_events;
create policy "Staff reads verification events" on public.verification_events
  for select using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role in ('admin', 'cs')
    )
  );

drop policy if exists "Pro reads own verification events" on public.verification_events;
create policy "Pro reads own verification events" on public.verification_events
  for select using (
    professional_id in (
      select id from public.professionals where user_id = (select auth.uid())
    )
  );

-- 4) Backfill: una riga a livello 'none' per ogni professionista esistente,
--    così la UI non deve gestire il caso "riga assente".
insert into public.professional_verification (professional_id, level)
select p.id, 'none'
from public.professionals p
on conflict (professional_id) do nothing;

-- 5) Nuovi professionisti: riga creata automaticamente.
create or replace function public.create_professional_verification_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.professional_verification (professional_id, level)
  values (new.id, 'none')
  on conflict (professional_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_professional_created_verification on public.professionals;
create trigger on_professional_created_verification
  after insert on public.professionals
  for each row execute function public.create_professional_verification_row();
