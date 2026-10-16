-- 124_chiuso_una_volta.sql
--
-- «IL CLIENTE HA CHIUSO QUESTA RICHIESTA.» UNA VOLTA SOLA PER CHIUSURA VERA
-- (16/10, decisione di André).
--
-- PERCHE'. Dalla 123 riaprire e' silenzioso: il pro non riceve niente. Cosi'
-- archivia → riapri → archivia scriveva al pro due «chiuso» uno dopo l'altro,
-- e dalla sua parte non c'era niente in mezzo: sembrava un errore. Trovato
-- dal vivo il 16/10 sulla richiesta di PROVA ddaae033: Colori & Pareti ha
-- tre «chiuso» di fila (07:37, 08:39:15, 08:39:48, ora italiana) e, per la
-- PR 8, tre voci uguali nella campanella.
--
-- LA REGOLA. La nota si scrive solo se l'ULTIMO messaggio della
-- conversazione (stessa richiesta e stesso pro, qualunque mittente, in
-- ordine di created_at, id) non e' gia' un «chiuso» di Bob. Se dall'ultimo
-- «chiuso» nella chat non e' successo niente (nessun messaggio del cliente
-- o del pro, nessun'altra nota di Bob), archiviare di nuovo e' silenzioso:
-- per il pro la richiesta era gia' chiusa e non ha visto riaprirla. Se
-- invece in mezzo qualcuno ha scritto, la chiusura e' una notizia nuova e
-- la nota arriva.
-- Tutto il resto dell'archiviazione resta com'e': archived_at, proposte
-- aperte rifiutate (con bob.archiviazione, quindi niente analisi), scelta
-- annullata se si archivia il pro scelto. L'«Annulla» di 5 secondi
-- dell'interfaccia non cambia.
--
-- FUNZIONI RISCRITTE DA QUELLE VIVE (pg_get_functiondef del 16/10):
--   public.archivia_conversazione  md5 del corpo 8a74bd247fe019b0f72fb82087116d49 (121)
--   public.scegli_professionista   md5 del corpo 903351193a4bdaf36a1436f1fc1d5e1f (123)
-- Ognuna cambia SOLO intorno all'insert della nota «chiuso», segnato con
-- (124): l'insert identico, dentro un if. Stessi permessi: solo il service
-- role.
--
-- UNICO OGGETTO NUOVO: private.ultimo_e_chiuso(richiesta, pro), la domanda
-- in un posto solo. Il testo e' esattamente BOB_CHIUSA di src/lib/scelta.ts
-- (confronto esatto, niente LIKE) e sender_type 'bob'. SECURITY INVOKER: la
-- chiamano le due funzioni, che girano col service role; anon e
-- authenticated non la eseguono.
--
-- DATI. Nessun dato toccato: le note doppie gia' scritte (anche quelle di
-- PROVA su ddaae033) restano per la pulizia prima del pilota.
--
-- Idempotente: create or replace, revoke e grant ripetibili.

create or replace function private.ultimo_e_chiuso(p_richiesta uuid, p_professionista uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select m.sender_type = 'bob' and m.message = 'Il cliente ha chiuso questa richiesta.'
      from public.request_messages m
     where m.request_id = p_richiesta
       and m.professional_id = p_professionista
     order by m.created_at desc, m.id desc
     limit 1
  ), false);
$$;

revoke execute on function private.ultimo_e_chiuso(uuid, uuid) from public, anon, authenticated;
grant execute on function private.ultimo_e_chiuso(uuid, uuid) to service_role;

CREATE OR REPLACE FUNCTION public.archivia_conversazione(p_richiesta uuid, p_cliente uuid, p_professionista uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.requests%rowtype;
  v_archiviata timestamptz;
  v_scelta_annullata boolean := false;
begin
  select * into r from public.requests where id = p_richiesta for update;
  if not found or r.customer_id is distinct from p_cliente then
    return jsonb_build_object('ok', false, 'motivo', 'non_trovata');
  end if;
  if r.status not in ('sent', 'quote_request', 'matched') then
    return jsonb_build_object('ok', false, 'motivo', 'chiusa');
  end if;
  select rp.archived_at into v_archiviata
    from public.request_professionals rp
   where rp.request_id = r.id and rp.professional_id = p_professionista
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'non_collegato');
  end if;
  if v_archiviata is not null then
    return jsonb_build_object('ok', false, 'motivo', 'gia_archiviata');
  end if;
  -- Un appuntamento confermato e non ancora finito con questo pro: prima si
  -- disdice (la stessa finestra di scegli_professionista).
  if exists (
    select 1 from public.appointments a
     where a.request_id = r.id
       and a.professional_id = p_professionista
       and a.status = 'confirmed'
       and a.starts_at + make_interval(mins => coalesce(a.duration_minutes, 60)) >= now()
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'appuntamento_confermato', 'professionista', p_professionista);
  end if;

  -- Il pro scelto si puo' archiviare: la scelta si annulla.
  if r.chosen_professional_id = p_professionista then
    update public.requests
       set chosen_professional_id = null,
           chosen_at = null
     where id = r.id;
    v_scelta_annullata := true;
  end if;

  -- Gli stessi passi di scegli_professionista (120) per un pro archiviato.
  perform set_config('bob.archiviazione', 'si', true);
  perform set_config('bob.autore', 'customer', true);
  update public.request_professionals
     set archived_at = now()
   where request_id = r.id
     and professional_id = p_professionista;
  update public.appointments
     set status = 'declined'
   where request_id = r.id
     and professional_id = p_professionista
     and status = 'proposed';
  -- (124) La nota solo se l'ultimo messaggio della chat non e' gia' lei.
  if not private.ultimo_e_chiuso(r.id, p_professionista) then
    insert into public.request_messages (request_id, professional_id, sender_type, sender_id, message, kind)
    values (r.id, p_professionista, 'bob', null, 'Il cliente ha chiuso questa richiesta.', 'text');
  end if;
  perform set_config('bob.archiviazione', '', true);
  perform set_config('bob.autore', '', true);

  return jsonb_build_object(
    'ok', true,
    'professionista', p_professionista,
    'scelta_annullata', v_scelta_annullata
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.scegli_professionista(p_richiesta uuid, p_cliente uuid, p_professionista uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    -- (123) Niente nota di Bob: riaprire non avvisa il pro.
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
    -- (124) La nota solo se l'ultimo messaggio della chat non e' gia' lei.
    if not private.ultimo_e_chiuso(r.id, v_pro) then
      insert into public.request_messages (request_id, professional_id, sender_type, sender_id, message, kind)
      values (r.id, v_pro, 'bob', null, 'Il cliente ha chiuso questa richiesta.', 'text');
    end if;
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
$function$;

-- Gli stessi permessi di oggi: solo le route (service role).
revoke execute on function public.archivia_conversazione(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.scegli_professionista(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.archivia_conversazione(uuid, uuid, uuid) to service_role;
grant execute on function public.scegli_professionista(uuid, uuid, uuid) to service_role;
