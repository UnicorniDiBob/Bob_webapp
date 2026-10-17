-- 129 — un professionista con una proposta d'appuntamento in chat si puo' cancellare (17/10/2026, CANC2).
--
-- IL GUASTO, TROVATO DAL VIVO (scripts/prova_cancellazione.mjs, 17/10 12:03Z):
-- la cancellazione di un professionista che ha mandato almeno una proposta
-- d'appuntamento in chat fallisce e torna indietro per intero. Auth log:
-- DELETE /admin/users/<pro> -> «appointment_id non appartiene a questa
-- richiesta (SQLSTATE P0001)». Il cron cancella-account lo registra come
-- falliti e riprova ogni notte, per sempre; lo stesso dal pannello admin.
--
-- PERCHE': cancellare professionals fa partire due azioni referenziali. Una
-- cancella i suoi appointments (CASCADE), l'altra mette a NULL
-- request_messages.professional_id (SET NULL). Quell'UPDATE fa partire
-- trg_request_messages_appointment_guard (BEFORE INSERT OR UPDATE, tutte le
-- colonne), che ricontrolla appointment_id: sul messaggio-proposta punta a un
-- appuntamento che la cascata ha APPENA cancellato, e il cui SET NULL non e'
-- ancora arrivato. Il controllo non lo trova e solleva l'eccezione. Non e' un
-- errore di permessi come la 128: e' il controllo che guarda lo stato a meta'
-- della cascata. Il cliente invece si cancella: con la sua richiesta vanno via
-- anche i messaggi (CASCADE), senza UPDATE.
--
-- LA CORREZIONE: il controllo «l'appuntamento appartiene a questa richiesta»
-- serve quando il collegamento NASCE o CAMBIA — INSERT, o UPDATE che tocca
-- appointment_id o request_id. Un UPDATE che non cambia nessuno dei due
-- (segnare letto, il SET NULL di professional_id) non crea nessun
-- collegamento nuovo da controllare. Il resto e' identico.
--
-- Corpo riscritto dalla definizione VIVA (pg_get_functiondef, 17/10): ultima
-- versione e' la 033, la 119 la cita soltanto. Restano SECURITY INVOKER e
-- search_path = public, come in produzione.
--
-- Idempotente: create or replace; il trigger non cambia.

create or replace function public.request_messages_appointment_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Solo in INSERT: se il pro cancella l'appuntamento, la FK diventa null per
  -- effetto di ON DELETE SET NULL e il messaggio resta con kind = proposta.
  -- Se lo pretendessimo anche in UPDATE, quella riga non sarebbe più
  -- aggiornabile — nemmeno per segnarla come letta. La UI mostra i tasti solo
  -- quando l'appuntamento c'è ancora.
  if tg_op = 'INSERT'
     and new.kind = 'appointment_proposal'
     and new.appointment_id is null then
    raise exception 'Una proposta di appuntamento richiede appointment_id';
  end if;

  -- (129) Solo quando il collegamento nasce o cambia. Un UPDATE che lascia
  -- appointment_id e request_id come sono non collega niente di nuovo; e
  -- durante la cancellazione di un pro l'appuntamento puo' essere gia' sparito
  -- mentre il suo SET NULL non e' ancora arrivato.
  if new.appointment_id is not null
     and (tg_op = 'INSERT'
          or new.appointment_id is distinct from old.appointment_id
          or new.request_id is distinct from old.request_id) then
    if not exists (
      select 1
      from public.appointments a
      where a.id = new.appointment_id
        and a.request_id = new.request_id
    ) then
      raise exception 'appointment_id non appartiene a questa richiesta';
    end if;
  end if;

  return new;
end;
$function$;
