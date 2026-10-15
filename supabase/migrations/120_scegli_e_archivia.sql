-- 120_scegli_e_archivia.sql
--
-- SCEGLI E ARCHIVIA (15/10, PR 7 della dashboard cliente; decisioni della
-- revisione di Lucio del 14/10 e di André del 15/10).
--
-- COM'ERA. Nella pagina della richiesta il cliente confronta i pro uno
-- accanto all'altro, ma il confronto non finiva mai: niente diceva «vado con
-- questo», e gli altri pro restavano ad aspettare in una chat che non
-- portava da nessuna parte.
--
-- ADESSO.
--   - requests.chosen_professional_id / chosen_at: il pro scelto, e quando.
--   - request_professionals.archived_at: la conversazione di quel pro su
--     quella richiesta e' archiviata. Archiviata NON vuol dire cancellata: e'
--     uno stato, non una regola di conservazione (DATA_COMPLIANCE §5 vale
--     come prima).
--   - Un pro archiviato legge ma non scrive: niente messaggi, niente
--     proposte d'orario, niente spostamenti (policy e trigger qui sotto).
--   - Scegliere e riaprire passano da due funzioni che solo il service role
--     puo' chiamare (le route /api/richieste/[id]/scegli e /riapri), ognuna
--     in UNA transazione: o tutto o niente, mai una richiesta scelta con i
--     messaggi di Bob a meta'.
--   - «Non scelto» e «archiviato» non entrano in nessun punteggio, ordinamento
--     o segnale (decisione 4). Letto dal vivo il 15/10: professionals_score
--     non legge ne' messaggi ne' partecipazioni; aggiorna_segnali_
--     professionisti e i trigger analisi_messaggio / request_messages_
--     segnali_trg guardano solo sender_type 'professional' (un messaggio di
--     Bob, 'bob', non conta come risposta ne' come tempo di risposta);
--     analisi_partecipazione scatta solo su request_professionals.status,
--     che qui non cambia. L'unico punto che avrebbe registrato qualcosa e'
--     analisi_da_appuntamento, quando una proposta del pro archiviato viene
--     rifiutata («proposta_rifiutata»): riscritto qui sotto, salta quella
--     riga solo dentro la scelta.
--
-- STATO VIVO LETTO PRIMA DI SCRIVERE (15/10, sola lettura; i dettagli nella
-- PR #172):
--   requests: nessuna colonna di scelta; RLS: il cliente aggiorna la propria
--     riga intera («User updates own requests»), il pro legge le richieste
--     assegnate.
--   request_professionals: id, request_id, professional_id, status,
--     created_at; RLS: il cliente inserisce e legge le proprie, il pro legge
--     e AGGIORNA le proprie («Pro updates own assignments») — per questo
--     archived_at ha un suo trigger di guardia.
--   request_messages: «Pro inserts assigned messages» (sotto, riscritta).
--   appointments: il pro propone con un INSERT diretto («Pro inserts own
--     appointments», sotto, riscritta); sposta con sposta_appuntamento() o
--     con un UPDATE diretto di starts_at dal calendario, ritarda con
--     segnala_ritardo(). Le due funzioni sono INVOKER e scrivono un messaggio
--     del pro: la policy dei messaggi le ferma gia'. L'UPDATE diretto passa
--     sempre da proteggi_spostamento_pro (sotto, riscritta).
--
-- FUNZIONI CONDIVISE RISCRITTE DA QUELLE VIVE (pg_get_functiondef del 15/10):
--   private.proteggi_spostamento_pro   md5 d3b08e7f65a400ac7e9ed7a894359b64 (116)
--   private.analisi_da_appuntamento    md5 8a13127159d3f70c73115d7de548332f (110/113)
-- Ognuna cambia nei punti segnati con (120).
-- POLICY RISCRITTE DA pg_policies DEL 15/10, con UNA condizione in piu'
-- ciascuna, segnata con (120).
--
-- Idempotente: add column if not exists, create or replace, drop-then-create
-- di trigger e policy.

-- ---------------------------------------------------------------------------
-- 1. Le colonne
-- ---------------------------------------------------------------------------

alter table public.requests
  add column if not exists chosen_professional_id uuid
    references public.professionals(id) on delete set null,
  add column if not exists chosen_at timestamptz;

alter table public.request_professionals
  add column if not exists archived_at timestamptz;

comment on column public.requests.chosen_professional_id is
  'Il pro che il cliente ha scelto (120). Si scrive solo da scegli_professionista().';
comment on column public.request_professionals.archived_at is
  'Conversazione archiviata: il pro legge ma non scrive (120). Uno stato, non una cancellazione.';

-- ---------------------------------------------------------------------------
-- 2. La scelta: solo un pro collegato, e solo da Bob
-- ---------------------------------------------------------------------------
-- INVOKER: la controlla chi scrive. Il service role (la route) vede tutto;
-- il cliente e il pro non arrivano mai al controllo del collegamento,
-- perche' prima li ferma la regola su chi puo' scrivere.
-- CHI PUO' SCRIVERLA. Il cliente ha l'UPDATE dell'intera riga della sua
-- richiesta: senza questo controllo potrebbe scegliere direttamente un pro
-- che non ha risposto, senza archiviare nessuno. La scelta passa solo da
-- scegli_professionista() (service role, auth.uid() nullo) o dallo staff,
-- come proteggi_chiusura_richiesta fa per closed_reason.
create or replace function public.valida_scelta_professionista()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.chosen_professional_id is not distinct from old.chosen_professional_id
     and new.chosen_at is not distinct from old.chosen_at then
    return new;
  end if;
  if tg_op = 'INSERT' and new.chosen_professional_id is null and new.chosen_at is null then
    return new;
  end if;
  if auth.uid() is not null and not private.is_admin_or_cs() then
    raise exception 'La scelta del professionista si fa dalla pagina della richiesta'
      using errcode = '42501';
  end if;
  if new.chosen_professional_id is not null and not exists (
    select 1 from public.request_professionals rp
     where rp.request_id = new.id
       and rp.professional_id = new.chosen_professional_id
  ) then
    raise exception 'Il professionista scelto non e'' fra quelli della richiesta'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.valida_scelta_professionista() from public, anon, authenticated;

drop trigger if exists valida_scelta_professionista on public.requests;
create trigger valida_scelta_professionista
  before insert or update of chosen_professional_id, chosen_at on public.requests
  for each row execute function public.valida_scelta_professionista();

-- ---------------------------------------------------------------------------
-- 3. L'archiviazione: la scrive solo Bob
-- ---------------------------------------------------------------------------
-- Il pro ha l'UPDATE delle proprie righe di request_professionals («Pro
-- updates own assignments»): senza questo trigger potrebbe togliersi
-- l'archiviazione da solo. archived_at lo cambiano solo le due funzioni
-- qui sotto (service role) o lo staff.
create or replace function public.proteggi_archiviazione()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and auth.uid() is not null
     and not private.is_admin_or_cs() then
    raise exception 'L''archiviazione di una conversazione la decide il cliente dalla pagina della richiesta'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_archiviazione() from public, anon, authenticated;

drop trigger if exists proteggi_archiviazione on public.request_professionals;
create trigger proteggi_archiviazione
  before update of archived_at on public.request_professionals
  for each row execute function public.proteggi_archiviazione();

-- ---------------------------------------------------------------------------
-- 4. Il pro archiviato non scrive (policy viva + una condizione)
-- ---------------------------------------------------------------------------
drop policy if exists "Pro inserts assigned messages" on public.request_messages;
create policy "Pro inserts assigned messages"
  on public.request_messages
  for insert
  to public
  with check (
    (sender_id = ( select auth.uid() as uid))
    and (professional_id in ( select private.my_professional_ids() as my_professional_ids))
    and (request_id in (
      select request_professionals.request_id
        from public.request_professionals
       where (request_professionals.professional_id in ( select private.my_professional_ids() as my_professional_ids))))
    -- (120) la sua conversazione su questa richiesta non e' archiviata.
    and exists (
      select 1 from public.request_professionals rp
       where rp.request_id = request_messages.request_id
         and rp.professional_id = request_messages.professional_id
         and rp.archived_at is null)
  );

-- ---------------------------------------------------------------------------
-- 5. Il pro archiviato non propone orari (policy viva + una condizione)
-- ---------------------------------------------------------------------------
-- NOT EXISTS su una riga archiviata, e non EXISTS su una riga attiva: la
-- policy viva non chiede che il pro sia collegato alla richiesta (le voci
-- dell'agenda privata hanno request_id nullo), e questa migrazione non
-- cambia altro che l'archiviazione.
drop policy if exists "Pro inserts own appointments" on public.appointments;
create policy "Pro inserts own appointments"
  on public.appointments
  for insert
  to public
  with check (
    (professional_id in (
      select professionals.id
        from public.professionals
       where (professionals.user_id = ( select auth.uid() as uid))))
    -- (120) non su una richiesta dove la sua conversazione e' archiviata.
    and not exists (
      select 1 from public.request_professionals rp
       where rp.request_id = appointments.request_id
         and rp.professional_id = appointments.professional_id
         and rp.archived_at is not null)
  );

-- ---------------------------------------------------------------------------
-- 6. Il pro archiviato non sposta (proteggi_spostamento_pro, dalla viva)
-- ---------------------------------------------------------------------------
create or replace function private.proteggi_spostamento_pro()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_preavviso integer;
begin
  -- (120) Prima di tutto, anche dentro sposta_appuntamento() e
  -- segnala_ritardo() (che accendono bob.annullamento): il pro di una
  -- conversazione archiviata non sposta piu' niente su quella richiesta.
  -- Il cliente (115) si', e il service role pure.
  if auth.uid() is not null
     and new.starts_at is distinct from old.starts_at
     and old.request_id is not null
     and exists (
       select 1 from public.professionals p
        where p.id = old.professional_id and p.user_id = auth.uid()
     )
     and exists (
       select 1 from public.request_professionals rp
        where rp.request_id = old.request_id
          and rp.professional_id = old.professional_id
          and rp.archived_at is not null
     ) then
    raise exception 'Il cliente ha chiuso questa richiesta: non puoi piu'' spostare l''appuntamento'
      using hint = 'archiviata';
  end if;

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
$function$;

-- ---------------------------------------------------------------------------
-- 7. Il rifiuto per archiviazione non entra nelle analisi del pro
-- ---------------------------------------------------------------------------
-- analisi_da_appuntamento dalla viva. Unico cambio (120): quando una proposta
-- del pro diventa 'declined' DENTRO scegli_professionista() (interruttore
-- bob.archiviazione, acceso e spento li'), non si registra
-- «proposta_rifiutata». Non e' un rifiuto della sua proposta: il cliente ha
-- scelto un altro, e decisione 4 vuole che questo non entri in nessun
-- segnale. Lo storico dell'appuntamento (registra_evento_appuntamento)
-- resta: dice cosa e' successo alla proposta.
create or replace function private.analisi_da_appuntamento()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_service uuid;
  v_subservice uuid;
  v_prima text;
  v_importo integer;
begin
  if tg_op = 'DELETE' then
    -- Il pro ha cancellato l'appuntamento: per lui non e' mai esistito, e il
    -- calendario resta la verita'.
    delete from public.professional_work_events e
     where e.professional_id = old.professional_id and e.rif = old.id;
    return null;
  end if;

  if new.professional_service_id is not null then
    select ps.service_id, ps.subservice_id into v_service, v_subservice
      from public.professional_services ps where ps.id = new.professional_service_id;
  end if;
  if v_service is null and new.request_id is not null then
    select q.service_id, q.subservice_id into v_service, v_subservice
      from public.requests q where q.id = new.request_id;
  end if;

  v_importo := case when new.price is null then null else round(new.price * 100)::integer end;
  v_prima := case when tg_op = 'INSERT' then null else old.status end;

  if tg_op = 'INSERT' and new.source = 'direct' then
    perform private.registra_evento_lavoro(
      new.professional_id, 'prenotazione_diretta', coalesce(new.created_at, now()),
      new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
  end if;

  -- Una proposta del pro su una richiesta. Anche quando lo diventa dopo:
  -- una proposta del cliente spostata dal pro e' sua (riproponi_se_spostato).
  if new.request_id is not null and new.source <> 'direct'
     and new.status = 'proposed' and new.proposed_by = 'professional' then
    perform private.registra_evento_lavoro(
      new.professional_id, 'proposta_inviata', coalesce(new.created_at, now()),
      new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
  end if;

  if new.status is distinct from v_prima then
    -- Si arriva a un appuntamento fissato su una richiesta: e' l'«accettata»
    -- dell'imbuto, chiunque abbia fatto l'ultima proposta.
    if new.status = 'confirmed' and new.request_id is not null and new.source <> 'direct' then
      perform private.registra_evento_lavoro(
        new.professional_id, 'proposta_accettata', now(),
        new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
    end if;
    -- (120) non quando il «rifiuto» e' l'archiviazione della scelta.
    if new.status = 'declined'
       and current_setting('bob.archiviazione', true) is distinct from 'si' then
      perform private.registra_evento_lavoro(
        new.professional_id, 'proposta_rifiutata', now(),
        new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
    end if;
    if new.status = 'cancelled' then
      perform private.registra_evento_lavoro(
        new.professional_id, 'lavoro_disdetto', now(),
        new.id, new.request_id, v_service, v_subservice, new.comune_istat, v_importo);
    end if;

    if v_prima = 'completed' then
      delete from public.professional_work_events e
       where e.professional_id = new.professional_id and e.rif = new.id
         and e.evento = 'lavoro_concluso';
    elsif v_prima = 'cancelled' then
      delete from public.professional_work_events e
       where e.professional_id = new.professional_id and e.rif = new.id
         and e.evento = 'lavoro_disdetto';
    elsif v_prima = 'declined' then
      delete from public.professional_work_events e
       where e.professional_id = new.professional_id and e.rif = new.id
         and e.evento = 'proposta_rifiutata';
    end if;
  end if;

  -- Il lavoro concluso porta la data del LAVORO (starts_at), non quella in cui
  -- e' stato segnato: e' quella che decide di che mese e' l'importo, come gia'
  -- fanno le caselle della dashboard. Si riallinea a ogni modifica.
  if new.status = 'completed' then
    insert into public.professional_work_events as e
      (professional_id, evento, avvenuto_al, rif, richiesta, service_id,
       subservice_id, comune_istat, importo_cent, minuti)
    values
      (new.professional_id, 'lavoro_concluso', new.starts_at, new.id,
       new.request_id, v_service, v_subservice, new.comune_istat, v_importo,
       new.duration_minutes)
    on conflict (professional_id, evento, rif) do update
      set avvenuto_al   = excluded.avvenuto_al,
          richiesta     = coalesce(excluded.richiesta, e.richiesta),
          service_id    = excluded.service_id,
          subservice_id = excluded.subservice_id,
          comune_istat  = excluded.comune_istat,
          importo_cent  = excluded.importo_cent,
          minuti        = excluded.minuti;
  end if;

  return null;
exception when others then
  raise warning 'analisi_da_appuntamento(%): %', coalesce(new.id, old.id), sqlerrm;
  return null;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Scegliere: tutto in una transazione
-- ---------------------------------------------------------------------------
-- La chiama solo la route POST /api/richieste/[id]/scegli col service role,
-- dopo aver controllato chi e' l'utente: p_cliente e' l'utente della
-- sessione, e qui si ricontrolla che la richiesta sia sua. Un rifiuto
-- torna come { ok: false, motivo, ... } senza scrivere niente; un errore
-- vero annulla tutto (nessuna scelta senza archiviazione, nessun messaggio
-- di Bob senza scelta).
-- INVOKER: gira come il service role, che non ha bisogno di altro; nessun
-- altro la puo' eseguire (grant qui sotto).
create or replace function public.scegli_professionista(
  p_richiesta uuid,
  p_cliente uuid,
  p_professionista uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.requests%rowtype;
  v_collegati integer;
  v_altro uuid;
  v_archiviati uuid[] := '{}';
  v_riaperto boolean := false;
  v_pro uuid;
begin
  select * into r from public.requests where id = p_richiesta for update;
  if not found or r.customer_id is distinct from p_cliente then
    return jsonb_build_object('ok', false, 'motivo', 'non_trovata');
  end if;
  if r.status not in ('sent', 'quote_request', 'matched') then
    return jsonb_build_object('ok', false, 'motivo', 'chiusa');
  end if;
  if not exists (
    select 1 from public.request_professionals rp
     where rp.request_id = r.id and rp.professional_id = p_professionista
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'non_collegato');
  end if;
  select count(*) into v_collegati from public.request_professionals rp where rp.request_id = r.id;
  if v_collegati < 2 then
    return jsonb_build_object('ok', false, 'motivo', 'un_solo_pro');
  end if;
  if not exists (
    select 1 from public.request_messages m
     where m.request_id = r.id
       and m.professional_id = p_professionista
       and m.sender_type = 'professional'
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'non_ha_risposto');
  end if;
  -- Un appuntamento confermato e non ancora finito con un ALTRO pro: prima
  -- si disdice quello.
  select a.professional_id into v_altro
    from public.appointments a
   where a.request_id = r.id
     and a.professional_id <> p_professionista
     and a.status = 'confirmed'
     and a.starts_at + make_interval(mins => coalesce(a.duration_minutes, 60)) >= now()
   order by a.starts_at
   limit 1;
  if v_altro is not null then
    return jsonb_build_object('ok', false, 'motivo', 'appuntamento_altro', 'professionista', v_altro);
  end if;
  -- Decisione 5: la scelta si cambia finche' col pro scelto non c'e' un
  -- appuntamento confermato (o gia' fatto).
  if r.chosen_professional_id is not null
     and r.chosen_professional_id <> p_professionista
     and exists (
       select 1 from public.appointments a
        where a.request_id = r.id
          and a.professional_id = r.chosen_professional_id
          and a.status in ('confirmed', 'completed')
     ) then
    return jsonb_build_object('ok', false, 'motivo', 'scelta_bloccata', 'professionista', r.chosen_professional_id);
  end if;

  update public.requests
     set chosen_professional_id = p_professionista,
         chosen_at = now()
   where id = r.id;

  -- Il pro scelto, se era archiviato, torna a poter scrivere.
  update public.request_professionals
     set archived_at = null
   where request_id = r.id
     and professional_id = p_professionista
     and archived_at is not null;
  if found then
    v_riaperto := true;
    insert into public.request_messages (request_id, professional_id, sender_type, sender_id, message, kind)
    values (r.id, p_professionista, 'bob', null, 'Il cliente ha riaperto la conversazione.', 'text');
  end if;

  -- Gli altri: archiviati, le loro proposte ancora aperte rifiutate (come il
  -- «Rifiuta» del cliente, senza entrare nelle analisi: vedi 7), e un
  -- messaggio di Bob nella loro chat.
  perform set_config('bob.archiviazione', 'si', true);
  perform set_config('bob.autore', 'customer', true);
  for v_pro in
    update public.request_professionals
       set archived_at = now()
     where request_id = r.id
       and professional_id <> p_professionista
       and archived_at is null
    returning professional_id
  loop
    v_archiviati := v_archiviati || v_pro;
    update public.appointments
       set status = 'declined'
     where request_id = r.id
       and professional_id = v_pro
       and status = 'proposed';
    insert into public.request_messages (request_id, professional_id, sender_type, sender_id, message, kind)
    values (r.id, v_pro, 'bob', null, 'Il cliente ha chiuso questa richiesta.', 'text');
  end loop;
  perform set_config('bob.archiviazione', '', true);
  perform set_config('bob.autore', '', true);

  return jsonb_build_object(
    'ok', true,
    'professionista', p_professionista,
    'archiviati', to_jsonb(v_archiviati),
    'riaperto', v_riaperto
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Riaprire una conversazione archiviata
-- ---------------------------------------------------------------------------
-- La scelta non cambia: il cliente riapre per parlare, non per scegliere.
create or replace function public.riapri_conversazione(
  p_richiesta uuid,
  p_cliente uuid,
  p_professionista uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.requests r where r.id = p_richiesta and r.customer_id = p_cliente
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'non_trovata');
  end if;
  update public.request_professionals
     set archived_at = null
   where request_id = p_richiesta
     and professional_id = p_professionista
     and archived_at is not null;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'non_archiviata');
  end if;
  insert into public.request_messages (request_id, professional_id, sender_type, sender_id, message, kind)
  values (p_richiesta, p_professionista, 'bob', null, 'Il cliente ha riaperto la conversazione.', 'text');
  return jsonb_build_object('ok', true, 'professionista', p_professionista);
end;
$$;

-- Solo le route (service role). Nessun utente le chiama direttamente: il
-- controllo «e' la tua richiesta» lo fa la route con la sessione vera.
revoke execute on function public.scegli_professionista(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.riapri_conversazione(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.scegli_professionista(uuid, uuid, uuid) to service_role;
grant execute on function public.riapri_conversazione(uuid, uuid, uuid) to service_role;
