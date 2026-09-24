-- 097_limite_di_frequenza.sql
--
-- Fase 5 (P1.5, G20-G22): /api/bob/chat e /api/bob/brief sono senza
-- autenticazione, senza limite di frequenza e senza tetto al payload.
-- ANTHROPIC_API_KEY resta volutamente fuori da Vercel finche' questo non
-- esiste (docs/QUOTE_INTAKE_SPEC.md §6.3) — questa migrazione e' quello.
--
-- DUE MECCANISMI DISTINTI, NON UNO SOLO.
--
-- 1) IL LIMITE PER ATTORE (check_rate_limit). Limita quello che UN
--    chiamante puo' spendere — un IP anonimo, o un account loggato. Non
--    limita il totale: cento IP diversi, ognuno dentro il proprio limite,
--    fanno comunque cento volte la spesa. Non basta da solo.
--
-- 2) IL TETTO GLOBALE GIORNALIERO (check_global_daily_cap). Limita la
--    spesa TOTALE di /api/bob/chat, indipendentemente da chi chiama. Alla
--    rottura non blocca — non c'e' nessun 429 globale, nessuno vede un
--    errore — degrada silenziosamente a ruleBasedDecision (il fallback a
--    regole gia' esistente): l'app continua a rispondere, la spesa si
--    ferma, il log gia' esistente ("[bob/chat] ... fallback a regole")
--    dice che e' successo. Il tetto di spesa sulla Console Anthropic resta
--    un backstop separato: quello spegne la chiave per OGNI rotta insieme,
--    questo degrada la sola /api/bob/chat lasciando tutto il resto vivo.
--
-- PERCHE' POSTGRES E NON REDIS/VERCEL KV. Nessuna delle due esiste in
-- questo progetto — verificato: nessuna dipendenza redis/upstash/kv in
-- package.json, nessuna variabile d'ambiente relativa. Introdurne una
-- significa un fornitore nuovo, una riga DPA nuova, variabili d'ambiente
-- da provisionare su Vercel — per un problema che questo progetto risolve
-- gia' cosi' (system_job_runs, 049; customer_memory, 034): stato che deve
-- sopravvivere alla natura stateless del serverless, su Postgres, con
-- pg_cron per la pulizia. Un INSERT ... ON CONFLICT ... DO UPDATE da' la
-- stessa garanzia atomica di un INCR di Redis, su un'infrastruttura gia'
-- pagata e gia' fidata con tutto il resto di quest'app.
--
-- FALLISCE CHIUSO, SU ENTRAMBI I MECCANISMI — non e' un vero dilemma.
-- /api/bob/chat e /api/bob/brief dipendono gia' da Postgres per la loro
-- logica principale (getServices/getAllSubservices, l'insert su
-- job_briefs): se Supabase e' giu' per davvero, quelle rotte sono gia'
-- rotte a prescindere da questo limite. "Il contatore non risponde ma il
-- resto di Postgres si'" e' un caso stretto (un bug in questa tabella, lock
-- contention), non un nuovo rischio sistemico — e in quel caso stretto un
-- controllo di sicurezza che fallisce aperto e' l'errore gia' noto: meglio
-- che qualche richiesta legittima veda "riprova fra poco" piuttosto che il
-- limite smetta di limitare in silenzio. "Chiuso" significa cose diverse
-- per i due meccanismi: per il limite per attore vuol dire 429 (blocca
-- quel chiamante); per il tetto globale vuol dire degradare a regole (non
-- blocca MAI il cliente, smette solo di spendere) — mai un errore visibile
-- per un problema che e' nostro, non suo.
--
-- LA CONTESA SOTTO UN'ONDATA DA UN SOLO IP NON E' UN BUG. Ogni richiesta
-- dello stesso IP nello stesso minuto contende sulla STESSA riga
-- (key, route, window_kind, window_start) — Postgres la serializza da
-- solo, riga per riga. Con un timeout di 500ms lato applicazione e fail
-- closed, l'esito sotto un'ondata vera e' una sequenza di 429 via via piu'
-- rapidi: e' l'esito CORRETTO, il limite di frequenza che funziona sotto
-- pressione, non un sintomo di contesa da controllare in produzione.
--
-- DATI PERSONALI (DATA_COMPLIANCE §5, docs/legal/ROPA.md voce A24). La
-- chiave `ip:<indirizzo>` e' un identificatore (art. 4(1) GDPR). Finalita'
-- unica: sicurezza/anti-abuso, legittimo interesse (6(1)(f)) — mai usata
-- per profilazione, marketing o altro. Minimizzazione per finalita', non
-- mascheramento cieco: la regola generale del progetto (§1, mascherare
-- almeno l'ultimo ottetto) vale per l'ANALYTICS, dove l'IP non serve mai
-- per intero; qui l'IP intero e' necessario perche' il controllo deve
-- distinguere un chiamante dall'altro, non aggregarli. La riga 'global:*'
-- non e' un identificatore di nessuno: nessuna voce ROPA le serve.
-- Conservazione: breve, perche' la finestra piu' lunga che il sistema
-- consulta e' un'ora — 48 ore di margine per il debug, poi cancellata dal
-- cron orario qui sotto. Percorso di cancellazione: la funzione di pulizia,
-- nessuna azione manuale prevista.
--
-- Idempotente: create table/function/index/policy if not exists,
-- create or replace per le funzioni, drop-then-create per la policy.

begin;

create table if not exists public.rate_limit_counters (
  id           uuid primary key default gen_random_uuid(),
  -- 'ip:<indirizzo>' per un chiamante anonimo, 'user:<uuid>' per un
  -- account loggato, 'global:<rotta>' per il tetto aggregato — tre forme
  -- della stessa chiave, mai confuse fra loro grazie al prefisso.
  key          text        not null,
  route        text        not null check (route in ('chat', 'brief')),
  window_kind  text        not null check (window_kind in ('minute', 'hour', 'day')),
  window_start timestamptz not null,
  count        integer     not null default 0,
  updated_at   timestamptz not null default now()
);

comment on table public.rate_limit_counters is
  'Contatori del limite di frequenza per /api/bob/chat e /api/bob/brief (Fase 5, P1.5). La chiave ip:* e'' un dato personale (identificatore, art. 4(1) GDPR) - vedi ROPA A24. Conservazione 48 ore, purge_stale_rate_limit_counters() ogni ora.';
comment on column public.rate_limit_counters.key is
  'ip:<indirizzo> (anonimo) | user:<uuid> (loggato) | global:<rotta> (tetto aggregato, nessun dato personale).';

-- Una riga sola per (chiave, rotta, tipo di finestra, inizio finestra):
-- l'upsert in check_rate_limit/check_global_daily_cap incrementa sempre
-- la stessa riga finche' la finestra e' quella, mai una riga nuova.
create unique index if not exists rate_limit_counters_bucket_idx
  on public.rate_limit_counters (key, route, window_kind, window_start);

-- Le query di controllo filtrano per key+route+window_kind e ordinano per
-- window_start: utile anche alla pulizia, che cancella per window_start.
create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_kind, window_start);

alter table public.rate_limit_counters enable row level security;

-- Nessuna policy per anon/authenticated: solo le funzioni SECURITY DEFINER
-- qui sotto (o il service role) toccano questa tabella. Un utente non deve
-- poter leggere quante richieste ha fatto un altro IP, ne' scrivere la
-- propria riga direttamente.
revoke all on public.rate_limit_counters from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1) Limite per attore: minuto + ora, incrementati insieme
-- ---------------------------------------------------------------------------
-- Incrementa ENTRAMBI i contatori prima di controllare, non solo quello
-- che eventualmente sfora: un tentativo respinto ha comunque raggiunto il
-- server e conta lo stesso ai fini del conteggio orario, altrimenti un
-- chiamante bloccato sul minuto potrebbe restare "gratis" per l'ora.
create or replace function public.check_rate_limit(
  p_key text,
  p_route text,
  p_minute_limit integer,
  p_hour_limit integer
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare
  v_now          timestamptz := now();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_hour_start   timestamptz := date_trunc('hour', v_now);
  v_minute_count integer;
  v_hour_count   integer;
begin
  insert into public.rate_limit_counters (key, route, window_kind, window_start, count)
  values (p_key, p_route, 'minute', v_minute_start, 1)
  on conflict (key, route, window_kind, window_start)
  do update set count = rate_limit_counters.count + 1, updated_at = v_now
  returning count into v_minute_count;

  insert into public.rate_limit_counters (key, route, window_kind, window_start, count)
  values (p_key, p_route, 'hour', v_hour_start, 1)
  on conflict (key, route, window_kind, window_start)
  do update set count = rate_limit_counters.count + 1, updated_at = v_now
  returning count into v_hour_count;

  if v_minute_count > p_minute_limit then
    return query select false, (60 - extract(second from v_now))::integer;
  elsif v_hour_count > p_hour_limit then
    return query select false, (3600 - extract(epoch from (v_now - v_hour_start)))::integer;
  else
    return query select true, 0;
  end if;
end;
$$;

revoke execute on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
-- Esplicito, non implicito: le rotte la chiamano via admin.rpc(...) col
-- service role (src/lib/rate-limit.ts). Non ci si affida al comportamento
-- di default di Postgres per una funzione che decide se una richiesta
-- passa o no.
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

comment on function public.check_rate_limit is
  'Limite per attore (IP o utente) su una rotta: minuto + ora, incrementati insieme. Ritorna allowed=false + un retry_after indicativo se uno dei due tetti e'' superato.';

-- ---------------------------------------------------------------------------
-- 2) Tetto globale giornaliero: solo /api/bob/chat, mai un 429
-- ---------------------------------------------------------------------------
create or replace function public.check_global_daily_cap(
  p_route text,
  p_daily_limit integer
) returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare
  v_day_start timestamptz := date_trunc('day', now());
  v_count     integer;
begin
  insert into public.rate_limit_counters (key, route, window_kind, window_start, count)
  values ('global:' || p_route, p_route, 'day', v_day_start, 1)
  on conflict (key, route, window_kind, window_start)
  do update set count = rate_limit_counters.count + 1, updated_at = now()
  returning count into v_count;

  return v_count <= p_daily_limit;
end;
$$;

revoke execute on function public.check_global_daily_cap(text, integer) from public, anon, authenticated;
grant execute on function public.check_global_daily_cap(text, integer) to service_role;

comment on function public.check_global_daily_cap is
  'Tetto aggregato giornaliero su una rotta, indipendente da chi chiama. Ritorna false quando il tetto e'' superato: il chiamante (route.ts) degrada a ruleBasedDecision invece di rispondere con un errore - vedi commento in testa al file.';

-- ---------------------------------------------------------------------------
-- Pulizia: 48 ore, ogni ora
-- ---------------------------------------------------------------------------
create or replace function public.purge_stale_rate_limit_counters()
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare n integer;
begin
  delete from public.rate_limit_counters
   where window_start < now() - interval '48 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_stale_rate_limit_counters() from public, anon, authenticated;

comment on function public.purge_stale_rate_limit_counters() is
  'Conservazione 48 ore per rate_limit_counters (DATA_COMPLIANCE §5, ROPA A24). La finestra piu'' lunga consultata e'' un''ora: 48h e'' solo margine per il debug.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'pulizia-limite-di-frequenza') then
      perform cron.unschedule('pulizia-limite-di-frequenza');
    end if;
    perform cron.schedule(
      'pulizia-limite-di-frequenza',
      '5 * * * *',
      $cron$select public.purge_stale_rate_limit_counters();$cron$
    );
  else
    raise notice 'pg_cron non installata: purge_stale_rate_limit_counters() creata ma non schedulata.';
  end if;
end $$;

commit;
