-- 116_ritardo_e_sovrapposizione.sql
--
-- IL RITARDO, E LA SOVRAPPOSIZIONE PERMESSA AL PRO (07/10, Lucio).
--
-- COM'ERA. Un pro in ritardo di venti minuti aveva due strade, tutte e due
-- sbagliate: spostare l'appuntamento (che lo rimandava al cliente da
-- confermare, 107) o non dire niente. E se il ritardo invadeva
-- l'appuntamento dopo, il vincolo di esclusione della 113
-- (appuntamenti_cliente_senza_sovrapposizioni) lo fermava: il vincolo non
-- sa chi scrive, e trattava il pro come un cliente che prende uno slot
-- occupato.
--
-- LE DECISIONI (Lucio, 07/10).
--   1. IL RITARDO e' un concetto suo, non uno spostamento. Il pro dichiara
--      «sono in ritardo di N minuti» su un appuntamento confermato della
--      giornata in corso: starts_at slitta di N minuti, l'appuntamento
--      RESTA confermato, il cliente non deve approvare, il preavviso non
--      conta (un ritardo e' per definizione dentro). Nuovo tipo 'ritardo'
--      nello storico, con l'ora di prima, quella di dopo e il motivo se c'e'.
--      Il cliente lo legge in chat e in campanella.
--   2. SE IL RITARDO INVADE GLI APPUNTAMENTI DOPO, il pro li vede prima di
--      confermare e decide se avvisarli: a ognuno arriva in chat «il tuo
--      appuntamento potrebbe slittare di circa N minuti». I loro orari NON
--      cambiano: e' solo un avviso.
--   3. LA SOVRAPPOSIZIONE E' PERMESSA AL PRO E VIETATA AL CLIENTE. Il
--      vincolo di esclusione esce; al suo posto un trigger che vieta la
--      sovrapposizione solo quando l'orario lo sceglie il cliente, con la
--      stessa semantica (stesso professionista, appuntamenti con un cliente,
--      confermati o proposti, agenda privata esclusa) e lo stesso errore
--      (23P01, hint «occupato»). Chi e' «il pro»:
--        - l'interruttore di transazione bob.sovrapposizione = 'si', acceso
--          dalle funzioni che agiscono per conto del pro (il ritardo, lo
--          spostamento del pro) — lo stesso idioma di bob.annullamento (113);
--        - il pro titolare che scrive dal browser (auth.uid()), come gia'
--          riconoscono riproponi_se_spostato e registra_evento_appuntamento:
--          la proposta in chat e la modifica dal calendario sono INSERT e
--          UPDATE diretti, e un interruttore da li' non si accende (deciso
--          con Lucio il 07/10).
--      Eccezione, che resta vietata anche al pro: il rifiuto di uno
--      spostamento del cliente che rimette l'orario di prima (115) sopra un
--      altro cliente. L'orario lo sceglie il database, non il pro, e la 115
--      ha deciso che li' ci si ferma invece di sovrapporre in silenzio.
--      ACCETTARE NON E' SCEGLIERE (Lucio, 07/10): il cliente che conferma
--      una proposta del pro cosi' com'e' passa sempre — l'orario l'ha scelto
--      il pro, e che si sovrapponga non sono affari del cliente. Il cliente
--      riceve un no solo quando chiede LUI un orario: prenotazione diretta,
--      controproposta, spostamento.
--      Gli slot liberi mostrati al cliente (/api/pro/slots,
--      /api/pro/instant-slots) restano calcolati dagli orari ATTUALI degli
--      appuntamenti: un appuntamento slittato occupa il suo orario nuovo,
--      e il cliente non vede uno slot che non potrebbe prendere.
--   4. L'AVVISO DI SOVRAPPOSIZIONE per il pro e' una sua preferenza, che lo
--      segue su ogni dispositivo: professionals.avviso_sovrapposizione.
--      protect_professional_columns e' una lista di colonne VIETATE: questa,
--      nuova, il pro la cambia da solo, come preavviso_annullamento_ore.
--   5. IL MOTIVO DELL'ANNULLAMENTO DIVENTA FACOLTATIVO ANCHE PER IL PRO.
--      Resta registrato quando c'e'. Il «concordato al telefono» dentro il
--      preavviso non cambia.
--   6. IL PRO SPOSTA CON LA STESSA REGOLA DELL'ANNULLAMENTO. Fuori dal
--      preavviso sposta dal sito e il cliente riconferma (come oggi, 107);
--      dentro il preavviso chiama, e poi registra lo spostamento dichiarando
--      di averlo concordato al telefono: allora resta confermato, perche'
--      il cliente ha gia' detto si'. sposta_appuntamento() (115) regge ora
--      anche l'autore 'professional'. Lo spostamento diretto dal calendario
--      dentro il preavviso il database lo rifiuta (hint «chiama»).
--
-- FUNZIONI CONDIVISE RISCRITTE DA QUELLE VIVE (pg_get_functiondef del 07/10):
--   riproponi_se_spostato          md5 66229b9b9ab48a2314acc390a214071d
--   registra_evento_appuntamento   md5 f107ca60c30e21bb74a25cb4cbc1645e
--   annulla_appuntamento (private) md5 e01bc72f9a13fed531151b66f58bf50a
--   sposta_appuntamento            md5 64dc81cbb64af0ba59fd674770a7b5c8
-- Ognuna cambia nei punti segnati con (116).
--
-- L'ORDINE DEI TRIGGER BEFORE (alfabetico) dopo questa migrazione:
--   appointments_customer_guard, appointments_fill_location,
--   proteggi_appuntamento_cliente, proteggi_finestra_disdetta,
--   proteggi_spostamento_pro (nuovo), riproponi_se_spostato,
--   spostamento_rifiutato, z_analisi_campi_appuntamento,
--   zz_sovrapposizione_cliente (nuovo).
-- zz_sovrapposizione_cliente DEVE essere l'ultimo: guarda la riga come la
-- lasciano gli altri (riproponi cambia lo stato, spostamento_rifiutato
-- rimette l'orario di prima). proteggi_spostamento_pro non dipende
-- dall'ordine: legge solo old e new.starts_at e al massimo si ferma.
--
-- PERSONALI E CONSERVAZIONE. Nessuna tabella nuova. Il tipo 'ritardo' sta in
-- appointment_events (ROPA A5): un orario, un motivo facoltativo scritto dal
-- pro, la stessa conservazione dello storico (cascade con la richiesta e
-- con il professionista). avviso_sovrapposizione e' una preferenza
-- d'interfaccia del pro, nessun dato su terzi: vive e muore con la riga del
-- professionista. Gli avvisi in chat sono transazionali, non promozionali.
--
-- Idempotente: if not exists, drop-then-recreate per vincoli, trigger e
-- funzioni.

begin;

-- 1. Il tipo «ritardo» nello storico ---------------------------------------------
alter table public.appointment_events
  drop constraint if exists appointment_events_tipo_check;
alter table public.appointment_events
  add constraint appointment_events_tipo_check check (tipo in (
    'prenotato', 'proposto', 'confermato', 'rifiutato', 'ritirato',
    'spostato', 'annullato', 'concluso', 'riproposto', 'ritardo'
  ));

comment on table public.appointment_events is
  'Storico degli appuntamenti con un cliente: chi ha prenotato, proposto, spostato (da che ora a che ora), dichiarato un ritardo (116), annullato e perche''. Lo scrive solo il trigger registra_evento_appuntamento. Conservazione: con la richiesta e con il professionista (cascade). ROPA A5, migrazioni 113 e 116.';

-- 2. L'avviso di sovrapposizione, preferenza del pro ---------------------------
alter table public.professionals
  add column if not exists avviso_sovrapposizione boolean not null default true;

comment on column public.professionals.avviso_sovrapposizione is
  'Se mostrare al pro l''avviso «si sovrappone a...» quando sceglie un orario occupato (116). E'' un avviso, non un divieto: la sovrapposizione al pro e'' permessa. Il pro la spegne con «non mostrarmelo piu''» e la riaccende dalle impostazioni.';

-- 3. Uno slot, un cliente: dal vincolo al trigger -------------------------------
alter table public.appointments
  drop constraint if exists appuntamenti_cliente_senza_sovrapposizioni;

-- L'indice che il vincolo portava con se': senza, il controllo qui sotto
-- leggerebbe tutti gli appuntamenti del pro.
create index if not exists appuntamenti_cliente_fascia_idx
  on public.appointments using gist (
    professional_id,
    public.fascia_appuntamento(starts_at, duration_minutes)
  )
  where (request_id is not null and status in ('confirmed', 'proposed'));

-- SECURITY DEFINER: il cliente non vede gli appuntamenti degli altri clienti
-- (RLS), ma il controllo deve vederli tutti. In `private`, dove PostgREST non
-- arriva; nessuno la chiama se non il trigger.
create or replace function private.sovrapposizione_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_altro uuid;
begin
  if new.request_id is null or new.status not in ('confirmed', 'proposed') then
    return new;
  end if;

  -- Il pro, da una funzione che agisce per lui (ritardo, spostamento).
  if current_setting('bob.sovrapposizione', true) = 'si' then
    return new;
  end if;

  -- L'orario non si sceglie adesso: confermare o rifiutare una proposta,
  -- ritoccare titolo, prezzo, note. Accettare non e' scegliere.
  if tg_op = 'UPDATE'
     and new.starts_at = old.starts_at
     and new.duration_minutes = old.duration_minutes
     and new.professional_id = old.professional_id then
    return new;
  end if;

  -- Il pro titolare che sceglie l'orario dal calendario o dalla chat. Non
  -- lo e' il database che rimette l'orario di prima dopo il rifiuto di uno
  -- spostamento (115): l'unico modo in cui una proposta del cliente diventa
  -- confermata a un orario diverso, perche' una conferma spostata dal pro
  -- riproponi_se_spostato la riporta a proposta.
  if v_uid is not null
     and exists (
       select 1 from public.professionals p
        where p.id = new.professional_id and p.user_id = v_uid
     )
     and not (
       tg_op = 'UPDATE'
       and old.status = 'proposed'
       and old.proposed_by = 'customer'
       and new.status = 'confirmed'
     ) then
    return new;
  end if;

  -- Il cliente (dal browser o dalle route di servizio: prenotazione
  -- diretta, controproposta). Due prenotazioni simultanee sullo stesso pro
  -- si mettono in fila qui: la seconda legge dopo che la prima ha chiuso,
  -- e la vede. Era il lavoro che faceva il vincolo di esclusione.
  perform pg_advisory_xact_lock(hashtextextended('bob.agenda:' || new.professional_id::text, 0));

  select a.id into v_altro
    from public.appointments a
   where a.professional_id = new.professional_id
     and a.id <> new.id
     and a.request_id is not null
     and a.status in ('confirmed', 'proposed')
     and public.fascia_appuntamento(a.starts_at, a.duration_minutes)
         && public.fascia_appuntamento(new.starts_at, new.duration_minutes)
   limit 1;
  if v_altro is not null then
    raise exception 'Quell''orario non e'' piu'' libero: scegline un altro'
      using errcode = 'exclusion_violation', hint = 'occupato';
  end if;
  return new;
end;
$$;

revoke execute on function private.sovrapposizione_cliente() from public, anon, authenticated;

drop trigger if exists zz_sovrapposizione_cliente on public.appointments;
create trigger zz_sovrapposizione_cliente
  before insert or update of starts_at, duration_minutes, status, professional_id, request_id
  on public.appointments
  for each row execute function private.sovrapposizione_cliente();

-- 4. riproponi_se_spostato si fa da parte per le funzioni ----------------------
-- RISCRITTA DALLA VIVA. Cambia una riga (116): con l'interruttore della 113
-- acceso, chi scrive e' una funzione che ha gia' deciso lo stato (il ritardo
-- resta confermato; lo spostamento concordato al telefono anche; quello dal
-- sito torna proposta da se'). Prima nessuna funzione cambiava l'orario
-- come pro, quindi la riga non serviva.
create or replace function public.riproponi_se_spostato()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_spostato boolean;
begin
  if auth.uid() is null
     or current_setting('bob.annullamento', true) = 'si' -- (116)
     or new.request_id is null
     or new.starts_at <= now() then
    return new;
  end if;
  if not exists (
    select 1 from public.professionals p
     where p.id = new.professional_id and p.user_id = auth.uid()
  ) then
    return new;
  end if;

  v_spostato := new.starts_at is distinct from old.starts_at
             or new.duration_minutes is distinct from old.duration_minutes;

  -- Il pro accetta la proposta del cliente, tale e quale: conferma vera.
  if new.status = 'confirmed' and old.status = 'proposed'
     and old.proposed_by = 'customer' and not v_spostato then
    return new;
  end if;

  -- Ogni altra conferma che il cliente non ha dato torna una proposta.
  if new.status = 'confirmed' and (old.status <> 'confirmed' or v_spostato) then
    new.status := 'proposed';
    new.proposed_by := 'professional';
    return new;
  end if;

  -- Una proposta (anche del cliente) spostata dal pro diventa sua.
  if new.status = 'proposed' and v_spostato then
    new.proposed_by := 'professional';
  end if;
  return new;
end;
$function$;

-- 5. Lo storico sa cos'e' un ritardo -------------------------------------------
-- RISCRITTA DALLA VIVA. Cambia una riga (116): quando l'orario cambia, il
-- tipo e' 'spostato' a meno che la funzione che scrive non dica altro
-- (bob.tipo = 'ritardo').
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
    v_tipo := coalesce(nullif(current_setting('bob.tipo', true), ''), 'spostato'); -- (116)
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

-- 6. Il motivo dell'annullamento e' facoltativo anche per il pro --------------
-- RISCRITTA DALLA VIVA (private.annulla_appuntamento, spostata li' dalla 114;
-- l'involucro in public non cambia). Cambia (116): tolto il controllo
-- «motivo» del pro. Il resto, telefonata dentro il preavviso compresa, e'
-- byte per byte quello vivo.
create or replace function private.annulla_appuntamento(
  p_id uuid,
  p_motivo text default null::text,
  p_concordato_telefono boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  -- (116) Il motivo non e' piu' obbligatorio per il pro: resta registrato
  -- quando c'e'.
  if v_ruolo = 'professional' and v_dentro and not v_concordato then
    raise exception 'Mancano meno di % ore: prima chiama il cliente, poi registra l''annullamento', v_preavviso
      using hint = 'chiama';
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

  -- L'interruttore si spegne qui, non a fine transazione: da PostgREST ogni
  -- chiamata e' una transazione sua, ma chi chiamasse questa funzione dentro
  -- una transazione piu' lunga si ritroverebbe i trigger ancora disarmati
  -- per tutto il resto (le prove della 113 l'hanno mostrato).
  perform set_config('bob.annullamento', '', true);
  perform set_config('bob.autore', '', true);
  perform set_config('bob.motivo', '', true);
  perform set_config('bob.concordato', '', true);
  perform set_config('bob.dentro', '', true);

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
$function$;

revoke execute on function private.annulla_appuntamento(uuid, text, boolean) from public, anon;
grant execute on function private.annulla_appuntamento(uuid, text, boolean) to authenticated;

-- 7. Lo spostamento diretto del pro dentro il preavviso: si chiama -----------
-- Dal calendario (UPDATE di starts_at) un appuntamento confermato con un
-- cliente si sposta solo fuori dal preavviso, come si annulla. Dentro, la
-- strada e' sposta_appuntamento() con «concordato al telefono», che accende
-- l'interruttore e passa. La durata non e' affare di questa regola
-- (cambiarla riapre comunque la conferma, 107), e nemmeno un appuntamento
-- gia' cominciato. Il cliente non arriva qui: il suo guard gli
-- vieta di toccare starts_at.
create or replace function private.proteggi_spostamento_pro()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_preavviso integer;
begin
  if auth.uid() is null
     or current_setting('bob.annullamento', true) = 'si'
     or old.request_id is null
     or old.status <> 'confirmed'
     or new.starts_at = old.starts_at
     or old.starts_at <= now() then
    return new;
  end if;
  select coalesce(old.cancellation_window_hours, p.preavviso_annullamento_ore, 48)
    into v_preavviso
    from public.professionals p
   where p.id = old.professional_id and p.user_id = auth.uid();
  if not found then
    return new;
  end if;
  if now() > old.starts_at - make_interval(hours => v_preavviso) then
    raise exception 'Mancano meno di % ore: prima chiama il cliente, poi registra lo spostamento', v_preavviso
      using hint = 'chiama';
  end if;
  return new;
end;
$$;

revoke execute on function private.proteggi_spostamento_pro() from public, anon, authenticated;

drop trigger if exists proteggi_spostamento_pro on public.appointments;
create trigger proteggi_spostamento_pro
  before update of starts_at on public.appointments
  for each row execute function private.proteggi_spostamento_pro();

-- 8. Spostare, ora anche per il pro ------------------------------------------
-- RISCRITTA DALLA VIVA (115). Cambia (116): un parametro in piu',
-- p_concordato_telefono, e il ramo del pro al posto del «il professionista
-- sposta dal calendario». Il ramo del cliente e' quello di prima, riga per
-- riga. La firma cambia, quindi la vecchia esce: con due versioni, una
-- chiamata con tre argomenti sarebbe ambigua.
--   Pro fuori dal preavviso: l'orario nuovo torna al cliente da confermare
--     (proposta del pro), come uno spostamento dal calendario (107).
--   Pro dentro il preavviso: solo dichiarando la telefonata; resta
--     confermato, perche' il cliente l'ha gia' detto a voce.
--   Il pro puo' sovrapporsi (interruttore bob.sovrapposizione); il cliente no.
drop function if exists public.sposta_appuntamento(uuid, timestamptz, text);

create or replace function public.sposta_appuntamento(
  p_id uuid,
  p_inizio timestamptz,
  p_motivo text default null,
  p_concordato_telefono boolean default false
)
returns jsonb
language plpgsql
security invoker
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
    v_ruolo := 'professional'; -- (116)
  elsif a.customer_id = v_uid
     or exists (
       select 1 from public.requests r
        where r.id = a.request_id and r.customer_id = v_uid
     ) then
    v_ruolo := 'customer';
  else
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
  v_dentro := now() > a.starts_at - make_interval(hours => v_preavviso);
  if v_dentro and v_ruolo = 'customer' then
    raise exception 'Mancano meno di % ore: per spostarlo chiama il professionista', v_preavviso
      using hint = 'chiama';
  end if;
  if v_dentro and v_ruolo = 'professional' and not v_concordato then -- (116)
    raise exception 'Mancano meno di % ore: prima chiama il cliente, poi registra lo spostamento', v_preavviso
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
  perform set_config('bob.autore', v_ruolo, true);
  perform set_config('bob.motivo', coalesce(v_motivo, ''), true);

  if v_ruolo = 'customer' then
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
  else
    -- (116) Il pro. Puo' sovrapporsi: e' una sua scelta, e l'interfaccia
    -- glielo ha gia' detto.
    perform set_config('bob.sovrapposizione', 'si', true);
    perform set_config('bob.concordato', case when v_dentro then 'si' else '' end, true);
    perform set_config('bob.dentro', case when v_dentro then 'si' else '' end, true);
    if v_dentro then
      update public.appointments set starts_at = p_inizio where id = a.id;
      v_testo := 'Ho spostato l''appuntamento di '
                 || private.quando_breve(a.starts_at)
                 || coalesce(' (' || a.title || ')', '')
                 || ' a ' || private.quando_breve(p_inizio) || ', come concordato al telefono.'
                 || coalesce(' Motivo: ' || v_motivo, '');
    else
      update public.appointments
         set starts_at = p_inizio,
             status = 'proposed',
             proposed_by = 'professional'
       where id = a.id;
      v_testo := 'Ho spostato l''appuntamento: da ' || private.quando_breve(a.starts_at)
                 || ' a ' || private.quando_breve(p_inizio)
                 || ' (' || a.duration_minutes || ' min). Confermalo qui sotto o proponi un altro orario.'
                 || coalesce(' Motivo: ' || v_motivo, '');
    end if;
  end if;

  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (a.request_id, a.professional_id, v_ruolo, v_uid, v_testo,
     'appointment_proposal', a.id);

  -- Si spegne qui, non a fine transazione (stessa lezione della 113).
  perform set_config('bob.annullamento', '', true);
  perform set_config('bob.sovrapposizione', '', true);
  perform set_config('bob.autore', '', true);
  perform set_config('bob.motivo', '', true);
  perform set_config('bob.concordato', '', true);
  perform set_config('bob.dentro', '', true);

  return jsonb_build_object(
    'ok', true,
    'ruolo', v_ruolo,
    'request_id', a.request_id,
    'professional_id', a.professional_id,
    'customer_name', a.customer_name,
    'title', a.title,
    'inizio_prima', a.starts_at,
    'inizio_dopo', p_inizio,
    'duration_minutes', a.duration_minutes,
    'resta_confermato', v_ruolo = 'professional' and v_dentro
  );
end;
$$;

revoke execute on function public.sposta_appuntamento(uuid, timestamptz, text, boolean) from public, anon;
grant execute on function public.sposta_appuntamento(uuid, timestamptz, text, boolean) to authenticated;

-- 9. Il ritardo ----------------------------------------------------------------
-- Solo il pro titolare, solo un appuntamento confermato con un cliente della
-- giornata in corso (ora di Roma) e non ancora finito. Da 1 a 240 minuti:
-- oltre e' uno spostamento. Il preavviso non conta.
--
-- Con p_solo_anteprima = true controlla tutto e restituisce cosa succederebbe
-- senza scrivere niente: l'interfaccia lo usa per mostrare al pro quali
-- appuntamenti della giornata vengono toccati prima che confermi. Le regole
-- stanno in un posto solo, e l'anteprima non puo' dire «puoi» quando la
-- scrittura direbbe «no».
--
-- «Toccati» = gli appuntamenti della stessa giornata, a partire dall'ora di
-- prima, che il ritardo raggiunge a catena: se il primo slitta di 20 minuti
-- e il secondo cominciava 10 minuti dopo la fine, il secondo slitta di 10, e
-- cosi' via finche' c'e' margine. I loro orari NON cambiano: con
-- p_avvisa_toccati = true a ogni cliente arriva un messaggio in chat. Le
-- voci dell'agenda privata compaiono nell'elenco (il pro deve saperlo) ma
-- non c'e' nessuno da avvisare.
--
-- Errori con un HINT, come le altre: «non_trovato», «non_attivo» (non
-- confermato, finito, privato), «non_oggi», «minuti».
create or replace function public.segnala_ritardo(
  p_id uuid,
  p_minuti integer,
  p_motivo text default null,
  p_avvisa_toccati boolean default false,
  p_solo_anteprima boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.appointments%rowtype;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 500);
  v_dopo timestamptz;
  v_fine timestamptz;
  v_slitta integer;
  v_toccati jsonb := '[]'::jsonb;
  v_avvisati integer := 0;
  r record;
  v_testo text;
begin
  if v_uid is null then
    raise exception 'Accedi per segnalare un ritardo' using errcode = '28000';
  end if;

  select * into a from public.appointments where id = p_id for update;
  if not found or not exists (
    select 1 from public.professionals p
     where p.id = a.professional_id and p.user_id = v_uid
  ) then
    -- Il cliente non segnala ritardi, e chi non e' delle parti non vede.
    raise exception 'Appuntamento non trovato' using hint = 'non_trovato';
  end if;

  if a.request_id is null then
    raise exception 'E'' nella tua agenda privata: spostalo dal calendario'
      using hint = 'non_attivo';
  end if;
  if a.status <> 'confirmed'
     or a.starts_at + make_interval(mins => a.duration_minutes) <= now() then
    raise exception 'Questo appuntamento non e'' in corso ne'' da venire'
      using hint = 'non_attivo';
  end if;
  if (a.starts_at at time zone 'Europe/Rome')::date
     <> (now() at time zone 'Europe/Rome')::date then
    raise exception 'Il ritardo si segnala solo per gli appuntamenti di oggi: per un altro giorno spostalo'
      using hint = 'non_oggi';
  end if;
  if p_minuti is null or p_minuti < 1 or p_minuti > 240 then
    raise exception 'Scegli un ritardo fra 1 e 240 minuti: oltre, spostalo'
      using hint = 'minuti';
  end if;

  v_dopo := a.starts_at + make_interval(mins => p_minuti);
  v_fine := v_dopo + make_interval(mins => a.duration_minutes);

  for r in
    select x.id, x.request_id, x.customer_name, x.title, x.starts_at, x.duration_minutes
      from public.appointments x
     where x.professional_id = a.professional_id
       and x.id <> a.id
       and x.status in ('confirmed', 'proposed')
       and x.starts_at >= a.starts_at
       and (x.starts_at at time zone 'Europe/Rome')::date
           = (a.starts_at at time zone 'Europe/Rome')::date
     order by x.starts_at, x.id
  loop
    exit when r.starts_at >= v_fine;
    v_slitta := ceil(extract(epoch from (v_fine - r.starts_at)) / 60)::integer;
    v_toccati := v_toccati || jsonb_build_object(
      'id', r.id,
      'request_id', r.request_id,
      'customer_name', r.customer_name,
      'title', r.title,
      'starts_at', r.starts_at,
      'slitta_minuti', v_slitta,
      'avvisabile', r.request_id is not null
    );
    v_fine := greatest(v_fine, r.starts_at + make_interval(mins => r.duration_minutes + v_slitta));
  end loop;

  if p_solo_anteprima then
    return jsonb_build_object(
      'ok', true,
      'anteprima', true,
      'inizio_prima', a.starts_at,
      'inizio_dopo', v_dopo,
      'toccati', v_toccati
    );
  end if;

  perform set_config('bob.annullamento', 'si', true);
  perform set_config('bob.sovrapposizione', 'si', true);
  perform set_config('bob.autore', 'professional', true);
  perform set_config('bob.tipo', 'ritardo', true);
  perform set_config('bob.motivo', coalesce(v_motivo, ''), true);

  update public.appointments set starts_at = v_dopo where id = a.id;

  -- Al cliente, nella chat di quella richiesta. Collegato all'appuntamento:
  -- il biglietto con l'orario nuovo compare sotto questo messaggio.
  v_testo := 'Sono in ritardo di circa ' || p_minuti || ' minuti: arrivo alle '
             || to_char(v_dopo at time zone 'Europe/Rome', 'HH24:MI')
             || ' invece che alle '
             || to_char(a.starts_at at time zone 'Europe/Rome', 'HH24:MI') || '.'
             || coalesce(' Motivo: ' || v_motivo, '');
  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (a.request_id, a.professional_id, 'professional', v_uid, v_testo,
     'appointment_proposal', a.id);

  -- Agli appuntamenti dopo, se il pro ha detto si'. Solo un avviso: il loro
  -- orario resta quello, e il biglietto non si sposta (messaggio semplice).
  if coalesce(p_avvisa_toccati, false) then
    for r in
      select (t ->> 'request_id')::uuid as request_id,
             (t ->> 'starts_at')::timestamptz as starts_at,
             (t ->> 'slitta_minuti')::integer as slitta
        from jsonb_array_elements(v_toccati) t
       where (t ->> 'avvisabile')::boolean
    loop
      insert into public.request_messages
        (request_id, professional_id, sender_type, sender_id, message, kind)
      values
        (r.request_id, a.professional_id, 'professional', v_uid,
         'Sto accumulando un ritardo: il tuo appuntamento delle '
           || to_char(r.starts_at at time zone 'Europe/Rome', 'HH24:MI')
           || ' potrebbe slittare di circa ' || r.slitta
           || ' minuti. Se cambia qualcosa te lo scrivo qui.',
         'text');
      v_avvisati := v_avvisati + 1;
    end loop;
  end if;

  perform set_config('bob.annullamento', '', true);
  perform set_config('bob.sovrapposizione', '', true);
  perform set_config('bob.autore', '', true);
  perform set_config('bob.tipo', '', true);
  perform set_config('bob.motivo', '', true);

  return jsonb_build_object(
    'ok', true,
    'anteprima', false,
    'request_id', a.request_id,
    'professional_id', a.professional_id,
    'inizio_prima', a.starts_at,
    'inizio_dopo', v_dopo,
    'toccati', v_toccati,
    'avvisati', v_avvisati
  );
end;
$$;

revoke execute on function public.segnala_ritardo(uuid, integer, text, boolean, boolean) from public, anon;
grant execute on function public.segnala_ritardo(uuid, integer, text, boolean, boolean) to authenticated;

commit;
