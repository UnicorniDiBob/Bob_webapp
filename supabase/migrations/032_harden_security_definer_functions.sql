-- 032: chiude l'esposizione REST delle funzioni SECURITY DEFINER di trigger
-- e fissa il search_path su quelle che ne erano prive.
--
-- PERCHÉ
-- I security advisor di Supabase (lint 0028/0029) segnalano che ogni funzione
-- SECURITY DEFINER nello schema `public` è invocabile via
-- /rest/v1/rpc/<nome> dai ruoli `anon` e `authenticated`: Postgres concede
-- EXECUTE a PUBLIC per default su ogni funzione, e PostgREST espone tutto ciò
-- che sta in `public`. Le funzioni qui sotto sono funzioni di trigger: non
-- devono essere endpoint. Emerso applicando la 031, che ricrea
-- appointments_customer_guard (il `create or replace` conserva i grant, quindi
-- il problema c'era da prima — dalla 021 — e riguarda anche le altre).
--
-- SICUREZZA DELLA REVOCA
-- Postgres verifica il privilegio EXECUTE su una funzione di trigger al
-- momento della CREATE TRIGGER, non a ogni scatto: revocare EXECUTE NON
-- impedisce ai trigger di funzionare. Verificato inoltre che l'app non chiama
-- nessuna funzione via RPC (nessuna occorrenza di `.rpc(` in src/).
--
-- COSA NON TOCCHIAMO, DI PROPOSITO
-- is_admin(), is_admin_or_cs(), my_assigned_request_ids(), my_professional_ids()
-- sono helper usati DENTRO le policy RLS: lì vengono invocati dal ruolo che
-- interroga, quindi EXECUTE per anon/authenticated serve e revocarlo
-- romperebbe le policy. Restano esposti via RPC by design; sono STABLE, senza
-- parametri e non rivelano nulla che il chiamante non sappia già di sé.
--
-- Nessun dato personale coinvolto: solo privilegi. Idempotente per natura
-- (revoke e alter function sono ripetibili).

-- 1. Funzioni di trigger di riga.
revoke execute on function public.appointments_customer_guard() from public, anon, authenticated;
revoke execute on function public.enforce_portfolio_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_brief_search_event() from public, anon, authenticated;
revoke execute on function public.log_request_search_event() from public, anon, authenticated;
revoke execute on function public.log_subscription_tier_change() from public, anon, authenticated;
revoke execute on function public.protect_professional_columns() from public, anon, authenticated;

-- 2. Event trigger.
-- Condizionale: rls_auto_enable() nasce fuori dal repo (creata a mano in
-- produzione) e viene dichiarata solo dalla 047. Su un clone nuovo qui non
-- esiste ancora, e una revoke secca fermava la ricostruzione a questo punto,
-- portandosi dietro tutte le migrazioni dalla 032 alla 046. La 047 rifà la
-- revoke subito dopo aver creato la funzione, quindi lo stato finale è lo
-- stesso in entrambi i percorsi.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 3. search_path fisso (lint 0011): senza di esso una funzione SECURITY
-- DEFINER può risolvere nomi non qualificati in schemi controllati dal
-- chiamante. Tutte e quattro referenziano solo oggetti public.* qualificati e
-- auth.uid(), quindi il pin non cambia il comportamento.
alter function public.is_admin() set search_path = public;
alter function public.is_admin_or_cs() set search_path = public;
alter function public.portfolio_limit(text) set search_path = public;
alter function public.enforce_portfolio_limit() set search_path = public;

-- Nota per il futuro: `create or replace function` conserva i grant, quindi
-- queste revoche sopravvivono a un aggiornamento del corpo. Un `drop function`
-- seguito da `create`, invece, riporta EXECUTE a PUBLIC: in quel caso ripetere
-- la revoca nella stessa migrazione.
