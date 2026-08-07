-- 044: l'indirizzo del cliente esce dal testo libero e diventa un dato
--      strutturato, visibile al professionista solo dopo l'accettazione.
--
-- PERCHÉ (il problema, verificato in produzione il 06/08/2026)
-- Bob incollava l'indirizzo dentro la prosa: `L'indirizzo è ...` nel messaggio
-- (src/components/BobChat.tsx) e `Indirizzo: ...` in requests.problem_description
-- (QuoteDialog / RequestDialog). Da lì lo leggeva:
--   * OGNI professionista invitato nel giro di preventivi, prima che il cliente
--     ne avesse scelto uno — cinque estranei ricevevano via e numero civico di
--     casa di una persona che non aveva ancora deciso niente;
--   * il prompt di /api/pro/request-summary, quindi usciva verso il fornitore
--     LLM senza necessità (DATA_COMPLIANCE §2, minimizzazione).
-- La migrazione 031 aveva già diagnosticato metà del problema ("l'indirizzo
-- finiva solo come prosa dentro requests.problem_description, non consultabile
-- in modo strutturato") e aveva risolto il lato appuntamento con uno snapshot.
-- Questa chiude l'altra metà: il lato richiesta.
--
-- LA REGOLA (DATA_COMPLIANCE, divulgazione progressiva)
-- Richiesta pseudonimizzata prima, recapito completo solo dopo che il cliente
-- ha accettato. Qui "accettato" non è una parola nuova da inventare: è un
-- appuntamento confermato fra quel cliente e quel professionista. È il segnale
-- che esiste già, ed è già quello che significa "ti ho scelto". Un appuntamento
-- solo 'proposed' non basta: lo propone il pro, non il cliente.
--
-- COSA VEDE IL PRO PRIMA DELL'ACCETTAZIONE
-- Città, servizio, urgenza, brief e descrizione — senza via e numero civico.
-- Le colonne coarse_* restano NULL: sono l'aggancio per la mappa con raggio
-- approssimato (roadmap 40.0), che richiede prima un fornitore di geocoding con
-- DPA art. 28 e regione UE. Finché quel fornitore non c'è, non si scrivono.
-- Il punto approssimato, quando arriverà, va calcolato lato server e salvato
-- già spostato: il browser del professionista non deve mai ricevere il punto
-- esatto, altrimenti il raggio è un disegno e non una tutela.
--
-- CONFORMITÀ (parte del "done", non un dopo)
-- Base giuridica: art. 6(1)(b) esecuzione del contratto — senza l'indirizzo la
--   prestazione a domicilio non è eseguibile. Nessun consenso richiesto.
-- Finalità: esecuzione dell'intervento a domicilio. Non è una finalità nuova:
--   è la stessa già dichiarata, resa solo più stretta di com'era.
-- Minimizzazione: solo testo libero di via e civico, più una nota facoltativa
--   (scala, citofono). Nessuna coordinata, nessun geocoding, nessun fornitore
--   esterno introdotto qui.
-- Conservazione: la riga vive quanto la richiesta a cui appartiene e sparisce
--   con essa (on delete cascade). Non apre un binario di retention nuovo.
-- Cancellazione: cascade dalla richiesta, che a sua volta cascata dall'utente
--   (mig 012). Nessun dato personale orfano.
-- DPIA: nessun trigger di §7.3 — nessun monitoraggio sistematico, nessuna
--   categoria particolare, nessuna decisione automatizzata. Non richiesta.
-- Registro dei trattamenti: la riga esistente "gestione delle richieste" va
--   aggiornata indicando la divulgazione progressiva (attività 41.3).
--
-- Idempotente.

-- ---------------------------------------------------------------- tabella

create table if not exists public.request_addresses (
  request_id   uuid primary key references public.requests(id) on delete cascade,
  address_line text not null,
  city_name    text,
  notes        text,
  -- Agganci per la mappa approssimata (roadmap 40.0). Restano NULL finché non
  -- esiste un fornitore di geocoding con DPA: vedi il blocco in testa.
  coarse_lat     double precision,
  coarse_lng     double precision,
  coarse_radius_m integer,
  coarse_source  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.request_addresses is
  'Indirizzo del cliente per una richiesta. Separato da requests perché la RLS è di riga, non di colonna: tenerlo qui è l''unico modo di farlo leggere al cliente e al solo professionista accettato. Il pro accettato ne riceve comunque una copia-snapshot su appointments.location_address (mig 031), che sopravvive alla cancellazione di questa riga.';
comment on column public.request_addresses.address_line is
  'Via e numero civico, testo libero. Niente coordinate.';
comment on column public.request_addresses.coarse_lat is
  'NULL finché roadmap 40.0 non porta un fornitore di geocoding con DPA art. 28 e regione UE. Va scritto GIÀ spostato dal punto reale: il punto esatto non deve mai raggiungere il browser del professionista.';

create index if not exists request_addresses_created_at_idx
  on public.request_addresses (created_at);

-- ---------------------------------------------------------------- il cancello

-- Un appuntamento confermato (o già svolto) fra questo professionista e questa
-- richiesta è il segnale di accettazione. 'proposed' no: lo propone il pro.
-- SECURITY DEFINER per non richiedere al pro la lettura di appointments dentro
-- la policy (ricorsione), con search_path fissato come da mig 032.
create or replace function public.can_see_request_address(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.appointments a
    where a.request_id = p_request_id
      and a.professional_id in (select public.my_professional_ids())
      and a.status in ('confirmed', 'completed')
  );
$$;

revoke all on function public.can_see_request_address(uuid) from public, anon;
grant execute on function public.can_see_request_address(uuid) to authenticated;

comment on function public.can_see_request_address(uuid) is
  'Divulgazione progressiva: vero solo se chi chiede è il professionista di un appuntamento confermato o completato su quella richiesta.';

-- ---------------------------------------------------------------- RLS

alter table public.request_addresses enable row level security;

drop policy if exists request_addresses_customer_all on public.request_addresses;
create policy request_addresses_customer_all
  on public.request_addresses
  for all
  to authenticated
  using (
    exists (select 1 from public.requests r
            where r.id = request_id and r.customer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.requests r
            where r.id = request_id and r.customer_id = auth.uid())
  );

drop policy if exists request_addresses_pro_read_after_accept on public.request_addresses;
create policy request_addresses_pro_read_after_accept
  on public.request_addresses
  for select
  to authenticated
  using (public.can_see_request_address(request_id));

drop policy if exists request_addresses_staff_read on public.request_addresses;
create policy request_addresses_staff_read
  on public.request_addresses
  for select
  to authenticated
  using (public.is_admin_or_cs());

-- ---------------------------------------------------------------- snapshot

-- Alla conferma dell'appuntamento l'indirizzo viene copiato su appointments,
-- come vuole la 031: il record di lavoro deve sopravvivere alla cancellazione
-- della richiesta. Lo fa un trigger e non la UI, così non si può dimenticare e
-- non serve dare al pro un permesso di lettura in più.
create or replace function public.fill_appointment_location_from_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.request_id is not null
     and new.status in ('confirmed', 'completed')
     and (new.location_address is null or new.location_address = '')
  then
    select ra.address_line, coalesce(new.location_city, ra.city_name)
      into new.location_address, new.location_city
      from public.request_addresses ra
     where ra.request_id = new.request_id;
  end if;
  return new;
end;
$$;

revoke all on function public.fill_appointment_location_from_request() from public, anon, authenticated;

drop trigger if exists appointments_fill_location on public.appointments;
create trigger appointments_fill_location
  before insert or update of status, location_address on public.appointments
  for each row execute function public.fill_appointment_location_from_request();

-- ---------------------------------------------------------------- bonifica

-- Sposta gli indirizzi già finiti nel testo libero e li toglie da lì.
-- Si occupa SOLO delle due forme che il codice produceva:
--     "Indirizzo: <via>"        (requests.problem_description)
--     "L'indirizzo è <via>."    (request_messages.message)
-- Un indirizzo scritto a mano dentro una frase ("Bilocale in Viale Monza 55 da
-- tinteggiare") non si tocca: una regex che ci provasse rovinerebbe il testo.
-- Quelli restano da rivedere a mano — la query per elencarli è in coda.

do $$
declare
  v_addr text;
  r record;
begin
  -- 1) da requests.problem_description
  for r in
    select id, problem_description
      from public.requests
     where problem_description ~* '(^|\s|—|-)\s*indirizzo\s*:'
  loop
    v_addr := btrim(substring(r.problem_description from '(?i)indirizzo\s*:\s*([^—\n]+)'));
    if v_addr is not null and length(v_addr) > 3 then
      insert into public.request_addresses (request_id, address_line)
      values (r.id, left(v_addr, 200))
      on conflict (request_id) do nothing;

      update public.requests
         set problem_description =
               btrim(regexp_replace(problem_description,
                     '(?i)\s*(—|-)?\s*indirizzo\s*:\s*[^—\n]+', '', 'g'))
       where id = r.id;
    end if;
  end loop;

  -- 2) da request_messages.message
  for r in
    select id, request_id, message
      from public.request_messages
     where message ~* 'l''indirizzo\s+è\s+'
  loop
    v_addr := btrim(substring(r.message from '(?i)l''indirizzo\s+è\s+([^.\n]+)'));
    if v_addr is not null and length(v_addr) > 3 and r.request_id is not null then
      insert into public.request_addresses (request_id, address_line)
      values (r.request_id, left(v_addr, 200))
      on conflict (request_id) do nothing;
    end if;

    update public.request_messages
       set message =
             btrim(regexp_replace(message,
                   '(?i)\s*l''indirizzo\s+è\s+[^.\n]+\.?', '', 'g'))
     where id = r.id;
  end loop;
end $$;

-- Da rivedere a mano dopo questa migrazione — indirizzi scritti in prosa che la
-- bonifica non poteva estrarre senza rovinare la frase:
--
--   select id, left(problem_description, 120)
--     from public.requests
--    where problem_description ~* '\m(via|viale|corso|piazza|largo|vicolo)\M';
--
--   select id, request_id, left(message, 120)
--     from public.request_messages
--    where message ~* '\m(via|viale|corso|piazza|largo|vicolo)\M';
