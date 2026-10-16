-- 125_collegamento_pro_guardia.sql
--
-- CHI PUO' RAGGIUNGERE CHI: ALLA PROPRIA RICHIESTA SI COLLEGANO SOLO
-- PROFESSIONISTI CONTATTABILI, E SI SCRIVE SOLO A QUELLI COLLEGATI (16/10,
-- decisioni di André; chiude il rilievo serio del 29/09 «Dal browser si puo'
-- attaccare alla propria richiesta qualunque professionista» e il buco
-- gemello sui messaggi).
--
-- IL BUCO. Il browser del cliente scrive request_professionals in due flussi
-- legittimi: «Contatta» dal profilo (RequestDialog, un pro) e la richiesta di
-- preventivo dalla chat di Bob (QuoteDialog, i pro scelti fra i suggeriti).
-- La policy «User inserts own request_professionals» controlla solo che la
-- richiesta sia del chiamante, mai QUALE pro: dall'API si poteva collegare un
-- pro spento o non pronto, il proprio profilo da pro, o quanti pro si
-- voleva. Ogni pro collegato legge la richiesta e i suoi messaggi
-- (private.my_assigned_request_ids()), e dalle #172-#174 il collegamento
-- decide anche scelta, archiviazione e la casella del pro.
--
-- LA REGOLA, SOLO QUANDO INSERISCE UN UTENTE (auth.uid() non nullo). Il
-- service role (prenotazione diretta, /api/pro/instant-book) e' fidato e non
-- cambia.
--   1. Il pro deve essere PRONTO: private.pro_e_pronto(), la stessa regola
--      che tiene ready_at (almeno un servizio dichiarato e deactivated_at
--      nullo). Una fonte sola: non la si riscrive qui. La ricerca e il
--      profilo mostrano solo profili non spenti; il profilo non offre piu'
--      «Contatta» a chi non e' pronto (stessa PR).
--   2. Il pro non deve essere del chiamante (professionals.user_id).
--   3. Al massimo 3 pro per richiesta. E' una REGOLA DI PRODOTTO (André,
--      16/10): un preventivo si chiede a pochi, perche' il cliente possa
--      confrontare con calma e i pro abbiano motivo di rispondere. Nell'app
--      il numero sta in un posto solo, MAX_PRO_PER_RICHIESTA in
--      src/lib/collegamento.ts: lo usano la chat di Bob (non se ne scelgono
--      di piu') e il testo del rifiuto; un test controlla che coincida col
--      3 di questo file.
-- QuoteDialog inserisce PIU' righe in una sola istruzione: un trigger BEFORE
-- per riga non vede le righe sorelle. Per questo e' un trigger AFTER INSERT
-- per ISTRUZIONE, con la tabella di transizione delle righe nuove: conta le
-- righe della richiesta DOPO l'inserimento, sorelle comprese. Prima di
-- contare blocca la riga della richiesta (for update): due inserimenti
-- paralleli sulla stessa richiesta si mettono in fila, e il secondo conta
-- anche le righe del primo.
--
-- E NIENTE SPOSTAMENTI. «Pro updates own assignments» lascia al pro
-- l'UPDATE della propria riga senza limiti di colonna: poteva cambiare
-- request_id e spostare il suo collegamento sulla richiesta di un altro.
-- request_id e professional_id non cambiano piu' per nessun utente (stessa
-- forma di proteggi_archiviazione, 120).
--
-- PERMESSI. Tutto SECURITY INVOKER, search_path vuoto. Basta quello che il
-- cliente gia' vede: professionals e' leggibile da tutti, le righe della
-- propria richiesta le legge («User reads own request_professionals»), la
-- riga della propria richiesta la puo' aggiornare (e quindi bloccare), e
-- private.pro_e_pronto() e' eseguibile da authenticated (default: la
-- funzione e' della 062 e non ha revoke; se un giorno lo avesse, questi
-- inserimenti fallirebbero tutti, e il test locale lo dice). Le funzioni dei
-- trigger non si eseguono a mano: execute tolto a public, anon e
-- authenticated.
--
-- DATI ESISTENTI NON TOCCATI. Letto il 16/10 in produzione: 25 collegamenti,
-- nessuno a un pro spento o non pronto, nessuna richiesta con piu' di 2 pro;
-- 1 collegamento al proprio profilo (ca9d1532..., 03/06/2026). Resta: e'
-- storia, e i trigger guardano solo gli inserimenti nuovi.
--
-- I MESSAGGI DEL CLIENTE, LO STESSO BUCO. «User inserts own request_messages»
-- (letta viva il 16/10) controllava richiesta del chiamante, sender_type
-- 'customer' e sender_id, ma non il pro: il cliente poteva scrivere sulla
-- propria richiesta a un pro QUALUNQUE, e quel pro lo leggeva («Pro reads
-- assigned messages» guarda solo professional_id). Si riscrive dalla
-- definizione viva aggiungendo esattamente: professional_id non nullo, e
-- collegato alla richiesta con una riga NON archiviata (per un pro
-- archiviato si riapre prima con «Riapri», come l'interfaccia gia' chiede;
-- e' la stessa condizione che la 120 mette al pro). Letto in produzione:
-- nessun messaggio con professional_id nullo (le conversazioni sono per
-- coppia dalla 022), nessun messaggio del cliente a un pro non collegato.
-- Le note di Bob le scrivono funzioni col service role: non cambiano; la
-- policy del pro (120) non si tocca.
--
-- PRIVACY. Riduce chi puo' leggere le richieste e i messaggi dei clienti;
-- nessun dato o finalita' nuova: il registro dei trattamenti non cambia.
--
-- Idempotente: create or replace, drop-then-create dei trigger e della
-- policy, revoke ripetibili.

-- 1 e 2, e il tetto: una funzione sola, per istruzione.
create or replace function public.guardia_collegamento_pro()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pro uuid;
  v_richiesta uuid;
begin
  -- Il service role (auth.uid() nullo) e' fidato: prenotazione diretta.
  if auth.uid() is null then
    return null;
  end if;

  select n.professional_id into v_pro
    from nuove n
    join public.professionals p on p.id = n.professional_id
   where p.user_id = auth.uid()
   limit 1;
  if v_pro is not null then
    raise exception 'Non puoi contattare il tuo stesso profilo da professionista.'
      using errcode = '42501';
  end if;

  select n.professional_id into v_pro
    from nuove n
   where not private.pro_e_pronto(n.professional_id)
   limit 1;
  if v_pro is not null then
    raise exception 'Questo professionista non è disponibile per nuove richieste.'
      using errcode = '42501';
  end if;

  -- Il tetto, contando anche le righe gia' presenti. In fila per richiesta.
  perform 1
    from public.requests r
   where r.id in (select n.request_id from nuove n)
   order by r.id
     for update;
  select rp.request_id into v_richiesta
    from public.request_professionals rp
   where rp.request_id in (select n.request_id from nuove n)
   group by rp.request_id
  having count(*) > 3
   limit 1;
  if v_richiesta is not null then
    raise exception 'Puoi contattare al massimo 3 professionisti per richiesta.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke execute on function public.guardia_collegamento_pro() from public, anon, authenticated;

drop trigger if exists guardia_collegamento_pro on public.request_professionals;
create trigger guardia_collegamento_pro
  after insert on public.request_professionals
  referencing new table as nuove
  for each statement execute function public.guardia_collegamento_pro();

-- 4: il collegamento non si sposta.
create or replace function public.proteggi_collegamento()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.request_id is distinct from old.request_id
      or new.professional_id is distinct from old.professional_id)
     and auth.uid() is not null then
    raise exception 'Il collegamento fra una richiesta e un professionista non si sposta.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_collegamento() from public, anon, authenticated;

drop trigger if exists proteggi_collegamento on public.request_professionals;
create trigger proteggi_collegamento
  before update of request_id, professional_id on public.request_professionals
  for each row execute function public.proteggi_collegamento();

-- 5: si scrive solo a un pro collegato e non archiviato. Riscritta dalla
-- definizione viva (pg_policies del 16/10, md5 del WITH CHECK
-- 3217fc4cd4e52793886c6670da7d6434): le prime tre condizioni sono quelle,
-- le ultime due sono nuove.
drop policy if exists "User inserts own request_messages" on public.request_messages;
create policy "User inserts own request_messages" on public.request_messages
  for insert to public
  with check (
    (request_id in (select requests.id from public.requests where requests.customer_id = (select auth.uid())))
    and (sender_type = 'customer'::text)
    and (sender_id = (select auth.uid()))
    -- (125)
    and (professional_id is not null)
    and (exists (
      select 1 from public.request_professionals rp
       where rp.request_id = request_messages.request_id
         and rp.professional_id = request_messages.professional_id
         and rp.archived_at is null
    ))
  );
