-- 108_registro_lavoro_pro.sql
--
-- IL REGISTRO DEL LAVORO DEL PROFESSIONISTA (04/10, Lucio). Fase 0 delle
-- Analisi: docs/SPEC_analisi_professionista.md, §3.6 e §7.
--
-- PERCHE' PRIMA DI QUALUNQUE SCHERMATA. Tre fatti dello schema vivo:
--   1. Gli stati non hanno storia: request_professionals ha solo created_at,
--      appointments nessuna data di conferma o di conclusione.
--   2. requests.customer_id e' on delete cascade: quando un cliente cancella
--      l'account se ne vanno richieste, partecipazioni e messaggi, e l'imbuto
--      passato del professionista si accorcia da solo.
--   3. Gli appuntamenti creati dal pro non hanno ne' comune ne' servizio.
-- Un dato non raccolto non si recupera, e il pilota parte a gennaio 2027.
--
-- COSA C'E' QUI
--   a. appointments: completed_at, comune_istat, postal_code.
--   b. professional_work_events: un evento per passo del lavoro. NESSUNA
--      colonna del cliente: cosi' sopravvive alla sua cancellazione senza
--      conservarne i dati. Lo scrivono solo i trigger.
--   c. analisi_mesi: i mesi condensati. Ogni mese piu' vecchio di 25 viene
--      riassunto qui in una riga per servizio e comune, e i suoi eventi si
--      cancellano. Il registro resta grande al massimo 25 mesi per pro; i
--      confronti fra anni e fra mesi leggono la vista analisi_mesi_vive, che
--      unisce i mesi condensati e quelli ancora in dettaglio.
--   d. il recupero, una volta sola, di quello che c'e' oggi (ricostruito =
--      true: le date dei passaggi di stato non esistevano, sono stimate).
--
-- UN'ANALISI NON BLOCCA MAI UN LAVORO. Ogni trigger che scrive nel registro
-- intercetta i propri errori, li lascia nei log come warning e lascia passare
-- l'operazione: una prenotazione persa per colpa di un contatore sarebbe il
-- difetto peggiore possibile.
--
-- Idempotente: if not exists, create or replace, drop-then-recreate di
-- trigger e policy, unschedule prima di schedule, on conflict nel recupero.

begin;

-- ---------------------------------------------------------------------------
-- a. Appuntamenti: quando e' stato concluso, dove
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists completed_at timestamptz,
  add column if not exists comune_istat text,
  add column if not exists postal_code text;

comment on column public.appointments.completed_at is
  'Quando il lavoro e'' stato SEGNATO concluso (dal trigger, mig 108). Il mese del lavoro resta quello di starts_at: e'' quando si e'' lavorato. Null sugli appuntamenti conclusi prima della 108: la data non esisteva.';
comment on column public.appointments.comune_istat is
  'Comune del lavoro. Copiato dalla richiesta, oppure ricavato dal CAP, oppure scelto dal pro (SceltaComune). Mig 108.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_comune_istat_format') then
    alter table public.appointments add constraint appointments_comune_istat_format
      check (comune_istat is null or comune_istat ~ '^[0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_postal_code_format') then
    alter table public.appointments add constraint appointments_postal_code_format
      check (postal_code is null or postal_code ~ '^[0-9]{5}$');
  end if;
end $$;

-- Il nome comincia per z_ di proposito: i trigger BEFORE girano in ordine
-- alfabetico, e questo deve vedere lo stato DOPO riproponi_se_spostato, che
-- puo' riportare una conferma a «proposed».
create or replace function private.analisi_campi_appuntamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_comune text;
  v_cap text;
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;

  if new.comune_istat is null and new.request_id is not null then
    select r.comune_istat, r.postal_code into v_comune, v_cap
      from public.requests r where r.id = new.request_id;
    new.comune_istat := v_comune;
    new.postal_code := coalesce(new.postal_code, v_cap);
  end if;

  if new.comune_istat is null and new.postal_code is not null then
    new.comune_istat := private.comune_da_cap(new.postal_code, null);
  end if;

  return new;
exception when others then
  raise warning 'analisi_campi_appuntamento(%): %', new.id, sqlerrm;
  return new;
end;
$function$;

drop trigger if exists z_analisi_campi_appuntamento on public.appointments;
create trigger z_analisi_campi_appuntamento
  before insert or update of status, request_id, postal_code, comune_istat
  on public.appointments
  for each row execute function private.analisi_campi_appuntamento();

-- ---------------------------------------------------------------------------
-- b. Il registro
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type
     where typname = 'evento_lavoro' and typnamespace = 'public'::regnamespace
  ) then
    create type public.evento_lavoro as enum (
      'richiesta_ricevuta',
      'prima_risposta',
      'proposta_inviata',
      'proposta_accettata',
      'proposta_rifiutata',
      'prenotazione_diretta',
      'lavoro_concluso',
      'lavoro_disdetto'
    );
  end if;
end $$;

-- Le colonne sono in ordine di allineamento (8 byte, 16, 4, 1, variabili):
-- Postgres non riordina, e cosi' non spreca riempitivo fra una e l'altra.
-- Una riga sta intorno ai 150 byte. Un enum costa 4 byte contro i ~20 di un
-- testo come 'proposta_accettata'. Gli importi sono centesimi interi.
create table if not exists public.professional_work_events (
  id              bigint generated always as identity primary key,
  avvenuto_al     timestamptz not null,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  -- Id della richiesta (eventi di richiesta) o dell'appuntamento (eventi di
  -- appuntamento). SENZA chiave esterna, di proposito: quando la richiesta
  -- sparisce resta un numero che non punta piu' a niente.
  rif             uuid not null,
  -- La richiesta a cui appartiene l'evento, anche per quelli di
  -- appuntamento: serve a seguire una richiesta lungo l'imbuto anche dopo
  -- che appointments.request_id e' passato a null. Senza chiave esterna.
  richiesta       uuid,
  service_id      uuid,
  subservice_id   uuid,
  evento          public.evento_lavoro not null,
  -- lavoro_concluso, proposta_*: importo in centesimi.
  importo_cent    integer,
  -- prima_risposta: minuti fra la prima domanda del cliente e la prima
  -- risposta del pro. lavoro_concluso: durata prevista del lavoro.
  minuti          integer,
  -- true = recuperato dalla 108 da dati che non avevano la data del passo.
  ricostruito     boolean not null default false,
  comune_istat    text,
  constraint professional_work_events_unico unique (professional_id, evento, rif)
);

comment on table public.professional_work_events is
  'Registro del lavoro del professionista: un evento per passo (richiesta ricevuta, prima risposta, proposta, conclusione...). Nessun dato del cliente, per costruzione: sopravvive alla cancellazione dell''account del cliente senza conservarne i dati. Lo scrivono solo i trigger. Conservazione: dettaglio per 25 mesi, poi condensato in analisi_mesi da condensa_analisi(); tutto muore con il professionista (cascade). ROPA A26. Mig 108.';

create index if not exists professional_work_events_pro_quando
  on public.professional_work_events (professional_id, avvenuto_al);

alter table public.professional_work_events enable row level security;

drop policy if exists "Pro legge il proprio registro" on public.professional_work_events;
create policy "Pro legge il proprio registro"
  on public.professional_work_events for select to authenticated
  using (professional_id in (
    select p.id from public.professionals p where p.user_id = (select auth.uid())
  ));

revoke all on public.professional_work_events from anon;
revoke insert, update, delete, truncate on public.professional_work_events from authenticated;

-- Una scrittura sola, usata da tutti i trigger.
create or replace function private.registra_evento_lavoro(
  p_pro uuid,
  p_evento public.evento_lavoro,
  p_quando timestamptz,
  p_rif uuid,
  p_richiesta uuid,
  p_service uuid,
  p_subservice uuid,
  p_comune text,
  p_importo_cent integer default null,
  p_minuti integer default null
)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public.professional_work_events
    (professional_id, evento, avvenuto_al, rif, richiesta, service_id,
     subservice_id, comune_istat, importo_cent, minuti)
  values
    (p_pro, p_evento, coalesce(p_quando, now()), p_rif, p_richiesta, p_service,
     p_subservice, p_comune, p_importo_cent, p_minuti)
  on conflict (professional_id, evento, rif) do nothing;
$function$;

revoke all on function private.registra_evento_lavoro(uuid, public.evento_lavoro, timestamptz, uuid, uuid, uuid, uuid, text, integer, integer) from public, anon, authenticated;

-- b.1 Richiesta ricevuta: la partecipazione esce da 'suggested'.
create or replace function private.analisi_da_partecipazione()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r record;
begin
  if new.status = 'suggested' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status is distinct from 'suggested' then
    return null;
  end if;

  select q.service_id, q.subservice_id, q.comune_istat into r
    from public.requests q where q.id = new.request_id;

  perform private.registra_evento_lavoro(
    new.professional_id, 'richiesta_ricevuta',
    case when tg_op = 'INSERT' then coalesce(new.created_at, now()) else now() end,
    new.request_id, new.request_id, r.service_id, r.subservice_id, r.comune_istat);
  return null;
exception when others then
  raise warning 'analisi_da_partecipazione(%): %', new.id, sqlerrm;
  return null;
end;
$function$;

drop trigger if exists analisi_partecipazione on public.request_professionals;
create trigger analisi_partecipazione
  after insert or update of status on public.request_professionals
  for each row execute function private.analisi_da_partecipazione();

-- b.2 Prima risposta. La formula e' QUELLA di aggiorna_segnali_professionisti
-- (075): prima risposta del pro meno prima domanda testuale del cliente, nella
-- conversazione di quel pro. Il numero che il pro vede nelle Analisi e quello
-- che lo ordina nei risultati devono essere lo stesso numero.
create or replace function private.analisi_da_messaggio()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r record;
  v_domanda timestamptz;
  v_minuti integer;
begin
  if exists (
    select 1 from public.professional_work_events e
     where e.professional_id = new.professional_id
       and e.evento = 'prima_risposta'
       and e.rif = new.request_id
  ) then
    return null;
  end if;

  select min(m.created_at) into v_domanda
    from public.request_messages m
   where m.request_id = new.request_id
     and m.professional_id = new.professional_id
     and m.sender_type = 'customer'
     and m.kind = 'text';

  if v_domanda is not null and new.created_at >= v_domanda then
    v_minuti := round(extract(epoch from (new.created_at - v_domanda)) / 60);
  end if;

  select q.service_id, q.subservice_id, q.comune_istat into r
    from public.requests q where q.id = new.request_id;

  perform private.registra_evento_lavoro(
    new.professional_id, 'prima_risposta', coalesce(new.created_at, now()),
    new.request_id, new.request_id, r.service_id, r.subservice_id,
    r.comune_istat, null, v_minuti);
  return null;
exception when others then
  raise warning 'analisi_da_messaggio(%): %', new.id, sqlerrm;
  return null;
end;
$function$;

drop trigger if exists analisi_messaggio on public.request_messages;
create trigger analisi_messaggio
  after insert on public.request_messages
  for each row
  when (new.sender_type = 'professional' and new.professional_id is not null)
  execute function private.analisi_da_messaggio();

-- b.3 Appuntamenti: proposta, accettazione, rifiuto, prenotazione diretta,
-- conclusione, disdetta. Il registro segue lo stato VERO dell'appuntamento:
-- se un lavoro concluso torna aperto, o una disdetta viene ripresa, l'evento
-- si toglie. Un mese gia' condensato invece non cambia piu' (§7 della spec).
create or replace function private.analisi_da_appuntamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_service uuid;
  v_subservice uuid;
  v_prima text;
  v_importo integer;
begin
  if tg_op = 'DELETE' then
    -- Il pro ha cancellato l'appuntamento: per lui non e' mai esistito, e il
    -- calendario resta la verita'.
    delete from public.professional_work_events e
     where e.professional_id = old.professional_id and e.rif = old.id;
    return null;
  end if;

  if new.professional_service_id is not null then
    select ps.service_id, ps.subservice_id into v_service, v_subservice
      from public.professional_services ps where ps.id = new.professional_service_id;
  end if;
  if v_service is null and new.request_id is not null then
    select q.service_id, q.subservice_id into v_service, v_subservice
      from public.requests q where q.id = new.request_id;
  end if;

  v_importo := case when new.price is null then null else round(new.price * 100)::integer end;
  v_prima := case when tg_op = 'INSERT' then null else old.status end;

  if tg_op = 'INSERT' and new.source = 'direct' then
    perform private.registra_evento_lavoro(
      new.professional_id, 'prenotazione_diretta', coalesce(new.created_at, now()),
      new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
  end if;

  -- Una proposta del pro su una richiesta. Anche quando lo diventa dopo:
  -- una proposta del cliente spostata dal pro e' sua (riproponi_se_spostato).
  if new.request_id is not null and new.source <> 'direct'
     and new.status = 'proposed' and new.proposed_by = 'professional' then
    perform private.registra_evento_lavoro(
      new.professional_id, 'proposta_inviata', coalesce(new.created_at, now()),
      new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
  end if;

  if new.status is distinct from v_prima then
    -- Si arriva a un appuntamento fissato su una richiesta: e' l'«accettata»
    -- dell'imbuto, chiunque abbia fatto l'ultima proposta.
    if new.status = 'confirmed' and new.request_id is not null and new.source <> 'direct' then
      perform private.registra_evento_lavoro(
        new.professional_id, 'proposta_accettata', now(),
        new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
    end if;
    if new.status = 'declined' then
      perform private.registra_evento_lavoro(
        new.professional_id, 'proposta_rifiutata', now(),
        new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
    end if;
    if new.status = 'cancelled' then
      perform private.registra_evento_lavoro(
        new.professional_id, 'lavoro_disdetto', now(),
        new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
    end if;

    if v_prima = 'completed' then
      delete from public.professional_work_events e
       where e.professional_id = new.professional_id and e.rif = new.id
         and e.evento = 'lavoro_concluso';
    elsif v_prima = 'cancelled' then
      delete from public.professional_work_events e
       where e.professional_id = new.professional_id and e.rif = new.id
         and e.evento = 'lavoro_disdetto';
    elsif v_prima = 'declined' then
      delete from public.professional_work_events e
       where e.professional_id = new.professional_id and e.rif = new.id
         and e.evento = 'proposta_rifiutata';
    end if;
  end if;

  -- Il lavoro concluso porta la data del LAVORO (starts_at), non quella in cui
  -- e' stato segnato: e' quella che decide di che mese e' l'importo, come gia'
  -- fanno le caselle della dashboard. Si riallinea a ogni modifica.
  if new.status = 'completed' then
    insert into public.professional_work_events as e
      (professional_id, evento, avvenuto_al, rif, richiesta, service_id,
       subservice_id, comune_istat, importo_cent, minuti)
    values
      (new.professional_id, 'lavoro_concluso', new.starts_at, new.id,
       new.request_id, v_service, v_subservice, new.comune_istat, v_importo,
       new.duration_minutes)
    on conflict (professional_id, evento, rif) do update
      set avvenuto_al   = excluded.avvenuto_al,
          richiesta     = coalesce(excluded.richiesta, e.richiesta),
          service_id    = excluded.service_id,
          subservice_id = excluded.subservice_id,
          comune_istat  = excluded.comune_istat,
          importo_cent  = excluded.importo_cent,
          minuti        = excluded.minuti;
  end if;

  return null;
exception when others then
  raise warning 'analisi_da_appuntamento(%): %', coalesce(new.id, old.id), sqlerrm;
  return null;
end;
$function$;

drop trigger if exists analisi_appuntamento on public.appointments;
create trigger analisi_appuntamento
  after insert or update of status, price, starts_at, duration_minutes,
    comune_istat, professional_service_id, proposed_by
  on public.appointments
  for each row execute function private.analisi_da_appuntamento();

drop trigger if exists analisi_appuntamento_eliminato on public.appointments;
create trigger analisi_appuntamento_eliminato
  after delete on public.appointments
  for each row execute function private.analisi_da_appuntamento();

-- ---------------------------------------------------------------------------
-- c. I mesi condensati, e la vista che li unisce al dettaglio
-- ---------------------------------------------------------------------------

-- Una riga per pro, mese, origine, servizio e comune. Un pro con dieci
-- combinazioni al mese fa 120 righe l'anno, intorno ai 20 KB: e' il peso di
-- tutto il suo passato oltre i 25 mesi.
create table if not exists public.analisi_mesi (
  mese              date not null,
  professional_id   uuid not null references public.professionals(id) on delete cascade,
  service_id        uuid,
  importo_cent      bigint  not null default 0,
  richieste         integer not null default 0,
  risposte          integer not null default 0,
  -- risposte date entro un'ora, entro quattro, entro un giorno (cumulative)
  risposte_1h       integer not null default 0,
  risposte_4h       integer not null default 0,
  risposte_24h      integer not null default 0,
  proposte          integer not null default 0,
  accettate         integer not null default 0,
  rifiutate         integer not null default 0,
  dirette           integer not null default 0,
  conclusi          integer not null default 0,
  disdetti          integer not null default 0,
  minuti_lavoro     integer not null default 0,
  -- 'bob' oggi; 'esterno' per i ricavi esterni della Fase 2 (§4 della spec).
  origine           text not null default 'bob' check (origine in ('bob', 'esterno')),
  comune_istat      text,
  constraint analisi_mesi_unico unique nulls not distinct
    (professional_id, mese, origine, service_id, comune_istat)
);

comment on table public.analisi_mesi is
  'Mesi condensati delle Analisi del professionista: oltre i 25 mesi gli eventi di professional_work_events vengono riassunti qui (condensa_analisi) e cancellati. Solo conteggi e somme, nessun dato del cliente. Un mese condensato non cambia piu''. Muore con il professionista (cascade). ROPA A26. Mig 108.';

alter table public.analisi_mesi enable row level security;

drop policy if exists "Pro legge i propri mesi" on public.analisi_mesi;
create policy "Pro legge i propri mesi"
  on public.analisi_mesi for select to authenticated
  using (professional_id in (
    select p.id from public.professionals p where p.user_id = (select auth.uid())
  ));

revoke all on public.analisi_mesi from anon;
revoke insert, update, delete, truncate on public.analisi_mesi from authenticated;

-- La vista su cui si fanno TUTTI i confronti fra periodi: anni, mesi,
-- intervalli qualunque, a grana di mese. Somma i mesi condensati e il
-- dettaglio ancora vivo; le due parti possono avere righe sullo stesso mese
-- (un lavoro vecchio segnato concluso oggi), per questo chi legge SOMMA
-- sempre, non prende la riga. security_invoker: vale la RLS di chi legge.
create or replace view public.analisi_mesi_vive
with (security_invoker = true) as
select
  m.professional_id, m.mese, m.origine, m.service_id, m.comune_istat,
  m.richieste, m.risposte, m.risposte_1h, m.risposte_4h, m.risposte_24h,
  m.proposte, m.accettate, m.rifiutate, m.dirette, m.conclusi, m.disdetti,
  m.importo_cent, m.minuti_lavoro
from public.analisi_mesi m
union all
select
  e.professional_id,
  date_trunc('month', e.avvenuto_al at time zone 'Europe/Rome')::date,
  'bob',
  e.service_id,
  e.comune_istat,
  count(*) filter (where e.evento = 'richiesta_ricevuta')::integer,
  count(*) filter (where e.evento = 'prima_risposta')::integer,
  count(*) filter (where e.evento = 'prima_risposta' and e.minuti <= 60)::integer,
  count(*) filter (where e.evento = 'prima_risposta' and e.minuti <= 240)::integer,
  count(*) filter (where e.evento = 'prima_risposta' and e.minuti <= 1440)::integer,
  count(*) filter (where e.evento = 'proposta_inviata')::integer,
  count(*) filter (where e.evento = 'proposta_accettata')::integer,
  count(*) filter (where e.evento = 'proposta_rifiutata')::integer,
  count(*) filter (where e.evento = 'prenotazione_diretta')::integer,
  count(*) filter (where e.evento = 'lavoro_concluso')::integer,
  count(*) filter (where e.evento = 'lavoro_disdetto')::integer,
  coalesce(sum(e.importo_cent) filter (where e.evento = 'lavoro_concluso'), 0)::bigint,
  coalesce(sum(e.minuti) filter (where e.evento = 'lavoro_concluso'), 0)::integer
from public.professional_work_events e
group by 1, 2, 3, 4, 5;

revoke all on public.analisi_mesi_vive from anon;
grant select on public.analisi_mesi_vive to authenticated;

-- La condensazione. Un solo statement: gli eventi tolti sono esattamente
-- quelli riassunti, anche se nel frattempo ne arriva uno nuovo. Il minimo e'
-- 13 mesi, perche' il confronto con lo stesso mese dell'anno prima abbia
-- sempre un mese intero di dettaglio da entrambe le parti.
create or replace function public.condensa_analisi(p_mesi integer default 25)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_soglia timestamptz;
  v_quanti integer;
begin
  if p_mesi is null or p_mesi < 13 then
    raise exception 'condensa_analisi: servono almeno 13 mesi di dettaglio, non %', p_mesi;
  end if;

  v_soglia := (date_trunc('month', now() at time zone 'Europe/Rome')
               - make_interval(months => p_mesi)) at time zone 'Europe/Rome';

  with tolti as (
    delete from public.professional_work_events e
     where e.avvenuto_al < v_soglia
    returning e.*
  ), riassunti as (
    insert into public.analisi_mesi as a
      (professional_id, mese, origine, service_id, comune_istat,
       richieste, risposte, risposte_1h, risposte_4h, risposte_24h,
       proposte, accettate, rifiutate, dirette, conclusi, disdetti,
       importo_cent, minuti_lavoro)
    select
      t.professional_id,
      date_trunc('month', t.avvenuto_al at time zone 'Europe/Rome')::date,
      'bob', t.service_id, t.comune_istat,
      count(*) filter (where t.evento = 'richiesta_ricevuta'),
      count(*) filter (where t.evento = 'prima_risposta'),
      count(*) filter (where t.evento = 'prima_risposta' and t.minuti <= 60),
      count(*) filter (where t.evento = 'prima_risposta' and t.minuti <= 240),
      count(*) filter (where t.evento = 'prima_risposta' and t.minuti <= 1440),
      count(*) filter (where t.evento = 'proposta_inviata'),
      count(*) filter (where t.evento = 'proposta_accettata'),
      count(*) filter (where t.evento = 'proposta_rifiutata'),
      count(*) filter (where t.evento = 'prenotazione_diretta'),
      count(*) filter (where t.evento = 'lavoro_concluso'),
      count(*) filter (where t.evento = 'lavoro_disdetto'),
      coalesce(sum(t.importo_cent) filter (where t.evento = 'lavoro_concluso'), 0),
      coalesce(sum(t.minuti) filter (where t.evento = 'lavoro_concluso'), 0)
    from tolti t
    group by 1, 2, 3, 4, 5
    on conflict on constraint analisi_mesi_unico do update
      set richieste     = a.richieste     + excluded.richieste,
          risposte      = a.risposte      + excluded.risposte,
          risposte_1h   = a.risposte_1h   + excluded.risposte_1h,
          risposte_4h   = a.risposte_4h   + excluded.risposte_4h,
          risposte_24h  = a.risposte_24h  + excluded.risposte_24h,
          proposte      = a.proposte      + excluded.proposte,
          accettate     = a.accettate     + excluded.accettate,
          rifiutate     = a.rifiutate     + excluded.rifiutate,
          dirette       = a.dirette       + excluded.dirette,
          conclusi      = a.conclusi      + excluded.conclusi,
          disdetti      = a.disdetti      + excluded.disdetti,
          importo_cent  = a.importo_cent  + excluded.importo_cent,
          minuti_lavoro = a.minuti_lavoro + excluded.minuti_lavoro
    returning 1
  )
  select count(*) into v_quanti from tolti;

  return v_quanti;
end;
$function$;

revoke all on function public.condensa_analisi(integer) from public, anon, authenticated;

create or replace function public.condensa_analisi_mensile()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inizio timestamptz := now();
  v_quanti integer;
begin
  v_quanti := public.condensa_analisi(25);
  insert into public.system_job_runs (job, started_at, finished_at, ok, outcome)
  values ('condensa_analisi', v_inizio, now(), true,
          jsonb_build_object('eventi_condensati', v_quanti));
exception when others then
  insert into public.system_job_runs (job, started_at, finished_at, ok, error)
  values ('condensa_analisi', v_inizio, now(), false, sqlerrm);
  raise;
end;
$function$;

revoke all on function public.condensa_analisi_mensile() from public, anon, authenticated;

-- Il 2 di ogni mese alle 03:50 UTC, dopo i lavori notturni delle 03:17,
-- 03:25 (il primo del mese) e 03:40.
select cron.unschedule('condensa-analisi')
where exists (select 1 from cron.job where jobname = 'condensa-analisi');

select cron.schedule('condensa-analisi', '50 3 2 * *',
                     $cron$select public.condensa_analisi_mensile();$cron$);

-- ---------------------------------------------------------------------------
-- d. Il recupero di quello che c'e' oggi
-- ---------------------------------------------------------------------------

-- Prima il registro, poi il comune sugli appuntamenti. L'UPDATE in fondo
-- passa dai trigger: se il registro fosse ancora vuoto, creerebbe i
-- lavoro_concluso senza il segno «ricostruito».

insert into public.professional_work_events
  (professional_id, evento, avvenuto_al, rif, richiesta, service_id,
   subservice_id, comune_istat, ricostruito)
select rp.professional_id, 'richiesta_ricevuta', coalesce(rp.created_at, q.created_at, now()),
       rp.request_id, rp.request_id, q.service_id, q.subservice_id, q.comune_istat, true
  from public.request_professionals rp
  join public.requests q on q.id = rp.request_id
 where rp.status <> 'suggested'
on conflict (professional_id, evento, rif) do nothing;

insert into public.professional_work_events
  (professional_id, evento, avvenuto_al, rif, richiesta, service_id,
   subservice_id, comune_istat, minuti, ricostruito)
select x.professional_id, 'prima_risposta', x.risposta, x.request_id, x.request_id,
       q.service_id, q.subservice_id, q.comune_istat,
       case when x.domanda is not null and x.risposta >= x.domanda
            then round(extract(epoch from (x.risposta - x.domanda)) / 60)::integer end,
       true
  from (
    select m.professional_id, m.request_id,
           min(m.created_at) filter (where m.sender_type = 'professional') as risposta,
           min(m.created_at) filter (where m.sender_type = 'customer' and m.kind = 'text') as domanda
      from public.request_messages m
     where m.professional_id is not null
     group by m.professional_id, m.request_id
  ) x
  join public.requests q on q.id = x.request_id
 where x.risposta is not null
on conflict (professional_id, evento, rif) do nothing;

with a as (
  select ap.*,
         coalesce(ps.service_id, q.service_id) as srv,
         case when ps.service_id is not null then ps.subservice_id else q.subservice_id end as sub,
         coalesce(ap.comune_istat, q.comune_istat) as com,
         case when ap.price is null then null else round(ap.price * 100)::integer end as cent
    from public.appointments ap
    left join public.professional_services ps on ps.id = ap.professional_service_id
    left join public.requests q on q.id = ap.request_id
)
insert into public.professional_work_events
  (professional_id, evento, avvenuto_al, rif, richiesta, service_id,
   subservice_id, comune_istat, importo_cent, minuti, ricostruito)
select professional_id, ev, quando, id, request_id, srv, sub, com, cent, mins, true
  from (
    select a.*, 'prenotazione_diretta'::public.evento_lavoro as ev,
           coalesce(a.created_at, a.starts_at) as quando, null::integer as mins
      from a where a.source = 'direct'
    union all
    select a.*, 'proposta_inviata', coalesce(a.created_at, a.starts_at), null
      from a where a.source <> 'direct' and a.request_id is not null
               and a.proposed_by = 'professional'
    union all
    select a.*, 'proposta_accettata', coalesce(a.created_at, a.starts_at), null
      from a where a.source <> 'direct' and a.request_id is not null
               and a.status in ('confirmed', 'completed')
    union all
    select a.*, 'proposta_rifiutata', coalesce(a.created_at, a.starts_at), null
      from a where a.status = 'declined'
    union all
    select a.*, 'lavoro_disdetto', coalesce(a.created_at, a.starts_at), null
      from a where a.status = 'cancelled'
    union all
    select a.*, 'lavoro_concluso', a.starts_at, a.duration_minutes
      from a where a.status = 'completed'
  ) tutti
on conflict (professional_id, evento, rif) do nothing;

update public.appointments ap
   set comune_istat = q.comune_istat,
       postal_code  = coalesce(ap.postal_code, q.postal_code)
  from public.requests q
 where q.id = ap.request_id
   and ap.comune_istat is null
   and q.comune_istat is not null;

commit;
