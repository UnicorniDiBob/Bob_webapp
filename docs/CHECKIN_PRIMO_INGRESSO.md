# Il primo ingresso del professionista — specifica

_Proposta del 27/08/2026, revisione 2 · traccia Internal (Lucio) · da ratificare prima di scrivere codice_

---

## 0. In una riga

L'iscrizione chiede il minimo indispensabile. Tutto il resto avviene **dentro il
prodotto, al primo ingresso**, in un percorso che **spiega mentre chiede**: ogni
passo mostra una parte di Bob — le richieste, il calendario, i messaggi — e chiede
solo la cosa che serve a far funzionare quella parte. Al termine esiste uno stato
dichiarato, *pronto a ricevere richieste*, che oggi non esiste in nessuna colonna.

**Cosa cambia rispetto alla revisione 1:** il questionario non è più un cancello
fra l'iscrizione e la dashboard, ma il primo ingresso stesso; la mappa e la scelta
della zona stanno sullo stesso schermo; esistono le coperture ampie fino a «tutta
Italia»; e le risposte diventano visibili e modificabili, perché oggi si scrivono
e non si rivedono più.

---

## 1. Il problema, con le prove

Verificato il 27/08/2026 su `origin/main` e sulla produzione (`bijgitnulucdzluqjxrx`).

| Fatto | Prova |
| --- | --- |
| Chi finisce l'onboarding di oggi è **invisibile in ogni ricerca** | `getProfessionals()` (`src/lib/data.ts:223`) costruisce la card dal primo record di `professional_services` e filtra per servizio su quello. Il questionario scrive `onboarding_answers` e crea `professionals` con solo `city_id` e `years_experience` |
| Non è un ragionamento: è successo | Iscrizione reale del 27/08 ore 15:57 (`sig.mozzato@gmail.com`, Fotografo, Navigli, piano Business via promo). `professional_services`: **0 righe**. Profilo completo di piano a pagamento, invisibile in ogni ricerca |
| Le risposte del questionario **non si rivedono più** | Nessuna schermata legge `onboarding_answers`. Il pro non sa cosa ha risposto e non lo può cambiare |
| «Navigli» non è diventato una zona | Salvato come testo in `onboarding_answers.zone`, mentre lo slug `navigli` esiste già in `src/lib/zones.ts` con le sue coordinate |
| Mestiere, città e anzianità si chiedono **due volte** | una nel questionario, una in `/impostazioni/azienda`, dove vive il dato che conta |
| La strada della zona **non è mai stata percorsa** | `requests.zone_slug` NULL su 9 richieste su 9; `request_addresses` 0 righe (ha già `coarse_lat`/`coarse_lng`/`coarse_radius_m`) |
| Nessuno spiega niente | Il pro atterra su `/impostazioni/azienda` (307 da `/dashboard/profilo`): un form, senza contesto. Nessuna guida, nessuna checklist, nessuna email di benvenuto (gap G46) |
| 4 professionisti su 5 non hanno **nessun orario**, nessuno ha telefono | query su `professional_availability` e `profile_phone` |

---

## 2. I cinque principi

1. **L'iscrizione chiede il minimo.** Nome, email, password. Ogni campo in più
   prima della porta è un professionista che non entra.
2. **Si spiega mentre si chiede.** Ogni domanda arriva dentro la schermata che
   quella risposta accende. «Qui arrivano le richieste dei clienti — dimmi di cosa
   ti occupi, altrimenti resta vuota.»
3. **Ogni domanda ha una destinazione.** Se una risposta non scrive un campo che
   il prodotto usa, non è una domanda del primo ingresso: è un sondaggio, e va
   dopo il traguardo.
4. **L'unità di misura appartiene al lavoro, non al professionista.** La dichiara
   il catalogo, il pro riempie solo il numero. Una domanda in meno, e prezzi
   confrontabili fra pro.
5. **Il nudge spinge, non costringe.** Default intelligenti, precompilazioni da
   togliere, conseguenze dichiarate. Mai prova sociale inventata, mai un piano a
   pagamento preselezionato, mai un campo finto-obbligatorio.

---

## 3. Il percorso

### 3.1 Prima della porta

```
iscrizione (nome, email, password, ruolo)  →  conferma email  →  primo ingresso
```

**La scelta del piano esce dal funnel.** Oggi sta fra la conferma e il
questionario: è il momento peggiore per chiedere una decisione commerciale, perché
il pro non ha ancora visto niente. Diventa una tappa del percorso guidato, nel
punto in cui compare la prima funzione che il piano sblocca — il modello «paywall
al momento del bisogno», che è già il task 17.1 del Gantt. Il codice promo resta
dov'è, come scorciatoia per chi ce l'ha.

### 3.2 Il primo ingresso, tappa per tappa

Sette tappe. Ognuna **mostra** un pezzo del prodotto e **chiede** la cosa che lo
accende. Barra di avanzamento sempre visibile, «salta per ora» sempre disponibile.

| # | Cosa mostra | Cosa chiede | Perché in questo punto |
| --- | --- | --- | --- |
| 1 | **La bacheca delle richieste**, vuota | Di cosa ti occupi: mestiere e sottoservizi | È la schermata che resta vuota per sempre se non risponde. La conseguenza è visibile, non spiegata |
| 2 | **La mappa della tua zona di lavoro** | Dove lavori (§5) | Subito dopo: mestiere e zona sono le due chiavi del match |
| 3 | **Il tuo profilo come lo vede il cliente** | Presentazione, foto, anni | Si guarda l'anteprima e si corregge, invece di riempire campi al buio |
| 4 | **Il preventivo che manderai** | Tariffa nell'unità del mestiere, costi accessori (§6) | Il numero si capisce quando si vede dove finisce |
| 5 | **Il calendario** | Orari, e se vuole la prenotazione diretta | Prima funzione da piano a pagamento: qui la scelta del piano ha senso |
| 6 | **I messaggi dei clienti** | Telefono e notifiche (§7) | Non c'è niente da configurare: si spiega dove arrivano e come si risponde |
| 7 | **La checklist** con quel che manca | Niente | Chiude il percorso e resta in dashboard |

Alla fine: **«pronto a ricevere richieste»**, dichiarato in una colonna, non
dedotto. Da qui discende la visibilità negli elenchi.

### 3.3 Le risposte devono restare visibili

È il difetto che il primo ingresso non deve ereditare. Tre regole:

- **Le risposte sono i campi.** Mestiere → `professional_services`, zona →
  copertura, tariffa → `rate_amount`. Quindi si rivedono e si cambiano dove vivono,
  dalle sezioni di `/impostazioni`, senza una schermata nuova.
- **Il percorso si riapre.** Voce «rivedi la guida» in dashboard, e opzione «non
  mostrarla più» al primo completamento (flag di completamento, non un cookie).
- **Resta nascosto solo ciò che non serve al pro:** `heard_from`. Che è anche
  l'unica domanda che non ha una destinazione nel prodotto, ed è per questo che si
  chiede dopo il traguardo.

---

## 4. Le domande

| # | Domanda | Dove finisce | Obbligo | Tecnica |
| --- | --- | --- | --- | --- |
| 1 | «Di cosa ti occupi?» → «Quali di questi fai?» (sottoservizi) | `professional_services`, `professionals.subservice_slugs` | sì | le 3-4 sottocategorie più comuni **già spuntate**, da togliere |
| 2 | «Dove lavori?» (§5) | `professional_coverage` + tabella pubblica | sì | default: la zona di partenza + raggio 5 km |
| 3 | «Ti presento così, va bene?» | `professionals.headline/bio` | no | **bozza precompilata** da mestiere + anni + città, modificabile |
| 4 | «Da quanti anni?» | `professionals.years_experience` | no | un tap; «preferisco non dirlo» resta un'opzione vera |
| 5 | «Quanto chiedi?» nell'unità del mestiere (§6) | `professional_services.rate_amount/rate_unit/min_units` | no, con conseguenza dichiarata | l'unità è già decisa dal catalogo; framing «forbice indicativa, non un impegno» |
| 5b | Costi accessori: uscita, sopralluogo, materiali, IVA (§6) | colonne nuove su `professionals` | no | struttura uguale per tutti, non testo libero |
| 6 | Orari | `professional_availability` | solo se accende la prenotazione diretta | default lun-ven 9-18 da correggere |
| 7 | Piano | `promo_redemptions`, `subscription_tier` | no: «decidi dopo» è una risposta | nessun default preselezionato, e arriva dopo aver visto la funzione |
| 8 | Telefono (§7) | `profile_phone` | sì se accende la prenotazione diretta | rassicurazione nel punto della domanda |
| 9 | P.IVA | `professional_verification` | solo piani a pagamento | mostrare cosa sblocca nel momento della domanda |
| 10 | «Come ci hai conosciuto?» | `onboarding_answers.heard_from` | no | **dopo** lo «hai finito», non prima |

---

## 5. Dove lavori: un solo schermo, tre livelli di precisione

### 5.1 Lo schermo

Mappa e zone **insieme**, non in sequenza:

```
┌─────────────────────────────────────────────────────┐
│  Città: [ Milano ▾ ]     Copertura: [ Zone ▾ ]      │
├──────────────────────────────┬──────────────────────┤
│                              │  ☑ Navigli           │
│         M A P P A            │  ☑ Ticinese          │
│      cerchio trascinabile    │  ☑ Centro / Duomo    │
│      slider del raggio       │  ☐ Isola             │
│                              │  ☐ Lambrate …        │
└──────────────────────────────┴──────────────────────┘
     raggio ●────────── 5 km          «tutta Milano»
```

Le due metà sono **lo stesso dato in due viste**: spunti una zona e si accende
sulla mappa; muovi il cerchio e le zone dentro si spuntano da sole. Da telefono le
due viste diventano due schede, con lo slider del raggio come interazione
principale — trascinare un poligono con un dito non funziona.

### 5.2 I tre livelli di precisione

| Livello | Come si dice | Per chi |
| --- | --- | --- |
| **Zone** | caselle e/o cerchio sulla città | l'idraulico: «giro entro 5 km da qui» |
| **Città / provincia / regione** | un menù, nessun disegno | il fabbro che copre la provincia |
| **Tutta Italia / a distanza** | un interruttore | il fotografo di matrimoni; il grafico che lavora online |

La copertura ampia era il pezzo mancante della revisione 1 e non è un caso
marginale: il primo professionista iscritto per davvero, il 27 agosto, è un
**fotografo**.

### 5.3 Una sola chiave di match, per tutti i livelli

Ogni copertura si riduce a un insieme di **gettoni**, e ogni richiesta genera i
propri. Il match è una sola intersezione fra due array, con indice GIN.

```
gettoni del professionista       gettoni della richiesta (Navigli, Milano)
─────────────────────────        ────────────────────────────────────────
zone:milano/navigli              zone:milano/navigli
city:milano                      city:milano
prov:milano                      prov:milano
reg:lombardia                    reg:lombardia
macro:nord                       macro:nord
it:*                             it:*
remote:*
```

`pro.coverage_keys && request.coverage_keys` → trovato. Chi ha `it:*` compare
per una richiesta di Milano senza nessuna eccezione nel codice; chi ha solo
`zone:milano/navigli` non compare per Lambrate. I gettoni di zona sono
**namespaced sulla città** perché «centro» esiste in ogni città d'Italia.

I valori vengono da colonne che `cities` **ha già**: `province`, `region`,
`macro_region` (oggi: Milano/Lombardia/nord, Roma/Lazio/centro,
Torino/Piemonte/nord).

**Ordinamento:** vince il gettone più specifico che ha fatto match — zona, poi
città, poi provincia, regione, nazionale. Un pro «tutta Italia» non scavalca
l'idraulico del quartiere: compare, in fondo.

### 5.4 Il limite che protegge la qualità del match

Un fotografo che copre l'Italia è normale; un **idraulico** che dice di coprire
l'Italia è una richiesta persa per il cliente e una recensione negativa per noi.
Quindi il livello massimo lo decide **il catalogo, non il professionista**:
`services.max_coverage_scope` (idraulico → provincia; fotografo → nazionale;
grafico → nazionale + a distanza). È lo stesso principio dell'unità di misura: la
proprietà appartiene al lavoro.

### 5.5 Il modello dati, e perché due tabelle

**Il centro del cerchio può essere casa sua.** Quindi la geometria non è pubblica,
i gettoni sì.

- `professional_coverage` — una riga per (professionista, ambito). Contiene
  `scope`, `city_id` (nullo per gli ambiti ampi), `mode`, `zone_slugs`,
  `center_lat`/`center_lng`/`radius_m`, `area_geojson`, `works_remote`.
  **Lettura: solo il proprietario e lo staff.**
- `professional_coverage_public` — (professionista, `coverage_keys`, `best_scope`).
  **Lettura pubblica**, nessuna policy di scrittura: la riempie un trigger
  `security definer`. È la tabella che leggono elenco e matching.
- `city_zones` — le zone in database (prima solo in un file TypeScript), perché le
  nuove città devono entrare senza un deploy e perché «quali zone cadono nel
  cerchio» si calcola lato server.

Più righe per professionista significa che si può dire **«zone di Milano, più tutta
la Lombardia per i lavori grossi»** senza casi speciali: i gettoni si sommano.

### 5.6 La mappa: quale fornitore

Le **tile non sono geocoding**: escono l'IP del pro e la porzione che guarda, mai
un dato del cliente.

**Scelta: MapLibre GL** (licenza BSD, nessun lock-in) **+ un nostro file PMTiles**
in un bucket Supabase. Nessun responsabile del trattamento, zero euro, nessuna
riga nuova nel registro fornitori, nessuna informativa da aggiornare. Da verificare
il tetto di banda del piano Free. L'alternativa scartata: MapTiler o Geoapify (UE,
con DPA) — meno lavoro, ma un fornitore in più. **Google Maps no**: responsabile
USA, chiave e fatturazione attive, script e cookie propri che indeboliscono la
scelta di non avere il banner, in cambio di nulla, perché il disegno avviene sopra
una griglia nostra.

Per il modo poligono il punto-in-poligono lo calcola il client (Turf.js) e manda
l'elenco; il server ricalcola da sé solo i cerchi. Quando arriverà il geocoder
(roadmap 40.0, marzo 2027) si potrà installare **PostGIS 3.3.7** — già disponibile
sul progetto, non installato — e passare a `ST_DWithin` senza toccare questo
modello.

### 5.7 Nuove città, e il confine con il lato cliente

`city_zones` si popola con lo stesso generatore di Milano, da dati aperti: Roma 155
zone urbanistiche, Torino 94 quartieri. Finché una città non ha zone, il livello
«zone» mostra un'unica voce «tutta la città»: nessuna città resta bloccata
dall'assenza dei dati, e i livelli ampi funzionano comunque.

`src/lib/zones.ts` **resta dov'è** e continua a servire il percorso del cliente: è
area di André, e va cambiata in un suo PR. Gli slug in `city_zones` sono identici a
quelli del file (stessa fonte, stesso generatore), quindi il match funziona
attraverso i due lati. Il generatore emetterà **sia** il file **sia** il seed SQL, e
`scripts/schema_check.sh` confronterà i due elenchi.

**Dipendenza bloccante, non nostra:** oggi `requests.zone_slug` è NULL su 9
richieste su 9. Il pro può disegnare quanto vuole: se il percorso del cliente non
scrive la zona, i gettoni di zona non fanno match. Nota che i livelli città,
provincia e regione **funzionano già** con il solo `city_id` della richiesta:
il primo ingresso non è bloccato, lo è solo la precisione al quartiere.

---

## 6. Quanto costi: unità e costi accessori

Metà c'è già: `RateUnit` in `src/lib/supabase/types.ts` è `hour | m2 | job |
session`, e `subservices.default_rate_unit` esiste (nel seed: `hour`, `session`).

**Vocabolario da estendere** — un solo tipo TypeScript più due vincoli CHECK:

`hour` (ora) · `day` (giornata) · `half_day` (mezza giornata) · `event` (evento) ·
`job` (intervento) · `session` (seduta) · `m2` (metro quadro) · `linear_m` (metro
lineare) · `point` (punto luce/presa) · `piece` (pezzo) · `quote` (solo a preventivo)

Il fotografo vede «a evento» — e oggi non esiste, è la prima cosa che è mancata al
primo professionista vero. L'imbianchino «a metro quadro», l'idraulico «a
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

## 7. Telefono e messaggi

La tappa 6 non configura quasi niente: **spiega**. Dove arrivano i messaggi dei
clienti, che la chat è in-app con letto/non letto, che il badge in header conta i
non letti, e che al momento **nessuna email di notifica parte** — cosa che il pro
deve sapere prima di scoprirlo perdendo una richiesta.

Il telefono si raccoglie, ma cambia il perché — e quindi la copy: **«non lo vede il
cliente: serve per farti arrivare le chiamate»**. Serve perché una chiamata
mascherata deve comunque atterrare su un numero vero; perché l'app-to-app fallisce
nel caso che conta (cliente senza app, o offline); come recapito di fallback e per
i mancati appuntamenti; e perché l'email di conferma oggi promette il numero del
pro.

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
`VERIFICATION_LABEL` in `src/lib/vat.ts:17-21`, più una riga in
`src/lib/piani.ts:45`, due stringhe in admin e la pagina `/per-i-professionisti`.

Vincolo dai documenti legali, da rispettare nella UI: «Verificato Bob» va
presentato come **«documenti verificati il GG/MM/AAAA»**, mai come «professionista
garantito» o «di fiducia» (`VERIFICA_ANALISI_LEGALE.md:93`). `VERIFICATION_MEANING`
e `VERIFICATION_CAVEAT` in `vat.ts` già dicono la cosa giusta e non si toccano;
`verification_level_at` fornisce la data. Lo stesso nome deve comparire nei ToS
professionisti §3.2 e nella pagina pubblica del badge (art. 5 P2B).

---

## 9. Conformità (DATA_COMPLIANCE §2, §5, §8)

| Voce | Determinazione |
| --- | --- |
| Base giuridica | Art. 6(1)(b) contratto: senza mestiere, copertura e tariffa il servizio non può proporre il professionista a nessuno. `heard_from` resta legittimo interesse, facoltativo |
| Dati personali | Sì, per le ditte individuali: area di lavoro e tariffe sono dati sulla persona. Sono anche ciò che il pro pubblica per lavorare: i gettoni sono pubblici, **la geometria non lo è** |
| Perché la geometria è privata | Il centro del cerchio può essere l'abitazione del professionista. Pubblicare centro e raggio pubblicherebbe casa sua |
| Righe RoPA | *Area di lavoro del professionista* (nuova); *Tariffe e costi accessori* (estende A15); *Recapito telefonico per instradamento* quando arriva la chiamata in app |
| Retention | Vita del profilo; cancellati a cascata con l'account, come `professional_services` |
| Nuovo fornitore | **Nessuno**: tile PMTiles nostre |
| DPIA | Non innescata: nessun monitoraggio sistematico, nessuna decisione automatizzata. La chiamata in app va rivalutata a parte |
| Advisor | Da rieseguire dopo la migrazione: RLS su tutte le tabelle nuove, `search_path` fissato sulle funzioni nuove, nessuna vista SECURITY DEFINER (per questo la tabella pubblica è una tabella e non una vista) |

---

## 10. Migrazione 057 (proposta)

Prossimo numero libero: **057** (in repo e in produzione si arriva a 056).
Idempotente: `if not exists`, drop-then-create per policy e trigger.

```sql
-- 057: primo ingresso del professionista — copertura, unità di misura, costi accessori.

-- 1) Le zone delle città, in database (prima solo in src/lib/zones.ts).
create table if not exists public.city_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  slug text not null,
  label text not null,
  lat double precision,
  lng double precision,
  source text,
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);
alter table public.city_zones enable row level security;

drop policy if exists "Anyone reads city zones" on public.city_zones;
create policy "Anyone reads city zones" on public.city_zones for select using (true);

drop policy if exists "Staff manages city zones" on public.city_zones;
create policy "Staff manages city zones" on public.city_zones
  for all using (private.is_admin_or_cs()) with check (private.is_admin_or_cs());

-- 2) Fin dove può arrivare una copertura: lo decide il catalogo, non il pro.
alter table public.services
  add column if not exists max_coverage_scope text
    check (max_coverage_scope is null or max_coverage_scope in
      ('zones','city','province','region','macro_region','national')),
  add column if not exists remote_possible boolean not null default false;

-- 3) L'area di lavoro: il disegno e l'ambito. Privata.
create table if not exists public.professional_coverage (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  scope text not null default 'zones'
    check (scope in ('zones','city','province','region','macro_region','national')),
  city_id uuid references public.cities (id) on delete cascade,
  mode text not null default 'zones' check (mode in ('zones','circle','polygon')),
  zone_slugs text[] not null default '{}',
  center_lat double precision,
  center_lng double precision,
  radius_m integer check (radius_m is null or (radius_m between 250 and 200000)),
  area_geojson jsonb,
  works_remote boolean not null default false,
  updated_at timestamptz not null default now(),
  -- Gli ambiti fino alla regione partono da una città; il nazionale no.
  check ((scope = 'national') or (city_id is not null))
);
create unique index if not exists professional_coverage_unica
  on public.professional_coverage (professional_id, scope, coalesce(city_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.professional_coverage enable row level security;

drop policy if exists "Pro manages own coverage" on public.professional_coverage;
create policy "Pro manages own coverage" on public.professional_coverage
  for all using (professional_id in (select private.my_professional_ids()))
  with check (professional_id in (select private.my_professional_ids()));

drop policy if exists "Staff reads coverage" on public.professional_coverage;
create policy "Staff reads coverage" on public.professional_coverage
  for select using (private.is_admin_or_cs());

-- 4) L'area di lavoro: i gettoni. Pubblica, sola lettura per tutti.
--    Nessuna policy di scrittura: la riempie solo il trigger.
create table if not exists public.professional_coverage_public (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  coverage_keys text[] not null default '{}',
  best_scope text,
  updated_at timestamptz not null default now()
);
alter table public.professional_coverage_public enable row level security;

drop policy if exists "Anyone reads coverage keys" on public.professional_coverage_public;
create policy "Anyone reads coverage keys" on public.professional_coverage_public
  for select using (true);

create index if not exists professional_coverage_public_keys_idx
  on public.professional_coverage_public using gin (coverage_keys);

-- 5) Quali zone cadono nel cerchio. Haversine: le zone di una città sono decine.
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

-- 6) I gettoni di una riga di copertura, e quelli di una richiesta: stessa
--    funzione di slugificazione, altrimenti i due elenchi non si incontrano.
create or replace function private.coverage_keys_for(p_coverage_id uuid)
returns text[]
language plpgsql stable security definer set search_path = public as $$
declare r record; keys text[] := '{}'; z text;
begin
  select c.*, ci.slug as city_slug, ci.province, ci.region, ci.macro_region
    into r
    from public.professional_coverage c
    left join public.cities ci on ci.id = c.city_id
   where c.id = p_coverage_id;
  if not found then return '{}'; end if;

  if r.works_remote then keys := keys || 'remote:*'; end if;

  if r.scope = 'national' then
    return keys || 'it:*';
  end if;
  if r.scope in ('macro_region') then
    return keys || ('macro:' || private.slugify(r.macro_region));
  end if;
  if r.scope in ('region') then
    return keys || ('reg:' || private.slugify(r.region));
  end if;
  if r.scope in ('province') then
    return keys || ('prov:' || private.slugify(r.province));
  end if;
  if r.scope = 'city' then
    return keys || ('city:' || r.city_slug);
  end if;

  -- scope = 'zones': un gettone per zona, con la città nel nome perché
  -- "centro" esiste in ogni città d'Italia.
  foreach z in array r.zone_slugs loop
    keys := keys || ('zone:' || r.city_slug || '/' || z);
  end loop;
  return keys;
end;
$$;

-- 7) Il cerchio si traduce in zone alla scrittura, non alla lettura.
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

-- 8) Solo i gettoni diventano pubblici. Mai centro e raggio.
create or replace function public.publish_coverage_keys()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; all_keys text[]; best text;
begin
  pid := coalesce(new.professional_id, old.professional_id);
  select coalesce(array_agg(distinct k), '{}')
    into all_keys
    from public.professional_coverage c,
         unnest(private.coverage_keys_for(c.id)) k
   where c.professional_id = pid;
  select scope into best from public.professional_coverage
   where professional_id = pid
   order by array_position(
     array['zones','city','province','region','macro_region','national'], scope)
   limit 1;
  insert into public.professional_coverage_public
    (professional_id, coverage_keys, best_scope, updated_at)
  values (pid, all_keys, best, now())
  on conflict (professional_id) do update
    set coverage_keys = excluded.coverage_keys,
        best_scope = excluded.best_scope,
        updated_at = now();
  return coalesce(new, old);
end;
$$;

drop trigger if exists publish_coverage_keys on public.professional_coverage;
create trigger publish_coverage_keys
  after insert or update or delete on public.professional_coverage
  for each row execute function public.publish_coverage_keys();

-- 9) Vocabolario delle unità di misura: due vincoli da rifare.
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

-- 10) Costi accessori: dichiarati una volta dal professionista, pubblici.
alter table public.professionals
  add column if not exists callout_fee numeric check (callout_fee is null or callout_fee >= 0),
  add column if not exists callout_fee_deducted boolean not null default false,
  add column if not exists survey_free boolean not null default true,
  add column if not exists survey_fee numeric check (survey_fee is null or survey_fee >= 0),
  add column if not exists min_billable_units numeric check (min_billable_units is null or min_billable_units > 0),
  add column if not exists materials_included boolean,
  add column if not exists vat_regime text check (vat_regime is null or vat_regime in ('22','10','forfettario'));

-- 11) Lo stato del primo ingresso: dichiarato, non dedotto.
alter table public.professionals
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists ready_at timestamptz;

-- 12) Serve anche private.slugify(text): minuscole, senza accenti, spazi in "-".
--     E il seed delle 28 zone di Milano, generato da
--     scripts/build_milano_zones.py (stesse slug di src/lib/zones.ts).
```

**Nota sull'ordine, che è la regola già scritta:** il file della migrazione entra
nel PR **prima** di essere applicato a Supabase, e nello stesso commit del codice
che lo usa. Dopo l'applicazione: advisor di sicurezza, e riga nel RoPA.

---

## 11. Fuori perimetro, e le dipendenze

- **Non nostro:** far scrivere `zone_slug` al percorso del cliente e la
  sostituzione di `zones.ts` con la tabella — area di André, suo PR. I livelli
  città/provincia/regione funzionano già senza.
- **Bloccante e da decidere a settembre:** l'SMTP personalizzato. Con 2 email/ora
  dal mailer interno di Supabase, il terzo professionista che si iscrive nella
  stessa ora non entra mai. Quindici minuti di lavoro, 8-10 giorni fra
  propagazione e warm-up; l'outreach parte a ottobre.
- **Da sistemare quando si tocca la prenotazione diretta:** `computeFreeSlots`
  ignora `professional_availability`, quindi la tappa del calendario oggi non
  produce l'effetto che promette.
- **Da decidere prima della tappa 6:** se la chiamata in app si fa, e con quale
  fornitore. Cambia la copy del telefono, non il campo.

---

## 12. Fatta quando

1. Un professionista che completa il primo ingresso **compare** nella ricerca per
   il suo servizio e nella sua area — verificato con una richiesta vera, non
   leggendo il codice. La prova negativa esiste già: `sig.mozzato@gmail.com`,
   iscritto il 27/08 con piano Business, oggi invisibile.
2. Un fotografo può dire «lavoro in tutta Italia» e un idraulico no, e la
   differenza sta nel catalogo.
3. Nessuna domanda è posta due volte, e ogni risposta si rivede e si cambia da
   `/impostazioni`.
4. Il pro sa dove arrivano le richieste, i messaggi e gli appuntamenti perché
   glielo ha mostrato il percorso, non perché gli abbiamo scritto una mail a mano.
5. Il centro del cerchio non è leggibile da nessun client anonimo: provato con una
   query anon su `professional_coverage`.
6. Advisor Supabase senza nuovi rilievi, righe RoPA scritte, `schema_check.sh` che
   ricostruisce lo schema dai soli file del repo.
