-- 054: il consenso della waitlist smette di scriversi da solo.
--
-- PERCHE' E' SEPARATA DALLA 053.
-- La 015 dichiarava `consent_at timestamptz not null default now()`: bastava
-- inserire un'email e il database aggiungeva la prova di un atto affermativo
-- che non era mai avvenuto. Togliere quel default e' l'unica riga di SQL che
-- rende impossibile il problema invece di limitarsi a evitarlo: da qui in poi
-- una riga di city_waitlist senza consenso non nasce, e se un giorno qualcuno
-- scrivesse un nuovo percorso di iscrizione dimenticando il campo, l'insert
-- fallirebbe subito invece di produrre un registro che sembra in ordine.
--
-- MA VA APPLICATA DOPO IL DEPLOY, non prima.
-- Il codice che passa consent_at esplicitamente e' in src/app/api/waitlist/
-- route.ts. Finche' quella versione non e' online, la route vecchia inserisce
-- senza consent_at e si appoggia al default: applicare questa migrazione prima
-- del deploy romperebbe il form per tutta la durata del build.
-- Ordine corretto:
--   1. 053 (additiva, quando vuoi)
--   2. push su main -> Vercel builda e mette online la route nuova
--   3. questa
-- La 053 e la 054 viaggiano nello stesso commit del codice che le usa, come
-- vuole la regola sulle migrazioni: cambia solo il momento in cui si eseguono.
--
-- Verificato il 19/08/2026 prima di scriverla: city_waitlist ha 0 righe, quindi
-- non c'e' nessuna riga storica con un consenso finto da bonificare. Se ce ne
-- fossero state, la bonifica sarebbe andata QUI e prima del drop: un
-- consent_at che non corrisponde a un atto e' un dato da correggere, non da
-- conservare.
--
-- Idempotente: drop default su una colonna che non ha piu' default non e' un
-- errore in Postgres.

alter table public.city_waitlist alter column consent_at drop default;

comment on column public.city_waitlist.consent_at is
  'Momento della spunta. NESSUN DEFAULT di proposito (migrazione 054): chi inserisce deve fornirlo, altrimenti la riga non nasce.';
