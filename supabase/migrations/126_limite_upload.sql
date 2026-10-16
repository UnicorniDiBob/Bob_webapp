-- 126 — il limite di frequenza ammette la rotta «upload» (16/10/2026).
--
-- /api/upload/immagine (ramo strip-exif-server-endpoint) chiama
-- check_rate_limit con p_route = 'upload'. Il vincolo della 104 ammette solo
-- chat, brief e accesso: senza questa migrazione la RPC fallisce sul CHECK,
-- checkActorRateLimit chiude (nega) come deve, e OGNI caricamento risponde
-- 429. Fallire chiusi e' giusto; fallire chiusi per un vincolo dimenticato e'
-- un guasto. Va applicata PRIMA del merge, o insieme.
--
-- Solo il vincolo: check_rate_limit non filtra per rotta e resta com'e'
-- (definizione viva letta il 16/10, invariata dalla 097). 'accesso' resta
-- finche' una migrazione non lo toglie (ROPA A24, roadmap/findings.csv).
-- Le righe 'upload' le purga purge_stale_rate_limit_counters() come le
-- altre: non filtra per rotta.
--
-- Idempotente: il vincolo si toglie se c'e' e si rimette.

begin;

alter table public.rate_limit_counters
  drop constraint if exists rate_limit_counters_route_check;

alter table public.rate_limit_counters
  add constraint rate_limit_counters_route_check
  check (route = any (array['chat'::text, 'brief'::text, 'accesso'::text, 'upload'::text]));

comment on constraint rate_limit_counters_route_check on public.rate_limit_counters is
  'Le rotte con un limite di frequenza: chat e brief (097), accesso (104: aggiungi account, per IP e per HMAC dell''email), upload (126: /api/upload/immagine, per utente).';

commit;
