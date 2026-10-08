-- 118_rifiuto_spostamento_nello_storico.sql
--
-- IL RIFIUTO DI UNO SPOSTAMENTO E' UN RIFIUTO, ANCHE NELLO STORICO (08/10,
-- André).
--
-- COM'ERA. Il cliente chiede di spostare (115); il pro preme «Rifiuta»; il
-- trigger spostamento_rifiutato rimette l'orario di prima, confermato.
-- Giusto. Ma registra_evento_appuntamento vede solo il risultato:
-- starts_at e' cambiato, chi scrive e' il pro. E scrive 'spostato',
-- autore 'professional', da {orario chiesto} a {orario di prima}. Nessuna
-- traccia del rifiuto. La campanella del cliente lo traduce in «Milano
-- Clean Squad ha spostato l'appuntamento: da ven 9 ott, 10:00 a mar 13 ott,
-- 09:00» — falso: il pro non ha spostato niente, ha detto no. Provato dal
-- vivo l'08/10 (appuntamento b5a739ba…).
--
-- ADESSO. Il ripristino lascia un segno per la transazione, legato a
-- QUELL'appuntamento: bob.ripristino = id. Lo storico, quando lo trova,
-- scrive 'rifiutato' invece di 'spostato', e lo spegne. La riga dice il
-- vero: tipo 'rifiutato', autore 'professional' (ha rifiutato il pro),
-- inizio_prima = l'orario chiesto e non concesso, inizio_dopo = l'orario
-- che resta. Un rifiuto qualunque (prima proposta del pro, controproposta)
-- ha i due orari uguali: e' cosi' che la campanella li distingue.
--
-- PERCHE' NON bob.tipo (116). bob.tipo lo accende una funzione che poi
-- lo spegne da sola, dopo il suo UPDATE. Un trigger BEFORE non puo': lo
-- storico (AFTER) lo legge dopo che il trigger e' finito, e nessuno lo
-- spegnerebbe piu'. Resterebbe acceso per il resto della transazione, e il
-- prossimo cambio di orario verrebbe scritto come un rifiuto. Il segno
-- nuovo lo spegne chi lo legge, e vale solo per l'appuntamento che lo ha
-- acceso.
--
-- FUNZIONI CONDIVISE RISCRITTE DA QUELLE VIVE (pg_get_functiondef dell'08/10):
--   spostamento_rifiutato          md5 4d8d27197756052e47790b45e03cca40 (= 115)
--   registra_evento_appuntamento   md5 9e329e474864c90d8366a2a25a36ccd7 (= 116)
-- Ognuna cambia nei punti segnati con (118).
--
-- NON TOCCA: il vincolo appointment_events_tipo_check ('rifiutato' c'e'
-- gia', 113/116); le righe gia' scritte (in produzione ce n'e' una, del
-- test dell'08/10: si corregge a mano, se si vuole, fuori da questa
-- migrazione); il doppio avviso dopo un rifiuto e l'errore 23P01 grezzo sul
-- ripristino (rilievi aperti a parte).
--
-- PERSONALI E CONSERVAZIONE. Nessun dato nuovo, nessuna tabella nuova: cambia
-- l'etichetta di una riga dello storico (ROPA A5), con la stessa
-- conservazione.
--
-- Idempotente: create or replace per le funzioni; i trigger restano quelli
-- della 113 e della 115 e puntano alle stesse funzioni.

begin;

-- 1. Il ripristino lascia il segno ----------------------------------------------
-- RISCRITTA DALLA VIVA (= 115). Cambia una riga (118): set_config locale
-- alla transazione, con l'id dell'appuntamento ripristinato.
create or replace function private.spostamento_rifiutato()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
  perform set_config('bob.ripristino', old.id::text, true); -- (118)

  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (old.request_id, old.professional_id, 'professional', auth.uid(),
     'Non posso spostarlo a ' || private.quando_breve(old.starts_at)
       || ': resta confermato l''appuntamento di ' || private.quando_breve(v_prima) || '.',
     'appointment_proposal', old.id);
  return new;
end;
$function$;

revoke execute on function private.spostamento_rifiutato() from public, anon, authenticated;

-- 2. Lo storico scrive il rifiuto -------------------------------------------------
-- RISCRITTA DALLA VIVA (= 116). Cambia un punto (118): quando l'orario
-- cambia e il segno bob.ripristino e' quello di questo appuntamento, il
-- tipo e' 'rifiutato' e il segno si spegne. Tutto il resto, bob.tipo della
-- 116 compreso, e' byte per byte quello vivo.
create or replace function private.registra_evento_appuntamento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
    -- (118) Il pro ha rifiutato uno spostamento del cliente e
    -- spostamento_rifiutato ha rimesso l'orario di prima: e' un rifiuto.
    if current_setting('bob.ripristino', true) = new.id::text then
      v_tipo := 'rifiutato';
      perform set_config('bob.ripristino', '', true);
    else
      v_tipo := coalesce(nullif(current_setting('bob.tipo', true), ''), 'spostato'); -- (116)
    end if;
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
$function$;

revoke execute on function private.registra_evento_appuntamento() from public, anon, authenticated;

commit;
