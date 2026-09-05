-- 071: GLI AVVISI DI SERVIZIO — quando siamo NOI a dover dire una cosa a tutti.
--
-- PERCHE' QUI UNA TABELLA CI VUOLE, MENTRE PER LE NOTIFICHE NO.
-- src/lib/notifiche.ts spiega, e bene, perche' le notifiche di servizio non
-- hanno una tabella: ogni voce e' DERIVATA da righe che esistono gia' (un
-- ticket, una verifica, un profilo senza servizi), e una tabella in piu'
-- sarebbe solo una copia che si disallinea. Un avviso di servizio e' l'unico
-- caso in cui quel ragionamento non regge: non e' derivabile da niente, perche'
-- e' un testo che una persona dello staff scrive apposta. Non esiste una riga
-- da cui dedurre «lunedi' alle 3 il server sara' fermo». Quindi la tabella.
--
-- E costa poco, perche' NON CONTIENE DATI PERSONALI DEGLI UTENTI: e' un
-- messaggio scritto da noi per tutti. L'unico dato personale e' chi l'ha
-- scritto (creato_da), che e' personale dello staff e serve a sapere chi ha
-- detto cosa. Sta a `on delete set null`: cancellato l'account dello staff,
-- l'avviso resta e l'autore sparisce.
--
-- CONSERVAZIONE. Gli avvisi scaduti si tengono 24 mesi dopo fine_il: sono la
-- prova di cosa abbiamo comunicato e quando (utile se qualcuno contesta un
-- disservizio), e dopo due anni non servono piu' a nessuno. Nessun job
-- automatico per adesso: sono pochi e si cancellano a mano dal pannello.
--
-- QUANDO UN AVVISO E' IN CORSO lo decide il database, non l'interfaccia:
-- `now() between inizio_il e fine_il`. La stessa condizione sta nella policy
-- di lettura, quindi un avviso scaduto non e' «nascosto»: e' irraggiungibile.
-- Cosi' non c'e' modo di dimenticarsi un filtro in una query e lasciare in
-- pagina un avviso di tre settimane fa.
--
-- Idempotente: if not exists ovunque, drop-then-create per vincoli e policy.

begin;

create table if not exists public.avvisi_servizio (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  testo text not null,
  livello text not null default 'informazione',
  inizio_il timestamptz not null default now(),
  fine_il timestamptz not null,
  creato_da uuid references public.users(id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

alter table public.avvisi_servizio
  drop constraint if exists avvisi_servizio_livello_check;
alter table public.avvisi_servizio
  add constraint avvisi_servizio_livello_check
  check (livello = any (array['informazione'::text, 'attenzione'::text, 'disservizio'::text]));

-- Un titolo vuoto o un testo vuoto non sono un avviso: sono una riga che
-- occupa lo schermo di tutti senza dire niente.
alter table public.avvisi_servizio
  drop constraint if exists avvisi_servizio_titolo_check;
alter table public.avvisi_servizio
  add constraint avvisi_servizio_titolo_check
  check (char_length(btrim(titolo)) between 3 and 120);

alter table public.avvisi_servizio
  drop constraint if exists avvisi_servizio_testo_check;
alter table public.avvisi_servizio
  add constraint avvisi_servizio_testo_check
  check (char_length(btrim(testo)) between 3 and 2000);

-- Una finestra che finisce prima di iniziare non si accende mai: meglio che il
-- database la rifiuti subito, invece di lasciare all'admin il dubbio.
alter table public.avvisi_servizio
  drop constraint if exists avvisi_servizio_finestra_check;
alter table public.avvisi_servizio
  add constraint avvisi_servizio_finestra_check
  check (fine_il > inizio_il);

create index if not exists idx_avvisi_finestra
  on public.avvisi_servizio (inizio_il, fine_il);

alter table public.avvisi_servizio enable row level security;

-- UNA SOLA POLICY DI LETTURA, non due. La 067 aveva dato all'admin una policy
-- `for all` che comprendeva anche il SELECT: ogni lettura pubblica finiva per
-- valutare due policy, e la 068 ha dovuto rimediare. Qui la condizione e' una
-- sola espressione, e private.is_admin_or_cs() sta dentro un select cosi'
-- Postgres la valuta una volta per query e non una volta per riga.
drop policy if exists "Legge gli avvisi in corso" on public.avvisi_servizio;
create policy "Legge gli avvisi in corso" on public.avvisi_servizio
  for select to authenticated
  using (
    (select private.is_admin_or_cs())
    or (now() >= inizio_il and now() < fine_il)
  );

-- Scrive solo l'admin. Il cs legge tutto — deve poter rispondere a chi chiede
-- «che succede?» — ma non parla a nome di Bob a tutta la comunita'.
drop policy if exists "Admin crea avvisi" on public.avvisi_servizio;
create policy "Admin crea avvisi" on public.avvisi_servizio
  for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists "Admin modifica avvisi" on public.avvisi_servizio;
create policy "Admin modifica avvisi" on public.avvisi_servizio
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admin cancella avvisi" on public.avvisi_servizio;
create policy "Admin cancella avvisi" on public.avvisi_servizio
  for delete to authenticated
  using ((select private.is_admin()));

comment on table public.avvisi_servizio is
  'Comunicazioni dello staff a tutti gli utenti (manutenzioni, disservizi). Nessun dato personale degli utenti. Conservazione: 24 mesi dopo fine_il.';

-- --------------------------------------------------------------------------
-- «L'ho gia' visto»: una data sola, sul profilo
-- --------------------------------------------------------------------------
--
-- L'avviso appare come finestra al primo accesso dopo la pubblicazione, e poi
-- vive fra le notifiche. Per sapere se questa persona l'ha gia' visto serve
-- ricordarselo, e ricordarselo NEL BROWSER non basta: notifiche.ts lo fa per
-- il pallino della campanella e lo dichiara («se apri le notifiche sul
-- telefono, il computer non lo sa»), ma li' il prezzo e' un pallino di
-- troppo. Qui il prezzo sarebbe una finestra che riparte in faccia su ogni
-- dispositivo, e non e' lo stesso prezzo.
--
-- Quel file prevedeva «una colonna su users». La mettiamo su profiles, non su
-- users, per una ragione precisa: users porta `role`, e per scriverci l'utente
-- servirebbe allargare i permessi di scrittura su una tabella che decide chi e'
-- admin. profiles ha gia' «User updates own profile» dalla 018 e non contiene
-- nessuna colonna che dia privilegi. Non si tocca la serratura per aprire una
-- finestra.
--
-- Cancellazione: la riga muore col profilo, che ha gia' il suo percorso.
-- Export art. 15/20: esce da solo, lib/export-dati.ts legge profiles con
-- select *.
alter table public.profiles
  add column if not exists avvisi_visti_al timestamptz;

comment on column public.profiles.avvisi_visti_al is
  'Fino a quando questa persona ha visto gli avvisi di servizio. Serve a non ripresentare la stessa finestra a ogni accesso.';

commit;
