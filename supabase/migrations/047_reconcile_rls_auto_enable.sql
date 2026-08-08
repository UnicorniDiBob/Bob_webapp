-- 047: rimette nel repo il guardiano che accende la RLS da se'.
--
-- PERCHE' QUESTO FILE ESISTE.
-- In produzione esiste da tempo un event trigger, `ensure_rls`, che dopo ogni
-- CREATE TABLE nello schema public accende la row level security sulla tabella
-- appena creata. E' il meccanismo che fa rispettare la regola di progetto "ogni
-- tabella nuova: RLS accesa" senza dipendere dalla memoria di chi scrive la
-- migrazione. Non e' mai stato dichiarato in un file: e' stato creato a mano,
-- e nessuno se ne era accorto perche' in produzione funziona.
--
-- Non era un problema estetico. La 032 revoca l'EXECUTE su
-- public.rls_auto_enable(): su un clone nuovo, dove la funzione non esiste, la
-- 032 si fermava con "function public.rls_auto_enable() does not exist", e con
-- lei tutte le migrazioni dalla 032 alla 046. Ricostruire il database dai soli
-- file del repo era impossibile, non solo impreciso. La 032 e' stata resa
-- condizionale nello stesso commit di questo file.
--
-- VERIFICATO, non dedotto: la sequenza 001 -> 047 si applica per intero su un
-- Postgres 16 vuoto (piu' lo shim di piattaforma: ruoli anon/authenticated/
-- service_role, schemi auth/storage/extensions, auth.uid(), storage.buckets,
-- uuid-ossp e pgcrypto in extensions, pg_cron, publication supabase_realtime),
-- 0 errori. Confrontando il risultato con la produzione, colonne (310),
-- vincoli (146), indici (82), policy (83), tabelle e flag RLS (32), trigger
-- (11), event trigger (1) e funzioni (20) coincidono tutti.
--
-- Cosa NON fa: non cambia niente in produzione. La definizione qui sotto e'
-- copiata da pg_get_functiondef(), carattere per carattere, non riscritta a
-- memoria - cosi' il confronto resta pulito. Applicarla in produzione e'
-- un'operazione a vuoto: serve al clone.
--
-- Idempotente: create or replace per la funzione, drop-then-create per l'event
-- trigger, revoke ripetibile, e il ciclo finale salta le tabelle che hanno
-- gia' la RLS accesa.

-- ---------------------------------------------------------------------------
-- 1. La funzione, identica a quella in produzione
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. L'event trigger che la richiama
-- ---------------------------------------------------------------------------
drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();

-- ---------------------------------------------------------------------------
-- 3. Superficie esposta: una funzione di event trigger non e' un RPC
-- ---------------------------------------------------------------------------
-- Stessa revoke della 032, qui non condizionale perche' adesso la funzione
-- esiste per certo. Vale anche per PUBLIC: senza quello il grant implicito
-- resta e anon/authenticated continuano a poterla eseguire.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rete di sicurezza: la RLS dove il guardiano non c'era ancora
-- ---------------------------------------------------------------------------
-- Su un clone nuovo le tabelle create prima di questo file non sono passate
-- sotto l'event trigger. In produzione ci sono passate tutte. Allineiamo, cosi'
-- clone e produzione dicono la stessa cosa su ogni tabella di public. In
-- produzione questo ciclo non trova niente da fare.
do $$
declare t record;
begin
  for t in
    select c.oid::regclass as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table %s enable row level security', t.tbl);
    raise notice '047: RLS accesa su %', t.tbl;
  end loop;
end $$;
