-- 106_prenotazione_diretta_con_richiesta.sql
--
-- LA PRENOTAZIONE DIRETTA NON E' PIU' UN VICOLO CIECO (01/10, Lucio).
--
-- COM'ERA. /api/pro/instant-book creava l'appuntamento («confirmed»,
-- source «direct») senza request_id. Tutto il resto del prodotto passa da
-- request_id: la chat (request_messages.request_id NOT NULL, la lista delle
-- conversazioni da request_professionals), l'area personale del cliente
-- (CustomerHome legge gli appuntamenti delle sue richieste), la policy di
-- UPDATE del cliente. Risultato: la prenotazione non compariva da nessuna
-- parte, cliente e professionista non avevano dove scriversi, e la
-- «cancellazione gratuita fino a X ore prima» stampata nel dialog non era
-- applicata da nessuna parte.
--
-- LA STRADA SCELTA: OGNI PRENOTAZIONE HA LA SUA RICHIESTA. La route ora crea
-- una riga in requests (status «matched», quote_mode «bookable») e il
-- collegamento in request_professionals (status «responded», cosi' non finisce
-- fra le «nuove richieste» del riassunto del pro) prima dell'appuntamento.
-- Questa migrazione fa lo stesso per le prenotazioni gia' esistenti.
--
-- LA FINESTRA DI DISDETTA DIVENTA UN DATO DELL'APPUNTAMENTO. Prima stava solo
-- su professional_services: se il pro la accorcia domani, la promessa fatta
-- oggi al cliente cambierebbe sotto di lui. Adesso la route la fotografa al
-- momento della prenotazione, e la disdetta (/api/appointments/[id]/disdici)
-- legge quella. La scrive solo il server: authenticated ha UPDATE e INSERT a
-- livello di tabella su appointments (una revoca di colonna non basterebbe),
-- quindi la protegge un trigger a se', senza toccare appointments_customer_guard.
--
-- La disdetta da parte del cliente non passa mai da PostgREST: il guard
-- (031) gli consente solo proposed -> confirmed/declined, quindi l'unica via
-- e' la route, con il controllo della finestra lato server.
--
-- Idempotente.

begin;

-- 1. La finestra fotografata sull'appuntamento -------------------------------
alter table public.appointments
  add column if not exists cancellation_window_hours integer
    check (cancellation_window_hours is null or cancellation_window_hours >= 0);

comment on column public.appointments.cancellation_window_hours is
  'Ore prima dell''inizio entro cui il cliente puo'' disdire da solo. Fotografata alla prenotazione diretta; null = non si disdice dall''area personale. La scrive solo il server (trigger proteggi_finestra_disdetta).';

-- 2. Solo il server la scrive ------------------------------------------------
create or replace function public.proteggi_finestra_disdetta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() null = service role o job interni: e' la route, va bene.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' and new.cancellation_window_hours is not null then
    raise exception 'La finestra di disdetta la fissa solo la prenotazione';
  end if;
  if tg_op = 'UPDATE'
     and new.cancellation_window_hours is distinct from old.cancellation_window_hours then
    raise exception 'La finestra di disdetta di una prenotazione non si cambia';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_finestra_disdetta() from public, anon, authenticated;

drop trigger if exists proteggi_finestra_disdetta on public.appointments;
create trigger proteggi_finestra_disdetta
  before insert or update of cancellation_window_hours on public.appointments
  for each row execute function public.proteggi_finestra_disdetta();

-- 3. Le prenotazioni dirette gia' fatte: una richiesta ciascuna --------------
-- Al 01/10 sono 6, tutte di account di prova e tutte nel passato. Per ognuna:
-- richiesta con la data della prenotazione (anche l'evento di ricerca che il
-- trigger log_request_search_event scrive prende quella data), collegamento
-- al pro, request_id e finestra sull'appuntamento. Le richieste di
-- prenotazioni gia' passate o annullate nascono chiuse.
do $$
declare
  r record;
  v_req uuid;
begin
  for r in
    select a.id, a.customer_id, a.professional_id, a.created_at, a.starts_at,
           a.duration_minutes, a.status, a.title,
           ps.subservice_id, ps.cancellation_window_hours,
           ss.service_id, pr.city_id
      from public.appointments a
      join public.professional_services ps on ps.id = a.professional_service_id
      join public.subservices ss on ss.id = ps.subservice_id
      join public.professionals pr on pr.id = a.professional_id
     where a.source = 'direct'
       and a.request_id is null
       and a.customer_id is not null
  loop
    insert into public.requests
      (customer_id, city_id, service_id, subservice_id, status, quote_mode,
       problem_description, created_at)
    values
      (r.customer_id, r.city_id, r.service_id, r.subservice_id,
       case
         when r.status in ('cancelled', 'declined', 'completed')
           or r.starts_at + make_interval(mins => r.duration_minutes) < now()
         then 'closed'
         else 'matched'
       end,
       'bookable',
       'Prenotazione diretta: ' || coalesce(r.title, 'servizio a tariffa fissa'),
       r.created_at)
    returning id into v_req;

    insert into public.request_professionals
      (request_id, professional_id, status, created_at)
    values (v_req, r.professional_id, 'responded', r.created_at);

    update public.appointments
       set request_id = v_req,
           cancellation_window_hours = r.cancellation_window_hours
     where id = r.id;
  end loop;
end $$;

commit;
