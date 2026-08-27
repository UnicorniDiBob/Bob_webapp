# Check-in del primo ingresso del professionista — specifica

_Proposta del 27/08/2026 · traccia Internal (Lucio) · da ratificare prima di scrivere codice_

---

## 0. In una riga

Il check-in smette di essere un questionario e diventa il **setup**: ogni domanda
scrive un campo che decide se il professionista è **trovabile** e **contattabile**,
e al termine esiste uno stato dichiarato — *pronto a ricevere richieste* — che oggi
non esiste in nessuna colonna.

---

## 1. Il problema, con le prove

Verificato il 27/08/2026 su `origin/main` e sulla produzione (`bijgitnulucdzluqjxrx`).

| Fatto | Prova |
| --- | --- |
| Chi finisce l'onboarding di oggi è **invisibile in ogni ricerca** | `getProfessionals()` (`src/lib/data.ts:223`) costruisce la card dal primo record di `professional_services` e filtra per servizio su quello. Il questionario (`src/app/onboarding/profilo/page.tsx`) scrive `onboarding_answers` e crea `professionals` con solo `city_id` e `years_experience`: nessuna riga di servizio, quindi `serviceSlug` nullo e pro escluso da ogni filtro |
| Mestiere, città e anzianità si chiedono **due volte** | una nel questionario, una in `/impostazioni/azienda`, dove vive il dato che conta |
| «Zona o quartiere» è testo libero che **nessuna query legge** | `onboarding_answers.zone` |
| La strada della zona **non è mai stata percorsa** | 9 richieste in produzione, `requests.zone_slug` NULL su 9/9; `request_addresses` 0 righe (ha già `coarse_lat`/`coarse_lng`/`coarse_radius_m`) |
| Il primissimo ostacolo non è una domanda: è la **conferma email** | signup con attesa e polling (`src/app/login/page.tsx:370-408`); le mail escono dal mailer interno di Supabase, 2 all'ora per tutto il progetto |
| 4 professionisti su 5 non hanno **nessun orario**, nessuno ha telefono | query su `professional_availability` e `profile_phone` |
| Il titolo promette «Due domande e ci siamo», poi ne fa cinque | `src/app/onboarding/profilo/page.tsx` |

---

## 2. I quattro principi

1. **Ogni domanda ha una destinazione.** Se una risposta non scrive un campo che
   il prodotto usa, non è una domanda del check-in: è un sondaggio, e va dopo il
   traguardo.
2. **L'unità di misura appartiene al lavoro, non al professionista.** La dichiara
   il catalogo (`subservices.default_rate_unit`), il pro riempie solo il numero.
   Una domanda in meno, e prezzi confrontabili fra pro — che è ciò che serve al
   confronto preventivi.
3. **La chiave del match resta discreta.** Qualunque cosa il pro disegni, la
   riduciamo sempre a un **insieme di slug di zona**: la stessa chiave che la
   richiesta del cliente già porta (`requests.zone_slug`). Il disegno è
   presentazione e intenzione; il match è un confronto fra due elenchi.
4. **Il nudge spinge, non costringe.** Default intelligenti, precompilazioni da
   togliere, conseguenze dichiarate. Mai prova sociale inventata, mai un piano a
   pagamento preselezionato, mai un campo finto-obbligatorio.

---

## 3. Il percorso

```
iscrizione → conferma email → [1] piano → [2] mestiere e sottoservizi
   → [3] dove lavori → [4] quanto costi → [5] come ti presenti
   → «pronto a ricevere richieste» + checklist di ciò che manca
```

Barra di avanzamento sempre visibile («passo 3 di 5»), **«salta per ora»** sempre
disponibile, e al termine una **checklist persistente** in dashboard con quel che
manca: è lo stesso oggetto dello stato *pronto*, visto dal lato del pro.

---

## 4. Le domande

| # | Domanda | Dove finisce | Obbligo | Tecnica |
| --- | --- | --- | --- | --- |
| 1 | Piano (già esistente) | `promo_redemptions`, `subscription_tier` | sì | nessun default preselezionato |
| 2 | «Che lavoro fai?» → «Quali di questi fai?» (sottoservizi) | `professional_services`, `professionals.subservice_slugs` | sì | le 3-4 sottocategorie più comuni **già spuntate**, da togliere |
| 3 | «Dove lavori?» città → zona → disegno (§5) | `professional_coverage`, `professional_areas_public` | sì | default: la zona scelta + raggio 5 km |
| 4 | «Quanto chiedi?» nell'unità del mestiere (§6) | `professional_services.rate_amount/rate_unit/min_units` | no, con conseguenza dichiarata | l'unità è già decisa dal catalogo; framing «forbice indicativa, non un impegno» |
| 4b | Costi accessori: uscita, sopralluogo, materiali, IVA (§6) | colonne nuove su `professionals` | no | struttura uguale per tutti, non testo libero |
| 5 | «Ti presento così, va bene?» | `professionals.headline/bio` | no | **bozza precompilata** da mestiere + anni + città, modificabile |
| 6 | «Da quanti anni?» | `professionals.years_experience` | no | un tap; «preferisco non dirlo» resta un'opzione vera |
| 7 | Telefono (§7) | `profile_phone` | sì se accende la prenotazione diretta | rassicurazione nel punto della domanda |
| 8 | Orari | `professional_availability` | solo se `subservices.instant_book_eligible` e piano a pagamento | default lun-ven 9-18 da correggere |
| 9 | P.IVA | `professional_verification` | solo piani a pagamento | mostrare cosa sblocca nel momento della domanda |
| 10 | «Come ci hai conosciuto?» | `onboarding_answers.heard_from` | no | **dopo** lo «hai finito», non prima |

---

## 5. Dove lavori: città → zona → disegno

Sistema misto, come richiesto: **si scegle la città, poi la zona, poi si disegna**.
Tre modi per la stessa cosa, un solo dato in uscita.

### 5.1 I tre modi

| Modo | Come si usa | Per chi |
| --- | --- | --- |
| `zones` | caselle sulle zone della città | chi lavora «in centro e Isola», e chi è da telefono |
| `circle` | un centro (la zona scelta, trascinabile) + **slider del raggio** | il caso normale: «giro entro 5 km da qui» |
| `polygon` | disegno a mano libera | v2, solo desktop: aree strane (una direttrice, un comune confinante) |

Il cerchio non è geometria libera: è **uno strumento di disegno sopra una griglia
che già possediamo**. `src/lib/zones.ts` contiene le 28 zone di Milano con
coordinate vere, generate dal dataset NIL ufficiale del Comune (CC-BY) da
`scripts/build_milano_zones.py`, e la distanza in linea d'aria è già implementata.

### 5.2 Il modello dati

Due tabelle, per una ragione di riservatezza: **il centro del cerchio può essere
casa sua**. Quindi la geometria non è pubblica, l'elenco delle zone sì.

- `professional_coverage` — una riga per (professionista, città). Contiene `mode`,
  `zone_slugs`, `center_lat`/`center_lng`/`radius_m`, `area_geojson`.
  **Lettura: solo il proprietario e lo staff.**
- `professional_areas_public` — (professionista, città, `zone_slugs`).
  **Lettura pubblica**, nessuna policy di scrittura: la riempie solo un trigger
  `security definer`. È la tabella che leggono elenco e matching.
- `city_zones` — le zone in database (prima erano solo in un file TypeScript),
  perché le nuove città devono poter entrare senza un deploy e perché il calcolo
  «quali zone cadono nel cerchio» va fatto lato server.

Una riga per città significa che **un pro può coprire Milano e Monza** con due
disegni diversi: è il motivo per cui la città è il primo passo e non un campo
singolo su `professionals`.

### 5.3 Come si calcola il match

1. Il pro disegna. Il trigger calcola l'insieme delle zone i cui centroidi cadono
   nel cerchio (haversine in SQL su `city_zones`: sono decine di righe, non serve
   PostGIS) e lo scrive in `zone_slugs`.
2. Il secondo trigger copia solo `zone_slugs` nella tabella pubblica.
3. Il match è `richiesta.zone_slug = ANY(pro.zone_slugs)` con indice GIN.
   Nessuna coordinata del cliente entra mai nel calcolo.

Per il modo `polygon` il punto-in-poligono lo calcola il client (Turf.js) e manda
l'elenco; il server ricalcola da sé solo i cerchi. Quando arriverà il geocoder
(roadmap 40.0, marzo 2027) si potrà installare **PostGIS 3.3.7** — già
disponibile sul progetto, non installato — e passare a `ST_DWithin` senza toccare
questo modello.

### 5.4 La mappa: quale fornitore

Le **tile non sono geocoding**: escono l'IP del pro e la porzione che guarda, mai
un dato del cliente. Due strade, stesso codice:

- **MapLibre GL** (licenza BSD, nessun lock-in) **+ un nostro file PMTiles** di
  Milano in un bucket Supabase: **nessun responsabile del trattamento**, zero
  euro, nessuna riga nuova nel registro fornitori. Da verificare il tetto di
  banda del piano Free. **È la strada che consiglio.**
- MapLibre + tile da **MapTiler** o **Geoapify** (UE, con DPA): meno lavoro
  iniziale, ma è un fornitore nuovo → DPA art. 28, riga RoPA, informativa
  aggiornata (DATA_COMPLIANCE §8).

**Google Maps no**, per la v1: responsabile USA, chiave e fatturazione attive,
script e cookie propri che indeboliscono la scelta di non avere il banner — e in
cambio nulla, perché il disegno avviene sopra una griglia nostra.

### 5.5 Nuove città

`city_zones` si popola con lo stesso schema del generatore di Milano, da dati
aperti: Roma 155 zone urbanistiche, Torino 94 quartieri. Finché una città non ha
zone, il modo `zones` mostra un'unica voce «tutta la città» e il cerchio è
disattivato: nessuna città resta bloccata dall'assenza dei dati.

### 5.6 Il confine con il lato cliente

`src/lib/zones.ts` **resta dov'è** e continua a servire il percorso del cliente:
è area di André, e va cambiata in un suo PR. Gli slug in `city_zones` sono
identici a quelli del file (stessa fonte, stesso generatore), quindi il match
funziona attraverso i due lati. Il rischio è avere due elenchi della stessa cosa:
si contiene facendo emettere al generatore **sia** il file **sia** il seed SQL, e
aggiungendo a `scripts/schema_check.sh` un confronto fra i due.

**Dipendenza bloccante, non nostra:** oggi `requests.zone_slug` è NULL su 9
richieste su 9. Il pro può disegnare quanto vuole, se il percorso del cliente non
scrive la zona non gli cadrà dentro niente. Va acceso prima, o insieme.

---

## 6. Quanto costi: unità e costi accessori

Metà c'è già: `RateUnit` in `src/lib/supabase/types.ts` è `hour | m2 | job |
session`, e `subservices.default_rate_unit` esiste (nel seed: `hour`, `session`).

**Vocabolario da estendere** — un solo tipo TypeScript più due vincoli CHECK:

`hour` (ora) · `day` (giornata) · `half_day` (mezza giornata) · `event` (evento) ·
`job` (intervento) · `session` (seduta) · `m2` (metro quadro) · `linear_m` (metro
lineare) · `point` (punto luce/presa) · `piece` (pezzo) · `quote` (solo a preventivo)

Il fotografo vede «a evento», l'imbianchino «a metro quadro», l'idraulico «a
intervento»: non lo scelgono loro, lo dice il catalogo.

**Costi accessori**, struttura uguale per tutti — e sono esattamente le righe del
preventivo strutturato, quindi si definiscono una volta sola:

| Campo | Perché |
| --- | --- |
| `callout_fee` + `callout_fee_deducted` | il diritto di uscita esiste e oggi non ha posto; e va detto se viene scalato dal lavoro |
| `survey_free` + `survey_fee` | il sopralluogo è il momento in cui la forbice diventa prezzo |
| `min_billable_units` | «minimo un'ora» è la sorpresa più frequente in fattura |
| `materials_included` | cambia il totale più di ogni altra voce |
| `vat_regime` (`22` / `10` / `forfettario`) | un forfettario non addebita IVA: senza questo campo il totale mostrato è sbagliato |

Resta la regola di progetto: **prima del sopralluogo è sempre una forbice, mai un
prezzo.**

---

## 7. Telefono

Si raccoglie, ma cambia il perché — e quindi la copy: **«non lo vede il cliente:
serve per farti arrivare le chiamate»**.

Serve perché una chiamata mascherata deve comunque atterrare su un numero vero;
perché l'app-to-app fallisce nel caso che conta (cliente senza app, o offline);
come recapito di fallback e per i mancati appuntamenti; e perché l'email di
conferma oggi promette il numero del pro.

Smette di essere disclosure progressiva di un contatto e diventa **dato di
instradamento**: riga RoPA diversa. Se le chiamate passano da un ponte, arriva un
responsabile nuovo (DPA, UE), più i metadati di chiamata — chi, quando, quanto —
con la loro retention, e il divieto di registrare senza informare. Tocca i criteri
DPIA: **decisione scritta prima del codice.**

---

## 8. Nomi dei livelli di verifica

Ripresi dai documenti di progetto, dove sono già scritti
(`docs/NOTE_E_DECISIONI.md:112-117`, `docs/VERIFICA_ANALISI_LEGALE.md:87-93`):

| Valore tecnico (DB, invariato) | Etichetta di oggi | **Etichetta dai documenti** |
| --- | --- | --- |
| `none` | Iscritto | **Iscritto** |
| `vat_verified` | Pro | **P.IVA verificata** |
| `documents_verified` | Pro+ | **Verificato Bob** |

**È un cambio di sola copia: nessuna migrazione.** I nomi vivono in un posto solo,
`VERIFICATION_LABEL` in `src/lib/vat.ts:17-21`, più una riga in `src/lib/piani.ts:45`,
due stringhe in admin e la pagina `/per-i-professionisti`.

Vincolo dai documenti legali, da rispettare nella UI: «Verificato Bob» va
presentato come **«documenti verificati il GG/MM/AAAA»**, mai come «professionista
garantito» o «di fiducia» (`VERIFICA_ANALISI_LEGALE.md:93`). `VERIFICATION_MEANING`
e `VERIFICATION_CAVEAT` in `vat.ts` già dicono la cosa giusta e non si toccano; e
`verification_level_at` fornisce la data. Lo stesso nome deve comparire nei ToS
professionisti §3.2 e nella pagina pubblica del badge (art. 5 P2B).

---

## 9. Conformità (DATA_COMPLIANCE §2, §5, §8)

| Voce | Determinazione |
| --- | --- |
| Base giuridica | Art. 6(1)(b) contratto: senza mestiere, zona e tariffa il servizio non può proporre il professionista a nessuno. `heard_from` resta legittimo interesse, facoltativo |
| Dati personali | Sì, per le ditte individuali: zona di lavoro e tariffe sono dati sulla persona. Sono anche ciò che il pro pubblica per lavorare: `zone_slugs` è pubblico, **la geometria non lo è** |
| Perché la geometria è privata | Il centro del cerchio può essere l'abitazione del professionista. Pubblicare centro e raggio pubblicherebbe casa sua |
| Righe RoPA | *Area di lavoro del professionista* (nuova); *Tariffe e costi accessori* (estende A15); *Recapito telefonico per instradamento* quando arriva la chiamata in app |
| Retention | Vita del profilo; cancellati a cascata con l'account, come `professional_services` |
| Nuovo fornitore | **Nessuno**, se le tile sono PMTiles nostre. Con MapTiler/Geoapify: DPA, informativa, riga fornitori |
| DPIA | Non innescata: nessun monitoraggio sistematico, nessuna decisione automatizzata. La chiamata in app va rivalutata a parte |
| Advisor | Da rieseguire dopo la migrazione: RLS su tutte le tabelle nuove, `search_path` fissato sulle funzioni nuove, nessuna vista SECURITY DEFINER (per questo la tabella pubblica è una tabella e non una vista) |

---

## 10. Migrazione 057 (proposta)

Prossimo numero libero: **057** (in repo e in produzione si arriva a 056).
Idempotente: `if not exists`, drop-then-create per policy e trigger.

```sql
-- 057: check-in del primo ingresso — zone servite, unità di misura, costi accessori.

-- 1) Le zone delle città, in database (prima solo in src/lib/zones.ts).
create table if not exists public.city_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  slug text not null,
  label text not null,
  lat double precision,
  lng double precision,
  source text,                       -- es. 'NIL Comune di Milano (CC-BY)'
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);
alter table public.city_zones enable row level security;

drop policy if exists "Anyone reads city zones" on public.city_zones;
create policy "Anyone reads city zones" on public.city_zones
  for select using (true);

drop policy if exists "Staff manages city zones" on public.city_zones;
create policy "Staff manages city zones" on public.city_zones
  for all using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

-- 2) L'area di lavoro: il disegno. Privata.
create table if not exists public.professional_coverage (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  mode text not null default 'zones' check (mode in ('zones', 'circle', 'polygon')),
  zone_slugs text[] not null default '{}',
  center_lat double precision,
  center_lng double precision,
  radius_m integer check (radius_m is null or (radius_m between 250 and 60000)),
  area_geojson jsonb,
  updated_at timestamptz not null default now(),
  primary key (professional_id, city_id)
);
alter table public.professional_coverage enable row level security;

drop policy if exists "Pro manages own coverage" on public.professional_coverage;
create policy "Pro manages own coverage" on public.professional_coverage
  for all using (professional_id in (select private.my_professional_ids()))
  with check (professional_id in (select private.my_professional_ids()));

drop policy if exists "Staff reads coverage" on public.professional_coverage;
create policy "Staff reads coverage" on public.professional_coverage
  for select using (private.is_admin_or_cs());

-- 3) L'area di lavoro: l'elenco delle zone. Pubblica, sola lettura per tutti.
--    Nessuna policy di scrittura: la riempie solo il trigger qui sotto.
create table if not exists public.professional_areas_public (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  zone_slugs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (professional_id, city_id)
);
alter table public.professional_areas_public enable row level security;

drop policy if exists "Anyone reads pro areas" on public.professional_areas_public;
create policy "Anyone reads pro areas" on public.professional_areas_public
  for select using (true);

create index if not exists professional_areas_public_zones_idx
  on public.professional_areas_public using gin (zone_slugs);

-- 4) Quali zone cadono nel cerchio. Haversine: le zone di una città sono decine.
create or replace function private.zones_in_circle(
  p_city_id uuid, p_lat double precision, p_lng double precision, p_radius_m integer
) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(z.slug order by z.slug), '{}')
  from public.city_zones z
  where z.city_id = p_city_id
    and z.lat is not null and z.lng is not null
    and 6371000 * 2 * asin(sqrt(
          power(sin(radians(z.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(z.lat))
            * power(sin(radians(z.lng - p_lng) / 2), 2)
        )) <= p_radius_m;
$$;

-- 5) Il cerchio si traduce in zone alla scrittura, non alla lettura.
create or replace function public.sync_coverage_zones()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'circle' and new.center_lat is not null
     and new.center_lng is not null and new.radius_m is not null then
    new.zone_slugs := private.zones_in_circle(
      new.city_id, new.center_lat, new.center_lng, new.radius_m);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_coverage_zones on public.professional_coverage;
create trigger sync_coverage_zones
  before insert or update on public.professional_coverage
  for each row execute function public.sync_coverage_zones();

-- 6) Solo l'elenco delle zone diventa pubblico. Mai centro e raggio.
create or replace function public.publish_coverage_zones()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.professional_areas_public
      where professional_id = old.professional_id and city_id = old.city_id;
    return old;
  end if;
  insert into public.professional_areas_public
    (professional_id, city_id, zone_slugs, updated_at)
  values (new.professional_id, new.city_id, new.zone_slugs, now())
  on conflict (professional_id, city_id)
    do update set zone_slugs = excluded.zone_slugs, updated_at = now();
  return new;
end;
$$;

drop trigger if exists publish_coverage_zones on public.professional_coverage;
create trigger publish_coverage_zones
  after insert or update or delete on public.professional_coverage
  for each row execute function public.publish_coverage_zones();

-- 7) Vocabolario delle unità di misura: due vincoli da rifare.
alter table public.professional_services
  drop constraint if exists professional_services_rate_unit_check;
alter table public.professional_services
  add constraint professional_services_rate_unit_check check (
    rate_unit is null or rate_unit in
    ('hour','day','half_day','event','job','session','m2','linear_m','point','piece','quote'));

alter table public.subservices
  drop constraint if exists subservices_default_rate_unit_check;
alter table public.subservices
  add constraint subservices_default_rate_unit_check check (
    default_rate_unit is null or default_rate_unit in
    ('hour','day','half_day','event','job','session','m2','linear_m','point','piece','quote'));

-- 8) Costi accessori: dichiarati una volta dal professionista, pubblici.
alter table public.professionals
  add column if not exists callout_fee numeric check (callout_fee is null or callout_fee >= 0),
  add column if not exists callout_fee_deducted boolean not null default false,
  add column if not exists survey_free boolean not null default true,
  add column if not exists survey_fee numeric check (survey_fee is null or survey_fee >= 0),
  add column if not exists min_billable_units numeric check (min_billable_units is null or min_billable_units > 0),
  add column if not exists materials_included boolean,
  add column if not exists vat_regime text check (vat_regime is null or vat_regime in ('22','10','forfettario'));

-- 9) Seed delle zone di Milano: 28 righe, generate da
--    scripts/build_milano_zones.py (stesse slug di src/lib/zones.ts).
--    insert ... on conflict (city_id, slug) do update set label, lat, lng, source.
```

**Nota sull'ordine, che è la regola già scritta:** il file della migrazione entra
nel PR **prima** di essere applicato a Supabase, e nello stesso commit del codice
che lo usa. Dopo l'applicazione: advisor di sicurezza, e riga nel RoPA.

---

## 11. Fuori perimetro, e le dipendenze

- **Non nostro:** far scrivere `zone_slug` al percorso del cliente e la sostituzione
  di `zones.ts` con la tabella — area di André, suo PR.
- **Non in questa specifica:** la guida introduttiva al primissimo accesso (i
  contenuti, i tooltip, l'email di benvenuto): la vediamo dopo, come detto.
- **Bloccante e da decidere a settembre:** l'SMTP personalizzato. Con 2 email/ora
  il terzo professionista che si iscrive nella stessa ora non entra mai. Quindici
  minuti di lavoro, 8-10 giorni di attesa fra propagazione e warm-up; l'outreach
  parte a ottobre.
- **Da sistemare quando si tocca la prenotazione diretta:** `computeFreeSlots`
  ignora `professional_availability`, quindi la domanda sugli orari oggi non
  produce l'effetto che promette.

---

## 12. Fatta quando

1. Un professionista che completa il check-in **compare** nella ricerca per il suo
   servizio, nella sua città e nelle zone che ha disegnato — verificato con una
   richiesta vera, non leggendo il codice.
2. Nessuna domanda è posta due volte.
3. La checklist in dashboard dice cosa manca, e lo stato *pronto a ricevere
   richieste* è scritto in una colonna, non dedotto.
4. Il centro del cerchio non è leggibile da nessun client anonimo: provato con una
   query anon su `professional_coverage`.
5. Advisor Supabase senza nuovi rilievi, righe RoPA scritte, `schema_check.sh`
   che ricostruisce lo schema dai soli file del repo.
