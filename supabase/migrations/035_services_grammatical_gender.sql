-- 035: genere e numero grammaticale sui servizi.
--
-- PERCHÉ
-- In sette punti dell'app il nome del servizio veniva incollato dopo un "un"
-- scritto a mano: `ho bisogno di un ${service.name.toLowerCase()}`. Funziona
-- solo per i nove servizi che sono nomi di mestiere maschili singolari. Sui
-- restanti sei produce italiano sbagliato — "un pulizie", "un ripetizioni",
-- "un traslochi", "un sviluppo web" — e finisce nei messaggi precompilati che
-- il cliente manda al professionista e nella pagina /servizi/[slug].
-- La stessa mancanza di concordanza colpisce gli aggettivi: "trovi pulizie
-- verificati" invece di "verificate".
--
-- L'articolo non è derivabile dal nome: "Pulizie" e "Traslochi" sono entrambi
-- plurali ma di genere diverso, e nessuna euristica sul suffisso lo indovina in
-- modo affidabile. Serve un dato, e il posto giusto è la tabella, non una mappa
-- in TypeScript che si scorda i servizi aggiunti dall'area admin.
--
-- COLONNE
-- gender / is_plural  → concordanza di articoli e aggettivi.
-- takes_article       → falso per i nomi di categoria non numerabili
--                       ("Grafica e Logo", "Musica e intrattenimento"): con
--                       qualsiasi articolo suonano sbagliati, meglio ometterlo.
--                       Il codice in src/lib/italian.ts rispetta questo flag.
--
-- I default (maschile, singolare, con articolo) riproducono il comportamento
-- attuale, quindi un servizio inserito senza compilare i campi non peggiora
-- nulla rispetto a oggi.
--
-- Nessun dato personale: tabella di catalogo, pubblica in lettura.
-- Idempotente: add column if not exists + drop/recreate del constraint.

alter table public.services
  add column if not exists gender        text    not null default 'm',
  add column if not exists is_plural     boolean not null default false,
  add column if not exists takes_article boolean not null default true;

alter table public.services drop constraint if exists services_gender_check;
alter table public.services
  add constraint services_gender_check check (gender in ('m', 'f'));

comment on column public.services.gender is
  'Genere grammaticale del nome ("m"/"f"): concordanza di articolo e aggettivi. Vedi src/lib/italian.ts.';
comment on column public.services.is_plural is
  'Il nome è un plurale (Pulizie, Ripetizioni, Traslochi): l''articolo diventa partitivo.';
comment on column public.services.takes_article is
  'False per i nomi di categoria non numerabili: il codice omette l''articolo.';

-- Backfill dei 15 servizi in catalogo. Per slug, così è rieseguibile e non
-- dipende dagli id generati.
update public.services set gender = 'm', is_plural = false, takes_article = true
 where slug in ('elettricista', 'fotografo', 'giardiniere', 'idraulico',
                'imbianchino', 'personal-trainer', 'serramentista',
                'supporto-informatico', 'sviluppo-web', 'tuttofare');

-- Plurali. "delle pulizie", "delle ripetizioni", "dei traslochi".
update public.services set gender = 'f', is_plural = true, takes_article = true
 where slug in ('pulizie', 'ripetizioni');

update public.services set gender = 'm', is_plural = true, takes_article = true
 where slug = 'traslochi';

-- Categorie non numerabili: "cercavi grafica e logo", senza articolo.
update public.services set gender = 'f', is_plural = false, takes_article = false
 where slug in ('grafica-logo', 'musica-intrattenimento');
