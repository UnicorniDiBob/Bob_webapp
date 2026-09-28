-- 100_termini_accettazioni.sql
--
-- LO STORICO DELLE ACCETTAZIONI DEI TERMINI (28/09, Lucio).
--
-- PERCHE'. Fino a oggi l'unica traccia di un'accettazione era
-- profile_private.terms_version + terms_accepted_at: una riga per utente,
-- sovrascrivibile, con l'ORA DICHIARATA DAL BROWSER (login/page.tsx mandava
-- new Date() nei metadati di signUp e handle_new_user la copiava). Non reggeva
-- come prova per tre motivi: l'ora la sceglieva il client; una seconda
-- accettazione avrebbe cancellato la prima; e la riga muore con l'account,
-- cioe' proprio quando la prova serve.
--
-- COSA FA
--   1) terms_acceptances: una riga per accettazione, sola aggiunta.
--   2) l'ora in profile_private la scrive il database, qualunque cosa mandi
--      il browser.
--   3) all'iscrizione la riga nello storico nasce da sola (trigger su
--      profile_private: handle_new_user non si tocca — e' stata ricreata cinque
--      volte, e riscriverla qui vorrebbe dire copiarne il corpo).
--   4) un'accettazione successiva (route /api/termini/accetta, service role)
--      aggiorna il puntatore in profile_private nello stesso gesto.
--   5) alla chiusura dell'account le righe RESTANO e ricevono la data di
--      chiusura; dieci anni dopo le cancella un giro mensile.
--
-- CONSERVAZIONE: FINO ALLA PRESCRIZIONE, NON A CASCATA (decisione di Lucio,
-- 28/09). La prova di cosa e' stato accettato serve soprattutto DOPO che
-- l'account e' chiuso: una contestazione arriva quando il rapporto e' finito.
-- Base: art. 17(3)(e) GDPR (accertamento, esercizio o difesa di un diritto in
-- sede giudiziaria); termine: dieci anni dalla chiusura, la prescrizione
-- ordinaria (art. 2946 c.c.), coerente con le fatture a dieci anni. Per questo
-- user_id NON ha una chiave esterna verso auth.users: con `on delete cascade`
-- la riga sparirebbe, con `set null` resterebbe una prova di niente. Dopo la
-- chiusura l'id da solo non identifica nessuno; torna a identificare solo
-- insieme ad altri registri che conserviamo per obbligo (dalla v3, le fatture).
-- Riga A25 del Registro dei trattamenti.
--
-- COSA NON FA. Non manda preavvisi, non fissa date di efficacia, non chiede
-- niente a nessuno: quelle sono decisioni, e vivono altrove
-- (src/lib/termini/registro.ts e il lavoro sul preavviso).
--
-- NESSUNA FUNZIONE SECURITY DEFINER. Non ne serve nessuna: i trigger girano
-- dentro handle_new_user (che e' gia' definer), dentro la cascata da
-- auth.users (che esegue come proprietario di public.users), o dalla route col
-- service role; la purga la lancia pg_cron come postgres.
--
-- Idempotente: create ... if not exists, drop-then-create per policy e
-- trigger, create or replace per le funzioni, backfill con guardia, cron
-- ripianificato solo se c'e' pg_cron.

begin;

-- ---------------------------------------------------------------------------
-- 1) Lo storico
-- ---------------------------------------------------------------------------
create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  audience text not null check (audience in ('customer', 'professional')),
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}-v[0-9]+$'),
  accepted_at timestamptz not null default now(),
  method text not null check (method in ('signup', 'dialog', 'backfill')),
  commit_sha text,
  effective_from timestamptz,
  account_closed_at timestamptz
);

comment on table public.terms_acceptances is
  'Storico delle accettazioni dei termini, sola aggiunta (mig 100, ROPA A25). Una riga per accettazione. Sopravvive alla chiusura dell''account: la cancella purga_accettazioni_termini() dieci anni dopo account_closed_at (art. 17(3)(e) GDPR, art. 2946 c.c.).';
comment on column public.terms_acceptances.user_id is
  'Nessuna chiave esterna, di proposito: la riga deve restare dopo la cancellazione dell''account. Vedi la testata della mig 100.';
comment on column public.terms_acceptances.accepted_at is
  'Ora del SERVER. Fa eccezione method = backfill: righe nate prima del 28/09/2026, con l''ora dichiarata dal browser, che non vale come prova.';
comment on column public.terms_acceptances.method is
  'signup = all''iscrizione (trigger su profile_private); dialog = accettazione successiva (route /api/termini/accetta); backfill = ricostruita il 28/09/2026 da profile_private.';
comment on column public.terms_acceptances.commit_sha is
  'Il commit online al momento dell''accettazione (VERCEL_GIT_COMMIT_SHA): dice quale testo esatto era servito. Nullo sulle righe signup e backfill, che nascono nel database.';
comment on column public.terms_acceptances.effective_from is
  'La data di efficacia che il registro dichiarava per quella versione al momento dell''accettazione, o null se non era ancora fissata. Accettare prima di quella data puo'' valere come rinuncia al preavviso (art. 3(2) Reg. UE 2019/1150): la riga lo deve poter dimostrare.';
comment on column public.terms_acceptances.account_closed_at is
  'Quando l''account e'' stato cancellato. Da qui corrono i dieci anni di conservazione.';

create index if not exists terms_acceptances_user_idx
  on public.terms_acceptances (user_id, accepted_at desc);
create index if not exists terms_acceptances_closed_idx
  on public.terms_acceptances (account_closed_at)
  where account_closed_at is not null;

-- ---------------------------------------------------------------------------
-- 2) Chi la legge, chi la scrive: nessuno dal browser
-- ---------------------------------------------------------------------------
alter table public.terms_acceptances enable row level security;

revoke all on public.terms_acceptances from anon, authenticated;
grant select on public.terms_acceptances to authenticated;

drop policy if exists "Terms acceptances readable by owner or staff" on public.terms_acceptances;
create policy "Terms acceptances readable by owner or staff"
  on public.terms_acceptances
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin_or_cs());

-- Sola aggiunta anche per chi scavalca la RLS (service role, SQL editor):
-- l'unica modifica ammessa e' la data di chiusura, una volta; l'unica
-- cancellazione quella a conservazione scaduta.
create or replace function public.terms_acceptances_sola_aggiunta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.account_closed_at is null
       and new.account_closed_at is not null
       and (to_jsonb(new) - 'account_closed_at') = (to_jsonb(old) - 'account_closed_at') then
      return new;
    end if;
    raise exception 'terms_acceptances e'' di sola aggiunta: si puo'' solo registrare la chiusura dell''account';
  end if;
  if old.account_closed_at is not null
     and old.account_closed_at < now() - interval '10 years' then
    return old;
  end if;
  raise exception 'terms_acceptances e'' di sola aggiunta: si cancella solo dieci anni dopo la chiusura dell''account';
end;
$$;

revoke execute on function public.terms_acceptances_sola_aggiunta() from public, anon, authenticated;

drop trigger if exists trg_terms_acceptances_sola_aggiunta on public.terms_acceptances;
create trigger trg_terms_acceptances_sola_aggiunta
  before update or delete on public.terms_acceptances
  for each row execute function public.terms_acceptances_sola_aggiunta();

-- ---------------------------------------------------------------------------
-- 3) L'ora dell'accettazione la scrive il database
-- ---------------------------------------------------------------------------
-- Qualunque cosa arrivi dai metadati di signUp. Su un aggiornamento l'ora
-- cambia solo insieme alla versione: nessuno sposta la data di un'accettazione
-- senza registrarne una nuova.
create or replace function public.profile_private_ora_termini()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.terms_accepted_at := case when new.terms_version is null then null else now() end;
  elsif new.terms_version is distinct from old.terms_version then
    new.terms_accepted_at := case when new.terms_version is null then null else now() end;
  else
    new.terms_accepted_at := old.terms_accepted_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.profile_private_ora_termini() from public, anon, authenticated;

drop trigger if exists trg_profile_private_ora_termini on public.profile_private;
create trigger trg_profile_private_ora_termini
  before insert or update on public.profile_private
  for each row execute function public.profile_private_ora_termini();

comment on column public.profile_private.terms_accepted_at is
  'Ora dell''ULTIMA accettazione dei termini. Dal 28/09/2026 (mig 100) la scrive il database; prima era dichiarata dal browser e non vale come prova. Lo storico probatorio e'' terms_acceptances.';

-- ---------------------------------------------------------------------------
-- 4) All'iscrizione la riga nello storico nasce da sola
-- ---------------------------------------------------------------------------
-- handle_new_user inserisce public.users PRIMA di profile_private, quindi il
-- ruolo qui c'e' gia'. Una versione malformata NON blocca l'iscrizione: la
-- riga nello storico semplicemente non nasce (e profile_private conserva la
-- stringa, per capire cosa e' successo). Un signUp che fallisce per un
-- controllo di formato sarebbe un guasto peggiore di una riga mancante.
create or replace function public.termini_accettati_all_iscrizione()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.terms_version is null
     or new.terms_version !~ '^[0-9]{4}-[0-9]{2}-v[0-9]+$' then
    return new;
  end if;
  insert into public.terms_acceptances (user_id, audience, version, accepted_at, method)
  select new.user_id,
         case when u.role = 'professional' then 'professional' else 'customer' end,
         new.terms_version,
         coalesce(new.terms_accepted_at, now()),
         'signup'
    from public.users u
   where u.id = new.user_id;
  return new;
end;
$$;

revoke execute on function public.termini_accettati_all_iscrizione() from public, anon, authenticated;

drop trigger if exists trg_termini_accettati_all_iscrizione on public.profile_private;
create trigger trg_termini_accettati_all_iscrizione
  after insert on public.profile_private
  for each row execute function public.termini_accettati_all_iscrizione();

-- ---------------------------------------------------------------------------
-- 5) Un'accettazione successiva aggiorna il puntatore nello stesso gesto
-- ---------------------------------------------------------------------------
create or replace function public.termini_aggiorna_puntatore()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.method = 'dialog' then
    update public.profile_private
       set terms_version = new.version
     where user_id = new.user_id
       and terms_version is distinct from new.version;
  end if;
  return new;
end;
$$;

revoke execute on function public.termini_aggiorna_puntatore() from public, anon, authenticated;

drop trigger if exists trg_termini_aggiorna_puntatore on public.terms_acceptances;
create trigger trg_termini_aggiorna_puntatore
  after insert on public.terms_acceptances
  for each row execute function public.termini_aggiorna_puntatore();

-- ---------------------------------------------------------------------------
-- 6) Alla chiusura dell'account le righe restano, con la data di chiusura
-- ---------------------------------------------------------------------------
-- public.users cade a cascata da auth.users (auth.admin.deleteUser nel cron
-- cancella-account, o la dashboard): e' li' che si aggancia.
create or replace function public.termini_account_chiuso()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.terms_acceptances
     set account_closed_at = now()
   where user_id = old.id
     and account_closed_at is null;
  return old;
end;
$$;

revoke execute on function public.termini_account_chiuso() from public, anon, authenticated;

drop trigger if exists trg_termini_account_chiuso on public.users;
create trigger trg_termini_account_chiuso
  after delete on public.users
  for each row execute function public.termini_account_chiuso();

-- ---------------------------------------------------------------------------
-- 7) Dieci anni dopo la chiusura, la purga
-- ---------------------------------------------------------------------------
create or replace function public.purga_accettazioni_termini()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inizio timestamptz := now();
  v_quante integer;
begin
  delete from public.terms_acceptances
   where account_closed_at is not null
     and account_closed_at < now() - interval '10 years';
  get diagnostics v_quante = row_count;
  insert into public.system_job_runs (job, started_at, finished_at, ok, outcome)
  values ('purga_accettazioni_termini', v_inizio, now(), true,
          jsonb_build_object('cancellate', v_quante));
exception when others then
  insert into public.system_job_runs (job, started_at, finished_at, ok, error)
  values ('purga_accettazioni_termini', v_inizio, now(), false, sqlerrm);
  raise;
end;
$$;

revoke execute on function public.purga_accettazioni_termini() from public, anon, authenticated;

comment on function public.purga_accettazioni_termini() is
  'Conservazione di terms_acceptances: dieci anni dalla chiusura dell''account (ROPA A25, DATA_COMPLIANCE §5). Gira il primo di ogni mese; traccia in system_job_runs.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purga-accettazioni-termini') then
      perform cron.unschedule('purga-accettazioni-termini');
    end if;
    perform cron.schedule(
      'purga-accettazioni-termini',
      '25 3 1 * *',
      $cron$select public.purga_accettazioni_termini();$cron$
    );
  else
    raise notice 'pg_cron non installata: purga_accettazioni_termini() creata ma non schedulata.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8) Backfill: le accettazioni che conosciamo gia'
-- ---------------------------------------------------------------------------
-- Solo le righe con una versione (al 28/09/2026: due). L'ora e' quella
-- dichiarata dal browser allora, e method = 'backfill' lo dice. Le righe con
-- versione nulla (iscritti prima della 028) restano senza storico: non
-- sappiamo cosa abbiano accettato, e scriverlo sarebbe inventarlo.
insert into public.terms_acceptances (user_id, audience, version, accepted_at, method)
select pp.user_id,
       case when u.role = 'professional' then 'professional' else 'customer' end,
       pp.terms_version,
       coalesce(pp.terms_accepted_at, pp.created_at, now()),
       'backfill'
  from public.profile_private pp
  join public.users u on u.id = pp.user_id
 where pp.terms_version ~ '^[0-9]{4}-[0-9]{2}-v[0-9]+$'
   and not exists (
     select 1 from public.terms_acceptances t
      where t.user_id = pp.user_id and t.version = pp.terms_version
   );

commit;
