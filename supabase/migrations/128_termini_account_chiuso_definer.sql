-- 128 — la cancellazione di un account non fallisce piu' sui termini (16/10/2026).
--
-- IL GUASTO, TROVATO DAL VIVO (ramo cron-cancella-foto): dal 28/09 (migrazione
-- 100) nessun account si puo' cancellare. Supabase Auth cancella auth.users
-- col proprio ruolo (supabase_auth_admin); la cascata arriva a public.users, e
-- il trigger AFTER DELETE trg_termini_account_chiuso chiama
-- termini_account_chiuso(), che e' SECURITY INVOKER e fa UPDATE su
-- public.terms_acceptances. Quel ruolo non ha permessi su quella tabella
-- (solo postgres e service_role): «permission denied for table
-- terms_acceptances (SQLSTATE 42501)», e l'intera cancellazione torna indietro.
-- Il cron cancella-account lo registra come falliti: 1 e riprova ogni notte,
-- per sempre. Nessun utente vero colpito: dal 28/09 al 16/10 la coda delle
-- cancellazioni scadute e' stata vuota (system_job_runs: 0 cancellati, l'unico
-- giro con falliti e' la prova del 16/10).
--
-- LA CORREZIONE: SECURITY DEFINER (proprietario postgres), cosi' il trigger
-- scrive coi permessi di chi l'ha creato, chiunque cancelli l'utente. Corpo
-- riscritto dalla definizione VIVA (pg_get_functiondef, 16/10), identico alla
-- 100: cambia solo la riga security. search_path resta vuoto e ogni nome e'
-- qualificato (public.terms_acceptances): una funzione DEFINER con search_path
-- mutabile sarebbe il rilievo dell'advisor. EXECUTE resta tolto a public, anon
-- e authenticated: e' una funzione di trigger, nessuno la chiama a mano.
--
-- PERCHE' NON UN GRANT A supabase_auth_admin: e' un ruolo di Supabase, non
-- nostro, e dargli UPDATE su una tabella nostra vorrebbe dire che ogni
-- prossima tabella toccata da un trigger della cancellazione ha bisogno del
-- suo grant. DEFINER sta sulla funzione, dove sta la responsabilita'.
--
-- Idempotente: create or replace, revoke ripetibile.

begin;

create or replace function public.termini_account_chiuso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.terms_acceptances
     set account_closed_at = now()
   where user_id = old.id
     and account_closed_at is null;
  return old;
end;
$$;

revoke execute on function public.termini_account_chiuso() from public, anon, authenticated;

commit;
