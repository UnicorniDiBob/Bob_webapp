-- 034: regola di retention per customer_memory.
--
-- PERCHÉ
-- customer_memory conserva l'ultima ricerca del cliente (servizio, città,
-- fascia di budget, urgenza) con l'unica finalità di personalizzare il saluto
-- di Bob al rientro. Da questa migrazione il saluto usa la memoria solo se
-- `updated_at` è più recente di 24 ore (MEMORY_GREETING_TTL_MS in
-- src/components/BobChat.tsx): oltre quella soglia la riga non serve più ad
-- alcuna finalità. Tenerla comunque in tabella sarebbe conservazione senza
-- scopo — art. 5(1)(c) ed (e) GDPR, e la §5 di docs/DATA_COMPLIANCE.md chiede
-- una regola di cancellazione esplicita per ogni tabella con dati personali.
--
-- SCELTA DELLA SOGLIA
-- Il filtro di visualizzazione è 24h, la cancellazione è a 30 giorni. Il
-- margine è deliberato: `search_count` alimenta metriche aggregate di ritorno
-- e una finestra di un mese lascia spazio a un eventuale allungamento del TTL
-- del saluto senza dover reintrodurre dati già cancellati. Non è dato di
-- fatturazione né legato a una transazione, quindi non ricade nei 10 anni
-- delle fatture né nel termine di prescrizione delle chat transazionali.
-- La cancellazione dell'account resta coperta dalla FK
-- `references auth.users(id) on delete cascade` della 011.
--
-- Idempotente: create or replace + unschedule-then-schedule del job.

-- 1. Lo scheduler. pg_cron non era installata su questo progetto: senza di lei
--    la funzione di purga esisterebbe ma non girerebbe mai, e una regola di
--    retention che non cancella nulla non è una regola. Va in pg_catalog come
--    da indicazione Supabase. Serve anche alle retention ancora da scrivere
--    (fatture 10 anni, chat, prospect ≤12 mesi).
create extension if not exists pg_cron with schema pg_catalog;

-- 2. La purga. SECURITY DEFINER perché deve poter cancellare righe di tutti
--    gli utenti, cosa che le policy RLS della 011 (solo la propria riga)
--    vietano al chiamante. search_path fissato come da 032.
create or replace function public.purge_stale_customer_memory()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  deleted integer;
begin
  delete from public.customer_memory
   where updated_at < now() - interval '30 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

comment on function public.purge_stale_customer_memory() is
  'Retention customer_memory: cancella le righe non aggiornate da 30 giorni. Vedi docs/DATA_COMPLIANCE.md §5.';

-- 3. Non è un endpoint: come in 032, si revoca EXECUTE a PUBLIC/anon/
--    authenticated per non esporla su /rest/v1/rpc/.
revoke execute on function public.purge_stale_customer_memory() from public, anon, authenticated;

-- 4. Schedulazione giornaliera (03:17 UTC, fuori dai picchi). Il blocco resta
--    condizionale così la migrazione si applica anche dove pg_cron non è
--    disponibile (es. un ambiente locale minimale): lì la funzione esiste
--    comunque e la purga si può invocare a mano o da un cron esterno.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-stale-customer-memory') then
      perform cron.unschedule('purge-stale-customer-memory');
    end if;
    perform cron.schedule(
      'purge-stale-customer-memory',
      '17 3 * * *',
      $cron$select public.purge_stale_customer_memory();$cron$
    );
  else
    raise notice 'pg_cron non installata: purge_stale_customer_memory() creata ma non schedulata.';
  end if;
end;
$$;
