-- scripts/demo/idraulici_seed.sql
--
-- SEI IDRAULICI DEMO A MILANO (16/10, decisioni di André). SOLO DATI: niente
-- schema, niente migrazione. Servono a provare dal vivo il tetto di 3 pro per
-- richiesta (125), il confronto nella pagina della richiesta, Scegli e
-- archivia, e l'ordinamento (professionals_score, 072-104). DA RIMUOVERE
-- PRIMA DEL PILOTA: scripts/demo/idraulici_cleanup.sql toglie esattamente
-- quello che crea questo file. Vedi scripts/demo/README.md.
--
-- COSA CREA
--   - 6 idraulici «Idraulico Demo 1…6» (pro b1000000-…-0008 … 000d):
--     1-5 PRONTI, 6 NON PRONTO (nessun servizio: «… non sta ancora ricevendo
--     richieste.» e la guardia della 125 lo rifiuta).
--   - Demo 1 e 2 hanno un accesso: gli utenti di Auth li crea André a mano
--     (idraulico1.demo@bobapp.it, idraulico2.demo@bobapp.it); qui si trovano
--     PER EMAIL e si attaccano. Le password non passano mai di qui. Se non
--     esistono ancora, Demo 1 e 2 nascono come gli altri, senza accesso
--     (utenti a1000000-…-0008/0009) e un NOTICE lo dice.
--   - Demo 3-6 e i 3 «Recensore Demo» sono utenti senza password
--     (encrypted_password vuota: non si entra), creati in auth.users come i
--     demo di giugno; handle_new_user crea users, profiles e profile_private.
--     Nessun terms_version: nessuna riga in terms_acceptances.
--   - Per le recensioni e il tempo di risposta, richieste VERE nel senso
--     delle regole vive: chiuse («concluso»), collegate al pro, con il
--     messaggio del cliente e la risposta del pro; la recensione e' legata
--     alla richiesta (la stessa condizione della policy «Customer inserts
--     review for closed request»). Tutte dei Recensori Demo: mai di
--     cliente.demo ne' di utenti veri.
--
-- PERCHE' I MESSAGGI E NON UN NUMERO. Il tempo di risposta del punteggio e'
-- professional_signals.risposta_minuti, che il cron delle 04:10
-- (aggiorna_tutti_i_segnali) ricalcola ogni notte dai messaggi degli ultimi
-- 90 GIORNI: mediana, per richiesta, fra il primo messaggio del cliente e la
-- prima risposta del pro. Scritto a mano, sparirebbe la notte stessa. Le
-- date sono quindi relative al giorno del seed (fra 5 e 70 giorni fa): il
-- segnale regge fino a ~20 giorni dopo il seed, poi i messaggi piu' vecchi
-- escono dalla finestra (vedi README).
--
-- EFFETTI COLLATERALI, TUTTI NELLA PULIZIA. I trigger vivi scrivono anche:
-- professional_verification (una riga per pro, poi alzata a mano per Demo 1
-- e 2), professional_coverage_public, professional_signals,
-- professional_work_events (richiesta_ricevuta / prima_risposta) e
-- search_events (una riga per richiesta, SENZA riferimento alla richiesta:
-- la pulizia la ritrova per created_at, che e' quello della richiesta).
-- Tutto il resto cade in cascata dal pro o dall'utente.
--
-- IDEMPOTENTE: id fissi e «on conflict do nothing»; gli update hanno la
-- condizione «is distinct from». Rieseguirlo non cambia niente. Una
-- transazione sola.

begin;

do $seed$
declare
  v_citta uuid := (select id from public.cities where slug = 'milano');
  v_servizio uuid := (select id from public.services where slug = 'idraulico');
  v_idro_sotto uuid;
  v_pro record;
  v_utente uuid;
  v_n integer;
  v_k integer;
  v_req uuid;
  v_quando timestamptz;
  v_recensore uuid;
  v_nuove integer := 0;
begin
  if v_citta is null or v_servizio is null then
    raise exception 'Mancano la citta'' milano o il servizio idraulico: niente da fare';
  end if;

  -- I sei idraulici e i loro ingressi. Una tabella, cosi' la pulizia e il
  -- README leggono gli stessi numeri.
  create temporary table demo_idraulici (
    n integer primary key,
    pro uuid,
    utente_fisso uuid,
    email text,
    accesso boolean,
    cap text,
    bio text,
    etichetta_risposta text,
    copertura text,          -- 'city' o elenco di zone separate da virgola
    servizi jsonb,           -- [{sotto, min, max}]
    disponibilita boolean,
    verifica text,           -- none / vat_verified / documents_verified
    voti integer[],          -- un voto per richiesta chiusa con recensione
    richieste integer,       -- richieste chiuse (anche senza recensione)
    risposta_min integer[]   -- minuti alla prima risposta, a giro
  ) on commit drop;

  insert into demo_idraulici values
    (1, 'b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000008', 'idraulico1.demo@bobapp.it', true,
        '20121', 'DEMO — Idraulico di prova per Bob. Pronto intervento perdite e scarichi in tutta Milano.',
        'Risponde in pochi minuti', 'city',
        '[{"sotto":"perdita-rubinetto-sifone","min":60,"max":90},{"sotto":"scarico-otturato","min":70,"max":110},{"sotto":"emergenza-allagamento"}]',
        true, 'documents_verified',
        array[5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,4,4,4], 30, array[9,12,15,18,21]),
    (2, 'b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000009', 'idraulico2.demo@bobapp.it', true,
        '20135', 'DEMO — Idraulico di prova per Bob. Rubinetteria e piccole perdite, prezzi contenuti.',
        'Risponde in poche ore', 'city',
        '[{"sotto":"perdita-rubinetto-sifone","min":45,"max":70},{"sotto":"sostituzione-rubinetteria","min":50,"max":80}]',
        false, 'vat_verified',
        array[5,5,5,5,5,4,4,4,4,4], 10, array[150,180,210]),
    (3, 'b1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000a', 'idraulico3.demo@bobapp.it', false,
        '20146', 'DEMO — Idraulico di prova per Bob. Scarichi difficili, zona centro e ovest.',
        'Risponde in 48h', 'duomo,brera,magenta,porta-genova,de-angeli,san-siro',
        '[{"sotto":"scarico-otturato","min":100,"max":150},{"sotto":"perdita-rubinetto-sifone","min":90,"max":130}]',
        true, 'none',
        array[5,4,4], 3, array[2880]),
    (4, 'b1000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-00000000000b', 'idraulico4.demo@bobapp.it', false,
        '20161', null,
        null, 'city',
        '[{"sotto":"perdita-rubinetto-sifone"}]',
        false, 'none',
        array[]::integer[], 0, array[]::integer[]),
    (5, 'b1000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-00000000000c', 'idraulico5.demo@bobapp.it', false,
        '20157', 'DEMO — Idraulico di prova per Bob. Solo Quarto Oggiaro, Gallaratese e Trenno.',
        'Risponde in qualche giorno', 'quarto-oggiaro,gallaratese,trenno',
        '[{"sotto":"perdita-rubinetto-sifone","min":50,"max":80}]',
        false, 'none',
        array[3,3], 2, array[8640]),
    (6, 'b1000000-0000-0000-0000-00000000000d', 'a1000000-0000-0000-0000-00000000000d', 'idraulico6.demo@bobapp.it', false,
        '20122', 'DEMO — Idraulico di prova per Bob. Profilo NON pronto: nessun servizio dichiarato.',
        null, 'city',
        '[]',
        false, 'none',
        array[]::integer[], 0, array[]::integer[]);

  -- I tre recensori: clienti finti, solo per firmare le recensioni.
  for v_n in 1..3 loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000',
            ('a1000000-0000-0000-0000-' || lpad(to_hex(13 + v_n), 12, '0'))::uuid,
            'authenticated', 'authenticated', 'recensore' || v_n || '.demo@bobapp.it', '',
            '', '', '', '',
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('role', 'customer', 'first_name', 'Recensore', 'last_name', 'Demo ' || v_n),
            now(), now())
    on conflict (id) do nothing;
  end loop;

  for v_pro in select * from demo_idraulici order by n loop
    -- L'utente: per Demo 1 e 2 quello creato da André, se c'e'.
    v_utente := null;
    if v_pro.accesso then
      select u.id into v_utente from auth.users u where lower(u.email) = v_pro.email;
      if v_utente is null then
        raise notice 'Idraulico Demo %: % non esiste in Auth, nasce senza accesso (utente %)',
          v_pro.n, v_pro.email, v_pro.utente_fisso;
      end if;
    end if;
    if v_utente is null then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                              confirmation_token, recovery_token, email_change_token_new, email_change,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', v_pro.utente_fisso,
              'authenticated', 'authenticated', v_pro.email, '',
              '', '', '', '',
              '{"provider":"email","providers":["email"]}',
              jsonb_build_object('role', 'professional', 'first_name', 'Idraulico', 'last_name', 'Demo ' || v_pro.n),
              now(), now())
      on conflict (id) do nothing;
      v_utente := v_pro.utente_fisso;
    end if;

    -- Utente creato dalla dashboard: handle_new_user l'ha fatto cliente e
    -- senza nome. Diventa professionista con il suo nome.
    update public.users set role = 'professional' where id = v_utente and role is distinct from 'professional';
    update public.profiles
       set first_name = 'Idraulico', last_name = 'Demo ' || v_pro.n, full_name = 'Idraulico Demo ' || v_pro.n
     where user_id = v_utente and full_name is distinct from 'Idraulico Demo ' || v_pro.n;

    insert into public.professionals (id, user_id, city_id, business_name, headline, bio, years_experience,
                                      verification_status, response_time_label, subscription_tier,
                                      subservice_slugs, comune_istat, comune_name, province, region,
                                      postal_code, onboarding_completed_at, is_test_fixture)
    values (v_pro.pro, v_utente, v_citta, 'Idraulico Demo ' || v_pro.n,
            case when v_pro.bio is null then null else 'Idraulico demo — profilo di prova' end,
            v_pro.bio, 5 + v_pro.n,
            case when v_pro.verifica = 'none' then 'unverified' else 'verified' end,
            v_pro.etichetta_risposta, 'free',
            array(select x ->> 'sotto' from jsonb_array_elements(v_pro.servizi) x),
            '015146', 'Milano', 'Milano', 'Lombardia', v_pro.cap, now(), false)
    on conflict (id) do nothing;

    -- I servizi: uno per intervento, con o senza prezzo.
    insert into public.professional_services (id, professional_id, service_id, subservice_id, min_price, max_price, city_id)
    select ('b2000000-0000-0000-' || lpad(to_hex(v_pro.n), 4, '0') || '-' || lpad(to_hex(i::int), 12, '0'))::uuid,
           v_pro.pro, v_servizio, ss.id, (x ->> 'min')::numeric, (x ->> 'max')::numeric, v_citta
      from jsonb_array_elements(v_pro.servizi) with ordinality as t(x, i)
      join public.subservices ss on ss.service_id = v_servizio and ss.slug = x ->> 'sotto'
    on conflict (id) do nothing;

    -- Dove lavora: tutta Milano, oppure solo alcune zone.
    insert into public.professional_coverage (id, professional_id, scope, mode, city_id, zone_slugs)
    values (('b3000000-0000-0000-0000-' || lpad(to_hex(v_pro.n), 12, '0'))::uuid, v_pro.pro,
            case when v_pro.copertura = 'city' then 'city' else 'zones' end, 'zones', v_citta,
            case when v_pro.copertura = 'city' then '{}'::text[] else string_to_array(v_pro.copertura, ',') end)
    on conflict (id) do nothing;

    -- Disponibilita': lun-ven 8-18.
    if v_pro.disponibilita then
      insert into public.professional_availability (id, professional_id, weekday, start_time, end_time)
      select ('b4000000-0000-0000-' || lpad(to_hex(v_pro.n), 4, '0') || '-' || lpad(to_hex(g), 12, '0'))::uuid,
             v_pro.pro, g, '08:00', '18:00'
        from generate_series(1, 5) g
      on conflict (id) do nothing;
    end if;

    -- Verifica: la riga la crea il trigger alla nascita del pro; si alza il
    -- livello come farebbe lo staff, e la traccia lo dice.
    if v_pro.verifica <> 'none' then
      update public.professional_verification
         set level = v_pro.verifica,
             vat_number = '000000000' || lpad(v_pro.n::text, 2, '0'),
             vat_active = true,
             vat_checked_at = now() - interval '30 days',
             vat_check_source = 'staff',
             vat_match_source = 'staff',
             documents_checked_at = case when v_pro.verifica = 'documents_verified' then now() - interval '20 days' end,
             documents_note = case when v_pro.verifica = 'documents_verified' then 'DEMO 16/10: documenti finti, nessuna verifica vera' end
       where professional_id = v_pro.pro and level is distinct from v_pro.verifica;
      insert into public.verification_events (id, professional_id, event, from_level, to_level, note, actor_role)
      values (('b5000000-0000-0000-0000-' || lpad(to_hex(v_pro.n), 12, '0'))::uuid, v_pro.pro,
              'level_granted', 'none', v_pro.verifica, 'DEMO 16/10: livello dato dal seed degli idraulici demo, non una verifica vera', 'staff')
      on conflict (id) do nothing;
    end if;

    -- Le richieste chiuse: messaggio del cliente, risposta del pro dopo i
    -- minuti voluti, e la recensione se c'e' un voto.
    for v_k in 1..v_pro.richieste loop
      v_req := ('d1000000-0000-0000-' || lpad(to_hex(v_pro.n), 4, '0') || '-' || lpad(to_hex(v_k), 12, '0'))::uuid;
      v_recensore := ('a1000000-0000-0000-0000-' || lpad(to_hex(13 + 1 + (v_k % 3)), 12, '0'))::uuid;
      -- Fra 5 e 70 giorni fa, distinte (ognuna ha la sua riga in search_events).
      v_quando := date_trunc('minute', now()) - make_interval(days => 5 + (v_k * 2) % 66, mins => v_pro.n * 7 + v_k);
      insert into public.requests (id, customer_id, city_id, service_id, subservice_id, status, closed_reason,
                                   problem_description, comune_istat, created_at)
      values (v_req, v_recensore, v_citta, v_servizio,
              (select ss.id from public.subservices ss
                where ss.service_id = v_servizio and ss.slug = (v_pro.servizi -> 0 ->> 'sotto')),
              'closed', 'concluso', 'DEMO 16/10 — richiesta di prova degli idraulici demo', '015146', v_quando)
      on conflict (id) do nothing;
      if found then
        v_nuove := v_nuove + 1;
        insert into public.request_professionals (request_id, professional_id, status, created_at)
        values (v_req, v_pro.pro, 'responded', v_quando);
        insert into public.request_messages (id, request_id, professional_id, sender_type, sender_id, message, created_at, read_at)
        values (('e1000000-0000-0000-' || lpad(to_hex(v_pro.n), 4, '0') || '-' || lpad(to_hex(v_k * 2), 12, '0'))::uuid,
                v_req, v_pro.pro, 'customer', v_recensore, 'DEMO — Buongiorno, ho una perdita: quando potrebbe passare?',
                v_quando + interval '1 minute', v_quando + interval '2 minutes'),
               (('e1000000-0000-0000-' || lpad(to_hex(v_pro.n), 4, '0') || '-' || lpad(to_hex(v_k * 2 + 1), 12, '0'))::uuid,
                v_req, v_pro.pro, 'professional', v_utente, 'DEMO — Buongiorno, posso passare domani mattina.',
                v_quando + interval '1 minute' + make_interval(mins => v_pro.risposta_min[1 + (v_k - 1) % array_length(v_pro.risposta_min, 1)]),
                v_quando + interval '1 minute' + make_interval(mins => v_pro.risposta_min[1 + (v_k - 1) % array_length(v_pro.risposta_min, 1)] + 5));
      end if;
      if v_k <= coalesce(array_length(v_pro.voti, 1), 0) then
        insert into public.ratings (id, professional_id, customer_id, request_id, score, comment, created_at)
        values (('f1000000-0000-0000-' || lpad(to_hex(v_pro.n), 4, '0') || '-' || lpad(to_hex(v_k), 12, '0'))::uuid,
                v_pro.pro, v_recensore, v_req, v_pro.voti[v_k], 'DEMO — recensione di prova',
                v_quando + interval '3 days')
        on conflict (id) do nothing;
      end if;
    end loop;
  end loop;

  -- Il tempo di risposta subito, senza aspettare il cron delle 04:10 (che
  -- comunque arriva allo stesso numero: stessa funzione, stessi messaggi).
  -- Solo se questa esecuzione ha scritto messaggi: rieseguire non tocca niente.
  if v_nuove > 0 then
    perform public.aggiorna_segnali_professionisti(array(select pro from demo_idraulici));
  end if;

  raise notice 'Idraulici demo: % pro, % richieste demo, % recensioni demo',
    (select count(*) from public.professionals where id in (select pro from demo_idraulici)),
    (select count(*) from public.requests where id::text like 'd1000000-0000-0000-%'),
    (select count(*) from public.ratings where id::text like 'f1000000-0000-0000-%');
end;
$seed$;

commit;
