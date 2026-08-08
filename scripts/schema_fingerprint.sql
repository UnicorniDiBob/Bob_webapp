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
         ' sp='||coalesce(array_to_string(p.proconfig,','),'-')||' md5='||md5(pg_get_functiondef(p.oid)) as sig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
), trg as (
  select 'trg '||rel.relname||' '||t.tgname||' '||pg_get_triggerdef(t.oid) as sig
  from pg_trigger t join pg_class rel on rel.oid=t.tgrelid
  join pg_namespace n on n.oid=rel.relnamespace
  where n.nspname='public' and not t.tgisinternal
), evt as (
  select 'evt '||evtname||' '||evtevent||' '||p.proname as sig
  from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid
), all_sigs as (
  select 'columns' k, sig from cols union all select 'tables', sig from tabs
  union all select 'constraints', sig from cons union all select 'indexes', sig from idx
  union all select 'policies', sig from pol union all select 'functions', sig from fns
  union all select 'triggers', sig from trg union all select 'event_triggers', sig from evt
)
select k as category, count(*) as n, md5(string_agg(sig, E'\n' order by sig)) as fingerprint
from all_sigs group by k order by k;
