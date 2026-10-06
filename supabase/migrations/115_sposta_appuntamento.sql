-- 115_sposta_appuntamento.sql
--
-- IL CLIENTE SPOSTA UN APPUNTAMENTO CONFERMATO (06/10, André; regola decisa
-- con Lucio).
--
-- COM'ERA. Il cliente poteva solo disdire (113). Per cambiare orario doveva
-- disdire e ricominciare, o scrivere al pro e sperare: nessun percorso, e il
-- guard (appointments_customer_guard, 031 -> 113) gli vieta di toccare
-- starts_at.
--
-- LA REGOLA. Spostare segue ESATTAMENTE il preavviso dell'annullamento
-- (113): quello fotografato sull'appuntamento alla conferma, se no quello
-- del professionista, se no 48 ore. Fuori dal preavviso il cliente sceglie
-- un orario nuovo da solo; dentro, si chiama. L'orario nuovo non e' deciso
-- dal cliente da solo: l'appuntamento torna «da confermare» (proposed, del
-- cliente) e il pro lo conferma o lo rifiuta dal biglietto in chat, come
-- una proposta qualunque.
--
-- NESSUNO PERDE UN LAVORO CONFERMATO PERCHE' IL PRO DICE NO. Se il pro
-- rifiuta lo spostamento (da qualunque strada: biglietto in chat,
-- calendario, area di lavoro), l'appuntamento torna CONFERMATO all'orario
-- di prima, letto dallo storico (appointment_events.inizio_prima
-- dell'ultimo «spostato» del cliente). Sta in un trigger, non nei bottoni:
-- le strade del pro per rifiutare sono quattro, e domani possono essere
-- cinque (stesso ragionamento della 107). La prima proposta del pro e la
-- controproposta del cliente (/api/appointments/counter) non sono
-- spostamenti: per loro un rifiuto resta un rifiuto, come oggi.
--
-- COME, SENZA RISCRIVERE FUNZIONI CONDIVISE. sposta_appuntamento() gira
-- come il cliente (SECURITY INVOKER: la RLS gli lascia gia' aggiornare
-- l'appuntamento della sua richiesta e scrivere nella sua chat) e accende
-- per la sola transazione lo stesso interruttore della 113,
-- bob.annullamento: il guard del cliente, il messaggio automatico della 107
-- e i divieti della 113 lo leggono gia' e si fanno da parte. Lo storico lo
-- scrive registra_evento_appuntamento, con autore e motivo dagli stessi
-- parametri bob.*. Nessuna funzione esistente e' ricreata: l'unico ritocco
-- a un oggetto esistente e' un GRANT (sezione 1).
--
-- PERSONALI E CONSERVAZIONE. Nessun dato nuovo: un orario, un motivo
-- facoltativo scritto dal cliente (come nella disdetta, 500 caratteri) e
-- un messaggio in chat, gia' coperti da ROPA A5 e dalla conservazione della
-- richiesta (113). Nessuna tabella nuova.
--
-- Idempotente: create or replace per le funzioni, drop-then-recreate per il
-- trigger, grant ripetibili.

begin;

-- 1. La data come la scrive l'app, anche per chi chiama ------------------------
-- private.quando_breve (107) formatta un timestamptz in «ven 2 ott, 10:00».
-- Finora la chiamavano solo funzioni SECURITY DEFINER; le due di questa
-- migrazione girano come l'utente. E' una funzione pura, senza dati, e
-- `private` non e' esposto da PostgREST: l'EXECUTE non apre niente.
grant execute on function private.quando_breve(timestamptz) to authenticated;

-- 2. Spostare, la strada del cliente --------------------------------------------
-- Errori con un HINT che la route traduce, come annulla_appuntamento():
-- «non_trovato» (404), «non_attivo» (409), «chiama» (409, dentro il
-- preavviso), «occupato» (409, l'orario si sovrappone a un altro
-- appuntamento con un cliente: vincolo della 113), «orario» (400).
create or replace function public.sposta_appuntamento(
  p_id uuid,
  p_inizio timestamptz,
  p_motivo text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.appointments%rowtype;
  v_preavviso integer;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500);
  v_testo text;
begin
  if v_uid is null then
    raise exception 'Accedi per spostare' using errcode = '28000';
  end if;

  -- La RLS mostra solo gli appuntamenti delle due parti: per chiunque altro
  -- «non trovato», come per un id che non esiste.
  select * into a from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;

  if exists (
    select 1 from public.professionals p
     where p.id = a.professional_id and p.user_id = v_uid
  ) then
    raise exception 'Il professionista sposta un appuntamento dal calendario'
      using hint = 'non_attivo';
  end if;
  if not (
    a.customer_id = v_uid
    or exists (
      select 1 from public.requests r
       where r.id = a.request_id and r.customer_id = v_uid
    )
  ) then
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;

  if a.request_id is null then
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;
  if a.status <> 'confirmed' or a.starts_at <= now() then
    raise exception 'Questo appuntamento non si sposta piu'' da qui'
      using hint = 'non_attivo';
  end if;

  -- Lo stesso conto di annulla_appuntamento() (113), riga per riga.
  select coalesce(a.cancellation_window_hours, p.preavviso_annullamento_ore, 48)
    into v_preavviso
    from public.professionals p
   where p.id = a.professional_id;
  v_preavviso := coalesce(v_preavviso, 48);
  if now() > a.starts_at - make_interval(hours => v_preavviso) then
    raise exception 'Mancano meno di % ore: per spostarlo chiama il professionista', v_preavviso
      using hint = 'chiama';
  end if;

  if p_inizio is null or p_inizio <= now() then
    raise exception 'Scegli un orario che non sia gia'' passato'
      using hint = 'orario';
  end if;
  if p_inizio = a.starts_at then
    raise exception 'L''appuntamento e'' gia'' a quell''ora'
      using hint = 'orario';
  end if;

  perform set_config('bob.annullamento', 'si', true);
  perform set_config('bob.autore', 'customer', true);
  perform set_config('bob.motivo', coalesce(v_motivo, ''), true);

  -- Torna una proposta del cliente: la durata, il lavoro, il prezzo e il
  -- luogo restano quelli concordati. Il preavviso fotografato resta (la
  -- promessa e' quella del giorno dell'accordo).
  begin
    update public.appointments
       set starts_at = p_inizio,
           status = 'proposed',
           proposed_by = 'customer'
     where id = a.id;
  exception when exclusion_violation then
    raise exception 'Quell''orario non e'' piu'' libero: scegline un altro'
      using hint = 'occupato';
  end;

  v_testo := 'Vorrei spostare l''appuntamento di '
             || private.quando_breve(a.starts_at)
             || coalesce(' (' || a.title || ')', '')
             || ' a ' || private.quando_breve(p_inizio) || '.'
             || ' Confermalo qui sotto. Se non puoi, resta l''orario di prima.'
             || coalesce(' Motivo: ' || v_motivo, '');
  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (a.request_id, a.professional_id, 'customer', v_uid, v_testo,
     'appointment_proposal', a.id);

  -- Si spegne qui, non a fine transazione (stessa lezione della 113).
  perform set_config('bob.annullamento', '', true);
  perform set_config('bob.autore', '', true);
  perform set_config('bob.motivo', '', true);

  return jsonb_build_object(
    'ok', true,
    'request_id', a.request_id,
    'professional_id', a.professional_id,
    'customer_name', a.customer_name,
    'title', a.title,
    'inizio_prima', a.starts_at,
    'inizio_dopo', p_inizio,
    'duration_minutes', a.duration_minutes
  );
end;
$$;

revoke execute on function public.sposta_appuntamento(uuid, timestamptz, text) from public, anon;
grant execute on function public.sposta_appuntamento(uuid, timestamptz, text) to authenticated;

-- 3. Il pro dice no: torna l'orario di prima -----------------------------------
-- Scatta quando il PRO porta a «declined» o «cancelled» una proposta del
-- cliente che e' uno spostamento (nello storico c'e' lo «spostato» del
-- cliente che l'ha portata all'orario attuale), senza cambiarne l'orario
-- nello stesso momento.
-- Allora non e' un rifiuto: l'appuntamento torna confermato all'orario e
-- alla durata di prima, e il cliente lo legge in chat.
--
-- Non scatta, e il rifiuto resta un rifiuto come oggi, se: l'orario di
-- prima e' gia' passato (riconfermare un'ora trascorsa non ridarebbe a
-- nessuno il lavoro); chi rifiuta non e' il pro; la proposta non e' uno
-- spostamento (prima proposta del pro, controproposta del cliente).
-- Se nel frattempo l'orario di prima e' stato preso, il vincolo della 113
-- ferma tutto (23P01) e il pro deve scegliere un'altra strada: meglio di un
-- rifiuto che cancella il lavoro in silenzio.
--
-- L'ORDINE CONTA. I trigger BEFORE scattano in ordine alfabetico. Questo
-- deve venire DOPO riproponi_se_spostato (107): se venisse prima,
-- riproponi vedrebbe il pro confermare un orario cambiato e lo
-- ritrasformerebbe in una proposta. «spostamento_rifiutato» > «riproponi».
--
-- SECURITY INVOKER: gira come il pro, che lo storico lo legge (policy della
-- 113) e nella chat della richiesta scrive (policy della 006/018).
create or replace function private.spostamento_rifiutato()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prima timestamptz;
  v_durata_prima integer;
begin
  if auth.uid() is null
     or current_setting('bob.annullamento', true) = 'si'
     or old.request_id is null
     or old.status <> 'proposed'
     or old.proposed_by is distinct from 'customer'
     or new.status not in ('declined', 'cancelled')
     or new.starts_at is distinct from old.starts_at
     or new.duration_minutes is distinct from old.duration_minutes then
    return new;
  end if;
  if not exists (
    select 1 from public.professionals p
     where p.id = old.professional_id and p.user_id = auth.uid()
  ) then
    return new;
  end if;

  -- Lo spostamento che ha prodotto lo stato di adesso: uno «spostato» del
  -- cliente che e' arrivato proprio all'orario attuale. Non «l'ultimo
  -- evento» per created_at: due eventi nella stessa transazione hanno lo
  -- stesso now(), e l'ordine diventerebbe un caso.
  select e.inizio_prima, e.durata_prima
    into v_prima, v_durata_prima
    from public.appointment_events e
   where e.appointment_id = old.id
     and e.tipo = 'spostato'
     and e.autore = 'customer'
     and e.inizio_dopo = old.starts_at
   order by e.created_at desc
   limit 1;
  if v_prima is null or v_prima <= now() then
    return new;
  end if;

  new.status := 'confirmed';
  new.starts_at := v_prima;
  new.duration_minutes := coalesce(v_durata_prima, old.duration_minutes);

  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (old.request_id, old.professional_id, 'professional', auth.uid(),
     'Non posso spostarlo a ' || private.quando_breve(old.starts_at)
       || ': resta confermato l''appuntamento di ' || private.quando_breve(v_prima) || '.',
     'appointment_proposal', old.id);
  return new;
end;
$$;

revoke execute on function private.spostamento_rifiutato() from public, anon, authenticated;

drop trigger if exists spostamento_rifiutato on public.appointments;
create trigger spostamento_rifiutato
  before update of status on public.appointments
  for each row execute function private.spostamento_rifiutato();

commit;
