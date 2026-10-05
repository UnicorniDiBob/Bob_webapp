-- Prova di comportamento della 113: le regole della prenotazione reggono?
--
-- Non verifica la sintassi (per quella basta schema_check.sh): verifica che
-- due clienti non prendano lo stesso slot, che il preavviso si fotografi alla
-- conferma, che dentro il preavviso il cliente non annulli e il pro solo dopo
-- la telefonata e con il motivo, che una disdetta chiuda la richiesta e non
-- si recensisca, che il pro non annulli ne' elimini dal browser, che lo
-- spostamento lasci l'ora di partenza nello storico, che lo storico lo legga
-- solo chi ne fa parte. Ogni prova FALLISCE con un errore se il comportamento
-- non e' quello atteso (ON_ERROR_STOP). Tutto in una transazione annullata:
-- si puo' rilanciare.
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -f scripts/prova_113_prenotazione_regole.sql
-- Il 05/10 e' passata intera (13 prove) su Postgres 16 in container.
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
insert into public.profile_phone (user_id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+39 333 1234567')
  on conflict (user_id) do update set phone = excluded.phone;
insert into public.requests (id, customer_id, city_id, service_id, status, quote_mode) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', 'bookable'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', 'bookable'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', null);
insert into public.request_professionals (request_id, professional_id, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'responded'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 'responded'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1', 'responded');

-- Il giorno delle prove: fra 10 giorni alle 10:00 (fuori da ogni preavviso).
create temp table t (k text primary key, v timestamptz) on commit drop;
insert into t values ('g', date_trunc('day', now()) + interval '10 days 10 hours');
grant select on t to authenticated;

-- P1. La prenotazione diretta (service role) fotografa il preavviso del pro --
insert into public.appointments (id, request_id, professional_id, customer_id, customer_name, starts_at, duration_minutes, status, proposed_by, source)
select '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       '00000000-0000-0000-0000-0000000000c1', 'Cliente Uno', v, 60, 'confirmed', 'customer', 'direct' from t where k = 'g';
do $$ begin
  if (select cancellation_window_hours from public.appointments where id = '00000000-0000-0000-0000-00000000aa01') is distinct from 48 then
    raise exception 'P1 FALLITA: preavviso non fotografato a 48';
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa01' and tipo = 'prenotato' and autore = 'customer') then
    raise exception 'P1 FALLITA: manca l''evento «prenotato» del cliente';
  end if;
  raise notice 'P1 ok: preavviso 48 fotografato, evento prenotato dal cliente';
end $$;

-- P2. Un secondo cliente sullo stesso slot (mezz'ora dopo) viene fermato ----
do $$ begin
  begin
    insert into public.appointments (request_id, professional_id, customer_id, customer_name, starts_at, duration_minutes, status, proposed_by, source)
    select '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c2',
           'Cliente Due', v + interval '30 minutes', 60, 'confirmed', 'customer', 'direct' from t where k = 'g';
    raise exception 'P2 FALLITA: la sovrapposizione e'' passata';
  exception when exclusion_violation then
    raise notice 'P2 ok: 23P01 sulla prenotazione sovrapposta';
  end;
end $$;

-- P3. L'agenda privata del pro sopra lo stesso slot resta permessa ---------
insert into public.appointments (professional_id, customer_name, starts_at, duration_minutes, status)
select '00000000-0000-0000-0000-0000000000f1', 'Nota privata', v, 60, 'confirmed' from t where k = 'g';
\echo 'P3 ok: voce privata sovrapposta accettata'

-- P4. Il cliente disdice fuori dal preavviso: annullato, messaggio, richiesta chiusa come disdetta
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select public.annulla_appuntamento('00000000-0000-0000-0000-00000000aa01', 'Ho risolto da solo', false) is not null as p4_chiamata;
reset role;
do $$ begin
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa01') <> 'cancelled' then
    raise exception 'P4 FALLITA: non annullato';
  end if;
  if (select status || '/' || coalesce(closed_reason, '-') from public.requests where id = '00000000-0000-0000-0000-0000000000b1') <> 'closed/disdetto' then
    raise exception 'P4 FALLITA: richiesta non chiusa come disdetta';
  end if;
  if (select count(*) from public.request_messages where appointment_id = '00000000-0000-0000-0000-00000000aa01' and sender_type = 'customer' and message like 'Ho disdetto%Motivo: Ho risolto da solo') <> 1 then
    raise exception 'P4 FALLITA: messaggio standard in chat assente o doppio';
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa01' and tipo = 'annullato' and autore = 'customer' and motivo = 'Ho risolto da solo') then
    raise exception 'P4 FALLITA: evento annullato senza autore o motivo';
  end if;
  raise notice 'P4 ok: disdetta del cliente, messaggio, richiesta chiusa «disdetto», storico con motivo';
end $$;

-- P5. Dopo la disdetta lo slot e' di nuovo libero per il secondo cliente ----
insert into public.appointments (id, request_id, professional_id, customer_id, customer_name, starts_at, duration_minutes, status, proposed_by, source)
select '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
       '00000000-0000-0000-0000-0000000000c2', 'Cliente Due', v + interval '30 minutes', 60, 'confirmed', 'customer', 'direct' from t where k = 'g';
\echo 'P5 ok: slot liberato dalla disdetta, riprenotato'

-- P6. Niente recensione su una prenotazione disdetta, ne' togliersi il «disdetto»
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  begin
    insert into public.ratings (professional_id, customer_id, request_id, score)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 5);
    raise exception 'P6 FALLITA: recensione accettata su una disdetta';
  exception when insufficient_privilege then
    raise notice 'P6a ok: recensione rifiutata dalla policy';
  end;
  begin
    update public.requests set closed_reason = null where id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'P6 FALLITA: il cliente si e'' tolto il «disdetto»';
  exception when raise_exception then
    if sqlerrm like 'P6 FALLITA%' then raise; end if;
    raise notice 'P6b ok: %', sqlerrm;
  end;
end $$;
reset role;

-- Un appuntamento confermato della richiesta 3 (non diretta) fra 24 ore: dentro il preavviso di 48
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Uno', now() + interval '24 hours', 60, 'confirmed', 'professional');

-- P7. Dentro il preavviso il cliente non annulla dal sito --------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  begin
    perform public.annulla_appuntamento('00000000-0000-0000-0000-00000000aa03', null, false);
    raise exception 'P7 FALLITA: il cliente ha annullato dentro il preavviso';
  exception when raise_exception then
    declare h text; begin
      get stacked diagnostics h = pg_exception_hint;
      if h is distinct from 'chiama' then raise exception 'P7 FALLITA: errore senza hint chiama: % / %', sqlerrm, h; end if;
    end;
    raise notice 'P7 ok: %', sqlerrm;
  end;
end $$;
-- P8. Il cliente vede il telefono del pro? Il pro non ne ha: null. E il pro vede quello del cliente.
select (public.contatto_controparte('00000000-0000-0000-0000-00000000aa03') ->> 'telefono') is null as p8_cliente_senza_numero_del_pro;
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$ begin
  if (public.contatto_controparte('00000000-0000-0000-0000-00000000aa03') ->> 'telefono') is distinct from '+39 333 1234567' then
    raise exception 'P8 FALLITA: il pro non vede il numero del cliente su un appuntamento confermato';
  end if;
  raise notice 'P8 ok: il pro vede il numero del cliente';
end $$;

-- P9. Il pro: senza motivo no; dentro il preavviso senza telefonata no; con entrambi si'
do $$
declare h text;
begin
  begin
    perform public.annulla_appuntamento('00000000-0000-0000-0000-00000000aa03', '', true);
    raise exception 'P9 FALLITA: annullato senza motivo';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'motivo' then raise exception 'P9 FALLITA: hint % invece di motivo (%)', h, sqlerrm; end if;
  end;
  begin
    perform public.annulla_appuntamento('00000000-0000-0000-0000-00000000aa03', 'Sono malato', false);
    raise exception 'P9 FALLITA: annullato dentro il preavviso senza telefonata';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'chiama' then raise exception 'P9 FALLITA: hint % invece di chiama (%)', h, sqlerrm; end if;
  end;
  perform public.annulla_appuntamento('00000000-0000-0000-0000-00000000aa03', 'Sono malato', true);
  raise notice 'P9 ok: motivo e telefonata pretesi, poi annullato';
end $$;
reset role;
do $$ begin
  if (select count(*) from public.request_messages where appointment_id = '00000000-0000-0000-0000-00000000aa03') <> 1 then
    raise exception 'P9 FALLITA: % messaggi invece di 1 (il trigger 107 ha scritto il doppione?)',
      (select count(*) from public.request_messages where appointment_id = '00000000-0000-0000-0000-00000000aa03');
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa03'
                 and tipo = 'annullato' and autore = 'professional' and concordato_telefono and dentro_preavviso and motivo = 'Sono malato') then
    raise exception 'P9 FALLITA: storico senza telefonata/preavviso/motivo';
  end if;
  if (select status from public.requests where id = '00000000-0000-0000-0000-0000000000b3') <> 'matched' then
    raise exception 'P9 FALLITA: una richiesta non diretta e'' stata chiusa';
  end if;
  raise notice 'P9b ok: un solo messaggio, storico completo, richiesta normale resta aperta';
end $$;

-- P10. Il pro non annulla ne' elimina dal browser un appuntamento confermato con un cliente
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', v + interval '1 day', 60, 'confirmed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$ begin
  begin
    update public.appointments set status = 'cancelled' where id = '00000000-0000-0000-0000-00000000aa04';
    raise exception 'P10 FALLITA: annullamento secco passato';
  exception when raise_exception then
    if sqlerrm like 'P10 FALLITA%' then raise; end if;
    raise notice 'P10a ok: %', sqlerrm;
  end;
  begin
    delete from public.appointments where id = '00000000-0000-0000-0000-00000000aa04';
    raise exception 'P10 FALLITA: eliminazione passata';
  exception when raise_exception then
    if sqlerrm like 'P10 FALLITA%' then raise; end if;
    raise notice 'P10b ok: %', sqlerrm;
  end;
end $$;

-- P11. Spostare: l'ora di partenza resta nello storico; sopra un altro cliente no
update public.appointments set starts_at = starts_at + interval '2 hours' where id = '00000000-0000-0000-0000-00000000aa04';
do $$ begin
  begin
    update public.appointments a set starts_at = (select v + interval '30 minutes' from t where k = 'g')
     where a.id = '00000000-0000-0000-0000-00000000aa04';
    raise exception 'P11 FALLITA: spostato sopra la prenotazione del cliente due';
  exception when exclusion_violation then
    raise notice 'P11a ok: 23P01 spostando sopra un altro cliente';
  end;
end $$;
reset role;
do $$ begin
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa04') <> 'proposed' then
    raise exception 'P11 FALLITA: lo spostamento non e'' tornato da confermare';
  end if;
  if not exists (select 1 from public.appointment_events e join t on t.k = 'g'
                  where e.appointment_id = '00000000-0000-0000-0000-00000000aa04' and e.tipo = 'spostato'
                    and e.autore = 'professional' and e.inizio_prima = t.v + interval '1 day'
                    and e.inizio_dopo = t.v + interval '1 day 2 hours') then
    raise exception 'P11 FALLITA: lo storico non ha l''ora di partenza';
  end if;
  raise notice 'P11b ok: spostamento tornato da confermare, ora di partenza nello storico';
end $$;

-- P12. Ognuno legge solo il suo storico ------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
set role authenticated;
do $$ begin
  if exists (select 1 from public.appointment_events where request_id <> '00000000-0000-0000-0000-0000000000b2') then
    raise exception 'P12 FALLITA: il cliente due legge lo storico di altri';
  end if;
  if not exists (select 1 from public.appointment_events where request_id = '00000000-0000-0000-0000-0000000000b2') then
    raise exception 'P12 FALLITA: il cliente due non legge il suo';
  end if;
  raise notice 'P12 ok: storico visibile solo alle parti';
end $$;
reset role;

-- P13. Il pro cambia il suo preavviso da solo; vale per le conferme successive
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.professionals set preavviso_annullamento_ore = 24 where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa05', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', v + interval '3 days', 60, 'proposed', 'professional' from t where k = 'g';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.appointments set status = 'confirmed' where id = '00000000-0000-0000-0000-00000000aa05';
reset role;
do $$ begin
  if (select cancellation_window_hours from public.appointments where id = '00000000-0000-0000-0000-00000000aa05') is distinct from 24 then
    raise exception 'P13 FALLITA: la conferma del cliente non ha fotografato 24';
  end if;
  if (select cancellation_window_hours from public.appointments where id = '00000000-0000-0000-0000-00000000aa02') is distinct from 48 then
    raise exception 'P13 FALLITA: un appuntamento gia'' confermato ha cambiato preavviso';
  end if;
  raise notice 'P13 ok: nuovo preavviso sulle conferme nuove, vecchie intatte';
end $$;

\echo 'TUTTE LE PROVE DELLA 113 SONO PASSATE'
rollback;
