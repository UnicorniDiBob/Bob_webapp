-- 114_prenotazione_rpc_private.sql
--
-- LE DUE FUNZIONI DELLA 113 ESCONO DALLO SCHEMA ESPOSTO (05/10, Lucio).
--
-- PERCHE'. Applicata la 113, l'advisor di sicurezza ha segnalato (lint 0029)
-- annulla_appuntamento() e contatto_controparte(): SECURITY DEFINER in
-- `public`, quindi endpoint /rest/v1/rpc/ eseguiti con i privilegi del
-- proprietario. Lo sono di proposito — devono scrivere dove il chiamante non
-- puo' (chiudere la richiesta del cliente quando annulla il pro, leggere il
-- telefono dell'altra parte) e ogni controllo di identita' e' dentro, su
-- auth.uid() — ma la regola del progetto (032, 075) e' che nello schema
-- esposto non resta nessuna funzione SECURITY DEFINER.
--
-- COME. Lo stesso schema degli helper della 048: il corpo si SPOSTA in
-- `private` (ALTER FUNCTION ... SET SCHEMA: il testo resta byte per byte
-- quello della 113, nessuna riscrittura), dove PostgREST non arriva; in
-- `public` resta un involucro SECURITY INVOKER con la stessa firma, che la
-- chiama. L'app non cambia: continua a chiamare rpc('annulla_appuntamento')
-- e rpc('contatto_controparte'). auth.uid() dentro resta quello di chi chiama
-- (legge la sessione, non il ruolo), e gli errori con il loro HINT passano
-- l'involucro intatti.
--
-- Idempotente: lo spostamento avviene solo se in `public` c'e' ancora la
-- versione SECURITY DEFINER; gli involucri sono create or replace.

begin;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'annulla_appuntamento' and p.prosecdef
  ) then
    alter function public.annulla_appuntamento(uuid, text, boolean) set schema private;
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'contatto_controparte' and p.prosecdef
  ) then
    alter function public.contatto_controparte(uuid) set schema private;
  end if;
end $$;

revoke execute on function private.annulla_appuntamento(uuid, text, boolean) from public, anon;
grant execute on function private.annulla_appuntamento(uuid, text, boolean) to authenticated;
revoke execute on function private.contatto_controparte(uuid) from public, anon;
grant execute on function private.contatto_controparte(uuid) to authenticated;

create or replace function public.annulla_appuntamento(
  p_id uuid,
  p_motivo text default null,
  p_concordato_telefono boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.annulla_appuntamento(p_id, p_motivo, p_concordato_telefono);
$$;

create or replace function public.contatto_controparte(p_appuntamento uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.contatto_controparte(p_appuntamento);
$$;

revoke execute on function public.annulla_appuntamento(uuid, text, boolean) from public, anon;
grant execute on function public.annulla_appuntamento(uuid, text, boolean) to authenticated;
revoke execute on function public.contatto_controparte(uuid) from public, anon;
grant execute on function public.contatto_controparte(uuid) to authenticated;

commit;
