-- Prova di comportamento della 117: il recupero chiude come «disdetto» le
-- prenotazioni dirette disdette prima della 113, e solo quelle.
--
-- Ogni prova FALLISCE con un errore se il comportamento non e' quello atteso
-- (ON_ERROR_STOP). Tutto in una transazione annullata: si puo' rilanciare.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -f scripts/prova_117_disdette_prima_della_113.sql
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pro@prova.it'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1@prova.it');
update public.users set role = 'professional' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.cities (id, name, slug, status) values ('00000000-0000-0000-0000-00000000c171', 'Milano', 'milano', 'coming_soon');
insert into public.services (id, name, slug) values ('00000000-0000-0000-0000-00000000005e', 'Idraulico', 'idraulico');
insert into public.professionals (id, user_id, city_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c171');

-- Cinque richieste, una per caso:
--   d1 prenotazione diretta disdetta e rimasta aperta (il rilievo del 3/10)
--   d2 prenotazione diretta disdetta, chiusa dal cliente senza motivo
--   d3 prenotazione diretta disdetta e poi riprenotata (un appuntamento attivo)
--   d4 prenotazione diretta disdetta ma gia' recensita
--   d5 richiesta normale (non diretta) con l'appuntamento annullato
insert into public.requests (id, customer_id, city_id, service_id, status, quote_mode) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', 'bookable'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'closed', 'bookable'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', 'bookable'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'closed', 'bookable'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', null);
insert into public.request_professionals (request_id, professional_id, status)
select r, '00000000-0000-0000-0000-0000000000f1', 'responded'
  from unnest(array['00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000d5']::uuid[]) r;

-- Gli appuntamenti, scritti come li lasciava la disdetta di prima della 113.
insert into public.appointments (request_id, professional_id, customer_id, customer_name, starts_at, duration_minutes, status, proposed_by, source)
select r, '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Cliente Uno',
       now() + (n || ' days')::interval, 60, 'cancelled', 'customer', 'direct'
  from unnest(array['00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000d5']::uuid[]) with ordinality as x(r, n);
insert into public.appointments (request_id, professional_id, customer_id, customer_name, starts_at, duration_minutes, status, proposed_by, source)
values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Cliente Uno',
        now() + interval '20 days', 60, 'confirmed', 'customer', 'direct');
insert into public.ratings (professional_id, customer_id, request_id, score)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 4);

-- Il recupero, due volte di fila: la seconda non deve cambiare niente.
\i supabase/migrations/117_disdette_prima_della_113.sql
\i supabase/migrations/117_disdette_prima_della_113.sql

do $$
declare
  x text;
begin
  select string_agg(right(id::text, 2) || '=' || status || '/' || coalesce(closed_reason, '-'), ' ' order by id) into x
    from public.requests where id::text like '00000000-0000-0000-0000-0000000000d%';
  if x <> 'd1=closed/disdetto d2=closed/disdetto d3=matched/- d4=closed/- d5=matched/-' then
    raise exception 'P117 FALLITA: %', x;
  end if;
  raise notice 'P1 ok: chiuse come disdette d1 (aperta) e d2 (chiusa senza motivo); intatte d3 (riprenotata), d4 (recensita), d5 (non diretta)';
end $$;

-- E adesso il cliente non recensisce d2, ne' la riapre.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  begin
    insert into public.ratings (professional_id, customer_id, request_id, score)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d2', 5);
    raise exception 'P2 FALLITA: recensione accettata su una disdetta recuperata';
  exception when insufficient_privilege then
    raise notice 'P2 ok: niente recensione sulla disdetta recuperata';
  end;
  begin
    update public.requests set status = 'matched' where id = '00000000-0000-0000-0000-0000000000d1';
    raise exception 'P3 FALLITA: il cliente ha riaperto una disdetta';
  exception when raise_exception then
    if sqlerrm like 'P3 FALLITA%' then raise; end if;
    raise notice 'P3 ok: %', sqlerrm;
  end;
end $$;
reset role;

\echo 'TUTTE LE PROVE DELLA 117 SONO PASSATE'
rollback;
