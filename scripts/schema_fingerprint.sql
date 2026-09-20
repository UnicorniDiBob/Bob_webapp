-- L'IMPRONTA DELLO SCHEMA: otto righe che rispondono a una domanda sola, «il
-- repo e la produzione sono la stessa cosa?». Si esegue sui due lati e si
-- confrontano le righe, categoria per categoria.
--
-- DUE NORMALIZZAZIONI, E IL PERCHE' (20/09). Senza queste il confronto non
-- coincide MAI, e un controllo che grida sempre al lupo non lo guarda piu'
-- nessuno — proprio nella categoria dove sono finite le regressioni vere:
--
--   FUNZIONI. Chi applica le migrazioni in produzione toglie i commenti `--`
--   dentro i corpi. Stesso codice, md5 diverso: sette funzioni su trentacinque
--   risultavano «diverse» pur essendo identiche riga per riga. Qui il corpo si
--   confronta senza commenti e con gli spazi normalizzati. Nome, argomenti,
--   SECURITY DEFINER e search_path restano nel confronto: quelli contano.
--
--   EVENT TRIGGER. Supabase ne installa sei suoi (pgrst_ddl_watch,
--   issue_pg_cron_access...), le cui funzioni stanno nello schema `extensions`.
--   Non sono nostri e non saranno mai in un clone ricostruito dal repo: si
--   contano solo quelli la cui funzione sta in `public`.
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
  select 'fn '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') sd='||p.prosecdef::text||
         ' sp='||coalesce(array_to_string(p.proconfig,','),'-')||' md5='||
         md5(lower(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))) as sig
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
  union all select 'triggers', sig from trg union all select 'event_triggers', sig from evt
)
select k as category, count(*) as n, md5(string_agg(sig, E'\n' order by sig)) as fingerprint
from all_sigs group by k order by k;
