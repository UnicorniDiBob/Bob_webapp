-- 131_indirizzo_solo_con_conferma_cliente.sql
--
-- L'INDIRIZZO DEL CLIENTE ARRIVA AL PROFESSIONISTA SOLO DOPO UNA CONFERMA CHE
-- IL CLIENTE HA DATO DAVVERO (17/10, decisioni di André; chiude il rilievo
-- serio del 17/10 «Un professionista collegato può ottenere l'indirizzo del
-- cliente creando o confermando da solo un appuntamento»).
--
-- IL NUMERO. Il task la chiamava 126, ma la 126 c'e' gia'
-- (126_limite_upload.sql) e main arriva alla 130: due file con lo stesso
-- numero romperebbero l'ordine delle migrazioni e scripts/deriva.sh. 131 e' il
-- primo numero libero su main, nelle PR aperte e nei rami.
--
-- IL CANCELLO DI OGGI (044, poi 048). Via e civico stanno in
-- request_addresses, e un pro li legge solo con un appuntamento 'confirmed' o
-- 'completed' su quella richiesta (private.can_see_request_address). Alla
-- conferma un trigger li copia anche nell'appuntamento (location_address), che
-- il pro legge sempre. Il cancello e' giusto; il buco e' che lo stato
-- 'confirmed' o 'completed' il pro poteva scriverselo da solo, e il trigger
-- della copia girava PRIMA di quello che rimette le cose a posto. Provato in
-- locale, ruoli veri, transazione annullata (T2-T8, prove fuori dal repo
-- perche' il repo e' pubblico): il pro collegato, mai scelto, leggeva
-- l'indirizzo. Esposto dalla 044 sul percorso del preventivo. In produzione il 17/10: una sola riga in request_addresses,
-- di un account di prova, e nessun indirizzo copiato in un appuntamento.
--
-- LA REGOLA, SOLO PER IL PRO (auth.uid() e' l'utente del professionista
-- dell'appuntamento) E SOLO SU UN APPUNTAMENTO LEGATO A UNA RICHIESTA. Le voci
-- dell'agenda personale (request_id nullo) non hanno un cliente Bob da cui
-- aspettare una conferma, e restano come sono. Il service role (auth.uid()
-- nullo: prenotazione diretta /api/pro/instant-book, controproposta del
-- cliente /api/appointments/counter, i job) e' fidato e non cambia. Il cliente
-- lo regola gia' appointments_customer_guard (031): puo' solo confermare o
-- rifiutare una proposta.
--   1. Il pro CREA solo proposte. Qualunque stato scriva, o il default della
--      colonna, la riga nasce 'proposed', proposta da lui. Si CORREGGE invece
--      di rifiutare, per tre ragioni: e' gia' la regola di
--      riproponi_se_spostato (107: «ogni altra conferma che il cliente non ha
--      dato torna una proposta»); il calendario del pro oggi offre
--      «Confermato» e la migrazione si applica PRIMA del merge che lo toglie,
--      quindi in quella finestra un rifiuto sarebbe un errore in un flusso che
--      l'interfaccia stessa offre; e il risultato e' quello che il pro voleva,
--      reso corretto: il cliente riceve la proposta e la conferma lui.
--   2. Il pro PORTA A 'confirmed' o 'completed' solo:
--      - un appuntamento gia' confermato o concluso (concluso → confermato e
--        ritorno: l'indirizzo era gia' aperto, da una conferma del cliente);
--      - una proposta DEL CLIENTE accettata cosi' com'e' (il cliente ha
--        scelto lui l'orario: e' la sua conferma), o rimessa all'orario che il
--        cliente aveva confermato quando il pro rifiuta un suo spostamento
--        (spostamento_rifiutato, 118: lo segnala con bob.ripristino).
--      Ogni altro passaggio torna 'proposed', proposta da lui. Non conta la
--      data: l'esenzione per il passato di riproponi_se_spostato (107:
--      «correggere a posteriori l'ora di un lavoro gia' fatto») resta per gli
--      SPOSTAMENTI, non vale piu' per la CONFERMA, perche' questa regola la
--      controlla dopo, qualunque sia l'orario.
--   3. Il pro non si fa passare per il cliente: non puo' scrivere
--      proposed_by = 'customer' su una proposta sua (torna 'professional').
--   4. Il pro non sposta un appuntamento su un'altra richiesta, ne' lo
--      attacca a una richiesta se era una voce della sua agenda: altrimenti un
--      appuntamento confermato in agenda diventerebbe una conferma su una
--      richiesta altrui. Qui si RIFIUTA: nessuna schermata lo fa.
--   5. La copia dell'indirizzo nell'appuntamento gira per ULTIMA, dopo tutte
--      le regole sullo stato: uno stato rimesso a 'proposed' non lascia piu'
--      un indirizzo copiato. Stessa funzione (044), trigger rinominato perche'
--      i trigger BEFORE girano in ordine alfabetico.
--   6. Il default della colonna diventa 'proposed'. Controllato che nessuno
--      si appoggi a 'confirmed': instant-book e controproposta scrivono lo
--      stato esplicito (service role); la proposta dalla chat del pro scrive
--      'proposed'; il calendario del pro manda sempre lo stato; nessuna
--      funzione del database inserisce appuntamenti; il seed degli idraulici
--      demo non ne crea; gli script di prova scrivono lo stato esplicito;
--      Bob_app non scrive appuntamenti.
--
-- L'ORDINE (trigger BEFORE, alfabetico):
--   INSERT: a_pro_propone_soltanto (nuovo) → proteggi_finestra_disdetta →
--           z_analisi_campi_appuntamento → zz_sovrapposizione_cliente →
--           zzz_indirizzo_dopo_conferma (era appointments_fill_location).
--           Primo, cosi' il preavviso (proteggi_finestra_disdetta) non si
--           calcola su una conferma che non c'e'.
--   UPDATE: appointments_customer_guard → … → riproponi_se_spostato →
--           spostamento_rifiutato → y_conferma_solo_dal_cliente (nuovo) →
--           z_analisi_campi_appuntamento → zz_sovrapposizione_cliente →
--           zzz_indirizzo_dopo_conferma. Dopo riproponi e
--           spostamento_rifiutato, cosi' vede lo stato che hanno deciso loro
--           (e bob.ripristino); prima dell'analisi, della sovrapposizione e
--           della copia, cosi' loro vedono lo stato finale.
--
-- NON CAMBIA: private.can_see_request_address (il momento resta l'appuntamento
-- confermato, non «Scegli»), le policy, i dati. Gli appuntamenti gia'
-- confermati restano come sono, anche quelli che il pro si era confermato da
-- solo prima della 131: cosa farne e' una decisione a parte (PR, parte C). In
-- produzione il 17/10 nessuno di loro ha un indirizzo copiato.
--
-- RISCRITTA DALLA VIVA: nessuna funzione esistente viene riscritta. Questa
-- migrazione si appoggia pero' al CORPO di cinque funzioni (l'ordine, i flag,
-- il cancello): il blocco qui sotto controlla che siano ancora quelle lette in
-- produzione il 17/10 (md5 di pg_get_functiondef) e si ferma se una e'
-- cambiata, perche' allora il ragionamento sopra va rifatto.
--
-- CONFORMITA'. Nessun dato personale nuovo, nessuna finalita' nuova: stringe
-- la divulgazione progressiva gia' dichiarata (DATA_COMPLIANCE, 044). Registro
-- dei trattamenti invariato. Nessuna tabella nuova.
--
-- Idempotente: drop-then-create di trigger, create or replace della funzione;
-- il default si riscrive uguale.

-- ------------------------------------------------- 0. le funzioni a cui si appoggia

do $$
declare
  v_attese constant jsonb := jsonb_build_object(
    'public.fill_appointment_location_from_request()', '20000d87a89e9db20efd53e38c6fbce3',
    'public.riproponi_se_spostato()',                  '1e7906871b80314e0bb6d041cbf564cd',
    'private.spostamento_rifiutato()',                 '121607e55c1f95768dd40c285209bb4a',
    'public.appointments_customer_guard()',            '55e7fb48d1585886ad26e8710644e2f1',
    'private.can_see_request_address(uuid)',           'a50e0bd224be71edd43b4c2f00445d10'
  );
  v_nome text;
  v_md5 text;
begin
  for v_nome in select jsonb_object_keys(v_attese) loop
    v_md5 := md5(pg_get_functiondef(v_nome::regprocedure));
    if v_md5 is distinct from v_attese ->> v_nome then
      raise exception '131: % non e'' piu'' quella letta in produzione il 17/10 (md5 %, attesa %). Rileggere la 131 dalla viva prima di applicarla.',
        v_nome, v_md5, v_attese ->> v_nome;
    end if;
  end loop;
end $$;

-- ------------------------------------------------- 1-4. la regola del pro

create or replace function private.conferma_solo_dal_cliente()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- Il service role e' fidato (instant-book, controproposta, job).
  if auth.uid() is null then
    return new;
  end if;

  -- Solo il pro dell'appuntamento. Il cliente lo regola
  -- appointments_customer_guard (031).
  if not exists (
    select 1 from public.professionals p
     where p.id = case when tg_op = 'INSERT' then new.professional_id else old.professional_id end
       and p.user_id = auth.uid()
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- (1) Su una richiesta il pro crea solo proposte.
    if new.request_id is not null then
      new.status := 'proposed';
      new.proposed_by := 'professional';
    end if;
    return new;
  end if;

  -- (4) La richiesta di un appuntamento non cambia.
  if new.request_id is distinct from old.request_id then
    raise exception 'Un appuntamento non passa da una richiesta all''altra: proponine uno nuovo dalla chat'
      using hint = 'richiesta_fissa';
  end if;

  -- L'agenda personale e' affare del pro.
  if new.request_id is null then
    return new;
  end if;

  -- (3) Il pro non firma per il cliente.
  if new.proposed_by = 'customer' and old.proposed_by is distinct from 'customer' then
    new.proposed_by := 'professional';
  end if;

  -- (2) Confermato o concluso solo da una conferma del cliente.
  if new.status in ('confirmed', 'completed')
     and new.status is distinct from old.status
     and not (
       old.status in ('confirmed', 'completed')
       or (
         old.status = 'proposed'
         and old.proposed_by = 'customer'
         and new.status = 'confirmed'
         and (
           (new.starts_at = old.starts_at and new.duration_minutes = old.duration_minutes)
           or current_setting('bob.ripristino', true) = old.id::text
         )
       )
     ) then
    new.status := 'proposed';
    new.proposed_by := 'professional';
  end if;

  return new;
end;
$function$;

revoke execute on function private.conferma_solo_dal_cliente() from public, anon, authenticated;

comment on function private.conferma_solo_dal_cliente() is
  'Migrazione 131: su un appuntamento legato a una richiesta il pro crea solo proposte e non conferma ne'' conclude da solo; la conferma la da'' il cliente. Senza questo, il pro si apriva da solo l''indirizzo (044).';

drop trigger if exists a_pro_propone_soltanto on public.appointments;
create trigger a_pro_propone_soltanto
  before insert on public.appointments
  for each row execute function private.conferma_solo_dal_cliente();

drop trigger if exists y_conferma_solo_dal_cliente on public.appointments;
create trigger y_conferma_solo_dal_cliente
  before update on public.appointments
  for each row execute function private.conferma_solo_dal_cliente();

-- ------------------------------------------------- 5. la copia dell'indirizzo per ultima

drop trigger if exists appointments_fill_location on public.appointments;
drop trigger if exists zzz_indirizzo_dopo_conferma on public.appointments;
create trigger zzz_indirizzo_dopo_conferma
  before insert or update of status, location_address on public.appointments
  for each row execute function public.fill_appointment_location_from_request();

-- ------------------------------------------------- 6. il default

alter table public.appointments alter column status set default 'proposed';
