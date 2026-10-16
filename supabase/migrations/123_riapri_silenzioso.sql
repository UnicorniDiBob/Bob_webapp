-- 123_riapri_silenzioso.sql
--
-- RIAPRIRE NON AVVISA IL PRO (16/10, André; cambia la decisione 3 della
-- revisione di Lucio del 14/10).
--
-- COM'ERA. Dalla 120, riaprire una conversazione archiviata (riapri_
-- conversazione) e scegliere un pro che era archiviato (scegli_
-- professionista) scrivevano al pro la nota di Bob «Il cliente ha riaperto
-- la conversazione.», e la PR 8 ne faceva una voce della sua campanella.
--
-- ADESSO. Riaprire e' silenzioso: archived_at torna nullo e il pro puo' di
-- nuovo leggere e scrivere, ma non riceve niente. Il pro deve sentire il
-- cliente solo quando il cliente gli scrive davvero: un «riaperto» senza un
-- messaggio dietro e' un'attesa senza niente da fare. E riaprire si disfa
-- (si riarchivia), quindi non serve avvisare. Archiviare invece resta
-- com'e': «Il cliente ha chiuso questa richiesta.» arriva, perche' al pro
-- cambia qualcosa (non puo' piu' scrivere).
--
-- FUNZIONI RISCRITTE DA QUELLE VIVE (pg_get_functiondef del 16/10):
--   public.riapri_conversazione    md5 del corpo fb97652da35d8c98f29c36a3e30d80b3 (= 120)
--   public.scegli_professionista   md5 del corpo 59ffc2e5f0c60888a556696d7be1aaa2 (= 120)
-- Ognuna perde SOLO l'insert della nota «riaperta», segnato con (123).
-- Tutto il resto e' identico: controlli, rifiuti, archiviazione degli altri
-- con «Il cliente ha chiuso questa richiesta.», forma del risultato
-- (scegli_professionista restituisce ancora «riaperto»: dice se il pro
-- scelto era archiviato, non che e' partita una nota). Stessi permessi:
-- solo il service role.
-- Le note «riaperta» gia' scritte restano nel database e nella campanella
-- del pro come prima; non se ne scrivono altre.
--
-- Idempotente: create or replace, revoke e grant ripetibili.

CREATE OR REPLACE FUNCTION public.riapri_conversazione(p_richiesta uuid, p_cliente uuid, p_professionista uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  -- (123) Niente nota di Bob: riaprire non avvisa il pro.
  return jsonb_build_object('ok', true, 'professionista', p_professionista);
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
$function$;

-- Gli stessi permessi della 120: solo le route (service role).
revoke execute on function public.riapri_conversazione(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.scegli_professionista(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.riapri_conversazione(uuid, uuid, uuid) to service_role;
grant execute on function public.scegli_professionista(uuid, uuid, uuid) to service_role;
