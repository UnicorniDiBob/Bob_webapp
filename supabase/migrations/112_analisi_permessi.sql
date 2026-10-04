-- 112_analisi_permessi.sql
--
-- I DUE RILIEVI DELL'ADVISOR DOPO LA 111 (04/10). Fanno parte di «fatto»
-- (CLAUDE.md: dopo ogni cambio di schema, advisor e rilievi risolti).
--
-- 1. cancella_tutti_i_ricavi_esterni() era SECURITY DEFINER ed eseguibile da
--    chiunque abbia una sessione (authenticated_security_definer_function_
--    executable). Serviva solo perche' analisi_mesi non dava il delete al pro.
--    Adesso glielo da', ma SOLO sulle righe 'esterno' sue: i mesi di Bob
--    restano scritti solo dalla condensazione. Con la policy la funzione puo'
--    girare come chi la chiama, e il rilievo sparisce per costruzione invece
--    che per un revoke.
--    Corpo riscritto da quello VIVO della 111 (hash verificato il 04/10):
--    cambia solo SECURITY INVOKER.
--
-- 2. Le funzioni dei trigger della 108 e della 111 erano eseguibili da anon e
--    authenticated, come ogni funzione appena creata (PUBLIC). Lo schema
--    private non e' esposto e una funzione che restituisce trigger non si
--    chiama da fuori, ma il progetto le tiene chiuse (063): stessa regola.
--    I trigger continuano a scattare: il permesso serve a chi CHIAMA la
--    funzione, non al trigger che la usa.
--
-- Idempotente: drop-then-recreate della policy, create or replace, revoke.

begin;

drop policy if exists "Pro cancella i propri mesi esterni" on public.analisi_mesi;
create policy "Pro cancella i propri mesi esterni"
  on public.analisi_mesi for delete to authenticated
  using (
    origine = 'esterno'
    and professional_id in (
      select p.id from public.professionals p where p.user_id = (select auth.uid())
    )
  );

grant delete on public.analisi_mesi to authenticated;

create or replace function public.cancella_tutti_i_ricavi_esterni()
returns integer
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_pro uuid;
  v_righe integer;
  v_mesi integer;
begin
  select p.id into v_pro from public.professionals p where p.user_id = (select auth.uid());
  if v_pro is null then
    raise exception 'Non sei un professionista' using errcode = '42501';
  end if;
  delete from public.ricavi_esterni r where r.professional_id = v_pro;
  get diagnostics v_righe = row_count;
  delete from public.analisi_mesi m where m.professional_id = v_pro and m.origine = 'esterno';
  get diagnostics v_mesi = row_count;
  return v_righe + v_mesi;
end;
$function$;

revoke all on function public.cancella_tutti_i_ricavi_esterni() from public, anon;
grant execute on function public.cancella_tutti_i_ricavi_esterni() to authenticated;

revoke all on function private.analisi_campi_appuntamento() from public, anon, authenticated;
revoke all on function private.analisi_da_partecipazione() from public, anon, authenticated;
revoke all on function private.analisi_da_messaggio() from public, anon, authenticated;
revoke all on function private.analisi_da_appuntamento() from public, anon, authenticated;
revoke all on function private.ricavi_esterni_tetto() from public, anon, authenticated;

commit;
