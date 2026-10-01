-- 107_avvisi_appuntamenti.sql
--
-- UN APPUNTAMENTO NON CAMBIA PIU' IN SILENZIO (01/10, Lucio).
--
-- COM'ERA. «Annulla appuntamento» (AppointmentDetail) e lo spostamento
-- (AppointmentDialog) erano un UPDATE secco su appointments: nessun messaggio
-- in chat, nessuna notifica. E lo spostamento lasciava lo stato com'era, cioe'
-- un appuntamento che il cliente aveva confermato restava «confirmed» a un'ora
-- nuova che non aveva mai accettato.
--
-- PERCHE' NEL DATABASE E NON NEI BOTTONI. «Avvisano sempre» vuol dire da
-- qualunque strada passi la modifica: il dialog di oggi, il calendario di
-- domani, una chiamata diretta all'API. Un avviso scritto nel componente vale
-- finche' qualcuno non aggiunge un secondo componente. Qui vale per tutti.
--
-- DOVE FINISCE L'AVVISO: nella chat della conversazione, a nome di chi ha
-- fatto il cambio (come gia' «Ho confermato l'appuntamento»). Non in
-- lib/notifiche.ts: quel file e' per lo stato dell'account, e per scelta
-- esclude i messaggi fra cliente e professionista, che hanno gia' la loro
-- casa con il badge dei non letti. Non con mittente «bob»: read_at e' uno
-- solo per messaggio, e chi apre per primo lo segna letto per tutti — di
-- solito proprio chi ha appena fatto il cambio, che cosi' spegnerebbe
-- l'avviso all'altra parte prima che lo veda. L'email (spenta per scelta,
-- src/lib/email.ts) e' una copia di questo messaggio, non il canale.
--
-- CHI VIENE COPERTO. I trigger scattano quando l'autore e' un utente
-- autenticato proprietario dell'appuntamento, cioe' il professionista: il
-- cliente, via PostgREST, non puo' ne' spostare ne' annullare (guard 031).
-- Le route che agiscono come servizio (auth.uid() null: la disdetta del
-- cliente, la controproposta, la prenotazione) scrivono il loro messaggio da
-- sole, perche' qui non si saprebbe a nome di chi parlare.
--
-- Idempotente: create or replace, drop-then-recreate dei trigger.

begin;

-- 1. Una data come la scrive l'app: «ven 2 ott, 10:00», ora di Roma ---------
create or replace function private.quando_breve(ts timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select (array['dom','lun','mar','mer','gio','ven','sab'])[extract(dow from l)::int + 1]
         || ' ' || extract(day from l)::int
         || ' ' || (array['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'])[extract(month from l)::int]
         || ', ' || to_char(l, 'HH24:MI')
    from (select ts at time zone 'Europe/Rome' as l) x;
$$;

revoke execute on function private.quando_breve(timestamptz) from public, anon, authenticated;

-- 2. Confermato vuol dire confermato dall'ALTRA parte -------------------------
-- Un orario accettato e' accettato per QUELL'ora. Se il pro lo sposta, torna
-- una proposta sua, e il cliente la conferma o la rifiuta dal biglietto in
-- chat. E il menu «Stato» del dialog del pro non e' una scorciatoia: su un
-- appuntamento con un cliente il pro conferma solo ACCETTANDO la proposta del
-- cliente cosi' com'e'. Qualunque altra «conferma» — della sua stessa
-- proposta, di un appuntamento annullato, di un orario appena spostato —
-- diventa una proposta che il cliente deve accettare.
-- Solo per appuntamenti legati a una richiesta (gli altri sono l'agenda
-- privata del pro, senza nessuno dall'altra parte) e solo verso il futuro:
-- correggere a posteriori l'ora di un lavoro gia' fatto non chiede conferma
-- a nessuno.
create or replace function public.riproponi_se_spostato()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_spostato boolean;
begin
  if auth.uid() is null
     or new.request_id is null
     or new.starts_at <= now() then
    return new;
  end if;
  if not exists (
    select 1 from public.professionals p
     where p.id = new.professional_id and p.user_id = auth.uid()
  ) then
    return new;
  end if;

  v_spostato := new.starts_at is distinct from old.starts_at
             or new.duration_minutes is distinct from old.duration_minutes;

  -- Il pro accetta la proposta del cliente, tale e quale: conferma vera.
  if new.status = 'confirmed' and old.status = 'proposed'
     and old.proposed_by = 'customer' and not v_spostato then
    return new;
  end if;

  -- Ogni altra conferma che il cliente non ha dato torna una proposta.
  if new.status = 'confirmed' and (old.status <> 'confirmed' or v_spostato) then
    new.status := 'proposed';
    new.proposed_by := 'professional';
    return new;
  end if;

  -- Una proposta (anche del cliente) spostata dal pro diventa sua.
  if new.status = 'proposed' and v_spostato then
    new.proposed_by := 'professional';
  end if;
  return new;
end;
$$;

revoke execute on function public.riproponi_se_spostato() from public, anon, authenticated;

drop trigger if exists riproponi_se_spostato on public.appointments;
create trigger riproponi_se_spostato
  before update of starts_at, duration_minutes, status on public.appointments
  for each row execute function public.riproponi_se_spostato();

-- 3. L'avviso in chat per annullamenti e spostamenti --------------------------
-- SECURITY DEFINER perche' l'avviso non deve dipendere dalle policy di
-- request_messages: se l'INSERT fallisse, fallirebbe anche l'annullamento.
create or replace function public.avvisa_cambio_appuntamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_testo text;
begin
  if auth.uid() is null or new.request_id is null then
    return null;
  end if;
  if not exists (
    select 1 from public.professionals p
     where p.id = new.professional_id and p.user_id = auth.uid()
  ) then
    return null;
  end if;

  if new.status = 'cancelled' and old.status = 'confirmed' then
    v_testo := 'Ho annullato l''appuntamento di ' || private.quando_breve(old.starts_at) || '.';
  elsif new.status = 'cancelled' and old.status = 'proposed'
        and old.proposed_by = 'professional' then
    -- Il pro ritira la SUA proposta. Quando invece rifiuta quella del
    -- cliente (proposed_by = customer) il messaggio lo scrive gia' l'app.
    v_testo := 'Ho ritirato la proposta di ' || private.quando_breve(old.starts_at) || '.';
  elsif new.status = 'proposed'
        and (new.starts_at is distinct from old.starts_at
             or new.duration_minutes is distinct from old.duration_minutes) then
    v_testo := 'Ho spostato l''appuntamento: da ' || private.quando_breve(old.starts_at)
               || ' a ' || private.quando_breve(new.starts_at)
               || ' (' || new.duration_minutes || ' min). Confermalo qui sotto o proponi un altro orario.';
  elsif new.status = 'proposed' and old.status in ('cancelled', 'declined', 'completed') then
    -- Un appuntamento chiuso riaperto dal pro: e' una proposta nuova.
    v_testo := 'Ti ripropongo l''appuntamento di ' || private.quando_breve(new.starts_at)
               || '. Confermalo qui sotto o proponi un altro orario.';
  else
    return null;
  end if;

  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind, appointment_id)
  values
    (new.request_id, new.professional_id, 'professional', auth.uid(), v_testo,
     'appointment_proposal', new.id);
  return null;
end;
$$;

revoke execute on function public.avvisa_cambio_appuntamento() from public, anon, authenticated;

drop trigger if exists avvisa_cambio_appuntamento on public.appointments;
create trigger avvisa_cambio_appuntamento
  after update of status, starts_at, duration_minutes on public.appointments
  for each row execute function public.avvisa_cambio_appuntamento();

-- 4. Eliminato = annullato, per chi stava dall'altra parte -------------------
-- «Elimina» nel dialog del pro cancella la riga: per il cliente e' un
-- annullamento senza traccia. Il messaggio resta (senza biglietto: la riga
-- non c'e' piu', e la FK dei messaggi e' ON DELETE SET NULL).
create or replace function public.avvisa_appuntamento_eliminato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or old.request_id is null
     or old.status not in ('confirmed', 'proposed')
     or old.starts_at <= now() then
    return null;
  end if;
  if not exists (
    select 1 from public.professionals p
     where p.id = old.professional_id and p.user_id = auth.uid()
  ) then
    return null;
  end if;
  insert into public.request_messages
    (request_id, professional_id, sender_type, sender_id, message, kind)
  values
    (old.request_id, old.professional_id, 'professional', auth.uid(),
     case when old.status = 'confirmed'
       then 'Ho annullato l''appuntamento di ' || private.quando_breve(old.starts_at) || '.'
       else 'Ho ritirato la proposta di ' || private.quando_breve(old.starts_at) || '.'
     end,
     'text');
  return null;
end;
$$;

revoke execute on function public.avvisa_appuntamento_eliminato() from public, anon, authenticated;

drop trigger if exists avvisa_appuntamento_eliminato on public.appointments;
create trigger avvisa_appuntamento_eliminato
  after delete on public.appointments
  for each row execute function public.avvisa_appuntamento_eliminato();

-- 5. Il tempo di risposta conta le domande, non i biglietti -------------------
-- Da qui in poi una prenotazione diretta scrive in chat a nome del cliente
-- («Ho prenotato…», con il biglietto), e lo stesso la sua disdetta. Il tempo
-- di risposta del pro (075) e' la mediana, per richiesta, fra il primo
-- messaggio del cliente e la prima risposta del pro: contando anche i
-- biglietti, una prenotazione che non chiede niente farebbe partire il
-- cronometro, e il «grazie, a domani» del pro due giorni dopo diventerebbe
-- una risposta lenta. Dal lato cliente contano solo i messaggi di testo.
--
-- RISCRITTA DA QUELLA VIVA (pg_get_functiondef del 01/10, md5
-- 055b604863d568b95c20636e0957fa0c), non dal file 075. Cambia una riga: il
-- filtro del cliente.
create or replace function public.aggiorna_segnali_professionisti(p_ids uuid[] default null::uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_quanti integer;
begin
  insert into public.professional_signals as sg
    (professional_id, risposta_minuti, risposte_contate, aggiornato_al)
  select
    pr.id,
    x.mediana,
    coalesce(x.n, 0),
    now()
  from public.professionals pr
  left join (
    select
      per_richiesta.professional_id,
      percentile_cont(0.5) within group (order by per_richiesta.minuti) as mediana,
      count(*) as n
    from (
      select
        m.professional_id,
        m.request_id,
        extract(epoch from (
          min(m.created_at) filter (where m.sender_type = 'professional')
          - min(m.created_at) filter (where m.sender_type = 'customer' and m.kind = 'text')
        )) / 60 as minuti
      from public.request_messages m
      where m.created_at > now() - interval '90 days'
        and m.professional_id is not null
      group by m.professional_id, m.request_id
    ) per_richiesta
    where per_richiesta.minuti is not null
      and per_richiesta.minuti >= 0
    group by per_richiesta.professional_id
  ) x on x.professional_id = pr.id
  where p_ids is null or pr.id = any(p_ids)
  on conflict (professional_id) do update
    set risposta_minuti = excluded.risposta_minuti,
        risposte_contate = excluded.risposte_contate,
        aggiornato_al = excluded.aggiornato_al;

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$function$;

-- I segnali di oggi, ricalcolati con la regola nuova.
select public.aggiorna_segnali_professionisti();

commit;
