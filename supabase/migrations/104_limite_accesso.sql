-- 104_limite_accesso.sql
--
-- IL TETTO DI TENTATIVI SU «AGGIUNGI ACCOUNT» (29/09, Lucio — sessioni multiple).
--
-- PERCHE'. Aggiungere un secondo account nel browser (POST
-- /api/sessioni/aggiungi) e' una superficie nuova che accetta una password.
-- Senza un tetto diventerebbe il modo comodo per provare password a raffica, o
-- per scoprire chi ha un account su Bob. Il tetto usa il limite di frequenza
-- che c'e' gia' (097: check_rate_limit + rate_limit_counters), che pero'
-- accetta solo due rotte: questa migrazione aggiunge la terza, «accesso».
--
-- COSA FINISCE NELLA TABELLA per la rotta «accesso», e cosa no:
--   ip:<indirizzo>        per IP, come per chat e brief;
--   email:<HMAC-SHA256>   per email, con una chiave segreta d'ambiente
--                         (ACCESSO_HMAC_SEGRETO, su Vercel). MAI l'indirizzo in
--                         chiaro e MAI un hash nudo: uno SHA-256 di un indirizzo
--                         si inverte provando indirizzi, e la tabella
--                         diventerebbe l'elenco di chi ha provato a entrare su
--                         Bob. Senza la chiave, dall'HMAC non si risale.
-- Mai la password, mai l'esito del tentativo.
--
-- CONSERVAZIONE. La stessa di tutta la tabella: 48 ore, poi
-- purge_stale_rate_limit_counters() (097, ogni ora via pg_cron), che non
-- filtra per rotta e quindi copre anche «accesso». Niente di nuovo da
-- schedulare. Riga A24 del Registro aggiornata: la finalita' si allarga.
--
-- COSA NON CAMBIA. Ne' check_rate_limit ne' la RLS: la tabella resta senza
-- policy pubbliche, e solo il service role la tocca attraverso le funzioni
-- SECURITY DEFINER della 097.
--
-- Idempotente: il vincolo si toglie se c'e' e si rimette.

begin;

alter table public.rate_limit_counters
  drop constraint if exists rate_limit_counters_route_check;

alter table public.rate_limit_counters
  add constraint rate_limit_counters_route_check
  check (route = any (array['chat'::text, 'brief'::text, 'accesso'::text]));

comment on constraint rate_limit_counters_route_check on public.rate_limit_counters is
  'Le rotte con un limite di frequenza: chat e brief (097), accesso (104: aggiungi account, per IP e per HMAC dell''email).';

commit;
