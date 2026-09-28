-- L'IMPRONTA DELLO SCHEMA: nove righe che rispondono a una domanda sola, «il
-- repo e la produzione sono la stessa cosa?». Si esegue sui due lati e si
-- confrontano le righe, categoria per categoria.
--
-- LE FUNZIONI SONO DUE RIGHE, NON UNA (28/09). Rispondono a due domande
-- diverse, e con una riga sola una delle due restava senza risposta:
--
--   functions        L'ALLARME. md5 del corpo senza commenti `--` e con gli
--                    spazi ridotti a uno. Se diverge, una funzione in
--                    produzione FA una cosa diversa da quella che dice il
--                    repo: e' la deriva vera, quella della 089. Nome,
--                    argomenti, SECURITY DEFINER e search_path restano nella
--                    firma. Niente lower(): minuscolare nasconderebbe un
--                    cambio dentro un letterale ('Admin' contro 'admin'), e
--                    quello cambia il comportamento.
--
--   functions_testo  L'AVVISO. md5 del corpo grezzo, come pg_get_functiondef
--                    lo restituisce. Se diverge MENTRE functions coincide, in
--                    produzione e' stato applicato un testo riscritto, non il
--                    file: stesso comportamento, testo diverso. Non e' un
--                    guasto, ma dice che il canale fra repo e produzione non
--                    e' «applica il file»: qualcuno lo ha ricopiato (di solito
--                    togliendo i commenti), e un ricopiare e' il posto dove
--                    un giorno sparira' una riga che non era un commento.
--                    ATTENZIONE: il testo grezzo lo ristampa il motore
--                    (pg_get_functiondef), e un aggiornamento di versione
--                    major da una parte sola puo' farlo divergere senza che
--                    nessuno abbia toccato niente. Il 28/09 la riga
--                    normalizzata coincideva fra PostgreSQL 16.13 (repo) e
--                    17.6 (produzione): se dopo un aggiornamento diverge solo
--                    functions_testo, si guarda prima la versione.
--
-- Il 28/09 e' esattamente il caso (misurato da Lucio): le 8 funzioni applica_disdette_scadute,
-- professionals_score, search_resolve, segnali_da_messaggio, set_request_comune,
-- sync_coverage_zones, sync_professional_verification_level e
-- sync_ready_at_da_servizi sono in produzione senza i commenti del file.
-- functions coincide, functions_testo no. L'impronta di quel giorno, dei due
-- lati, sta in scripts/impronte/.
--
-- Prima del 28/09 la riga era una sola, e fino al 20/09 era l'md5 grezzo: per
-- questo il confronto non coincideva mai e nessuno lo guardava piu'.
--
-- EVENT TRIGGER. Supabase ne installa sei suoi (pgrst_ddl_watch,
-- issue_pg_cron_access...), le cui funzioni stanno nello schema `extensions`.
-- Non sono nostri e non saranno mai in un clone ricostruito dal repo: si
-- contano solo quelli la cui funzione sta in `public`.
--
-- Uso: ./scripts/deriva.sh, oppure a mano su entrambi i lati.

with cols as (
  select 'col '||c.table_name||'.'||c.column_name||' '||c.data_type||' null='||c.is_nullable||' def='||coalesce(c.column_default,'-') as sig
  from information_schema.columns c
  join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
  where c.table_schema='public'
), tabs as (
  select 'tab '||c.relname||' rls='||c.relrowsecurity::text as sig
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
), cons as (
  select 'con '||rel.relname||' '||con.conname||' '||con.contype::text||' '||pg_get_constraintdef(con.oid) as sig
  from pg_constraint con join pg_class rel on rel.oid=con.conrelid
  join pg_namespace n on n.oid=rel.relnamespace where n.nspname='public'
), idx as (
  select 'idx '||indexname||' '||indexdef as sig from pg_indexes where schemaname='public'
), pol as (
  select 'pol '||rel.relname||' '||pol.polname||' '||pol.polcmd::text||' roles='||
         coalesce((select string_agg(r.rolname,',' order by r.rolname) from pg_roles r where r.oid = any(pol.polroles)),'PUBLIC')||
         ' using='||coalesce(pg_get_expr(pol.polqual, pol.polrelid),'-')||
         ' check='||coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'-') as sig
  from pg_policy pol join pg_class rel on rel.oid=pol.polrelid
  join pg_namespace n on n.oid=rel.relnamespace where n.nspname='public'
), fns as (
  -- L'ALLARME: il corpo senza commenti e con gli spazi normalizzati.
  select 'fn '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') sd='||p.prosecdef::text||
         ' sp='||coalesce(array_to_string(p.proconfig,','),'-')||' md5='||
         md5(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')) as sig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
), fns_testo as (
  -- L'AVVISO: il corpo grezzo, commenti compresi.
  select 'fn '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') md5='||
         md5(pg_get_functiondef(p.oid)) as sig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
), trg as (
  select 'trg '||rel.relname||' '||t.tgname||' '||pg_get_triggerdef(t.oid) as sig
  from pg_trigger t join pg_class rel on rel.oid=t.tgrelid
  join pg_namespace n on n.oid=rel.relnamespace
  where n.nspname='public' and not t.tgisinternal
), evt as (
  select 'evt '||evtname||' '||evtevent||' '||p.proname as sig
  from pg_event_trigger e
  join pg_proc p on p.oid=e.evtfoid
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
), all_sigs as (
  select 'columns' k, sig from cols union all select 'tables', sig from tabs
  union all select 'constraints', sig from cons union all select 'indexes', sig from idx
  union all select 'policies', sig from pol union all select 'functions', sig from fns
  union all select 'functions_testo', sig from fns_testo
  union all select 'triggers', sig from trg union all select 'event_triggers', sig from evt
)
select k as category, count(*) as n, md5(string_agg(sig, E'\n' order by sig)) as fingerprint
from all_sigs group by k order by k;
