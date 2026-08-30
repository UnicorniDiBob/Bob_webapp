-- ---------------------------------------------------------------------------
-- 063 — le due funzioni-trigger della 062 escono dall'API pubblica
-- ---------------------------------------------------------------------------
--
-- IL DIFETTO, misurato. La 062 e' stata applicata in produzione il 30/08/2026
-- alle 10:13. Gli advisor di sicurezza, rilanciati subito dopo come da regola,
-- hanno acceso due WARN nuovi e due soli:
--
--   public.sync_ready_at_da_servizi()  eseguibile da anon e da authenticated
--   public.sync_ready_at_da_profilo()  eseguibile da anon e da authenticated
--
-- Sono SECURITY DEFINER e vivono in `public`, quindi PostgREST le espone su
-- /rest/v1/rpc/<nome>. In pratica una chiamata fallirebbe comunque — Postgres
-- rifiuta di eseguire una funzione che ritorna `trigger` fuori da un trigger —
-- ma «in pratica fallisce» non e' una difesa: e' la coincidenza di come e'
-- fatto oggi il planner. La difesa e' non averle nell'API.
--
-- PERCHE' UNA MIGRAZIONE E NON UNA MODIFICA ALLA 062. La 062 e' gia' applicata
-- e gia' in main: riscriverla farebbe divergere il file dal database, che e'
-- esattamente il difetto che schema_check.sh esiste per trovare. Si aggiunge.
--
-- E' la stessa cura gia' data a tutte le altre funzioni-trigger del progetto:
-- 032 (sette funzioni), 038 (due), 047, 048, 049, 052. La 062 e' stata scritta
-- senza la riga, e nulla lo ha impedito perche' nulla lo controlla: la revoca
-- non e' verificata da nessun test, solo dagli advisor lanciati a mano dopo.
--
-- NOTA per chi tocchera' ancora queste funzioni: `create or replace function`
-- CONSERVA i privilegi esistenti, quindi non serve ripetere la revoca a ogni
-- modifica. Serve pero' a ogni funzione NUOVA — e va messa nella stessa
-- migrazione che la crea, non nella successiva come qui.
--
-- Idempotente: `revoke` su un privilegio gia' revocato non e' un errore.
-- ---------------------------------------------------------------------------

revoke execute on function public.sync_ready_at_da_servizi() from public, anon, authenticated;
revoke execute on function public.sync_ready_at_da_profilo() from public, anon, authenticated;

comment on function public.sync_ready_at_da_servizi() is
  'Trigger su professional_services: tiene allineata professionals.ready_at. Non eseguibile da anon/authenticated (063).';
comment on function public.sync_ready_at_da_profilo() is
  'Trigger su professionals: riallinea ready_at quando il profilo si spegne o si riaccende. Non eseguibile da anon/authenticated (063).';
