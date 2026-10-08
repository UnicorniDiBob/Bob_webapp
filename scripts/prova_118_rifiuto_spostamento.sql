-- Prova di comportamento della 118: quando il pro rifiuta uno spostamento
-- del cliente, lo storico scrive un rifiuto, non uno spostamento del pro.
--
-- Ogni prova FALLISCE con un errore se il comportamento non e' quello
-- atteso (ON_ERROR_STOP). Tutto in UNA transazione annullata: e' proprio
-- quello che serve a P2 (il segno del ripristino non deve restare acceso
-- per il resto della transazione). now() e' fisso per tutta la prova.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -f scripts/prova_118_rifiuto_spostamento.sql
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
begin;

do $$ begin
  if (now() at time zone 'Europe/Rome')::time > time '22:00' then
    raise exception 'Lancia questa prova prima delle 22 di Roma: l''appuntamento «di oggi» del ritardo finirebbe domani';
  end if;
end $$;

-- Dati ----------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pro@prova.it'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1@prova.it');
update public.users set role = 'professional' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.cities (id, name, slug, status) values ('00000000-0000-0000-0000-00000000c171', 'Milano', 'milano', 'coming_soon');
insert into public.services (id, name, slug) values ('00000000-0000-0000-0000-00000000005e', 'Idraulico', 'idraulico');
insert into public.professionals (id, user_id, city_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c171');
insert into public.requests (id, customer_id, city_id, service_id, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched');
insert into public.request_professionals (request_id, professional_id, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'responded');

-- g = fra 10 giorni alle 10:00, fuori da ogni preavviso.
create temp table t (k text primary key, v timestamptz) on commit drop;
insert into t values ('g', date_trunc('day', now()) + interval '10 days 10 hours');
grant select on t to authenticated;

-- Un appuntamento nato in chat: il pro propone, il cliente approva.
insert into public.appointments (id, request_id, professional_id, customer_name, title, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', 'Pulizia', v, 60, 'proposed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.appointments set status = 'confirmed' where id = '00000000-0000-0000-0000-00000000aa01';
-- Il cliente chiede di spostarlo un giorno dopo.
select public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', v + interval '1 day', null) is not null as spostato_dal_cliente
  from t where k = 'g';
reset role;

-- P1. Il pro rifiuta: lo storico scrive «rifiutato», non «spostato» del pro --
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa01';
do $$ begin
  if current_setting('bob.ripristino', true) is distinct from '' then
    raise exception 'P1 FALLITA: il segno del ripristino resta acceso dopo lo storico (%)', current_setting('bob.ripristino', true);
  end if;
end $$;
reset role;
do $$ declare g timestamptz; a public.appointments%rowtype; begin
  select v into g from t where k = 'g';
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa01';
  if a.status <> 'confirmed' or a.starts_at <> g then
    raise exception 'P1 FALLITA: il ripristino della 115 non c''e'' piu'' (stato %, inizio %)', a.status, a.starts_at;
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id
                 and tipo = 'rifiutato' and autore = 'professional'
                 and inizio_prima = g + interval '1 day' and inizio_dopo = g) then
    raise exception 'P1 FALLITA: manca il «rifiutato» del pro da {orario chiesto} a {orario che resta}';
  end if;
  if exists (select 1 from public.appointment_events where appointment_id = a.id
             and tipo = 'spostato' and autore = 'professional') then
    raise exception 'P1 FALLITA: lo storico dice ancora che il pro ha spostato';
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id
                 and tipo = 'spostato' and autore = 'customer'
                 and inizio_prima = g and inizio_dopo = g + interval '1 day') then
    raise exception 'P1 FALLITA: la richiesta di spostamento del cliente non e'' piu'' nello storico';
  end if;
  raise notice 'P1 ok: rifiuto del pro scritto come «rifiutato», la richiesta del cliente resta «spostato»';
end $$;

-- P2. Il segno non resta acceso: nella STESSA transazione, uno spostamento
-- vero del pro sullo stesso appuntamento e' ancora uno «spostato» ------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set starts_at = starts_at + interval '4 days'
 where id = '00000000-0000-0000-0000-00000000aa01';
reset role;
do $$ declare g timestamptz; begin
  select v into g from t where k = 'g';
  if not exists (select 1 from public.appointment_events
                  where appointment_id = '00000000-0000-0000-0000-00000000aa01'
                    and tipo = 'spostato' and autore = 'professional'
                    and inizio_prima = g and inizio_dopo = g + interval '4 days') then
    raise exception 'P2 FALLITA: lo spostamento vero del pro non e'' scritto come «spostato»';
  end if;
  if (select count(*) from public.appointment_events
       where appointment_id = '00000000-0000-0000-0000-00000000aa01' and tipo = 'rifiutato') <> 1 then
    raise exception 'P2 FALLITA: un secondo «rifiutato»: il segno del ripristino e'' rimasto acceso';
  end if;
  raise notice 'P2 ok: dopo il rifiuto, uno spostamento del pro nella stessa transazione resta «spostato»';
end $$;

-- P3. La prima proposta del pro rifiutata dal cliente: come prima ------------
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', v + interval '6 days', 60, 'proposed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa02';
reset role;
do $$ begin
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa02'
                 and tipo = 'rifiutato' and autore = 'customer' and inizio_prima = inizio_dopo) then
    raise exception 'P3 FALLITA: il rifiuto di una proposta non e'' piu'' un «rifiutato» con l''orario uguale prima e dopo';
  end if;
  raise notice 'P3 ok: il rifiuto di una proposta resta un «rifiutato» con un orario solo';
end $$;

-- P4. Il ritardo (116, bob.tipo) resta un «ritardo» ---------------------------
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Uno', date_trunc('minute', now()) - interval '5 minutes', 30, 'confirmed', 'professional');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select public.segnala_ritardo('00000000-0000-0000-0000-00000000aa03', 20) is not null as ritardo_segnalato;
reset role;
do $$ begin
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa03'
                 and tipo = 'ritardo' and autore = 'professional') then
    raise exception 'P4 FALLITA: il ritardo non e'' piu'' scritto come «ritardo»';
  end if;
  raise notice 'P4 ok: il ritardo resta un «ritardo»';
end $$;

\echo 'TUTTE LE PROVE DELLA 118 SONO PASSATE'
rollback;
