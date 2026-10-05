-- 113_prenotazione_regole.sql
--
-- UN APPUNTAMENTO CON UN CLIENTE HA DELLE REGOLE (05/10, Lucio).
--
-- COM'ERA. La 106 e la 107 hanno dato una casa alla prenotazione (richiesta,
-- chat, finestra di disdetta del cliente) e una voce ai cambi del pro (il
-- messaggio in chat). Restava una modifica generica, non un percorso:
--   - due clienti che prenotano lo stesso slot nello stesso istante passavano
--     entrambi: il controllo «slot libero» e l'INSERT erano due istruzioni;
--   - il pro annullava con un UPDATE dal browser: nessun motivo, nessuna
--     regola di tempo, nessuna traccia. Il cliente invece aveva una finestra
--     fotografata e controllata con l'ora del server;
--   - spostare sovrascriveva starts_at: l'ora di partenza non era piu'
--     leggibile da nessuna parte;
--   - «Elimina» cancellava la riga, e il cliente restava con un messaggio
--     senza biglietto;
--   - la disdetta lasciava la richiesta aperta fra i «Lavori in corso».
--
-- LE DECISIONI (Lucio, 05/10).
--   1. Il PREAVVISO PER ANNULLARE e' un'impostazione del professionista
--      (professionals.preavviso_annullamento_ore, 48 ore di base, 0 = sempre
--      online). Sostituisce la finestra per servizio della prenotazione
--      diretta (professional_services.cancellation_window_hours, che resta
--      in tabella ma nessuno la legge piu'). Vale per ENTRAMBE le parti, su
--      ogni appuntamento con un cliente, e si fotografa sull'appuntamento
--      (appointments.cancellation_window_hours, gia' della 106) quando
--      diventa confermato: la promessa e' quella del giorno dell'accordo.
--   2. FUORI dal preavviso si annulla dal sito: parte il messaggio standard
--      in chat, resta la traccia. DENTRO il preavviso si chiama: il cliente
--      non annulla online; il pro registra l'annullamento solo dichiarando
--      di aver parlato con il cliente («concordato al telefono»), cosi' il
--      cliente non resta con un appuntamento fantasma.
--   3. Il pro scrive SEMPRE il motivo (il cliente lo legge in chat). Il
--      cliente puo' scriverlo, non deve.
--   4. Una prenotazione diretta disdetta chiude la sua richiesta come
--      «disdetta» (requests.closed_reason), non come lavoro concluso: niente
--      invito a recensire, e la policy delle recensioni lo rifiuta.
--   5. Lo spostamento fuori dalle fasce del pro e' un avviso nell'interfaccia,
--      non un divieto (un sabato concordato e' legittimo). La SOVRAPPOSIZIONE
--      con un altro appuntamento con un cliente invece e' un divieto, qui.
--
-- FUNZIONI CONDIVISE RISCRITTE DA QUELLE VIVE (pg_get_functiondef del 05/10):
--   appointments_customer_guard   md5 50b57e060026d383d0a2cc297d1014dc
--   proteggi_finestra_disdetta    md5 88391544346d9c0396a241a25b7e0c6b
--   avvisa_cambio_appuntamento    md5 d69ea6584c7aa3aa74b66d87e2b78026
-- Policy «Customer inserts review for closed request» riscritta da quella
-- viva (pg_policy del 05/10). Ognuna cambia in un punto solo, segnato.
--
-- L'INTERRUTTORE DI TRANSAZIONE. annulla_appuntamento() e' l'unica strada
-- per annullare un appuntamento confermato con un cliente. Gira come
-- l'utente (auth.uid() resta suo: e' cosi' che i trigger sanno chi ha
-- annullato) e accende per la sola transazione bob.annullamento = 'si'
-- (set_config locale). I trigger che altrimenti bloccherebbero o
-- scriverebbero un secondo messaggio lo leggono e si fanno da parte. Da
-- PostgREST non si accende: set_config non e' esposto, e ogni richiesta e'
-- una transazione sua.
--
-- PERSONALI E CONSERVAZIONE. appointment_events contiene chi ha fatto cosa
-- e il motivo scritto a mano: e' parte del rapporto contrattuale (ROPA A5),
-- vive e muore con la richiesta (cascade: alla cancellazione dell'account
-- del cliente le richieste spariscono e lo storico con loro, come la chat)
-- e con il professionista. Entra nell'export dell'art. 15/20.
--
-- Idempotente: if not exists, drop-then-recreate per policy, trigger,
-- vincoli e funzioni.

begin;

-- 1. Uno slot, un cliente ----------------------------------------------------
-- Vincolo di esclusione: per lo stesso professionista, due appuntamenti con
-- un cliente (request_id) confermati o proposti non possono sovrapporsi. E'
-- il cancello vero contro le prenotazioni simultanee, contro lo spostamento
-- su un orario occupato e contro una controproposta concorrente: qualunque
-- strada passi, il database dice no (errore 23P01).
-- L'agenda privata (request_id null) ne resta fuori di proposito: e' del
-- pro, e la sola sovrapposizione esistente al 05/10 e' fra due voci private.
create extension if not exists btree_gist with schema extensions;

-- tstzrange(inizio, inizio + minuti): un'aggiunta di soli minuti non dipende
-- dal fuso, quindi la funzione e' davvero immutabile (timestamptz + interval
-- in generale non lo e', per via dei giorni e del cambio d'ora).
create or replace function public.fascia_appuntamento(p_inizio timestamptz, p_minuti integer)
returns tstzrange
language sql
immutable
parallel safe
set search_path = ''
as $$
  select tstzrange(p_inizio, p_inizio + p_minuti * interval '1 minute', '[)');
$$;

alter table public.appointments
  drop constraint if exists appuntamenti_cliente_senza_sovrapposizioni;
alter table public.appointments
  add constraint appuntamenti_cliente_senza_sovrapposizioni
  exclude using gist (
    professional_id with =,
    public.fascia_appuntamento(starts_at, duration_minutes) with &&
  )
  where (request_id is not null and status in ('confirmed', 'proposed'));

-- 2. Il preavviso per annullare, impostazione del pro -----------------------
-- protect_professional_columns e' una lista di colonne VIETATE: questa,
-- nuova, il pro la puo' cambiare da solo senza toccarla.
alter table public.professionals
  add column if not exists preavviso_annullamento_ore integer not null default 48;
alter table public.professionals
  drop constraint if exists professionals_preavviso_annullamento_ore_check;
alter table public.professionals
  add constraint professionals_preavviso_annullamento_ore_check
  check (preavviso_annullamento_ore between 0 and 336);

comment on column public.professionals.preavviso_annullamento_ore is
  'Ore prima dell''inizio sotto le quali un appuntamento con un cliente non si annulla dal sito: si chiama. 0 = sempre dal sito. Si fotografa su appointments.cancellation_window_hours alla conferma (113).';

comment on column public.appointments.cancellation_window_hours is
  'Preavviso per annullare, in ore, fotografato alla conferma dal preavviso del professionista (113; prima della 113 dalla finestra del servizio prenotabile). Lo scrive solo il server (trigger proteggi_finestra_disdetta).';

-- La finestra per servizio non e' piu' un requisito per attivare la
-- prenotazione diretta: c'e' quella del professionista, che vale per tutti i
-- suoi appuntamenti. RISCRITTA DALLA VIVA (md5 d06c117d9c4e99d70b5564e9f1d9aa7d).
-- Cambia: tolto il controllo su cancellation_window_hours (e la sua costante).
create or replace function public.enforce_instant_book_enable()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_eligible boolean;
begin
  if new.instant_book_enabled is true then
    if new.subservice_id is null then
      raise exception 'instant_book requires a subservice_id';
    end if;

    select instant_book_eligible into v_eligible
      from public.subservices where id = new.subservice_id;

    if coalesce(v_eligible, false) = false then
      raise exception 'subservice % is not instant_book_eligible', new.subservice_id;
    end if;

    if new.rate_amount is null
       or new.rate_unit is null
       or new.min_units is null
       or new.slot_duration_min is null then
      raise exception 'instant_book requires rate_amount, rate_unit, min_units, slot_duration_min';
    end if;
  end if;
  return new;
end;
$function$;

comment on column public.professional_services.cancellation_window_hours is
  'Non piu'' letta dalla 113: il preavviso per annullare e'' professionals.preavviso_annullamento_ore. Resta per le righe storiche; da togliere quando nessun file la cita.';

-- 3. La fotografia del preavviso ---------------------------------------------
-- RISCRITTA DALLA VIVA. Cambia: (a) i controlli sull'utente valgono come
-- prima, ma non fanno piu' uscire subito il servizio; (b) se l'appuntamento
-- con un cliente e' (o diventa) confermato e non ha ancora un preavviso, lo
-- prende dal professionista. Il trigger scatta adesso anche sui cambi di
-- stato. SECURITY DEFINER per leggere professionals a prescindere da chi
-- conferma (anche il cliente, dal biglietto in chat).
create or replace function public.proteggi_finestra_disdetta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() null = service role o job interni: la route puo' scriverla.
  if auth.uid() is not null then
    if tg_op = 'INSERT' and new.cancellation_window_hours is not null then
      raise exception 'La finestra di disdetta la fissa solo la prenotazione';
    end if;
    if tg_op = 'UPDATE'
       and new.cancellation_window_hours is distinct from old.cancellation_window_hours then
      raise exception 'La finestra di disdetta di una prenotazione non si cambia';
    end if;
  end if;

  -- (113) La fotografia: alla conferma, il preavviso del professionista.
  if new.cancellation_window_hours is null
     and new.request_id is not null
     and new.status = 'confirmed' then
    select p.preavviso_annullamento_ore
      into new.cancellation_window_hours
      from public.professionals p
     where p.id = new.professional_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_finestra_disdetta() from public, anon, authenticated;

drop trigger if exists proteggi_finestra_disdetta on public.appointments;
create trigger proteggi_finestra_disdetta
  before insert or update of cancellation_window_hours, status on public.appointments
  for each row execute function public.proteggi_finestra_disdetta();

-- Gli appuntamenti con un cliente gia' confermati e ancora da venire, senza
-- preavviso (quelli nati da una richiesta, non da una prenotazione diretta):
-- prendono quello del professionista, oggi per tutti 48 ore.
update public.appointments a
   set cancellation_window_hours = p.preavviso_annullamento_ore
  from public.professionals p
 where p.id = a.professional_id
   and a.request_id is not null
   and a.status = 'confirmed'
   and a.starts_at > now()
   and a.cancellation_window_hours is null;

-- 4. Come si e' chiusa una richiesta ------------------------------------------
-- null = come sempre (il cliente l'ha chiusa: lavoro concluso o lasciato
-- perdere). «disdetto» = la prenotazione e' stata annullata: non e' un lavoro
-- fatto e non si recensisce.
alter table public.requests
  add column if not exists closed_reason text;
alter table public.requests
  drop constraint if exists requests_closed_reason_check;
alter table public.requests
  add constraint requests_closed_reason_check
  check (closed_reason is null or closed_reason in ('concluso', 'disdetto'));

comment on column public.requests.closed_reason is
  'Perche'' la richiesta e'' chiusa. «disdetto» = prenotazione annullata (113): esclude la recensione. Lo scrive solo annulla_appuntamento().';

-- Il cliente aggiorna le sue richieste senza limiti di colonna (policy
-- «User updates own requests»): senza questo, potrebbe togliersi il
-- «disdetto» e recensire un lavoro mai fatto.
create or replace function public.proteggi_chiusura_richiesta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null
     or current_setting('bob.annullamento', true) = 'si'
     or private.is_admin_or_cs() then
    return new;
  end if;
  if new.closed_reason is distinct from old.closed_reason then
    raise exception 'Il motivo di chiusura di una richiesta lo scrive solo Bob';
  end if;
  if old.closed_reason = 'disdetto' and new.status is distinct from old.status then
    raise exception 'Una prenotazione disdetta non si riapre: prenotane una nuova';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_chiusura_richiesta() from public, anon, authenticated;

drop trigger if exists proteggi_chiusura_richiesta on public.requests;
create trigger proteggi_chiusura_richiesta
  before update of status, closed_reason on public.requests
  for each row execute function public.proteggi_chiusura_richiesta();

-- RISCRITTA DALLA VIVA. Cambia una riga: r.closed_reason non «disdetto».
drop policy if exists "Customer inserts review for closed request" on public.ratings;
create policy "Customer inserts review for closed request" on public.ratings
  for insert
  with check (
    customer_id = (select auth.uid())
    and request_id is not null
    and exists (
      select 1 from public.requests r
       where r.id = ratings.request_id
         and r.customer_id = (select auth.uid())
         and r.status = 'closed'
         and r.closed_reason is distinct from 'disdetto'
    )
    and exists (
      select 1 from public.request_professionals rp
       where rp.request_id = ratings.request_id
         and rp.professional_id = ratings.professional_id
    )
  );

-- 5. Lo storico dell'appuntamento ---------------------------------------------
create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  tipo text not null check (tipo in (
    'prenotato', 'proposto', 'confermato', 'rifiutato', 'ritirato',
    'spostato', 'annullato', 'concluso', 'riproposto'
  )),
  autore text not null check (autore in ('professional', 'customer', 'sistema')),
  autore_id uuid references public.users (id) on delete set null,
  inizio_prima timestamptz,
  inizio_dopo timestamptz,
  durata_prima integer,
  durata_dopo integer,
  motivo text check (motivo is null or char_length(motivo) <= 500),
  concordato_telefono boolean not null default false,
  dentro_preavviso boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.appointment_events is
  'Storico degli appuntamenti con un cliente: chi ha prenotato, proposto, spostato (da che ora a che ora), annullato e perche''. Lo scrive solo il trigger registra_evento_appuntamento. Conservazione: con la richiesta e con il professionista (cascade). ROPA A5, migrazione 113.';

create index if not exists appointment_events_request_idx
  on public.appointment_events (request_id);
create index if not exists appointment_events_appointment_idx
  on public.appointment_events (appointment_id);
create index if not exists appointment_events_pro_created_idx
  on public.appointment_events (professional_id, created_at desc);

alter table public.appointment_events enable row level security;

-- Lo leggono le due parti. Nessuna policy di scrittura: scrive solo il
-- trigger. Nessun accesso dello staff: sugli appuntamenti non ce l'ha.
drop policy if exists "Le parti leggono lo storico" on public.appointment_events;
create policy "Le parti leggono lo storico" on public.appointment_events
  for select to authenticated
  using (
    professional_id in (
      select p.id from public.professionals p where p.user_id = (select auth.uid())
    )
    or request_id in (
      select r.id from public.requests r where r.customer_id = (select auth.uid())
    )
  );

create or replace function private.registra_evento_appuntamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_autore text := nullif(current_setting('bob.autore', true), '');
  v_autore_id uuid;
  v_tipo text;
begin
  if new.request_id is null then
    return null;
  end if;

  -- Chi. Da annulla_appuntamento() lo dice l'interruttore; da PostgREST e'
  -- l'utente (il pro proprietario o il cliente); dalle route di servizio
  -- (prenotazione, controproposta) e' chi propone la riga nuova.
  if v_autore is not null then
    v_autore_id := v_uid;
  elsif v_uid is not null then
    v_autore := case
      when exists (
        select 1 from public.professionals p
         where p.id = new.professional_id and p.user_id = v_uid
      ) then 'professional'
      else 'customer'
    end;
    v_autore_id := v_uid;
  elsif tg_op = 'INSERT' then
    v_autore := new.proposed_by;
    v_autore_id := case when new.proposed_by = 'customer' then new.customer_id end;
  else
    v_autore := 'sistema';
  end if;

  if tg_op = 'INSERT' then
    v_tipo := case
      when new.status = 'confirmed' and new.source = 'direct' then 'prenotato'
      when new.status = 'confirmed' then 'confermato'
      when new.status = 'proposed' then 'proposto'
    end;
    if v_tipo is null then
      return null;
    end if;
    insert into public.appointment_events
      (appointment_id, request_id, professional_id, tipo, autore, autore_id,
       inizio_dopo, durata_dopo)
    values
      (new.id, new.request_id, new.professional_id, v_tipo, v_autore, v_autore_id,
       new.starts_at, new.duration_minutes);
    return null;
  end if;

  if new.starts_at is distinct from old.starts_at
     or new.duration_minutes is distinct from old.duration_minutes then
    v_tipo := 'spostato';
  elsif new.status is distinct from old.status then
    v_tipo := case new.status
      when 'confirmed' then 'confermato'
      when 'declined' then 'rifiutato'
      when 'completed' then 'concluso'
      when 'proposed' then 'riproposto'
      when 'cancelled' then case
        when old.status = 'proposed' and old.proposed_by = v_autore then 'ritirato'
        when old.status = 'proposed' then 'rifiutato'
        else 'annullato'
      end
    end;
  end if;
  if v_tipo is null then
    return null;
  end if;

  insert into public.appointment_events
    (appointment_id, request_id, professional_id, tipo, autore, autore_id,
     inizio_prima, inizio_dopo, durata_prima, durata_dopo,
     motivo, concordato_telefono, dentro_preavviso)
  values
    (new.id, new.request_id, new.professional_id, v_tipo, v_autore, v_autore_id,
     old.starts_at, new.starts_at, old.duration_minutes, new.duration_minutes,
     nullif(current_setting('bob.motivo', true), ''),
     coalesce(current_setting('bob.concordato', true) = 'si', false),
     coalesce(current_setting('bob.dentro', true) = 'si', false));
  return null;
end;
$$;

revoke execute on function private.registra_evento_appuntamento() from public, anon, authenticated;

drop trigger if exists registra_evento_appuntamento on public.appointments;
create trigger registra_evento_appuntamento
  after insert or update of status, starts_at, duration_minutes on public.appointments
  for each row execute function private.registra_evento_appuntamento();

-- 6. Nessuna scorciatoia: non si annulla e non si elimina dal browser ---------
-- Un appuntamento CONFERMATO con un cliente si annulla solo da
-- annulla_appuntamento(), che controlla il preavviso, chiede il motivo e
-- scrive in chat. Uno confermato o proposto non si elimina: si annulla o si
-- ritira, cosi' il cliente lo sa. Ritirare la propria proposta e rifiutare
-- quella del cliente (proposed -> cancelled/declined) restano come sono.
create or replace function public.proteggi_appuntamento_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or current_setting('bob.annullamento', true) = 'si' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.request_id is not null and old.status in ('confirmed', 'proposed') then
      raise exception 'Un appuntamento con un cliente non si elimina: annullalo, cosi'' il cliente lo sa';
    end if;
    return old;
  end if;
  if old.request_id is not null
     and old.status = 'confirmed'
     and new.status = 'cancelled' then
    raise exception 'Per annullare un appuntamento con un cliente usa «Annulla appuntamento»: avvisa il cliente e lascia traccia';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_appuntamento_cliente() from public, anon, authenticated;

drop trigger if exists proteggi_appuntamento_cliente on public.appointments;
create trigger proteggi_appuntamento_cliente
  before update of status or delete on public.appointments
  for each row execute function public.proteggi_appuntamento_cliente();

-- RISCRITTA DALLA VIVA. Cambia una riga: lascia passare annulla_appuntamento(),
-- che gira come il cliente quando e' lui a disdire.
create or replace function public.appointments_customer_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  is_owner boolean;
begin
  if auth.uid() is null
     or current_setting('bob.annullamento', true) = 'si' then
    return new; -- service role / job interni / annulla_appuntamento() (113)
  end if;
  select exists (
    select 1 from public.professionals p
    where p.id = old.professional_id and p.user_id = auth.uid()
  ) into is_owner;
  if is_owner then
    return new;
  end if;
  if old.status <> 'proposed'
     or new.status not in ('confirmed', 'declined')
     or new.professional_id is distinct from old.professional_id
     or new.request_id is distinct from old.request_id
     or new.customer_name is distinct from old.customer_name
     or new.title is distinct from old.title
     or new.starts_at is distinct from old.starts_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.price is distinct from old.price
     or new.notes is distinct from old.notes
     or new.location_address is distinct from old.location_address
     or new.location_city is distinct from old.location_city
     or new.location_notes is distinct from old.location_notes
  then
    raise exception 'Puoi solo confermare o rifiutare una proposta di appuntamento';
  end if;
  return new;
end $function$;

-- RISCRITTA DALLA VIVA. Cambia una riga: quando annulla da
-- annulla_appuntamento() il messaggio lo scrive la funzione (con il motivo),
-- e qui se ne scriverebbe un secondo.
create or replace function public.avvisa_cambio_appuntamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_testo text;
begin
  if auth.uid() is null or new.request_id is null
     or current_setting('bob.annullamento', true) = 'si' then
    return null;
  end if;
  if not exists (
    select 1 from public.professionals p
     where p.id = new.professional_id and p.user_id = auth.uid()
  ) then
    return null;
  end if;

  if new.status = 'cancelled' and old.status = 'confirmed' then
    v_testo := 'Ho annullato l''appuntamento di ' || private.quando_breve(old.starts_at) || '.';
  elsif new.status = 'cancelled' and old.status = 'proposed'
        and old.proposed_by = 'professional' then
    v_testo := 'Ho ritirato la proposta di ' || private.quando_breve(old.starts_at) || '.';
  elsif new.status = 'proposed'
        and (new.starts_at is distinct from old.starts_at
             or new.duration_minutes is distinct from old.duration_minutes) then
    v_testo := 'Ho spostato l''appuntamento: da ' || private.quando_breve(old.starts_at)
               || ' a ' || private.quando_breve(new.starts_at)
               || ' (' || new.duration_minutes || ' min). Confermalo qui sotto o proponi un altro orario.';
  elsif new.status = 'proposed' and old.status in ('cancelled', 'declined', 'completed') then
    v_testo := 'Ti ripropongo l''appuntamento di ' || private.quando_breve(new.starts_at)
               || '. Confermalo qui sotto o proponi un altro orario.';
  else
    return null;
  end if;

  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (new.request_id, new.professional_id, 'professional', auth.uid(), v_testo,
     'appointment_proposal', new.id);
  return null;
end;
$function$;

-- 7. Annullare, l'unica strada --------------------------------------------------
-- Il controllo e la scrittura in una transazione sola, con l'ora del server e
-- la riga bloccata (FOR UPDATE): due annullamenti in parallelo, o uno che
-- arriva un secondo dopo il limite, non passano.
-- Errori con un HINT che l'interfaccia legge: «chiama» (dentro il
-- preavviso), «motivo» (manca), «non_attivo», «non_trovato».
create or replace function public.annulla_appuntamento(
  p_id uuid,
  p_motivo text default null,
  p_concordato_telefono boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.appointments%rowtype;
  v_ruolo text;
  v_preavviso integer;
  v_dentro boolean;
  v_concordato boolean := coalesce(p_concordato_telefono, false);
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500);
  v_quote_mode text;
  v_testo text;
begin
  if v_uid is null then
    raise exception 'Accedi per annullare' using errcode = '28000';
  end if;

  select * into a from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;

  if exists (
    select 1 from public.professionals p
     where p.id = a.professional_id and p.user_id = v_uid
  ) then
    v_ruolo := 'professional';
  elsif a.customer_id = v_uid
     or exists (
       select 1 from public.requests r
        where r.id = a.request_id and r.customer_id = v_uid
     ) then
    v_ruolo := 'customer';
  else
    -- Stessa risposta per «non esiste» e «non e' tuo».
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;

  if a.request_id is null then
    raise exception 'Questo appuntamento e'' solo nella tua agenda: modificalo dal calendario'
      using hint = 'non_attivo';
  end if;
  if a.status <> 'confirmed' or a.starts_at <= now() then
    raise exception 'Questo appuntamento non e'' piu'' da annullare'
      using hint = 'non_attivo';
  end if;

  select coalesce(a.cancellation_window_hours, p.preavviso_annullamento_ore, 48)
    into v_preavviso
    from public.professionals p
   where p.id = a.professional_id;
  v_dentro := now() > a.starts_at - make_interval(hours => v_preavviso);

  if v_ruolo = 'customer' and v_dentro then
    raise exception 'Mancano meno di % ore: per annullare chiama il professionista', v_preavviso
      using hint = 'chiama';
  end if;
  if v_ruolo = 'professional' then
    if v_motivo is null or char_length(v_motivo) < 3 then
      raise exception 'Scrivi il motivo: il cliente lo legge in chat'
        using hint = 'motivo';
    end if;
    if v_dentro and not v_concordato then
      raise exception 'Mancano meno di % ore: prima chiama il cliente, poi registra l''annullamento', v_preavviso
        using hint = 'chiama';
    end if;
  end if;

  perform set_config('bob.annullamento', 'si', true);
  perform set_config('bob.autore', v_ruolo, true);
  perform set_config('bob.motivo', coalesce(v_motivo, ''), true);
  perform set_config('bob.concordato', case when v_dentro and v_concordato then 'si' else '' end, true);
  perform set_config('bob.dentro', case when v_dentro then 'si' else '' end, true);

  update public.appointments set status = 'cancelled' where id = a.id;

  -- Il messaggio standard, nella chat di quella richiesta, a nome di chi
  -- annulla: accende il badge dei non letti dell'altra parte.
  v_testo := case v_ruolo
               when 'professional' then 'Ho annullato l''appuntamento di '
               else 'Ho disdetto l''appuntamento di '
             end
             || private.quando_breve(a.starts_at)
             || coalesce(' (' || a.title || ')', '') || '.'
             || case when v_dentro and v_concordato then ' Come concordato al telefono.' else '' end
             || coalesce(' Motivo: ' || v_motivo, '');
  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (a.request_id, a.professional_id, v_ruolo, v_uid, v_testo,
     'appointment_proposal', a.id);

  -- Una prenotazione diretta disdetta non e' un lavoro in corso.
  select r.quote_mode into v_quote_mode from public.requests r where r.id = a.request_id;
  if v_quote_mode = 'bookable' then
    update public.requests
       set status = 'closed', closed_reason = 'disdetto'
     where id = a.request_id and status <> 'closed';
  end if;

  return jsonb_build_object(
    'ok', true,
    'ruolo', v_ruolo,
    'request_id', a.request_id,
    'professional_id', a.professional_id,
    'customer_id', a.customer_id,
    'customer_name', a.customer_name,
    'title', a.title,
    'starts_at', a.starts_at,
    'richiesta_chiusa', v_quote_mode = 'bookable'
  );
end;
$$;

revoke execute on function public.annulla_appuntamento(uuid, text, boolean) from public, anon;
grant execute on function public.annulla_appuntamento(uuid, text, boolean) to authenticated;

-- 8. Il numero dell'altra parte, per «Chiama per annullare» ------------------
-- Consegna progressiva: i contatti si aprono solo su un appuntamento
-- CONFERMATO (il cliente ha accettato), e solo alle due parti. Il telefono
-- sta in profile_phone, che ciascuno legge solo per se' (051): per questo
-- passa da qui, e non da una policy che lo aprirebbe per riga.
create or replace function public.contatto_controparte(p_appuntamento uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.appointments%rowtype;
  v_pro_user uuid;
  v_cliente uuid;
  v_altro uuid;
  v_nome text;
begin
  if v_uid is null then
    return null;
  end if;
  select * into a from public.appointments where id = p_appuntamento;
  if not found or a.request_id is null or a.status <> 'confirmed' then
    return null;
  end if;
  select p.user_id into v_pro_user from public.professionals p where p.id = a.professional_id;
  select coalesce(a.customer_id, r.customer_id) into v_cliente
    from public.requests r where r.id = a.request_id;

  if v_uid = v_pro_user then
    v_altro := v_cliente;
    v_nome := a.customer_name;
  elsif v_uid = v_cliente then
    v_altro := v_pro_user;
    select pr.full_name into v_nome from public.profiles pr where pr.user_id = v_pro_user;
  else
    return null;
  end if;

  return jsonb_build_object(
    'nome', v_nome,
    'telefono', (select ph.phone from public.profile_phone ph where ph.user_id = v_altro)
  );
end;
$$;

revoke execute on function public.contatto_controparte(uuid) from public, anon;
grant execute on function public.contatto_controparte(uuid) to authenticated;

commit;
