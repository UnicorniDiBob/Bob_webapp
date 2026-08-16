-- 052: onboarding professionista — nome/cognome separati, codici promo,
-- questionario post-iscrizione, documenti di verifica (10.2).
--
-- PERCHE', in quattro pezzi.
--
-- 1. NOME E COGNOME. Il form chiedeva un campo unico full_name: dati non
--    separabili (ordinamenti, fatturazione futura, cortesia "Ciao Mario").
--    Si aggiungono first_name/last_name; full_name RESTA e viene riempito
--    dal trigger, così nulla di esistente (admin, chat, prenotazioni) si
--    rompe. I vecchi utenti hanno solo full_name: va bene così, nessun
--    backfill inventato.
--
-- 2. CODICI PROMO. Il checkout Stripe non esiste ancora (M7/12.1): in beta
--    l'accesso ai piani a pagamento passa da un codice. Decisione di Lucio
--    del 14/08: un codice founder che concede tutto gratis, disattivabile.
--    La convalida avviene SOLO server-side (route con service role): le
--    policy qui sotto non danno alcun accesso ad anon/authenticated, e il
--    tier resta protetto dal trigger protect_professional_columns (il
--    service role lo bypassa perche' auth.uid() e' null).
--
-- 3. QUESTIONARIO. Dopo la scelta del piano, poche domande utili al match
--    (mestiere, citta'/zona, esperienza, come ci hai conosciuto). Base
--    giuridica: esecuzione del contratto (art. 6.1.b) per mestiere e zona,
--    che servono al servizio; legittimo interesse per heard_from (metrica
--    di canale, facoltativa). Retention: finche' l'account esiste; cancellati
--    a cascata con l'utente. Riga RoPA aggiunta in docs/legal/ROPA.md nello
--    stesso commit.
--
-- 4. DOCUMENTI DI VERIFICA (10.2). "Chiedi documenti" in coda admin e' [mig
--    038] un'azione vera ma il pro non aveva dove caricarli. Bucket PRIVATO
--    (mai public: regola DATA_COMPLIANCE), path per-utente, lettura solo
--    proprietario+staff. Retention: il file serve all'esame; alla decisione
--    resta come prova della verifica finche' il profilo esiste (stessa
--    durata di professional_verification), cancellazione a cascata con
--    l'account -- i file nel bucket vanno rimossi dal processo di
--    cancellazione account (documentato in ROPA, come per gli altri bucket).
--
-- Idempotente: add column if not exists, create table if not exists,
-- drop-then-create per policy e trigger, on conflict per i seed.

-- ---------------------------------------------------------------------------
-- 1. Nome e cognome separati
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

-- Trigger di signup: legge first_name/last_name e compone full_name.
-- Fallback sul vecchio full_name nei metadata per compatibilita' (deep link
-- vecchi, sessioni con la pagina precedente ancora aperta).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := nullif(new.raw_user_meta_data->>'first_name', '');
  v_last  text := nullif(new.raw_user_meta_data->>'last_name', '');
  v_full  text := nullif(new.raw_user_meta_data->>'full_name', '');
begin
  insert into public.users (id, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'customer')
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, first_name, last_name, full_name)
  values (
    new.id,
    v_first,
    v_last,
    coalesce(nullif(trim(coalesce(v_first, '') || ' ' || coalesce(v_last, '')), ''), v_full)
  )
  on conflict (user_id) do nothing;

  insert into public.profile_private (user_id, date_of_birth, terms_accepted_at, terms_version)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    case
      when nullif(new.raw_user_meta_data->>'terms_accepted_at', '') is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      else null
    end,
    nullif(new.raw_user_meta_data->>'terms_version', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Codici promo
-- ---------------------------------------------------------------------------

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  grants_tier text not null check (grants_tier in ('pro', 'business')),
  active boolean not null default true,
  max_uses integer,          -- null = illimitato
  used_count integer not null default 0,
  expires_at timestamptz,    -- null = non scade
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- Nessuna policy per anon/authenticated: il codice non e' enumerabile ne'
-- leggibile dal client. Convalida e redemption passano dal service role.
drop policy if exists "Staff manages promo codes" on public.promo_codes;
create policy "Staff manages promo codes" on public.promo_codes
  for all using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, user_id)  -- lo stesso codice una volta sola a testa
);

alter table public.promo_redemptions enable row level security;

drop policy if exists "Staff reads redemptions" on public.promo_redemptions;
create policy "Staff reads redemptions" on public.promo_redemptions
  for select using (private.is_admin_or_cs());

drop policy if exists "User reads own redemptions" on public.promo_redemptions;
create policy "User reads own redemptions" on public.promo_redemptions
  for select using (user_id = (select auth.uid()));

-- Il codice founder: tutto gratis, per sempre, finche' non lo disattivate
-- voi da admin (update active=false). Beta only.
insert into public.promo_codes (code, description, grants_tier, active)
values ('BOB-FOUNDER-2026', 'Codice founder beta: Bob Business gratis, revocabile', 'business', true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Questionario post-iscrizione
-- ---------------------------------------------------------------------------

create table if not exists public.onboarding_answers (
  user_id uuid primary key references public.users (id) on delete cascade,
  role text not null default 'professional',
  profession text,           -- mestiere/categoria dichiarata
  city text,                 -- citta' di lavoro dichiarata
  zone text,                 -- zona/quartiere, testo libero
  years_experience integer,
  heard_from text,           -- come ci hai conosciuto (facoltativo)
  chosen_plan text,          -- piano scelto all'onboarding (free/pro/business)
  created_at timestamptz not null default now()
);

alter table public.onboarding_answers enable row level security;

drop policy if exists "User inserts own answers" on public.onboarding_answers;
create policy "User inserts own answers" on public.onboarding_answers
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "User reads own answers" on public.onboarding_answers;
create policy "User reads own answers" on public.onboarding_answers
  for select using (user_id = (select auth.uid()));

drop policy if exists "Staff reads answers" on public.onboarding_answers;
create policy "Staff reads answers" on public.onboarding_answers
  for select using (private.is_admin_or_cs());

-- ---------------------------------------------------------------------------
-- 4. Documenti di verifica (10.2)
-- ---------------------------------------------------------------------------

create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  uploaded_by uuid not null references public.users (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  doc_type text,             -- es. visura, attestato, documento identita'
  status text not null default 'in_esame'
    check (status in ('in_esame', 'accettato', 'rifiutato')),
  review_note text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  uploaded_at timestamptz not null default now()
);

alter table public.verification_documents enable row level security;

drop policy if exists "Pro reads own documents" on public.verification_documents;
create policy "Pro reads own documents" on public.verification_documents
  for select using (
    professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  );

drop policy if exists "Pro uploads own documents" on public.verification_documents;
create policy "Pro uploads own documents" on public.verification_documents
  for insert with check (
    uploaded_by = (select auth.uid())
    and professional_id in (select id from public.professionals where user_id = (select auth.uid()))
  );

drop policy if exists "Staff reads documents" on public.verification_documents;
create policy "Staff reads documents" on public.verification_documents
  for select using (private.is_admin_or_cs());

drop policy if exists "Staff reviews documents" on public.verification_documents;
create policy "Staff reviews documents" on public.verification_documents
  for update using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

-- Bucket PRIVATO per i file. Path convention: <user_id>/<uuid>-<nome file>.
insert into storage.buckets (id, name, public)
values ('verifica-documenti', 'verifica-documenti', false)
on conflict (id) do nothing;

drop policy if exists "Pro uploads verification docs" on storage.objects;
create policy "Pro uploads verification docs" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verifica-documenti'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Pro reads own verification docs" on storage.objects;
create policy "Pro reads own verification docs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verifica-documenti'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Staff reads verification docs" on storage.objects;
create policy "Staff reads verification docs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verifica-documenti'
    and private.is_admin_or_cs()
  );
