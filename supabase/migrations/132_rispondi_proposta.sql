-- 132_rispondi_proposta.sql
--
-- IL CLIENTE CONFERMA O RIFIUTA UNA PROPOSTA: STATO E MESSAGGIO INSIEME
-- (17/10, Lucio; PR 3 di appuntamento-una-strada).
--
-- COM'ERA. Dalla PR #204 POST /api/appointments/[id]/conferma e /rifiuta
-- facevano due scritture separate con la sessione del cliente: l'update
-- dello stato e poi l'insert del messaggio in chat. Se la seconda falliva
-- (per esempio la RLS di request_messages, che non lascia scrivere in una
-- conversazione archiviata), l'appuntamento restava confermato senza traccia
-- in chat, e ripetere rispondeva «gia' fatto» senza riparare.
--
-- ADESSO. rispondi_proposta() fa i due passi in una transazione: o tutti e
-- due, o nessuno. La notifica resta nella route e parte solo se questa
-- funzione e' riuscita (l'email non si manda da dentro una transazione).
--
-- SECURITY INVOKER, search_path vuoto. Non serve alzare i privilegi: quello
-- che fa il cliente lo permette gia' la RLS (UPDATE «Customer responds to
-- proposed appointments», INSERT «User inserts own request_messages»), e
-- appointments_customer_guard (031) resta l'ultima parola su cosa puo'
-- cambiare. Girando come il cliente, i trigger vedono auth.uid() = cliente:
-- registra_evento_appuntamento scrive autore 'customer', come prima.
-- (annulla_appuntamento della 113 e' INVOKER solo fuori: dentro chiama
-- private.annulla_appuntamento, DEFINER, perche' deve scavalcare i trigger
-- con bob.annullamento. Qui non si scavalca niente.)
--
-- I MOTIVI (hint) li traduce la route, senza cambiare le risposte della #204:
--   non_trovato  -> 404  (non esiste, o la RLS non te la fa vedere)
--   non_cliente  -> 403  (la vedi ma non sei il cliente: per esempio il pro)
--   non_proposta -> 409  (non aspetta piu' una risposta)
--   proposta_tua -> 409  (l'ha proposta il cliente: aspetta il pro)
--   scaduta      -> 409  (l'orario e' gia' passato)
--   archiviata   -> 409  (il cliente ha archiviato la conversazione con quel
--                         pro: la riapre dalla pagina della richiesta). Nuovo:
--                         l'app lo deve conoscere.
-- La stessa risposta ripetuta non e' un errore: torna gia_fatto = true e non
-- scrive niente. La riga si blocca (for update): due risposte insieme si
-- mettono in fila, la seconda trova lo stato gia' cambiato.
--
-- I TESTI sono quelli del sito di oggi (src/lib/appuntamentoCliente.ts e
-- src/lib/rispostaProposta.ts), con l'ora italiana:
--   «Ho confermato l'appuntamento di dom 18 alle 10:00.»
--   «Non posso dom 18 alle 10:00: proponi un altro orario?»
--
-- STATO VIVO LETTO PRIMA DI SCRIVERE (17/10, sola lettura): nessuna funzione
-- rispondi_proposta in produzione. Nessun oggetto esistente cambia: qui si
-- aggiunge una funzione sola.
--
-- Idempotente: create or replace, revoke e grant si ripetono senza errori.

create or replace function public.rispondi_proposta(p_id uuid, p_ok boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.appointments%rowtype;
  v_nuovo text := case when p_ok then 'confirmed' else 'declined' end;
  v_dopo text;
  v_ora timestamp;
  v_quando text;
  v_testo text;
begin
  if v_uid is null then
    raise exception 'Accedi per rispondere' using errcode = '28000';
  end if;
  if p_ok is null then
    raise exception 'Manca la risposta' using errcode = '22023';
  end if;

  -- Sotto RLS: chi non e' una delle due parti non la trova.
  select * into a from public.appointments where id = p_id for update;
  if not found or a.request_id is null then
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;

  if not exists (
    select 1 from public.requests r
     where r.id = a.request_id and r.customer_id = v_uid
  ) then
    raise exception 'Solo il cliente può rispondere a questa proposta' using hint = 'non_cliente';
  end if;

  if a.status = v_nuovo then
    return jsonb_build_object(
      'ok', true, 'gia_fatto', true, 'status', v_nuovo,
      'request_id', a.request_id, 'professional_id', a.professional_id
    );
  end if;
  if a.status <> 'proposed' then
    raise exception 'Questo appuntamento non aspetta più una risposta' using hint = 'non_proposta';
  end if;
  if a.proposed_by is distinct from 'professional' then
    raise exception 'Questa proposta l''hai fatta tu: aspetta la risposta del professionista'
      using hint = 'proposta_tua';
  end if;
  if a.starts_at <= now() then
    raise exception 'Questo orario è già passato: chiedi al professionista un altro orario'
      using hint = 'scaduta';
  end if;

  -- La conversazione archiviata dal cliente non riceve risposte: la RLS
  -- rifiuterebbe il messaggio e si annullerebbe tutto, ma con un errore che
  -- non dice perche'. Archiviare rifiuta gia' le proposte aperte; una aperta
  -- qui l'ha riproposta il pro dopo (la sua policy di update non guarda
  -- archived_at), o la risposta e' partita mentre si archiviava. Da «Riapri»
  -- nella pagina della richiesta il cliente torna a poter rispondere.
  if exists (
    select 1 from public.request_professionals rp
     where rp.request_id = a.request_id
       and rp.professional_id = a.professional_id
       and rp.archived_at is not null
  ) then
    raise exception 'Hai archiviato questa conversazione: riaprila dalla pagina della richiesta per rispondere.'
      using hint = 'archiviata';
  end if;

  -- 1. Lo stato.
  update public.appointments set status = v_nuovo where id = a.id
  returning status into v_dopo;
  -- Un trigger l'ha portata altrove: non si scrive in chat una cosa falsa.
  if v_dopo is distinct from v_nuovo then
    raise exception 'Questo appuntamento non aspetta più una risposta' using hint = 'non_proposta';
  end if;

  -- 2. Il messaggio in chat, a nome del cliente. Se la RLS lo rifiuta, la
  -- funzione si interrompe e l'update qui sopra si annulla con lei.
  v_ora := a.starts_at at time zone 'Europe/Rome';
  v_quando := (array['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'])[extract(dow from v_ora)::int + 1]
              || ' ' || extract(day from v_ora)::int
              || ' alle ' || to_char(v_ora, 'HH24:MI');
  v_testo := case when p_ok
               then 'Ho confermato l''appuntamento di ' || v_quando || '.'
               else 'Non posso ' || v_quando || ': proponi un altro orario?'
             end;
  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (a.request_id, a.professional_id, 'customer', v_uid, v_testo, 'text', null);

  return jsonb_build_object(
    'ok', true, 'gia_fatto', false, 'status', v_nuovo,
    'request_id', a.request_id, 'professional_id', a.professional_id
  );
end;
$$;

revoke execute on function public.rispondi_proposta(uuid, boolean) from public, anon;
grant execute on function public.rispondi_proposta(uuid, boolean) to authenticated;
