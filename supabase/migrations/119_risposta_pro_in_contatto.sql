-- 119_risposta_pro_in_contatto.sql
--
-- LA RISPOSTA DEL PRO METTE IN CONTATTO (15/10, André).
--
-- COM'ERA. sendMessage (src/lib/messages.ts) provava a portare la richiesta a
-- 'matched' dopo OGNI messaggio in chat, dal browser di chi scriveva. Ma la
-- RLS di requests lascia aggiornare solo il cliente («User updates own
-- requests») e lo staff: quando scriveva il PRO l'update passava senza errori
-- e non toccava nessuna riga. Risultato: «matched» voleva dire «il cliente ha
-- scritto», i puntini restavano su «Preventivo chiesto» dopo che il pro aveva
-- risposto (5a431a74: IdroMilano Express ha risposto, era ancora
-- quote_request), e il box della dashboard non poteva sapere chi aveva
-- risposto davvero. Trovato nella PR 5 della dashboard cliente (#169).
--
-- ADESSO. Decisione di André del 15/10: in contatto lo mette SOLO il primo
-- messaggio di un pro (sender_type 'professional', testo o proposta di
-- appuntamento) su una richiesta ancora 'sent' o 'quote_request'. Il
-- messaggio del cliente non sposta piu' niente (il codice smette di
-- provarci nello stesso commit); quelli di Bob ('bob') mai. Le prenotazioni
-- dirette nascono gia' 'matched' (api/pro/instant-book), come prima.
--
-- STATO VIVO LETTO PRIMA DI SCRIVERE (15/10, sola lettura):
--   trigger su request_messages: analisi_da_messaggio, request_messages_
--     segnali_trg (AFTER INSERT, solo messaggi del pro, nessuno scrive su
--     requests), trg_request_messages_appointment_guard (BEFORE, controlla
--     appointment_id);
--   trigger su requests: proteggi_chiusura_richiesta (BEFORE UPDATE OF
--     status, closed_reason: blocca solo il cambio di closed_reason e la
--     riapertura di una disdetta — qui non succede ne' l'uno ne' l'altro: si
--     parte da 'sent'/'quote_request', mai da 'closed'), set_request_comune e
--     on_request_search_event (non scattano su un cambio di status);
--   requests.status: draft, sent, quote_request, matched, closed;
--   request_messages.sender_type: customer, professional, bob;
--   request_messages.kind: text, appointment_proposal.
-- Nessuna funzione condivisa viene riscritta: la funzione e il trigger sono
-- nuovi.
--
-- Idempotente: create or replace, drop-then-create del trigger, e un
-- recupero che dopo il primo giro non trova piu' righe.

-- PERCHE' SECURITY DEFINER. Il pro non ha (e non deve avere) il diritto di
-- aggiornare requests: e' una scelta della RLS, non una dimenticanza. La
-- funzione gira col proprietario solo per questo passo. E' sicura perche'
-- puo' fare UNA cosa: portare in avanti, da 'sent'/'quote_request' a
-- 'matched', la sola richiesta a cui appartiene il messaggio appena inserito.
-- Nessun'altra colonna, nessun altro stato, nessun'altra riga. E il
-- messaggio stesso e' gia' passato dalla policy di insert del pro («Pro
-- inserts assigned messages»: sender_id = auth.uid(), un suo professional_id,
-- una richiesta che gli e' stata assegnata): un pro non puo' spostare una
-- richiesta che non e' sua. search_path vuoto e nomi qualificati, come le
-- altre DEFINER del progetto.
create or replace function public.richiesta_in_contatto_su_risposta_pro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_type = 'professional' then
    update public.requests
       set status = 'matched'
     where id = new.request_id
       and status in ('sent', 'quote_request');
  end if;
  return new;
end;
$$;

-- Una funzione di trigger non si chiama da fuori: nessuno ha bisogno di
-- EXECUTE (come la 063).
revoke execute on function public.richiesta_in_contatto_su_risposta_pro() from public, anon, authenticated;

drop trigger if exists richiesta_in_contatto_su_risposta_pro on public.request_messages;
create trigger richiesta_in_contatto_su_risposta_pro
  after insert on public.request_messages
  for each row execute function public.richiesta_in_contatto_su_risposta_pro();

-- IL RECUPERO, SOLO IN AVANTI. Le richieste aperte ancora 'sent' o
-- 'quote_request' che hanno gia' almeno un messaggio di un pro diventano
-- 'matched'. Quelle gia' 'matched' restano come sono, anche se nessun pro ha
-- scritto (ci sono arrivate col messaggio del cliente, prima di oggi): niente
-- torna indietro, e niente di chiuso si tocca. Il 15/10 in produzione sono 2
-- righe (5a431a74, quote_request; 63b920ef, sent), contate in sola lettura
-- prima di scrivere questo file.
update public.requests
   set status = 'matched'
 where status in ('sent', 'quote_request')
   and exists (
     select 1
       from public.request_messages m
      where m.request_id = requests.id
        and m.sender_type = 'professional'
   );
