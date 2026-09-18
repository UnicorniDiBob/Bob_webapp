-- 091_quote_intake.sql
--
-- Lo scaffolding per l'intake strutturato del preventivo (spec §8,
-- docs/QUOTE_INTAKE_SPEC.md). Due colonne nuove su subservices per dire cosa
-- chiedere e a che livello, due su requests per raccogliere le risposte e
-- il verdetto del risolutore.
--
-- QUOTE_LEVEL, NON QUOTE_MODE, E' IL DEFAULT DEL CATALOGO. subservices.quote_level
-- e' la verita' dichiarata dal catalogo ("questo sotto-servizio si preventiva
-- cosi', di norma"); requests.quote_mode e' il verdetto per QUESTA richiesta,
-- dopo che il risolutore (Fase 2, src/lib/quoting.ts) ha applicato le regole
-- di aggravamento e il pre-check emergenza — puo' solo scendere lungo la
-- scala, mai salire, e in piu' porta 'dispatch' che quote_level non ha
-- (un'emergenza non e' mai un livello del catalogo, e' un bypass).
--
-- QUOTE_FIELDS STA IN UNA COLONNA SUA, NON DENTRO BOOKING_FIELDS. La
-- prenotazione diretta (booking_fields, migration 028) e' rotta in quattro
-- punti (spec §2, C16): impastare la sua definizione con quella del
-- preventivo avrebbe legato un dato nuovo e da lanciare subito a uno vecchio
-- e da non toccare finche' non e' riparato.
--
-- LETTURA: qualunque punto scriva scope su una request deve validare le sue
-- chiavi contro il quote_fields del subservice scelto (Fase 3, non qui) —
-- questa migrazione apre solo lo spazio, non lo riempie e non lo controlla.
-- La 092 (seed, stesso PR) popola quote_level/quote_fields per i cinque
-- servizi core e il fallback generico per gli altri dieci.
--
-- PRIVACY. Le due colonne su subservices sono in lettura pubblica come il
-- resto della tabella (mig 003): descrivono cosa si chiede, non chi ha
-- risposto cosa, quindi non aggiungono niente di deducibile. scope e
-- quote_mode su requests ereditano le policy RLS gia' in vigore sulla riga
-- (cliente proprietario, professionista assegnato, staff) — nessuna riga
-- nuova di RLS necessaria, la 044 (progressive disclosure) non cambia.
--
-- Idempotente: add column if not exists, create index if not exists.

begin;

alter table public.subservices
  add column if not exists quote_level text not null default 'survey'
    check (quote_level in ('bookable', 'range', 'assisted', 'survey')),
  add column if not exists quote_fields jsonb not null default '[]'::jsonb;

comment on column public.subservices.quote_level is
  'Livello di preventivabilita'' dichiarato dal catalogo per questo sotto-servizio (spec §2): bookable, range, assisted o survey. E'' il default; il risolutore (src/lib/quoting.ts) puo'' solo abbassarlo per una richiesta specifica, mai alzarlo. "bookable" degrada sempre a "range" a runtime finche'' la prenotazione diretta resta rotta in produzione (C16) — la colonna porta comunque la verita'' dichiarata dal catalogo.';

comment on column public.subservices.quote_fields is
  'Le domande strutturate per questo sotto-servizio (spec §3): array jsonb, stessa forma di booking_fields ma colonna separata apposta — booking_fields e'' della prenotazione diretta (rotta, mig 028) e non va confuso con questo. Limite editoriale: max sei campi, max tre required (non impostato come vincolo qui, e'' una regola per chi scrive il contenuto).';

alter table public.requests
  add column if not exists scope jsonb not null default '{}'::jsonb,
  add column if not exists quote_mode text
    check (quote_mode in ('bookable', 'range', 'assisted', 'survey', 'dispatch'));

comment on column public.requests.scope is
  'Le risposte del cliente alle domande di quote_fields del sotto-servizio scelto, chiave per chiave. Scritto da Bob (Fase 3) o dalla scheda lavoro (Fase 4); le chiavi vanno validate contro quote_fields del subservice PRIMA di scrivere qui — questa migrazione non lo impone, lo impone il codice applicativo a valle. Eredita le policy RLS gia'' esistenti su requests: nessuna colonna qui e'' piu'' esposta di quanto lo sia gia'' la riga.';

comment on column public.requests.quote_mode is
  'Il verdetto del risolutore per QUESTA richiesta (src/lib/quoting.ts, Fase 2): puo'' scendere rispetto al quote_level di default del sotto-servizio, mai salire, e puo'' diventare ''dispatch'' quando il pre-check emergenza scatta (red_flags o urgency=emergenza) — un valore che quote_level non ha, perche'' un''emergenza non e'' un livello del catalogo mai un bypass.';

create index if not exists requests_quote_mode_idx
  on public.requests (quote_mode, created_at desc);

commit;
