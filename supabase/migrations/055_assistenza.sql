-- 055: assistenza clienti — i ticket vivono su Bob, non nella posta.
--
-- PERCHE' COSI' E NON UN INDIRIZZO EMAIL.
-- Il business plan dice "i founder, SLA 24 ore", ma nel prodotto non esisteva
-- ne' una casella, ne' una coda, ne' un'escalation: "qualcuno guarda" smette
-- di funzionare il primo lunedi' con traffico vero. E un semplice "scrivici a"
-- oggi non e' scrivibile: gli indirizzi in src/lib/company.ts sono
-- [PLACEHOLDER] fino a gennaio 2027 (scelta consapevole) e la pipeline email e'
-- spenta finche' non c'e' RESEND_API_KEY. Una pagina che dice "ti rispondiamo
-- per email" sarebbe una promessa che il prodotto non mantiene.
-- Quindi: la richiesta e la risposta vivono dentro Bob. Funziona senza Resend,
-- e quando le email si accendono si aggiunge SOLO l'avviso — non il canale.
-- E' il primo pezzo di P3.7 (assistenza con SLA ed escalation).
--
-- CANCELLAZIONE A CASCATA, non SET NULL — e' una scelta, non una distrazione.
-- Un ticket e' anche un dato nostro (storico dei problemi, misura dello SLA) e
-- la tentazione e' conservarlo slegandolo dalla persona. Ma il ticket contiene
-- il racconto del problema e un indirizzo email: slegarlo dall'utente
-- lascerebbe dati personali orfani e non cancellabili, che e' esattamente
-- quello che la regola di progetto vieta ("nessun dato personale orfano o non
-- cancellabile"). Con la cascata perdiamo un po' di storico e restiamo puliti:
-- per un pilota e' il compromesso giusto. Se un giorno servira' la statistica,
-- si terra' un aggregato senza persone dentro, non il ticket svuotato.
--
-- RETENTION. Ticket di utenti registrati: quanto l'account, poi cascata.
-- Ticket ANONIMI (user_id null): non hanno un account che li porti via, quindi
-- hanno una regola propria — 12 mesi, come i dati di prospect (DATA_COMPLIANCE
-- §5). La cancellazione periodica e' lavoro di P3.9: qui si dichiara la regola,
-- il job la applichera'. Scritto anche nel ROPA, riga A19.
--
-- BASE GIURIDICA. Legittimo interesse (art. 6.1.f) per chi scrive senza
-- account: rispondere a una richiesta di aiuto che ci ha rivolto lui. Per gli
-- utenti registrati e' esecuzione del contratto (art. 6.1.b). Nessun consenso:
-- non e' marketing, ed e' l'utente a iniziare la conversazione.
--
-- Idempotente: create table if not exists, guardie su pg_constraint,
-- drop-then-create per le policy.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  -- Codice breve e leggibile: e' l'unica cosa che resta in mano a chi scrive
  -- senza account, perche' non ha un posto dove tornare a guardare.
  ref text not null unique,
  -- Null per chi scrive senza essere registrato.
  user_id uuid references public.users (id) on delete cascade,
  email text not null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'nuovo',
  -- Una risposta sola, non un thread. Per il pilota basta e costa un decimo;
  -- quando servira' la conversazione si aggiunge una tabella di messaggi e
  -- questo campo diventa il primo di quelli.
  staff_reply text,
  staff_reply_at timestamptz,
  staff_reply_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_tickets is
  'Richieste di assistenza. La risposta vive qui dentro, non nella posta: la pipeline email e'' spenta e gli indirizzi di contatto sono [PLACEHOLDER] fino a gennaio 2027. Vedi migrazione 055.';
comment on column public.support_tickets.ref is
  'Codice mostrato a chi scrive. Per un utente anonimo e'' il solo riferimento che ha.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'support_tickets_category_check') then
    alter table public.support_tickets add constraint support_tickets_category_check
      check (category in ('problema_tecnico','account','professionista','pagamenti','privacy','altro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'support_tickets_status_check') then
    alter table public.support_tickets add constraint support_tickets_status_check
      check (status in ('nuovo','in_lavorazione','risposto','chiuso'));
  end if;
end $$;

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

-- Una sola policy di lettura invece della coppia proprietario+staff: due policy
-- permissive fanno valutare entrambe le espressioni su ogni riga, e l'advisor
-- di performance lo segnala. Stessa scelta della 053.
drop policy if exists "Tickets readable by owner or staff" on public.support_tickets;
create policy "Tickets readable by owner or staff" on public.support_tickets
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin_or_cs());

-- NESSUNA policy di insert per anon o authenticated, di proposito: si passa
-- dalla route con service role, che e' l'unico posto dove si possono mettere
-- honeypot, validazione e un tetto agli invii. Stessa forma della waitlist.
drop policy if exists "Staff updates tickets" on public.support_tickets;
create policy "Staff updates tickets" on public.support_tickets
  for update to authenticated
  using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

-- Nessuna delete per nessuno: un ticket si chiude (status), non si cancella.
-- Sparisce solo con l'account, per cascata.
