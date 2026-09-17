-- 081_subservizi_deduplicazione.sql
--
-- Il catalogo dei cinque servizi core porta sei sotto-servizi legacy,
-- doppioni di altrettanti canonici, sopravvissuti alla 013/014 perche' i
-- profili professionista potevano gia' puntarci. Verificato in produzione il
-- 16-17 settembre 2026, non a memoria — e rivisto il 17 settembre dopo che
-- una lettura riga per riga delle collisioni reali ha corretto due mappature:
--
--   idraulico     riparazione-perdite        -> perdita-rubinetto-sifone (+ perdita-tubatura-infiltrazione)
--   elettricista  prese-e-interruttori       -> presa-interruttore
--   elettricista  messa-a-norma              -> messa-a-norma-certificazione
--   imbianchino   imbiancatura-camere        -> tinteggiatura-interni
--   pulizie       pulizie-appartamenti       -> ordinarie-ricorrenti (+ profonda-una-tantum)
--   pulizie       pulizie-uffici-piccoli     -> uffici-negozi
--
-- SOSTITUZIONE-RUBINETTERIA NON E' UN DOPPIONE. Sostituire un rubinetto che
-- funziona e' un lavoro preventivabile a se', non una riparazione di perdita
-- ne' un intervento su WC e sanitari. Resta un sotto-servizio canonico per
-- conto suo: non compare piu' in nessuna mappa qui sotto.
--
-- PULIZIE-APPARTAMENTI -> ORDINARIE-RICORRENTI, non profonda-una-tantum. La
-- prima stesura di questa migrazione aveva letto l'identita' byte-per-byte
-- dei booking_fields come prova a favore di profonda-una-tantum: era un
-- artefatto della semina dati (le due righe erano state clonate dalla stessa
-- fonte), non un indizio sul lavoro. Il legacy divide per TIPO DI IMMOBILE
-- (appartamenti / uffici piccoli), il canonico divide per TIPO DI LAVORO
-- (ricorrente / una tantum) — due assi diversi. "Pulizie appartamenti" a
-- 20 EUR/ora con un minimo di 2 ore e' pulizia domestica ordinaria: il
-- bersaglio primario e' ordinarie-ricorrenti.
--
-- Due legacy si dividono ancora su due canonici: nessuna riga del genere
-- porta un indizio nei dati (booking_fields vuoti su idraulico/imbianchino)
-- per decidere quale intendesse il professionista, quindi il bersaglio
-- "primario" sotto e' una scelta editoriale dove non c'e' una prova come
-- quella di pulizie-appartamenti.
--
-- NON SI CANCELLA NIENTE, e qui non serve nemmeno stare troppo sul chi va
-- avvisato: le sei righe professional_services toccate da questa migrazione
-- appartengono tutte ai cinque professionisti demo seminati il 2 giugno
-- (b1000000-...), non a professionisti veri. FOTOPRO-MILANO, l'unico
-- professionista reale in produzione al 17 settembre 2026, non ne ha
-- nessuna. Bassa posta in gioco oggi; la cautela sotto resta comunque la
-- regola giusta per quando smettera' di esserlo.
--
-- PREZZO: MAI INVENTATO. Dove il professionista ha gia' una riga vuota sul
-- canonico, il prezzo legacy vi si trasferisce (e' la sua stessa dichiarazione,
-- solo riallineata). Dove il canonico ha GIA' un prezzo diverso, nessuna delle
-- due righe viene toccata: finisce in subservice_migration_review, una coda
-- che al prossimo accesso chiede conferma al professionista invece di
-- scegliere per lui. Stessa cautela per il secondo bersaglio dei due legacy
-- che si dividono in due: mai un prezzo copiato li', solo una riga di
-- conferma se il professionista non offre gia' quel servizio a parte.
-- Espandere professionals.subservice_slugs a entrambi i canonici e' invece
-- sicuro e reversibile: dichiarare una capacita' non e' dichiarare un prezzo.
--
-- SUBSERVICE_MIGRATION_REVIEW E' UNA RETE DI SICUREZZA, NON UNA FEATURE. La
-- deduplicazione gira una volta sola; da qui in avanti un professionista
-- nuovo puo' scegliere solo slug canonici (i punti di lettura sono gia'
-- filtrati, vedi sotto), quindi su dati reali questa coda non si popolera'
-- mai piu' dopo questa migrazione. Nessuna fase successiva deve costruirci
-- sopra un'interfaccia per il professionista: resta un tavolo per lo staff.
--
-- LETTURA: ogni punto che elenca sotto-servizi attivi deve escludere le righe
-- con superseded_by valorizzato, o usare public.canonical_subservice_id() per
-- risolvere un id legacy incontrato altrove (es. in una request vecchia). I
-- file applicativi sono nella stessa PR di questa migrazione.
--
-- Idempotente: add column if not exists, create table if not exists,
-- drop-then-create di policy, backfill con guardia (not exists / is distinct
-- from / contenimento d'array), le update sui prezzi rileggono da zero a ogni
-- corsa e quindi non trovano piu' niente da riempire la seconda volta.

begin;

-- ---------------------------------------------------------------------------
-- 1) La colonna che segna chi e' stato sostituito
-- ---------------------------------------------------------------------------
alter table public.subservices
  add column if not exists superseded_by uuid references public.subservices(id);

comment on column public.subservices.superseded_by is
  'Valorizzata solo sulle righe legacy: punta al sotto-servizio canonico che le sostituisce (081). Le righe non si cancellano perche'' professional_services e professionals.subservice_slugs possono ancora referenziarle. Ogni punto che elenca sotto-servizi selezionabili deve leggere "where superseded_by is null"; per risolvere un id incontrato altrove vedi canonical_subservice_id().';

create index if not exists subservices_superseded_by_idx
  on public.subservices (superseded_by)
  where superseded_by is not null;

create or replace function public.canonical_subservice_id(p_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(s.superseded_by, s.id)
  from public.subservices s
  where s.id = p_id;
$$;

comment on function public.canonical_subservice_id(uuid) is
  'Risolve un id di sotto-servizio al suo canonico: se p_id e'' legacy torna superseded_by, altrimenti torna p_id stesso. Un solo salto: la 081 non crea catene.';

with mapping (legacy_slug, canonical_slug) as (
  values
    ('riparazione-perdite', 'perdita-rubinetto-sifone'),
    ('prese-e-interruttori', 'presa-interruttore'),
    ('messa-a-norma', 'messa-a-norma-certificazione'),
    ('imbiancatura-camere', 'tinteggiatura-interni'),
    ('pulizie-appartamenti', 'ordinarie-ricorrenti'),
    ('pulizie-uffici-piccoli', 'uffici-negozi')
)
update public.subservices legacy
   set superseded_by = canon.id
  from mapping m
  join public.subservices canon on canon.slug = m.canonical_slug
 where legacy.slug = m.legacy_slug
   and legacy.superseded_by is distinct from canon.id;

-- ---------------------------------------------------------------------------
-- 2) La coda "conferma il tuo prezzo" — mai un prezzo scritto senza prova
-- ---------------------------------------------------------------------------
create table if not exists public.subservice_migration_review (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  legacy_subservice_id uuid not null references public.subservices(id),
  suggested_subservice_id uuid not null references public.subservices(id),
  reason text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.subservice_migration_review is
  'Rete di sicurezza della deduplicazione 081, non una coda pensata per durare: gira una volta, e da qui in avanti un professionista nuovo puo'' scegliere solo slug canonici, quindi su dati reali non si ripopola. Nessuna interfaccia professionista va costruita sopra — resta un tavolo per lo staff. Conservazione: cancellata riga per riga quando risolta (percorso applicativo, non automatico); mai oltre la disattivazione del professionista (on delete cascade).';

create index if not exists subservice_migration_review_pro_idx
  on public.subservice_migration_review (professional_id)
  where resolved_at is null;

alter table public.subservice_migration_review enable row level security;

drop policy if exists "Pro legge la propria coda di revisione" on public.subservice_migration_review;
create policy "Pro legge la propria coda di revisione"
  on public.subservice_migration_review for select
  using (professional_id in (select private.my_professional_ids()));

drop policy if exists "Pro risolve la propria coda di revisione" on public.subservice_migration_review;
create policy "Pro risolve la propria coda di revisione"
  on public.subservice_migration_review for update
  using (professional_id in (select private.my_professional_ids()))
  with check (professional_id in (select private.my_professional_ids()));

drop policy if exists "Staff legge tutta la coda di revisione" on public.subservice_migration_review;
create policy "Staff legge tutta la coda di revisione"
  on public.subservice_migration_review for select
  using (private.is_admin_or_cs());

-- ---------------------------------------------------------------------------
-- 3) Il listino vero: sposta, non inventa
-- ---------------------------------------------------------------------------
-- 3a) Nessuna collisione: il professionista non ha gia' una riga sul canonico,
--     quindi la riga legacy si sposta di sana pianta, prezzo compreso. Dopo la
--     prima corsa lo slug legacy non compare piu' in questo join: idempotente.
with mapping (legacy_slug, canonical_slug) as (
  values
    ('riparazione-perdite', 'perdita-rubinetto-sifone'),
    ('prese-e-interruttori', 'presa-interruttore'),
    ('messa-a-norma', 'messa-a-norma-certificazione'),
    ('imbiancatura-camere', 'tinteggiatura-interni'),
    ('pulizie-appartamenti', 'ordinarie-ricorrenti'),
    ('pulizie-uffici-piccoli', 'uffici-negozi')
),
legacy_rows as (
  select ps.id as row_id, ps.professional_id, canon.id as canonical_id
  from public.professional_services ps
  join public.subservices leg on leg.id = ps.subservice_id
  join mapping m on m.legacy_slug = leg.slug
  join public.subservices canon on canon.slug = m.canonical_slug
)
update public.professional_services ps
   set subservice_id = lr.canonical_id
  from legacy_rows lr
 where ps.id = lr.row_id
   and not exists (
     select 1 from public.professional_services other
      where other.professional_id = lr.professional_id
        and other.subservice_id = lr.canonical_id
   );

-- 3b) Collisione: il professionista ha gia' una riga sul canonico. Se quella
--     riga e' vuota di prezzo, il prezzo legacy la riempie (e' la stessa
--     dichiarazione, solo spostata). Se ha gia' un prezzo DIVERSO, nessuna
--     riga si tocca e la coppia finisce nella coda di revisione. Le due CTE
--     leggono la stessa fotografia di "collision", presa una sola volta
--     all'inizio dell'istruzione: l'update di 3b non altera cio' che l'insert
--     finale vede, quindi non si auto-inganna sulle righe appena riempite.
--
--     "target_is_empty" da solo NON basta a decidere se rieseguire e' un
--     no-op: dopo il primo riempimento il canonico non e' piu' vuoto, e una
--     seconda corsa lo avrebbe scambiato per un conflitto nuovo, duplicando
--     la riga di revisione. La domanda giusta e' se il prezzo del canonico
--     COINCIDE con quello del legacy — vero sia quando non c'era nessun
--     prezzo (dopo il riempimento) sia quando i due dichiaravano la stessa
--     cosa per conto loro — non se la riga "era vuota".
with mapping (legacy_slug, canonical_slug) as (
  values
    ('riparazione-perdite', 'perdita-rubinetto-sifone'),
    ('pulizie-appartamenti', 'ordinarie-ricorrenti')
),
collision as (
  select
    ps.professional_id,
    leg.id as legacy_id,
    canon.id as canonical_id,
    tgt.id as target_row_id,
    ps.min_price as l_min, ps.max_price as l_max, ps.rate_amount as l_rate,
    ps.rate_unit as l_unit, ps.instant_book_enabled as l_instant,
    (tgt.min_price is null and tgt.max_price is null and tgt.rate_amount is null) as target_is_empty,
    (tgt.min_price is not distinct from ps.min_price
     and tgt.max_price is not distinct from ps.max_price
     and tgt.rate_amount is not distinct from ps.rate_amount) as prices_match
  from public.professional_services ps
  join public.subservices leg on leg.id = ps.subservice_id
  join mapping m on m.legacy_slug = leg.slug
  join public.subservices canon on canon.slug = m.canonical_slug
  join public.professional_services tgt
    on tgt.professional_id = ps.professional_id
   and tgt.subservice_id = canon.id
  where coalesce(ps.min_price, ps.max_price, ps.rate_amount) is not null
),
filled as (
  update public.professional_services tgt
     set min_price = c.l_min,
         max_price = c.l_max,
         rate_amount = c.l_rate,
         rate_unit = coalesce(c.l_unit, tgt.rate_unit),
         instant_book_enabled = tgt.instant_book_enabled or c.l_instant
    from collision c
   where tgt.id = c.target_row_id
     and c.target_is_empty
  returning tgt.id
)
insert into public.subservice_migration_review
  (professional_id, legacy_subservice_id, suggested_subservice_id, reason)
select c.professional_id, c.legacy_id, c.canonical_id,
  'Prezzo dichiarato su entrambe le righe dopo la fusione dei sotto-servizi: nessuna delle due e'' stata sovrascritta, conferma quale vale.'
from collision c
where not c.target_is_empty
  and not c.prices_match
  and not exists (
    select 1 from public.subservice_migration_review r
     where r.professional_id = c.professional_id
       and r.legacy_subservice_id = c.legacy_id
       and r.suggested_subservice_id = c.canonical_id
       and r.resolved_at is null
  );

-- 3c) Il secondo bersaglio dei due legacy che si dividono in due: mai un
--     prezzo copiato li'. Solo una riga di conferma, e solo se il
--     professionista non offre gia' quel servizio per conto suo.
with secondary_mapping (legacy_slug, secondary_slug) as (
  values
    ('riparazione-perdite', 'perdita-tubatura-infiltrazione'),
    ('pulizie-appartamenti', 'profonda-una-tantum')
),
gaps as (
  select distinct
    ps.professional_id,
    leg.id as legacy_id,
    sec.id as secondary_id
  from public.professional_services ps
  join public.subservices leg on leg.id = ps.subservice_id
  join secondary_mapping m on m.legacy_slug = leg.slug
  join public.subservices sec on sec.slug = m.secondary_slug
  where not exists (
    select 1 from public.professional_services other
     where other.professional_id = ps.professional_id
       and other.subservice_id = sec.id
  )
)
insert into public.subservice_migration_review
  (professional_id, legacy_subservice_id, suggested_subservice_id, reason)
select g.professional_id, g.legacy_id, g.secondary_id,
  'Il catalogo divide questo sotto-servizio legacy in due: hai gia'' un prezzo per l''altra meta'', manca questa. Confermala se la offri davvero, cosi'' compare nelle ricerche giuste.'
from gaps g
where not exists (
  select 1 from public.subservice_migration_review r
   where r.professional_id = g.professional_id
     and r.legacy_subservice_id = g.legacy_id
     and r.suggested_subservice_id = g.secondary_id
     and r.resolved_at is null
);

-- ---------------------------------------------------------------------------
-- 4) Cosa dichiara di saper fare: espandere e' reversibile, non e' un prezzo
-- ---------------------------------------------------------------------------
with mapping (legacy_slug, canonical_slug) as (
  values
    ('riparazione-perdite', 'perdita-rubinetto-sifone'),
    ('riparazione-perdite', 'perdita-tubatura-infiltrazione'),
    ('prese-e-interruttori', 'presa-interruttore'),
    ('messa-a-norma', 'messa-a-norma-certificazione'),
    ('imbiancatura-camere', 'tinteggiatura-interni'),
    ('pulizie-appartamenti', 'ordinarie-ricorrenti'),
    ('pulizie-appartamenti', 'profonda-una-tantum'),
    ('pulizie-uffici-piccoli', 'uffici-negozi')
),
additions as (
  select p.id as professional_id,
         array_agg(distinct m.canonical_slug) as add_slugs
  from public.professionals p
  join mapping m on m.legacy_slug = any(p.subservice_slugs)
  group by p.id
)
update public.professionals p
   set subservice_slugs = (
     select array_agg(distinct s)
     from unnest(p.subservice_slugs || a.add_slugs) as s
   )
  from additions a
 where a.professional_id = p.id
   and not (a.add_slugs <@ p.subservice_slugs);

-- ---------------------------------------------------------------------------
-- 5) requests.subservice_id — difensivo: oggi 0/10 righe puntano a un legacy,
--    ma una richiesta storica non si puo' dividere su due canonici, quindi
--    usa solo il bersaglio primario.
-- ---------------------------------------------------------------------------
with mapping (legacy_slug, canonical_slug) as (
  values
    ('riparazione-perdite', 'perdita-rubinetto-sifone'),
    ('prese-e-interruttori', 'presa-interruttore'),
    ('messa-a-norma', 'messa-a-norma-certificazione'),
    ('imbiancatura-camere', 'tinteggiatura-interni'),
    ('pulizie-appartamenti', 'ordinarie-ricorrenti'),
    ('pulizie-uffici-piccoli', 'uffici-negozi')
)
update public.requests r
   set subservice_id = canon.id
  from public.subservices leg
  join mapping m on m.legacy_slug = leg.slug
  join public.subservices canon on canon.slug = m.canonical_slug
 where r.subservice_id = leg.id;

commit;
