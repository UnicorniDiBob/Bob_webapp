-- 031: luogo dell'appuntamento (snapshot) + guard cliente aggiornato.
--
-- PERCHÉ
-- La tabella appointments non aveva alcun campo luogo: il pro vedeva quando ma
-- non dove. Per le prenotazioni dirette (source='direct') il buco era totale —
-- request_id è null, quindi l'indirizzo non esisteva da nessuna parte e il pro
-- letteralmente non sapeva dove andare. Per le richieste di preventivo
-- l'indirizzo finiva solo come prosa dentro requests.problem_description
-- (src/components/QuoteDialog.tsx), non consultabile in modo strutturato.
--
-- SNAPSHOT, NON FK a customer_addresses
-- L'appuntamento è un record di lavoro: deve sopravvivere alla modifica o
-- cancellazione dell'indirizzo salvato dal cliente (DATA_COMPLIANCE §6,
-- "design deletes now, not later"). Una FK avrebbe anche richiesto una nuova
-- policy RLS per far leggere customer_addresses al pro: qui non serve, le
-- colonne seguono le policy della tabella appointments, quindi il luogo è
-- leggibile SOLO dal pro proprietario e dal cliente collegato.
--
-- CONFORMITÀ (parte del "done", non un dopo)
-- Base giuridica: art. 6(1)(b) esecuzione del contratto — senza l'indirizzo la
--   prestazione a domicilio non è eseguibile. Nessun consenso richiesto.
-- Finalità: unica e già coperta dalla finalità "gestione dell'appuntamento".
-- Minimizzazione: testo libero e niente altro. NESSUNA coordinata geografica,
--   nessun geocoding, nessun fornitore esterno coinvolto in questa migrazione
--   (vedi roadmap 40.0 per la mappa e il DPA del vendor geo).
-- Conservazione: come il record di lavoro a cui appartiene (§5, fino al termine
--   di prescrizione per gli appuntamenti transazionali), cancellato o
--   anonimizzato insieme ad esso. Non introduce un nuovo binario di retention.
-- DPIA: nessun trigger di §7.3 attivato — nessun monitoraggio sistematico,
--   nessuna categoria particolare (art. 9), nessuna decisione automatizzata,
--   nessuna profilazione. Non richiesta.
-- Interessati: il cliente conosce l'indirizzo perché lo fornisce lui stesso al
--   momento della prenotazione, verso quel singolo pro con cui ha concluso.
--
-- Idempotente.

alter table public.appointments
  add column if not exists location_address text,
  add column if not exists location_city text,
  add column if not exists location_notes text;

comment on column public.appointments.location_address is
  'Snapshot di via e numero civico dove si svolge il lavoro. Copiato al momento della prenotazione: NON è una FK a customer_addresses, così il record di lavoro sopravvive alla cancellazione dell''indirizzo salvato.';

comment on column public.appointments.location_city is
  'Snapshot del comune, testo libero (non FK a cities): non vincola il luogo del lavoro alle città a catalogo e sopravvive alle rinomine.';

comment on column public.appointments.location_notes is
  'Indicazioni di accesso: citofono, piano, scala, parcheggio. Solo dati comuni — niente categorie particolari (art. 9).';

-- Guard cliente: la 021 elencava i campi bloccati uno per uno (blacklist), per
-- cui QUALSIASI colonna nuova nascerebbe modificabile dal cliente in fase di
-- conferma. Ricreiamo la funzione includendo le tre colonne di luogo: il
-- cliente indica l'indirizzo quando prenota, non lo cambia rispondendo a una
-- proposta (per un cambio passa dalla conversazione con il pro).
create or replace function public.appointments_customer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  if auth.uid() is null then
    return new; -- service role / job interni
  end if;
  select exists (
    select 1 from public.professionals p
    where p.id = old.professional_id and p.user_id = auth.uid()
  ) into is_owner;
  if is_owner then
    return new;
  end if;
  if old.status <> 'proposed'
     or new.status not in ('confirmed', 'declined')
     or new.professional_id is distinct from old.professional_id
     or new.request_id is distinct from old.request_id
     or new.customer_name is distinct from old.customer_name
     or new.title is distinct from old.title
     or new.starts_at is distinct from old.starts_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.price is distinct from old.price
     or new.notes is distinct from old.notes
     or new.location_address is distinct from old.location_address
     or new.location_city is distinct from old.location_city
     or new.location_notes is distinct from old.location_notes
  then
    raise exception 'Puoi solo confermare o rifiutare una proposta di appuntamento';
  end if;
  return new;
end $$;

drop trigger if exists appointments_customer_guard on public.appointments;
create trigger appointments_customer_guard
  before update on public.appointments
  for each row execute function public.appointments_customer_guard();
