-- 033 — Collega un messaggio della chat all'appuntamento a cui si riferisce.
--
-- Perché: finora una proposta di appuntamento era solo testo in
-- request_messages.message ("Ti propongo un appuntamento: ..."), quindi la chat
-- non sapeva a quale riga di appointments si riferisse e il cliente doveva
-- passare dall'area personale per rispondere. Con kind + appointment_id la chat
-- può mostrare i tre tasti (approva / rifiuta / modifica) sotto la proposta.
--
-- Nota privacy: nessun nuovo dato personale, solo un collegamento fra due
-- tabelle già esistenti. Base giuridica, finalità e retention restano quelle
-- della conversazione (contratto; chat legate a una transazione conservate fino
-- alla prescrizione — vedi docs/DATA_COMPLIANCE.md §5).
--
-- Idempotente: si può rieseguire senza effetti collaterali.

-- 1. Colonne -----------------------------------------------------------------

alter table public.request_messages
  add column if not exists kind text not null default 'text';

alter table public.request_messages
  add column if not exists appointment_id uuid
    references public.appointments(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'request_messages_kind_check'
  ) then
    alter table public.request_messages
      add constraint request_messages_kind_check
      check (kind in ('text', 'appointment_proposal'));
  end if;
end $$;

create index if not exists idx_request_messages_appointment
  on public.request_messages (appointment_id)
  where appointment_id is not null;

-- 2. Backfill ----------------------------------------------------------------
-- Le proposte già inviate erano solo testo. Le riconosciamo dal prefisso (le
-- emoji iniziali sono state rimosse dai template nella stessa release, quindi
-- accettiamo entrambe le forme) e le colleghiamo all'appuntamento creato nello
-- stesso thread a meno di 2 minuti di distanza — la proposta e il messaggio
-- vengono scritti nella stessa funzione, uno subito dopo l'altro.

with pairs as (
  select distinct on (m.id)
    m.id as message_id,
    a.id as appointment_id
  from public.request_messages m
  join public.appointments a
    on a.request_id = m.request_id
   and (m.professional_id is null or a.professional_id = m.professional_id)
   and abs(extract(epoch from (a.created_at - m.created_at))) < 120
  where m.kind = 'text'
    and m.appointment_id is null
    and (
      m.message like '%Ti propongo un appuntamento:%'
      or m.message like '%Ti propongo un orario diverso:%'
    )
  order by m.id, abs(extract(epoch from (a.created_at - m.created_at)))
)
update public.request_messages m
set kind = 'appointment_proposal',
    appointment_id = p.appointment_id
from pairs p
where m.id = p.message_id;

-- 3. Pulizia delle emoji nei messaggi già inviati -----------------------------
-- I template non le producono più (i messaggi sono testo scritto a nome
-- dell'utente, non UI). Ripuliamo solo il prefisso dei messaggi di sistema già
-- in tabella, ancorato all'inizio della stringa: nessun altro contenuto tocca.

update public.request_messages
set message = regexp_replace(message, '^(📅|✅|❌|🔄)[[:space:]]*', '')
where message ~ '^(📅|✅|❌|🔄)[[:space:]]*';

-- 4. Guardia di integrità ----------------------------------------------------
-- request_messages è scrivibile dal cliente (policy in 002) e dal pro (022):
-- senza controllo si potrebbe inserire un messaggio che punta a un appuntamento
-- di un'altra richiesta e far comparire i tasti di conferma dove non devono
-- esserci. La funzione è SECURITY INVOKER, quindi la SELECT sotto passa dalle
-- RLS di appointments: chi non vede l'appuntamento non può collegarlo.
-- search_path fissato (vedi 032).

create or replace function public.request_messages_appointment_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Solo in INSERT: se il pro cancella l'appuntamento, la FK diventa null per
  -- effetto di ON DELETE SET NULL e il messaggio resta con kind = proposta.
  -- Se lo pretendessimo anche in UPDATE, quella riga non sarebbe più
  -- aggiornabile — nemmeno per segnarla come letta. La UI mostra i tasti solo
  -- quando l'appuntamento c'è ancora.
  if tg_op = 'INSERT'
     and new.kind = 'appointment_proposal'
     and new.appointment_id is null then
    raise exception 'Una proposta di appuntamento richiede appointment_id';
  end if;

  if new.appointment_id is not null then
    if not exists (
      select 1
      from public.appointments a
      where a.id = new.appointment_id
        and a.request_id = new.request_id
    ) then
      raise exception 'appointment_id non appartiene a questa richiesta';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_request_messages_appointment_guard
  on public.request_messages;

create trigger trg_request_messages_appointment_guard
  before insert or update on public.request_messages
  for each row
  execute function public.request_messages_appointment_guard();

-- Il guard non è pensato per essere chiamato a mano (vedi 032).
revoke execute on function public.request_messages_appointment_guard()
  from anon, authenticated;
