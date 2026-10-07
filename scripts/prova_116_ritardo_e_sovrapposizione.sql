-- Prova di comportamento della 116: il ritardo, la sovrapposizione permessa
-- al pro e vietata al cliente, lo spostamento del pro con la regola del
-- preavviso, il motivo facoltativo nell'annullamento del pro.
--
-- Le due facce della sovrapposizione: un ritardo del pro che si sovrappone
-- all'appuntamento dopo e PASSA (R2); un cliente che prova a prendere lo
-- slot occupato e viene RESPINTO, sia prenotando sia spostando (R4). E in
-- mezzo: il cliente che accetta una proposta del pro sovrapposta passa,
-- perche' accettare non e' scegliere un orario (R5).
--
-- Ogni prova FALLISCE con un errore se il comportamento non e' quello
-- atteso (ON_ERROR_STOP). Tutto in una transazione annullata: si puo'
-- rilanciare. now() e' l'ora d'inizio della transazione: gli appuntamenti
-- «di oggi» stanno fra adesso e due ore da adesso, quindi la prova va
-- lanciata prima delle 22 di Roma (dopo, la giornata finisce prima degli
-- appuntamenti e la prova lo dice invece di fallire per caso).
--
-- Uso, dalla radice del repo, dopo ./scripts/schema_check.sh:
--   psql -h /tmp -p 55432 -U postgres -d bobclone -f scripts/prova_116_ritardo_e_sovrapposizione.sql
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
begin;

do $$ begin
  if (now() at time zone 'Europe/Rome')::time > time '22:00' then
    raise exception 'Lancia questa prova prima delle 22 di Roma: gli appuntamenti «di oggi» finirebbero domani';
  end if;
end $$;

-- Dati ----------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pro@prova.it'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1@prova.it'),
  ('00000000-0000-0000-0000-0000000000c2', 'cliente2@prova.it'),
  ('00000000-0000-0000-0000-0000000000c3', 'cliente3@prova.it');
update public.users set role = 'professional' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.cities (id, name, slug, status) values ('00000000-0000-0000-0000-00000000c171', 'Milano', 'milano', 'coming_soon');
insert into public.services (id, name, slug) values ('00000000-0000-0000-0000-00000000005e', 'Idraulico', 'idraulico');
insert into public.professionals (id, user_id, city_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c171');
insert into public.requests (id, customer_id, city_id, service_id, status, quote_mode) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', null),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', null),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000c171', '00000000-0000-0000-0000-00000000005e', 'matched', 'bookable');
insert into public.request_professionals (request_id, professional_id, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'responded'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 'responded'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1', 'responded');

-- La giornata: A (cliente 1) e' cominciato 5 minuti fa e dura 30; B
-- (cliente 2) comincia 35 minuti dopo A e dura 30; C (agenda privata) 40
-- minuti dopo B. Un ritardo di 20 minuti porta la fine di A a 50 minuti
-- dopo l'inizio di prima: invade B di 15 minuti, che a sua volta finirebbe
-- a 80, cioe' esattamente quando comincia C: C non e' toccato.
create temp table t (k text primary key, v timestamptz) on commit drop;
insert into t values ('a', date_trunc('minute', now()) - interval '5 minutes');
grant select on t to authenticated;
insert into public.appointments (id, request_id, professional_id, customer_name, title, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa0a', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Uno', 'Perdita', v, 30, 'confirmed', 'professional' from t where k = 'a';
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
select '00000000-0000-0000-0000-00000000aa0b', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
       'Cliente Due', v + interval '35 minutes', 30, 'confirmed', 'professional' from t where k = 'a';
insert into public.appointments (id, professional_id, customer_name, starts_at, duration_minutes, status)
select '00000000-0000-0000-0000-00000000aa0c', '00000000-0000-0000-0000-0000000000f1',
       'Commercialista', v + interval '80 minutes', 30, 'confirmed' from t where k = 'a';

-- R1. L'anteprima dice chi viene toccato e non scrive niente --------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$ declare r jsonb; g timestamptz; begin
  select v into g from t where k = 'a';
  r := public.segnala_ritardo('00000000-0000-0000-0000-00000000aa0a', 20, null, false, true);
  if (r ->> 'inizio_dopo')::timestamptz <> g + interval '20 minutes' then
    raise exception 'R1 FALLITA: inizio dopo %', r ->> 'inizio_dopo';
  end if;
  if jsonb_array_length(r -> 'toccati') <> 1
     or (r -> 'toccati' -> 0 ->> 'id') <> '00000000-0000-0000-0000-00000000aa0b'
     or (r -> 'toccati' -> 0 ->> 'slitta_minuti')::int <> 15 then
    raise exception 'R1 FALLITA: toccati %', r -> 'toccati';
  end if;
  if (select starts_at from public.appointments where id = '00000000-0000-0000-0000-00000000aa0a') <> g then
    raise exception 'R1 FALLITA: l''anteprima ha spostato l''appuntamento';
  end if;
  raise notice 'R1 ok: anteprima, B toccato di 15 minuti, C no, niente scritto';
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa0a' and tipo = 'ritardo') then
    raise exception 'R1 FALLITA: l''anteprima ha scritto nello storico';
  end if;
end $$;

-- R2. Il ritardo vero, con l'avviso a B: A resta confermato e si sovrappone a B
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select (public.segnala_ritardo('00000000-0000-0000-0000-00000000aa0a', 20, 'Traffico in tangenziale', true) ->> 'avvisati') = '1' as r2_un_avvisato;
do $$ begin
  if coalesce(current_setting('bob.sovrapposizione', true), '') <> ''
     or coalesce(current_setting('bob.annullamento', true), '') <> ''
     or coalesce(current_setting('bob.tipo', true), '') <> '' then
    raise exception 'R2 FALLITA: un interruttore resta acceso dopo la funzione';
  end if;
end $$;
reset role;
do $$ declare a public.appointments%rowtype; g timestamptz; begin
  select v into g from t where k = 'a';
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa0a';
  if a.status <> 'confirmed' or a.proposed_by <> 'professional' or a.starts_at <> g + interval '20 minutes' then
    raise exception 'R2 FALLITA: stato %, proposto da %, inizio % (riproponi ha riaperto la conferma?)', a.status, a.proposed_by, a.starts_at;
  end if;
  if (select starts_at from public.appointments where id = '00000000-0000-0000-0000-00000000aa0b') <> g + interval '35 minutes' then
    raise exception 'R2 FALLITA: l''orario di B e'' cambiato';
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id and tipo = 'ritardo'
                 and autore = 'professional' and inizio_prima = g and inizio_dopo = g + interval '20 minutes'
                 and motivo = 'Traffico in tangenziale') then
    raise exception 'R2 FALLITA: storico senza «ritardo» con orari e motivo';
  end if;
  if exists (select 1 from public.appointment_events where appointment_id = a.id and tipo = 'spostato') then
    raise exception 'R2 FALLITA: il ritardo e'' finito nello storico come spostamento';
  end if;
  if (select count(*) from public.request_messages where appointment_id = a.id and sender_type = 'professional'
      and message like 'Sono in ritardo di circa 20 minuti: arrivo alle % invece che alle %. Motivo: Traffico in tangenziale') <> 1 then
    raise exception 'R2 FALLITA: messaggio al cliente assente o doppio';
  end if;
  if exists (select 1 from public.request_messages where appointment_id = a.id and message like 'Ho spostato%') then
    raise exception 'R2 FALLITA: la 107 ha scritto «Ho spostato»';
  end if;
  if (select count(*) from public.request_messages where request_id = '00000000-0000-0000-0000-0000000000b2'
      and message like '%potrebbe slittare di circa 15 minuti%' and appointment_id is null) <> 1 then
    raise exception 'R2 FALLITA: B non ha ricevuto l''avviso, o ne ha ricevuti due';
  end if;
  if not (public.fascia_appuntamento(a.starts_at, a.duration_minutes)
          && (select public.fascia_appuntamento(b.starts_at, b.duration_minutes)
                from public.appointments b where b.id = '00000000-0000-0000-0000-00000000aa0b')) then
    raise exception 'R2 FALLITA: la prova non crea la sovrapposizione che dovrebbe provare';
  end if;
  raise notice 'R2 ok: ritardo del pro sovrapposto a B passato, resta confermato, storico, chat, B avvisato e fermo';
end $$;

-- R3. Il ritardo ha i suoi limiti ------------------------------------------
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa0d', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Uno', date_trunc('day', now()) + interval '10 days 10 hours', 60, 'confirmed', 'professional');
do $$
declare h text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
  execute 'set local role authenticated';
  begin
    perform public.segnala_ritardo('00000000-0000-0000-0000-00000000aa0a', 10);
    raise exception 'R3 FALLITA: il cliente ha segnalato un ritardo';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'non_trovato' then raise exception 'R3 FALLITA (cliente): % / %', sqlerrm, h; end if;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin
    perform public.segnala_ritardo('00000000-0000-0000-0000-00000000aa0d', 10);
    raise exception 'R3 FALLITA: ritardo su un appuntamento fra dieci giorni';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'non_oggi' then raise exception 'R3 FALLITA (non oggi): % / %', sqlerrm, h; end if;
  end;
  begin
    perform public.segnala_ritardo('00000000-0000-0000-0000-00000000aa0a', 0);
    raise exception 'R3 FALLITA: ritardo di zero minuti';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'minuti' then raise exception 'R3 FALLITA (minuti): % / %', sqlerrm, h; end if;
  end;
  begin
    perform public.segnala_ritardo('00000000-0000-0000-0000-00000000aa0c', 10);
    raise exception 'R3 FALLITA: ritardo su una voce privata';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'non_attivo' then raise exception 'R3 FALLITA (privata): % / %', sqlerrm, h; end if;
  end;
  execute 'reset role';
  raise notice 'R3 ok: niente ritardi del cliente, di un altro giorno, di zero minuti o su una voce privata';
end $$;

-- R4. Il cliente non prende lo slot occupato -------------------------------
-- a) prenotazione diretta (service role, come /api/pro/instant-book) dentro
--    l'orario nuovo di A: occupato. Nessuna identita': il service role.
reset request.jwt.claim.sub;
do $$
declare h text;
begin
  begin
    insert into public.appointments (request_id, professional_id, customer_id, customer_name, starts_at, duration_minutes, status, proposed_by, source)
    select '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c3',
           'Cliente Tre', v + interval '25 minutes', 10, 'confirmed', 'customer', 'direct' from t where k = 'a';
    raise exception 'R4 FALLITA: prenotazione diretta sopra lo slot slittato';
  exception when exclusion_violation then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'occupato' then raise exception 'R4 FALLITA (hint): % / %', sqlerrm, h; end if;
    raise notice 'R4a ok: 23P01 «occupato» prenotando dentro l''orario slittato di A';
  end;
end $$;
-- b) lo slot di prima di A (adesso libero davanti al ritardo) per il
--    database e' libero: e' la lista degli slot (2 ore di anticipo minimo)
--    a non mostrarlo. Qui basta che non sia occupato da A.
-- c) il cliente 1 sposta D sopra B: occupato, D resta com'era.
insert into t values ('d', (select starts_at from public.appointments where id = '00000000-0000-0000-0000-00000000aa0d'));
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa0e', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Due', date_trunc('day', now()) + interval '12 days 9 hours', 120, 'confirmed', 'professional');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare h text;
begin
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa0d',
                                       date_trunc('day', now()) + interval '12 days 10 hours', null);
    raise exception 'R4 FALLITA: il cliente ha spostato sopra un altro cliente';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'occupato' then raise exception 'R4 FALLITA (sposta): % / %', sqlerrm, h; end if;
  end;
  raise notice 'R4c ok: lo spostamento del cliente sopra un altro cliente riceve «occupato»';
end $$;
reset role;
do $$ begin
  if (select status || '@' || starts_at::text from public.appointments where id = '00000000-0000-0000-0000-00000000aa0d')
     <> 'confirmed@' || (select v::text from t where k = 'd') then
    raise exception 'R4 FALLITA: D cambiato dopo il rifiuto';
  end if;
end $$;

-- R5. Il pro propone sopra un altro cliente e passa; il cliente accetta e passa
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa0f', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Tre', date_trunc('day', now()) + interval '12 days 10 hours', 60, 'proposed', 'professional');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
set role authenticated;
update public.appointments set status = 'confirmed' where id = '00000000-0000-0000-0000-00000000aa0f';
reset role;
do $$ begin
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa0f') <> 'confirmed' then
    raise exception 'R5 FALLITA: la conferma del cliente non e'' passata';
  end if;
  raise notice 'R5 ok: proposta del pro sovrapposta passata, e il cliente l''ha accettata';
end $$;

-- R6. Lo spostamento del pro: fuori dal preavviso torna da confermare ------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select (public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa0d',
                                   date_trunc('day', now()) + interval '11 days 15 hours', 'Ho un altro cantiere') ->> 'resta_confermato') = 'false' as r6_chiamata;
reset role;
do $$ declare a public.appointments%rowtype; begin
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa0d';
  if a.status <> 'proposed' or a.proposed_by <> 'professional' then
    raise exception 'R6 FALLITA: stato %, proposto da %', a.status, a.proposed_by;
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id and tipo = 'spostato'
                 and autore = 'professional' and not concordato_telefono and motivo = 'Ho un altro cantiere') then
    raise exception 'R6 FALLITA: storico senza lo spostamento del pro';
  end if;
  if (select count(*) from public.request_messages where appointment_id = a.id and message like 'Ho spostato l''appuntamento: da %Confermalo qui sotto%') <> 1 then
    raise exception 'R6 FALLITA: messaggio assente o doppio (la 107 ne ha scritto un secondo?)';
  end if;
  raise notice 'R6 ok: il pro sposta fuori dal preavviso, torna da confermare, un messaggio solo';
end $$;

-- R7. Dentro il preavviso: dal calendario no, dalla funzione solo dopo la telefonata
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa10', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Uno', date_trunc('minute', now()) + interval '24 hours', 60, 'confirmed', 'professional');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$
declare h text;
begin
  begin
    update public.appointments set starts_at = starts_at + interval '1 day' where id = '00000000-0000-0000-0000-00000000aa10';
    raise exception 'R7 FALLITA: spostato dal calendario dentro il preavviso';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'chiama' then raise exception 'R7 FALLITA (calendario): % / %', sqlerrm, h; end if;
  end;
  begin
    perform public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa10', now() + interval '3 days', null, false);
    raise exception 'R7 FALLITA: spostato dentro il preavviso senza telefonata';
  exception when raise_exception then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'chiama' then raise exception 'R7 FALLITA (senza telefonata): % / %', sqlerrm, h; end if;
  end;
end $$;
select (public.sposta_appuntamento('00000000-0000-0000-0000-00000000aa10', date_trunc('minute', now()) + interval '30 hours', null, true) ->> 'resta_confermato') = 'true' as r7_concordato;
reset role;
do $$ declare a public.appointments%rowtype; begin
  select * into a from public.appointments where id = '00000000-0000-0000-0000-00000000aa10';
  if a.status <> 'confirmed' or a.starts_at <> date_trunc('minute', now()) + interval '30 hours' then
    raise exception 'R7 FALLITA: dopo la telefonata stato %, inizio %', a.status, a.starts_at;
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = a.id and tipo = 'spostato'
                 and autore = 'professional' and concordato_telefono and dentro_preavviso) then
    raise exception 'R7 FALLITA: storico senza telefonata e preavviso';
  end if;
  if (select count(*) from public.request_messages where appointment_id = a.id and message like '%come concordato al telefono.') <> 1 then
    raise exception 'R7 FALLITA: messaggio «come concordato al telefono» assente o doppio';
  end if;
  raise notice 'R7 ok: dentro il preavviso il calendario dice chiama; dopo la telefonata resta confermato';
end $$;

-- R8. Il pro annulla senza motivo: passa, e il messaggio non ha «Motivo» ---
insert into public.appointments (id, request_id, professional_id, customer_name, starts_at, duration_minutes, status, proposed_by)
values ('00000000-0000-0000-0000-00000000aa11', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
        'Cliente Due', date_trunc('day', now()) + interval '20 days 10 hours', 60, 'confirmed', 'professional');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select (public.annulla_appuntamento('00000000-0000-0000-0000-00000000aa11', null, false) ->> 'ok') = 'true' as r8_annullato;
reset role;
do $$ begin
  if (select status from public.appointments where id = '00000000-0000-0000-0000-00000000aa11') <> 'cancelled' then
    raise exception 'R8 FALLITA: non annullato';
  end if;
  if (select count(*) from public.request_messages where appointment_id = '00000000-0000-0000-0000-00000000aa11'
      and message like 'Ho annullato l''appuntamento di %.' and message not like '%Motivo%') <> 1 then
    raise exception 'R8 FALLITA: messaggio assente, doppio o con un motivo vuoto';
  end if;
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa11'
                 and tipo = 'annullato' and autore = 'professional' and motivo is null) then
    raise exception 'R8 FALLITA: storico senza annullamento del pro';
  end if;
  raise notice 'R8 ok: il pro annulla senza motivo, il cliente lo legge in chat';
end $$;

-- R9. L'avviso di sovrapposizione: il pro lo spegne da se', un altro no ----
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
update public.professionals set avviso_sovrapposizione = false where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.professionals set avviso_sovrapposizione = true where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
do $$ begin
  if (select avviso_sovrapposizione from public.professionals where id = '00000000-0000-0000-0000-0000000000f1') then
    raise exception 'R9 FALLITA: il pro non l''ha spento, o un cliente l''ha riacceso';
  end if;
  raise notice 'R9 ok: preferenza del pro, solo sua';
end $$;

-- R10. Il cliente legge il ritardo nel suo storico (la campanella lo deriva da qui)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  if not exists (select 1 from public.appointment_events where appointment_id = '00000000-0000-0000-0000-00000000aa0a' and tipo = 'ritardo') then
    raise exception 'R10 FALLITA: il cliente non legge il ritardo';
  end if;
  if exists (select 1 from public.appointment_events where request_id = '00000000-0000-0000-0000-0000000000b2') then
    raise exception 'R10 FALLITA: il cliente 1 legge lo storico del cliente 2';
  end if;
  raise notice 'R10 ok: il ritardo e'' nello storico del cliente, e solo del suo';
end $$;
reset role;

\echo 'TUTTE LE PROVE DELLA 116 SONO PASSATE'
rollback;
