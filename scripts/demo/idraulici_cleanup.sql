-- scripts/demo/idraulici_cleanup.sql
--
-- TOGLIE GLI IDRAULICI DEMO (16/10): esattamente quello che crea
-- scripts/demo/idraulici_seed.sql, e niente altro. Una transazione sola;
-- rieseguirlo non toglie niente (idempotente). Va nella lista delle pulizie
-- prima del pilota.
--
-- ORDINE, E PERCHE'.
--   1. search_events: una riga per richiesta demo, ma SENZA riferimento alla
--      richiesta (log_request_search_event scrive solo slug e ora). Si
--      ritrova per created_at, che e' quello della richiesta: quindi prima,
--      finche' le richieste esistono.
--   2. I sei pro (b1000000-…-0008 … 000d), solo se si chiamano ancora
--      «Idraulico Demo N». In cascata: servizi, copertura e copertura
--      pubblica, disponibilita', verifica e la sua traccia, segnali,
--      recensioni, collegamenti, eventi di lavoro, analisi mensili.
--   3. Le richieste demo (d1000000-0000-0000-…), solo se sono dei Recensori
--      Demo: in cascata messaggi e collegamenti rimasti.
--   4. Gli utenti con id fisso (a1000000-…-0008 … 0010), solo con email
--      *.demo@bobapp.it: in cascata users, profiles, profile_private.
--      Nessuno ha terms_acceptances (il seed non mette terms_version).
--
-- GLI ACCESSI DI DEMO 1 E 2 RESTANO. Gli utenti idraulico1/2.demo@bobapp.it
-- creati da André nella dashboard non li ha creati il seed (hanno un id
-- casuale): qui si toglie il loro profilo da pro, non l'account. Restano
-- utenti «professional» senza profilo da pro; per toglierli del tutto,
-- Supabase → Authentication → Users → elimina. Il NOTICE finale lo ricorda.

begin;

do $pulizia$
declare
  v_pro uuid[] := array[
    'b1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000009',
    'b1000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-00000000000b',
    'b1000000-0000-0000-0000-00000000000c', 'b1000000-0000-0000-0000-00000000000d']::uuid[];
  v_utenti uuid[] := array[
    'a1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000009',
    'a1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000b',
    'a1000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-00000000000d',
    'a1000000-0000-0000-0000-00000000000e', 'a1000000-0000-0000-0000-00000000000f',
    'a1000000-0000-0000-0000-000000000010']::uuid[];
  v_richieste uuid[];
  v_eventi integer;
  v_n integer;
begin
  -- Le richieste demo: id del seed E cliente fra i Recensori Demo.
  select coalesce(array_agg(r.id), '{}') into v_richieste
    from public.requests r
    join auth.users u on u.id = r.customer_id
   where r.id::text like 'd1000000-0000-0000-%'
     and u.id = any(v_utenti) and u.email like 'recensore%.demo@bobapp.it';

  -- 1. search_events, finche' le richieste ci sono.
  delete from public.search_events e
   where e.source = 'richiesta' and e.service_slug = 'idraulico' and e.city_slug = 'milano'
     and e.created_at in (select r.created_at from public.requests r where r.id = any(v_richieste));
  get diagnostics v_eventi = row_count;
  if v_eventi <> cardinality(v_richieste) then
    raise notice 'search_events tolti: % (richieste demo: %) — controllare', v_eventi, cardinality(v_richieste);
  end if;

  -- 2. I pro, solo se sono ancora i nostri.
  delete from public.professionals p
   where p.id = any(v_pro) and p.business_name like 'Idraulico Demo %';
  get diagnostics v_n = row_count;
  raise notice 'Idraulici demo tolti: %', v_n;

  -- 3. Le richieste demo.
  delete from public.requests r where r.id = any(v_richieste);
  get diagnostics v_n = row_count;
  raise notice 'Richieste demo tolte: % (search_events: %)', v_n, v_eventi;

  -- 4. Gli utenti creati dal seed (id fisso, email demo).
  delete from auth.users u
   where u.id = any(v_utenti) and u.email like '%.demo@bobapp.it';
  get diagnostics v_n = row_count;
  raise notice 'Utenti demo tolti: %', v_n;

  -- Gli accessi creati da André restano: lo si dice.
  select count(*) into v_n from auth.users u
   where u.email in ('idraulico1.demo@bobapp.it', 'idraulico2.demo@bobapp.it') and not (u.id = any(v_utenti));
  if v_n > 0 then
    raise notice 'Restano % account di accesso demo (idraulico1/2.demo@bobapp.it): li ha creati André, si tolgono da Supabase → Authentication → Users', v_n;
  end if;
end;
$pulizia$;

commit;
