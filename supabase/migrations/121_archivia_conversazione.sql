-- 121_archivia_conversazione.sql
--
-- ARCHIVIARE UNA CONVERSAZIONE A MANO (15/10, PR 9 della dashboard cliente;
-- decisioni di André del 15/10).
--
-- COM'ERA. Con la 120 una conversazione si archiviava solo scegliendo un
-- altro pro (scegli_professionista) e si riapriva con riapri_conversazione.
-- Il cliente che non voleva piu' sentire un pro, senza aver scelto nessuno,
-- non aveva un modo per dirlo; e il pro restava ad aspettare.
--
-- ADESSO. archivia_conversazione() fa per UN pro esattamente quello che la
-- scelta fa per gli altri, con gli stessi passi di scegli_professionista
-- (120): archived_at = now(); le sue proposte ancora aperte rifiutate con
-- bob.archiviazione = 'si' (cosi' analisi_da_appuntamento non scrive
-- «proposta_rifiutata»: decisione 4 della PR 7) e bob.autore = 'customer'
-- (lo storico dice che ha rifiutato il cliente); la nota di Bob «Il cliente
-- ha chiuso questa richiesta.» nella sua chat. Si riapre con
-- riapri_conversazione, come prima.
--   - Il pro SCELTO si puo' archiviare: la scelta si annulla
--     (chosen_professional_id e chosen_at a null) e «Scegli» torna sugli
--     altri. La scrive il service role, quindi valida_scelta_professionista
--     (120) la lascia passare; con null non controlla il collegamento.
--   - Bloccato solo se QUEL pro ha un appuntamento confermato e non ancora
--     finito su questa richiesta: prima si disdice.
--
-- STATO VIVO LETTO PRIMA DI SCRIVERE (15/10, sola lettura; dettagli nella
-- PR): scegli_professionista md5 del corpo 59ffc2e5f0c60888a556696d7be1aaa2,
-- riapri_conversazione fb97652da35d8c98f29c36a3e30d80b3,
-- private.analisi_da_appuntamento a45c49d51d39b1258d977cf744de61c5: gli
-- stessi della 120. Nessuna di queste cambia: qui si aggiunge una funzione
-- sola, e niente altro nello schema.
--
-- Idempotente: create or replace, revoke e grant si ripetono senza errori.

-- La chiama solo la route POST /api/richieste/[id]/archivia col service
-- role, dopo aver controllato chi e' l'utente; qui si ricontrolla che la
-- richiesta sia sua. Un rifiuto torna come { ok: false, motivo, ... } senza
-- scrivere niente; un errore vero annulla tutto. INVOKER come le due della
-- 120: gira come il service role, e nessun altro la puo' eseguire.
create or replace function public.archivia_conversazione(
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
  insert into public.request_messages (request_id, professional_id, sender_type, sender_id, message, kind)
  values (r.id, p_professionista, 'bob', null, 'Il cliente ha chiuso questa richiesta.', 'text');
  perform set_config('bob.archiviazione', '', true);
  perform set_config('bob.autore', '', true);

  return jsonb_build_object(
    'ok', true,
    'professionista', p_professionista,
    'scelta_annullata', v_scelta_annullata
  );
end;
$$;

-- Solo la route (service role), come scegli/riapri (120).
revoke execute on function public.archivia_conversazione(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.archivia_conversazione(uuid, uuid, uuid) to service_role;
