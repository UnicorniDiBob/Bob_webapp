-- Prova di comportamento della 115: il cliente sposta, il pro decide, e un
-- «no» del pro non costa al cliente il lavoro confermato.
--
-- Ogni prova FALLISCE con un errore se il comportamento non e' quello
-- atteso (ON_ERROR_STOP). Tutto in una transazione annullata: si puo'
-- rilanciare. Nota: now() e' l'ora d'inizio della transazione, uguale per
-- tutte le prove; il caso «l'orario di prima e' gia' passato» si simula
-- spostando indietro lo storico (P12).
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -f scripts/prova_115_sposta_appuntamento.sql
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
begin;

-- Dati ----------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pro@prova.it'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1@prova.it'),
  ('00000000-0000-0000-0000-0000000000c2', 'cliente2@prova.it');
update public.users set role = 'professional' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.cities (id, name, slug, status) values ('00000000-0000-0000-0000-00000000c171', 'Milano', 'milano', 'coming_soon');
insert into public.services (id, name, slug) values ('00000000-0000-0000-0000-00000000005e', 'Idraulico', 'idraulico');
insert into public.professionals (id, user_id, city_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c171');
-- b1: richiesta del cliente 1 con proposta in chat; b2: del cliente 2.
insert into public.requests (id, customer_id, city_id, service_id, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched');
insert into public.request_professionals (request_id, professional_id, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'responded'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 'responded');

-- Il giorno delle prove: fra 10 giorni alle 10:00 (fuori da ogni preavviso).
create temp table t (k text primary key, v timestamptz) on commit drop;
insert into t values ('g', date_trunc('day', now()) + interval '10 days 10 hours');
grant select on t to authenticated;

-- Un appuntamento nato in chat: il pro propone, il cliente approva dal biglietto.
insert into public.appointments (id, request_id, professional_id, customer_name, title, starts_at, duration_minutes, price, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', 'Perdita', v, 90, 80, 'proposed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.appointments set status = 'confirmed' where id = '00000000-0000-0000-0000-00000000aa01';
reset role;

-- P1. Il cliente sposta fuori dal preavviso: torna da confermare, storico, chat
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select (public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', v + interval '1 day', 'Sono fuori città') ->> 'ok') = 'true' as p1_chiamata
  from t where k = 'g';
do $$ begin
  if current_setting('bob.annullamento', true) is distinct from '' then
    raise exception 'P1 FALLITA: l''interruttore resta acceso dopo la funzione';
  end if;
end $$;
reset role;
do $$ declare a public.appointments%rowtype; g timestamptz; begin
  select v into g from t where k = 'g';
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa01';
  if a.status <> 'proposed' or a.proposed_by <> 'customer' or a.starts_at <> g + interval '1 day' then
    raise exception 'P1 FALLITA: stato %, proposto da %, inizio %', a.status, a.proposed_by, a.starts_at;
  end if;
  if a.duration_minutes <> 90 or a.price <> 80 or a.title <> 'Perdita' then
    raise exception 'P1 FALLITA: durata, prezzo o lavoro cambiati';
  end if;
  if a.cancellation_window_hours is distinct from 48 then
    raise exception 'P1 FALLITA: preavviso fotografato perso o cambiato (%)', a.cancellation_window_hours;
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id and tipo = 'spostato'
                 and autore = 'customer' and inizio_prima = g and inizio_dopo = g + interval '1 day' and motivo = 'Sono fuori città') then
    raise exception 'P1 FALLITA: storico senza «spostato» del cliente con orario di prima e motivo';
  end if;
  if (select count(*) from public.request_messages where appointment_id = a.id and sender_type = 'customer'
      and message like 'Vorrei spostare l''appuntamento di % (Perdita) a %Motivo: Sono fuori città') <> 1 then
    raise exception 'P1 FALLITA: messaggio in chat assente o doppio';
  end if;
  if exists (select 1 from public.request_messages where appointment_id = a.id and sender_type = 'professional'
             and message like 'Ho spostato%') then
    raise exception 'P1 FALLITA: la 107 ha scritto un secondo messaggio a nome del pro';
  end if;
  raise notice 'P1 ok: spostato, da confermare, preavviso intatto, storico e un messaggio solo';
end $$;

-- P2. Il pro rifiuta dal biglietto (declined): torna confermato all'ora di prima
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa01';
reset role;
do $$ declare a public.appointments%rowtype; g timestamptz; begin
  select v into g from t where k = 'g';
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa01';
  if a.status <> 'confirmed' or a.starts_at <> g or a.duration_minutes <> 90 then
    raise exception 'P2 FALLITA: dopo il rifiuto stato %, inizio %, durata %', a.status, a.starts_at, a.duration_minutes;
  end if;
  if (select count(*) from public.request_messages where appointment_id = a.id and sender_type = 'professional'
      and message like 'Non posso spostarlo a %: resta confermato l''appuntamento di %') <> 1 then
    raise exception 'P2 FALLITA: il cliente non legge in chat che resta l''orario di prima';
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id and tipo = 'spostato'
                 and autore = 'professional' and inizio_dopo = g) then
    raise exception 'P2 FALLITA: il ritorno all''orario di prima non e'' nello storico';
  end if;
  raise notice 'P2 ok: rifiuto del pro = orario di prima, confermato, scritto in chat e nello storico';
end $$;

-- P3. Si sposta di nuovo e il pro approva: confermato al nuovo orario
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', v + interval '2 days', null) is not null as p3_spostato
  from t where k = 'g';
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set status = 'confirmed' where id = '00000000-0000-0000-0000-00000000aa01';
reset role;
do $$ declare a public.appointments%rowtype; g timestamptz; begin
  select v into g from t where k = 'g';
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa01';
  if a.status <> 'confirmed' or a.starts_at <> g + interval '2 days' then
    raise exception 'P3 FALLITA: approvato ma stato %, inizio %', a.status, a.starts_at;
  end if;
  raise notice 'P3 ok: lo spostamento approvato dal pro resta al nuovo orario, confermato';
end $$;

-- P4. Il pro rifiuta dal calendario (cancelled): anche qui torna l'ora di prima
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', v + interval '3 days', null) is not null as p4_spostato
  from t where k = 'g';
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set status = 'cancelled' where id = '00000000-0000-0000-0000-00000000aa01';
reset role;
do $$ declare a public.appointments%rowtype; g timestamptz; begin
  select v into g from t where k = 'g';
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa01';
  if a.status <> 'confirmed' or a.starts_at <> g + interval '2 days' then
    raise exception 'P4 FALLITA: rifiuto dal calendario, stato %, inizio %', a.status, a.starts_at;
  end if;
  raise notice 'P4 ok: rifiuto dal calendario = orario di prima (quello approvato in P3)';
end $$;

-- P5. Chi non e' delle parti non sposta: un altro cliente (non_trovato).
-- (116: il pro ora sposta da questa funzione, con la regola del preavviso;
-- le sue prove stanno in prova_116_ritardo_e_sovrapposizione.sql.)
do $$ begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', now() + interval '20 days', null);
    raise exception 'P5 FALLITA: un altro cliente ha spostato';
  exception when raise_exception then
    declare h text; begin
      get stacked diagnostics h = pg_exception_hint;
      if h is distinct from 'non_trovato' then raise exception 'P5 FALLITA (altro cliente): % / %', sqlerrm, h; end if;
    end;
  end;
  execute 'reset role';
  raise notice 'P5 ok: un estraneo non passa';
end $$;

-- P6. Orario non valido: gia' passato, o lo stesso di adesso (orario)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ declare h text; g timestamptz; begin
  select v into g from t where k = 'g';
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', now() - interval '1 hour', null);
    raise exception 'P6 FALLITA: accettato un orario passato';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'orario' then raise exception 'P6 FALLITA (passato): % / %', sqlerrm, h; end if;
  end;
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', g + interval '2 days', null);
    raise exception 'P6 FALLITA: accettato lo stesso orario';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'orario' then raise exception 'P6 FALLITA (stesso): % / %', sqlerrm, h; end if;
  end;
  raise notice 'P6 ok: orario passato o identico rifiutati';
end $$;
reset role;

-- P7. Sovrapposizione con un altro appuntamento con un cliente: occupato
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Due', v + interval '5 days', 60, 'confirmed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ declare h text; g timestamptz; begin
  select v into g from t where k = 'g';
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', g + interval '5 days 30 minutes', null);
    raise exception 'P7 FALLITA: spostato sopra un altro appuntamento';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'occupato' then raise exception 'P7 FALLITA: % / %', sqlerrm, h; end if;
  end;
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa01') <> 'confirmed' then
    raise exception 'P7 FALLITA: il tentativo fallito ha lasciato traccia';
  end if;
  raise notice 'P7 ok: orario occupato rifiutato, appuntamento intatto';
end $$;
reset role;

-- P8. Dentro il preavviso il cliente non sposta (chiama)
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Uno', now() + interval '24 hours', 60, 'confirmed', 'professional');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ declare h text; begin
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa03', now() + interval '20 days', null);
    raise exception 'P8 FALLITA: spostato dentro il preavviso';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'chiama' then raise exception 'P8 FALLITA: % / %', sqlerrm, h; end if;
  end;
  raise notice 'P8 ok: %', 'dentro il preavviso si chiama';
end $$;
reset role;

-- P9. Il guard resta: il cliente non cambia starts_at con un UPDATE diretto
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  begin
    update public.appointments set starts_at = starts_at + interval '1 day', status = 'proposed'
     where id = '00000000-0000-0000-0000-00000000aa01';
    raise exception 'P9 FALLITA: UPDATE diretto del cliente accettato';
  exception when raise_exception then
    if sqlerrm like 'P9 FALLITA%' then raise; end if;
    raise notice 'P9 ok: %', sqlerrm;
  end;
end $$;
reset role;

-- P10. La prima proposta del pro, rifiutata dal cliente: resta rifiutata (come oggi)
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', v + interval '6 days', 60, 'proposed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa04';
reset role;
-- ... e la controproposta del cliente (route counter, service role), rifiutata dal pro: resta rifiutata
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa05', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', v + interval '7 days', 60, 'proposed', 'customer' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa05';
reset role;
do $$ begin
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa04') <> 'declined' then
    raise exception 'P10 FALLITA: la prima proposta del pro non e'' piu'' rifiutabile come prima';
  end if;
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa05') <> 'declined' then
    raise exception 'P10 FALLITA: la controproposta del cliente rifiutata dal pro e'' stata «ripristinata»';
  end if;
  if exists (select 1 from public.request_messages where appointment_id in
             ('00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-00000000aa05') and message like 'Non posso spostarlo%') then
    raise exception 'P10 FALLITA: messaggio di ripristino su una proposta che non era uno spostamento';
  end if;
  raise notice 'P10 ok: prima proposta e controproposta si rifiutano come prima';
end $$;

-- P11. L'orario di prima e' stato preso nel frattempo: il rifiuto si ferma (23P01)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa01', v + interval '8 days', null) is not null as p11_spostato
  from t where k = 'g';
reset role;
-- Un altro cliente prende l'orario lasciato libero (2 giorni dopo il giorno g).
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa06', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Due', v + interval '2 days', 60, 'confirmed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$ begin
  begin
    update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa01';
    raise exception 'P11 FALLITA: rifiuto passato con l''orario di prima occupato';
  exception when exclusion_violation then
    raise notice 'P11 ok: orario di prima occupato, il rifiuto si ferma invece di cancellare il lavoro';
  end;
end $$;
reset role;

-- P12. L'orario di prima e' gia' passato: il rifiuto resta un rifiuto
update public.appointment_events
   set inizio_prima = now() - interval '1 hour'
 where appointment_id = '00000000-0000-0000-0000-00000000aa01'
   and tipo = 'spostato' and autore = 'customer'
   and inizio_dopo = (select v + interval '8 days' from t where k = 'g');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.appointments set status = 'declined' where id = '00000000-0000-0000-0000-00000000aa01';
reset role;
do $$ begin
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa01') <> 'declined' then
    raise exception 'P12 FALLITA: riconfermato un orario gia'' passato';
  end if;
  raise notice 'P12 ok: orario di prima passato, il rifiuto resta un rifiuto';
end $$;

\echo 'TUTTE LE PROVE DELLA 115 SONO PASSATE'
rollback;
