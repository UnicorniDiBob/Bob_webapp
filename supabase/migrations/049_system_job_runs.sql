-- 049: un registro dei lavori automatici, cosi' "ha girato" e' una domanda con
-- risposta.
--
-- PERCHE'.
-- Il ritentativo notturno delle partite IVA (10.5, file 043) esce subito quando
-- non c'e' niente in attesa, e in quel caso non scrive nulla da nessuna parte.
-- E' la scelta giusta - non serve traffico inutile - ma ha un effetto
-- collaterale scomodo: dal database non si distingue una notte in cui il lavoro
-- e' girato e non aveva niente da fare da una notte in cui non e' girato per
-- niente. Ed e' esattamente il caso in cui ci siamo trovati: CRON_SECRET non
-- configurato, endpoint che risponde 503 a ogni chiamata, e nessuna traccia
-- della differenza.
--
-- Con questa tabella ogni passaggio lascia una riga, anche quello a vuoto.
-- "Il ritentativo ha girato almeno una volta" diventa una query, non una
-- deduzione.
--
-- DATI PERSONALI: nessuno. Qui finiscono nome del lavoro, orari e contatori.
-- L'esito e' aggregato (quanti esaminati, quanti confermati), non contiene id
-- di professionisti ne' partite IVA: il dettaglio per caso resta in
-- verification_events, che ha gia' la sua base giuridica e la sua RLS.
-- Percio' nessuna riga ROPA nuova e nessun aggiornamento dell'informativa.
--
-- CONSERVAZIONE (DATA_COMPLIANCE §5): 180 giorni. E' un registro di diagnostica
-- operativa: serve a vedere se una cosa gira e da quando ha smesso, non a
-- ricostruire la storia dell'anno. La cancellazione e' nella stessa funzione di
-- pulizia, richiamata dallo stesso cron.
--
-- Idempotente: create table if not exists, drop-then-create per policy e
-- funzione.

create table if not exists public.system_job_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text        not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  outcome      jsonb       not null default '{}'::jsonb,
  error        text
);

comment on table public.system_job_runs is
  'Registro dei lavori automatici (cron). Nessun dato personale: solo nome del lavoro, orari e contatori aggregati. Conservazione 180 giorni, vedi purge_stale_job_runs().';
comment on column public.system_job_runs.outcome is
  'Contatori aggregati del passaggio, es. {"esaminati":0,"confermati":0}. Mai id di persone o partite IVA.';

create index if not exists system_job_runs_job_started_idx
  on public.system_job_runs (job, started_at desc);

-- RLS: la scrittura passa dal service role, che la aggira. Nessun utente
-- scrive qui. In lettura solo lo staff, perche' e' uno strumento operativo.
alter table public.system_job_runs enable row level security;

drop policy if exists "system_job_runs_staff_read" on public.system_job_runs;
create policy "system_job_runs_staff_read" on public.system_job_runs
  for select
  to authenticated
  using (private.is_admin_or_cs());

revoke all on public.system_job_runs from anon;

-- ---------------------------------------------------------------------------
-- Pulizia: 180 giorni
-- ---------------------------------------------------------------------------
create or replace function public.purge_stale_job_runs()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare n integer;
begin
  delete from public.system_job_runs
   where started_at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_stale_job_runs() from public, anon, authenticated;

comment on function public.purge_stale_job_runs() is
  'Conservazione 180 giorni per system_job_runs (DATA_COMPLIANCE §5). La richiama il cron notturno.';
