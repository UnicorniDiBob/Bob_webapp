-- 056: cancellazione dell'account — le fondamenta, prima del bottone.
--
-- COSA DICE LA LEGGE, perche' il disegno viene da li' e non dal buon senso.
--
-- 1. IL MOTIVO NON PUO' ESSERE OBBLIGATORIO. L'art. 12(2) GDPR dice che "il
--    titolare agevola l'esercizio dei diritti dell'interessato di cui agli
--    articoli da 15 a 22". Pretendere una motivazione come CONDIZIONE per
--    cancellarsi e' l'opposto di agevolare: e' un ostacolo, e un ostacolo alla
--    cancellazione e' esso stesso una violazione. In piu' chiudere il proprio
--    account e' anzitutto recedere da un contratto, e da un contratto non si
--    recede spiegando perche'. Quindi il motivo si CHIEDE (serve a noi per
--    capire) ma non si IMPONE, e il percorso deve arrivare in fondo anche se
--    la persona non risponde.
--
-- 2. SETTE GIORNI DI RIPENSAMENTO STANNO DENTRO I TERMINI. L'art. 17(1) chiede
--    la cancellazione "senza ingiustificato ritardo" e l'art. 12(3) da' un mese
--    per dare riscontro. Sette giorni ci stanno con larghezza. Non sono un
--    ritardo "ingiustificato" a una condizione: che siano DICHIARATI alla
--    persona come finestra che controlla lei, non un'attesa silenziosa nostra.
--
-- 3. E QUI LA COSA CHE CAMBIA IL DISEGNO: durante quei sette giorni l'account
--    non puo' restare acceso. Se il profilo resta visibile e continua a
--    ricevere richieste, stiamo continuando a trattare dati dopo che la persona
--    ci ha chiesto di smettere — e allora i sette giorni diventano davvero un
--    ritardo. Quindi la richiesta SPEGNE subito (professionals.deactivated_at:
--    fuori dagli elenchi, dalla prenotazione diretta, dalla sitemap) e la
--    cancellazione avviene alla scadenza. Annullare riaccende.
--
-- Fonti: art. 12(2) e 12(3), art. 17(1) del Regolamento (UE) 2016/679.
-- Ricognizione, non parere legale: da confermare con l'avvocato in M6.
--
-- Idempotente: drop-then-add per il vincolo, if not exists per il resto.

-- ---------------------------------------------------------------------------
-- 1. Le recensioni sopravvivono a chi le ha scritte (G16)
-- ---------------------------------------------------------------------------
-- La 012 aveva messo ON DELETE CASCADE su ratings.customer_id per far passare
-- la cancellazione di un utente. Effetto collaterale mai voluto: cancellare un
-- cliente cancellava le sue recensioni, cioe' toglieva al professionista una
-- valutazione che aveva guadagnato. La regola di progetto dice l'opposto —
-- de-identificare, non cancellare.
-- Verificato il 19/08: il profilo pubblico legge solo punteggio, commento e
-- data (getProfessionalReviews in src/lib/data.ts), quindi con customer_id a
-- NULL la recensione resta identica per chi la legge e perde solo il legame
-- con la persona. Nessuna modifica di interfaccia necessaria: era gia' anonima
-- verso il pubblico, era il vincolo a essere sbagliato.
alter table public.ratings alter column customer_id drop not null;

alter table public.ratings drop constraint if exists ratings_customer_id_fkey;
alter table public.ratings
  add constraint ratings_customer_id_fkey
  foreign key (customer_id) references public.users (id) on delete set null;

comment on column public.ratings.customer_id is
  'NULL = autore cancellato. La recensione resta al professionista, de-identificata (migrazione 056, chiude G16).';

-- ---------------------------------------------------------------------------
-- 2. Spegnimento immediato del professionista
-- ---------------------------------------------------------------------------
alter table public.professionals add column if not exists deactivated_at timestamptz;

comment on column public.professionals.deactivated_at is
  'Valorizzata = fuori dagli elenchi pubblici, dalla prenotazione diretta e dalla sitemap. La imposta la richiesta di cancellazione e la azzera l''annullamento. Serve anche come base per una futura sospensione da staff.';

create index if not exists professionals_attivi_idx
  on public.professionals (deactivated_at)
  where deactivated_at is null;

-- ---------------------------------------------------------------------------
-- 3. La richiesta di cancellazione
-- ---------------------------------------------------------------------------
-- Una riga per utente. La riga ESISTE = cancellazione in corso.
-- Annullare CANCELLA la riga, non la marca: tenere lo storico di "ha chiesto di
-- essere cancellato e poi ha cambiato idea" sarebbe conservare un dato
-- personale, e delicato, proprio su chi ci aveva chiesto di sparire.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references public.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- Fine della finestra di ripensamento. La calcola la route, non un default,
  -- perche' la durata e' una decisione di prodotto e va letta nel codice.
  scheduled_for timestamptz not null,
  -- Entrambi FACOLTATIVI, per la ragione al punto 1.
  reason_code text,
  reason_note text
);

comment on table public.account_deletion_requests is
  'Cancellazioni in corso. La riga esiste = in corso; annullare la elimina. Motivo facoltativo: imporlo sarebbe un ostacolo all''esercizio di un diritto (art. 12(2) GDPR). Vedi migrazione 056.';

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Deletion request readable by owner or staff" on public.account_deletion_requests;
create policy "Deletion request readable by owner or staff" on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin_or_cs());

-- L'annullamento e' una cancellazione di riga fatta dalla persona stessa: e' un
-- diritto, non un favore, e non deve passare da noi.
drop policy if exists "User cancels own deletion" on public.account_deletion_requests;
create policy "User cancels own deletion" on public.account_deletion_requests
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Nessuna policy di insert: la richiesta passa dalla route con service role,
-- che e' l'unico posto dove si possono fare tre cose nello stesso momento —
-- creare la richiesta, spegnere il profilo e registrare il motivo anonimo.

-- ---------------------------------------------------------------------------
-- 4. I motivi, senza le persone
-- ---------------------------------------------------------------------------
-- Lucio vuole sapere perche' la gente se ne va. Il motivo pero' non puo'
-- sopravvivere legato a chi l'ha scritto: sarebbe un dato personale conservato
-- proprio su chi ha chiesto di essere cancellato. Quindi si separa: qui resta
-- il CODICE del motivo, senza utente e senza testo libero, e vive di vita
-- propria. Il testo libero resta sulla richiesta e muore con essa.
create table if not exists public.account_deletion_reasons (
  id uuid primary key default gen_random_uuid(),
  reason_code text not null,
  -- Il ruolo serve a leggere il dato ("i pro se ne vanno per un motivo diverso
  -- dai clienti") e non identifica nessuno.
  role text,
  created_at timestamptz not null default now()
);

comment on table public.account_deletion_reasons is
  'Solo il codice del motivo, senza utente e senza testo libero: statistica che sopravvive alla cancellazione senza conservare dati personali su chi se ne e'' andato. Vedi migrazione 056.';

alter table public.account_deletion_reasons enable row level security;

-- Nessuna lettura per gli utenti: non e' roba loro. Solo staff.
drop policy if exists "Staff reads deletion reasons" on public.account_deletion_reasons;
create policy "Staff reads deletion reasons" on public.account_deletion_reasons
  for select to authenticated using (private.is_admin_or_cs());
