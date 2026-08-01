-- 038: rende utilizzabile il blocco 10 nella UI.
--
-- NOTA SULLA NUMERAZIONE E SULLA SOVRAPPOSIZIONE CON 036/037.
-- Questo file nasce come "034" ed è stato applicato in produzione il 31/07 con
-- quel nome. Nel frattempo, in parallelo, sono arrivate altre migrazioni:
--   * 034_customer_memory_retention e 034_terms_version (in repo)
--   * 035_services_grammatical_gender (in repo)
--   * 036_verification_badge_denormalize e 037_reconcile_verification_badge,
--     applicate in produzione ma SENZA file in repo (drift da sanare).
-- La 036 aveva introdotto un secondo badge parallelo (professionals.verified_at
-- con un proprio trigger); la 037 lo ha rimosso ed elegge come canoniche le
-- colonne dichiarate qui: verification_level e verification_level_at.
-- Quindi: questo file è rinumerato 038 per non collidere, ed è scritto per
-- essere autosufficiente e idempotente — un clone nuovo riproduce lo stato
-- attuale della produzione anche senza i file 036/037.
--
-- Tre cose, tutte conseguenza del fatto che ora la verifica diventa visibile:
--
-- 1) BADGE PUBBLICO SENZA VIEW "SECURITY DEFINER".
--    La migration 029 esponeva livello e data tramite la vista
--    professional_verification_public con security_invoker = off. Funziona, ma
--    l'advisor di sicurezza Supabase la segnala come ERROR (una vista che
--    aggira la RLS di chi interroga), ed era l'unico modo di leggere il dato
--    lato pubblico. Qui la sostituiamo con due colonne rispecchiate su
--    professionals — tabella che ha già lettura pubblica dalla 003 — tenute
--    aggiornate da un trigger. Il numero di partita IVA resta dove era, in
--    professional_verification con RLS stretta: pubblicamente si vedono solo
--    livello e data, come previsto.
--    Effetto collaterale utile: la card e il profilo pubblico non fanno più
--    nessuna query aggiuntiva per il badge.
--    Fonte di verità resta professional_verification; professionals porta una
--    copia in sola lettura per il pubblico.
--
-- 2) STATO DELLA REVISIONE UMANA.
--    Il VIES che non conferma apre un caso (mai un rifiuto automatico, art. 22
--    GDPR). Senza uno stato persistito quel caso resterebbe in coda per sempre
--    anche dopo l'esame, e il professionista non saprebbe mai com'è finito.
--    Le colonne vat_review_* tengono lo stato e la motivazione, che il pro può
--    leggere sulla propria riga: è anche l'obbligo di motivazione verso i
--    professionisti del Reg. UE 2019/1150 (P2B).
--
-- 3) DUE NUOVI EVENTI nel registro: documenti richiesti e rifiuto motivato.
--    Servono per non riciclare eventi dal significato diverso e mantenere il
--    registro leggibile come prova.
--
-- Retention (DATA_COMPLIANCE §5): i dati di verifica vivono quanto il profilo
-- attivo, più il periodo utile a difendersi da una contestazione sul livello
-- concesso; la cancellazione dell'account li porta via in cascata (on delete
-- cascade già presente dalla 029).
--
-- Idempotente: add column if not exists, drop-then-create per trigger e vincoli.

-- ---------------------------------------------------------------------------
-- 1. Colonne pubbliche su professionals (copia di sola lettura)
-- ---------------------------------------------------------------------------

alter table public.professionals
  add column if not exists verification_level text not null default 'none',
  add column if not exists verification_level_at timestamptz;

alter table public.professionals
  drop constraint if exists professionals_verification_level_check;
alter table public.professionals
  add constraint professionals_verification_level_check
  check (verification_level in ('none', 'vat_verified', 'documents_verified'));

-- Indice sul livello: serve a filtrare gli elenchi pubblici per livello senza
-- scansionare la tabella (creato dalla 036, dichiarato qui per il clone nuovo).
create index if not exists professionals_verification_level_idx
  on public.professionals (verification_level);

comment on column public.professionals.verification_level is
  'Copia pubblica del livello di verifica. Fonte di verità: professional_verification.level (sincronizzata da trigger). Non scrivere a mano.';
comment on column public.professionals.verification_level_at is
  'Data del riscontro che ha prodotto il livello: va mostrata accanto al badge, il livello da solo non è un''informazione onesta.';

-- Il pro non può promuoversi da sé: estendiamo il guardiano della 016.
-- Nota sul "auth.uid() is not null": il guardiano esiste per fermare gli
-- UTENTI, non i contesti server. Le scritture di servizio (service role,
-- trigger, manutenzione SQL) non hanno una sessione utente e devono passare,
-- altrimenti la sincronizzazione qui sotto sarebbe impossibile. Gli anonimi
-- non possono comunque aggiornare: la policy "Pro updates own profile"
-- richiede user_id = auth.uid().
create or replace function public.protect_professional_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin_or_cs() then
    if new.verification_status is distinct from old.verification_status
       or new.subscription_tier is distinct from old.subscription_tier
       or new.user_id is distinct from old.user_id
       or new.verification_level is distinct from old.verification_level
       or new.verification_level_at is distinct from old.verification_level_at then
      raise exception 'Non puoi modificare stato di verifica, livello, piano o proprietario del profilo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_professional_columns on public.professionals;
create trigger protect_professional_columns
  before update on public.professionals
  for each row execute function public.protect_professional_columns();

-- Sincronizzazione: professional_verification → professionals.
create or replace function public.sync_professional_verification_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.professionals p
     set verification_level = new.level,
         verification_level_at = case
           when new.level = 'documents_verified' then new.documents_checked_at
           when new.level = 'vat_verified' then new.vat_checked_at
           else null
         end
   where p.id = new.professional_id
     and (p.verification_level is distinct from new.level
          or p.verification_level_at is distinct from case
               when new.level = 'documents_verified' then new.documents_checked_at
               when new.level = 'vat_verified' then new.vat_checked_at
               else null
             end);
  return new;
end;
$$;

drop trigger if exists sync_verification_level on public.professional_verification;
create trigger sync_verification_level
  after insert or update on public.professional_verification
  for each row execute function public.sync_professional_verification_level();

-- Le funzioni di trigger non devono comparire come RPC: chiamate direttamente
-- fallirebbero, ma l'advisor le segnala (0028/0029) e la superficie esposta va
-- tenuta pulita. Vale anche per quella introdotta dalla 029.
-- Nota: serve revocare anche a PUBLIC, altrimenti il grant implicito resta e
-- anon/authenticated continuano a poterle eseguire (come fa già la 032).
revoke execute on function public.sync_professional_verification_level() from public, anon, authenticated;
revoke execute on function public.create_professional_verification_row() from public, anon, authenticated;

-- L'anonimo non ha niente da fare su queste due tabelle: la partita IVA e il
-- registro delle verifiche non sono dati pubblici. (Già fatto dalla 036, qui
-- dichiarato perché un clone nuovo non deve dipendere da un file mancante.)
revoke all on public.professional_verification from anon;
revoke all on public.verification_events from anon;

-- La policy di INSERT su professionals (018) vincolava stato di verifica e
-- piano, ma non poteva conoscere le colonne aggiunte qui: senza questo, un
-- professionista potrebbe creare il proprio profilo già a livello
-- "documents_verified". Oggi la catena dei trigger lo farebbe comunque
-- fallire, ma la difesa deve stare nella policy, non in un effetto collaterale.
drop policy if exists "Pro creates own profile" on public.professionals;
create policy "Pro creates own profile" on public.professionals
  for insert with check (
    user_id = (select auth.uid())
    and verification_status = 'unverified'
    and subscription_tier = 'free'
    and verification_level = 'none'
    and verification_level_at is null
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role = 'professional'
    )
  );

-- Allineamento dell'esistente (5 righe oggi, tutte a 'none': innocuo).
update public.professionals p
   set verification_level = v.level,
       verification_level_at = case
         when v.level = 'documents_verified' then v.documents_checked_at
         when v.level = 'vat_verified' then v.vat_checked_at
         else null
       end
  from public.professional_verification v
 where v.professional_id = p.id
   and (p.verification_level is distinct from v.level
        or p.verification_level_at is distinct from case
             when v.level = 'documents_verified' then v.documents_checked_at
             when v.level = 'vat_verified' then v.vat_checked_at
             else null
           end);

-- La vista non serve più: via, così cade anche il rilievo dell'advisor.
drop view if exists public.professional_verification_public;

-- ---------------------------------------------------------------------------
-- 2. Stato della revisione umana sui casi che il VIES non conferma
-- ---------------------------------------------------------------------------

alter table public.professional_verification
  add column if not exists vat_review_state text,
  add column if not exists vat_review_note text,
  add column if not exists vat_reviewed_at timestamptz,
  add column if not exists vat_reviewed_by uuid references public.users (id) on delete set null;

alter table public.professional_verification
  drop constraint if exists professional_verification_review_state_check;
alter table public.professional_verification
  add constraint professional_verification_review_state_check
  check (vat_review_state is null
         or vat_review_state in ('pending', 'docs_requested', 'rejected'));

comment on column public.professional_verification.vat_review_state is
  'null = niente in sospeso. pending = in coda per l''esame umano. docs_requested = chiesti documenti al pro. rejected = respinto con motivazione (sempre umano, mai automatico).';
comment on column public.professional_verification.vat_review_note is
  'Motivazione mostrata al professionista: obbligo di motivazione Reg. UE 2019/1150 (P2B). Scrivere per essere letti da lui, non da noi.';

-- Coda admin: indice sui soli casi aperti.
create index if not exists professional_verification_review_idx
  on public.professional_verification (vat_review_state, updated_at desc)
  where vat_review_state is not null;

-- ---------------------------------------------------------------------------
-- 3. Nuovi eventi nel registro delle verifiche
-- ---------------------------------------------------------------------------

alter table public.verification_events
  drop constraint if exists verification_events_event_check;
alter table public.verification_events
  add constraint verification_events_event_check
  check (event in ('vat_submitted', 'vat_check_ok', 'vat_check_failed',
                   'documents_submitted', 'documents_requested', 'vat_rejected',
                   'level_granted', 'level_revoked'));
