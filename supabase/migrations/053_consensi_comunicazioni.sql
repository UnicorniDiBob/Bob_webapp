-- 053: consenso esplicito sulla waitlist + registro dei consensi per finalita'.
--
-- PERCHE', in due pezzi.
--
-- 1. LA WAITLIST REGISTRAVA UN CONSENSO CHE NESSUNO AVEVA PRESTATO.
--    La 015 dichiarava `consent_at timestamptz not null default now()`: ogni
--    iscrizione nasceva con la prova di un atto affermativo che non c'era.
--    Il form chiedeva solo l'email e mostrava una frase rassicurante; non una
--    spunta. Un consenso deve essere un atto positivo inequivocabile
--    (art. 4(11) GDPR) e il titolare deve poterlo dimostrare (art. 7.1): se il
--    default lo scrive per noi, non dimostra niente - documenta una nostra
--    supposizione. Togliamo il default, cosi' il database rifiuta una riga di
--    waitlist senza consenso, e aggiungiamo il TESTO accettato, che e' la
--    parte che rende il consenso dimostrabile a distanza di mesi.
--    Verificato il 19/08/2026: city_waitlist ha 0 righe, quindi nessuna
--    bonifica. Dopo la prima iscrizione questa correzione sarebbe stata una
--    rettifica di dati, non una migrazione.
--
--    La spunta sulla waitlist puo' essere OBBLIGATORIA senza violare l'art.
--    7(4): l'avviso al lancio non e' un extra legato a un altro servizio, e'
--    l'unico servizio richiesto dal form. Il consenso promozionale invece e'
--    separato, facoltativo e spento per default: marketing_consent_at.
--
-- 2. SERVIVA UN REGISTRO DEI CONSENSI PER FINALITA'.
--    Regola di progetto: "un record di consenso per finalita', nessun soft
--    opt-in". Non esisteva nessuna tabella dove scriverlo.
--    ATTENZIONE A COSA NON STA QUI: le comunicazioni di SERVIZIO (esito della
--    verifica, nuova richiesta, nuovo messaggio, appuntamenti, reset password,
--    avvisi di sicurezza) NON sono consensi e non stanno in questa tabella.
--    La loro base giuridica e' l'esecuzione del contratto (art. 6.1.b) e non
--    sono disattivabili finche' l'account e' attivo. Metterle qui sotto forma
--    di preferenza revocabile sarebbe un errore in due direzioni: darebbe per
--    facoltativo cio' che e' dovuto, e legherebbe il consenso commerciale al
--    servizio, che e' esattamente la costruzione vietata dall'art. 7(4).
--
--    La tabella e' un registro in sola aggiunta: nessuna policy di update o
--    delete per nessun ruolo. Una revoca e' una riga nuova con granted=false,
--    non la cancellazione della riga precedente - altrimenti si perde la
--    storia, che e' l'unica cosa che dimostra quando il consenso c'era.
--    Lo stato corrente di una finalita' e' la riga piu' recente per
--    (user_id, purpose).
--
--    Retention: le righe vivono quanto l'account e sono cancellate a cascata
--    con esso (on delete cascade su users). Non c'e' interesse a conservare la
--    prova di un consenso di una persona che non esiste piu'.
--    Riga RoPA aggiunta in docs/legal/ROPA.md nello stesso commit.
--
-- ORDINE DI APPLICAZIONE — PERCHE' SONO DUE FILE E NON UNO.
-- Questa migrazione e' SOLO ADDITIVA: due colonne nuove e una tabella nuova.
-- Si puo' applicare in qualsiasi momento, prima o dopo il deploy, senza
-- rompere niente: il codice vecchio non conosce le colonne nuove e non ne ha
-- bisogno. La rimozione del `default now()` da consent_at sta invece nella
-- 054, e va applicata DOPO il deploy — perche' fra il momento in cui il
-- default sparisce e il momento in cui la route aggiornata e' online, un
-- insert senza consent_at fallirebbe. Un file solo avrebbe reso impossibile
-- ordinare le due cose: o si rompe la waitlist per la durata del build, o si
-- lascia in produzione una tabella che il codice nuovo non trova.
--
-- Idempotente: add column if not exists, create table if not exists, guardia
-- su pg_constraint, drop-then-create per le policy.

-- ---------------------------------------------------------------------------
-- 1. Waitlist: le colonne che servono a documentare il consenso
-- ---------------------------------------------------------------------------

alter table public.city_waitlist add column if not exists consent_text text;

comment on column public.city_waitlist.consent_text is
  'Il testo esatto che l''utente ha accettato. E'' la parte che rende il consenso dimostrabile: fra sei mesi il testo del form sara'' cambiato.';

alter table public.city_waitlist add column if not exists marketing_consent_at timestamptz;

comment on column public.city_waitlist.marketing_consent_at is
  'Consenso SEPARATO e FACOLTATIVO alle comunicazioni promozionali. NULL = non prestato, ed e'' il default corretto. Non condiziona l''iscrizione.';

-- ---------------------------------------------------------------------------
-- 2. Registro dei consensi per finalita' (in sola aggiunta)
-- ---------------------------------------------------------------------------

create table if not exists public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Finalita': una riga per ognuna, mai una preferenza cumulativa.
  purpose text not null,
  -- true = prestato, false = revocato. La revoca e' una riga nuova.
  granted boolean not null,
  -- Il testo mostrato al momento della scelta: prova di cosa ha accettato.
  consent_text text,
  -- Da dove arriva la scelta (dashboard, iscrizione, import): utile in audit.
  source text not null default 'dashboard',
  created_at timestamptz not null default now()
);

comment on table public.communication_consents is
  'Registro in sola aggiunta dei consensi alle comunicazioni COMMERCIALI, una riga per finalita'' e per cambio di stato. Le comunicazioni di servizio non stanno qui: base giuridica contratto, non consenso. Vedi migrazione 053.';

-- Le finalita' ammesse. Vincolo separato e con guardia, cosi' la migrazione
-- resta rieseguibile anche se la tabella esisteva gia'.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'communication_consents_purpose_check'
  ) then
    alter table public.communication_consents
      add constraint communication_consents_purpose_check
      check (purpose in ('bob_news', 'partner_offers'));
  end if;
end $$;

-- Lo stato corrente e' "la riga piu' recente per finalita'": l'indice serve
-- esattamente a quella lettura.
create index if not exists communication_consents_user_purpose_idx
  on public.communication_consents (user_id, purpose, created_at desc);

alter table public.communication_consents enable row level security;

-- UNA SOLA POLICY DI LETTURA, NON DUE.
-- Il resto del database usa la coppia "l'utente legge le proprie" + "lo staff
-- legge tutto", e l'advisor di performance la segnala 123 volte
-- (multiple_permissive_policies): con due policy permissive Postgres valuta
-- entrambe le espressioni su ogni riga. Su una tabella nuova e vuota la forma
-- giusta costa zero, quindi si scrive giusta: un'unica policy con un OR,
-- stessa semantica, una valutazione invece di due.
-- `to authenticated` di proposito: per anon auth.uid() e' null e la condizione
-- non sarebbe mai vera comunque, ma dichiararlo tiene il ruolo fuori dal piano
-- invece di farlo scartare a valle.
drop policy if exists "User reads own consents" on public.communication_consents;
drop policy if exists "Staff reads consents" on public.communication_consents;
drop policy if exists "Consents readable by owner or staff" on public.communication_consents;
create policy "Consents readable by owner or staff" on public.communication_consents
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin_or_cs());

-- Solo per se stesso: nessuno registra un consenso al posto di un altro,
-- staff compreso. Un consenso prestato da qualcun altro non e' un consenso.
drop policy if exists "User writes own consents" on public.communication_consents;
create policy "User writes own consents" on public.communication_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- NESSUNA policy di update o delete, per nessun ruolo, di proposito: il
-- registro e' in sola aggiunta. Una riga che si puo' riscrivere non prova
-- niente, e la storia dei consensi e' l'unica difesa in caso di contestazione.
