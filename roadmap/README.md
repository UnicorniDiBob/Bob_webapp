# BOB — Roadmap tracker

Tracker vivo del progetto, organizzato **per traguardi** (non più per sezioni
tematiche). Un traguardo è **uno stato del mondo con un test che passa o non
passa**; sotto ci stanno le attività. Versionato nel repo così che André e Lucio
lavorino sullo stesso file.

> Rifatto il 06/08/2026 dopo un controllo incrociato di GitHub, Supabase e
> produzione. Il vecchio schema aveva 158 righe piatte, 10 sezioni e 4 righe con
> stato "Milestone" che in realtà erano checkpoint di KPI: diceva *cosa* mancava
> ma mai *cosa deve essere vero adesso*. Le sei cose che il controllo ha trovato
> stanno in `findings.csv` e nel pannello in cima a `roadmap.html`.

## File

| File | Cos'è |
|---|---|
| `milestones.csv` | **Fonte di verità.** I traguardi: titolo, finestra, `why`, `done_when`. |
| `roadmap.csv` | **Fonte di verità.** Il lavoro *aperto*, una riga per attività, con la colonna `milestone`. |
| `findings.csv` | Il pannello "controllo di realtà". Quando una riga è risolta, si cancella. |
| `next.csv` | Le prossime mosse in ordine, con i comandi. |
| `ARCHIVE.csv` | Lo storico chiuso (77 attività da giugno). Non si modifica: ci si **sposta dentro**. |
| `build_roadmap.py` | Generatore. Solo libreria standard, nessuna dipendenza. |
| `view_template.html` | Il guscio HTML della vista. Si tocca solo per cambiare il design. |
| `sync_status.py` | Incrocia i commit col CSV e controlla le regole dello schema. |
| `roadmap.md` | **Generato.** Versione leggibile, sincronizzata nel progetto Claude. |
| `roadmap.html` | **Generato.** La vista: timeline per traguardo, filtri per owner, test di completamento. |

Il vecchio `BOB_Roadmap_Gantt.xlsx` è **ritirato**. Le barre per singola attività
sono quello che rendeva illeggibile il grafico, e le date erano quasi tutte
inventate per farle comparire. La timeline in `roadmap.html` disegna **una barra
per traguardo**, che è l'unico livello a cui le date significano qualcosa.

## Colonne

**`milestones.csv`** — `id` · `kind` (milestone/lane/park) · `title` · `start` ·
`end` · `state` (blocked · urgent · active · open · gate · parallel · parked) ·
`why` · `done_when`

**`roadmap.csv`** — `milestone` · `id` · `parent` · `track` (Client/Pro ·
Internal · Shared) · `owner` · `status` · `start` · `end` · `task`

**`ARCHIVE.csv`** — `milestone` · `id` · `track` · `owner` · `done_on` · `task`

### Stati ammessi

| Stato | Quando |
|---|---|
| `Open` | Da fare, con una data di fine. |
| `In progress` | Ci si sta lavorando adesso. |
| `Gate` | Una decisione da prendere, non un lavoro da fare. Blocca quello che viene dopo. |
| `Dormant` | **Costruito ma spento in produzione.** Scrivi nella riga la condizione che lo accende. |
| `Parked` | Nel parcheggio: nessuna data finché non c'è una prova dal vivo. |

`Done` **non è più uno stato**: quello che è finito si sposta in `ARCHIVE.csv`.
`Milestone` non è più uno stato: i traguardi sono contenitori, e stanno in
`milestones.csv`.

## Track (chi fa cosa)

- **Client/Pro → André** — esperienza cliente e professionista (chat, dashboard,
  messaggi, appuntamenti, billing pro, SEO).
- **Internal → Lucio** — dati, dashboard admin, analisi, privacy, monitoring.
- **Shared** — infra, legale, go-to-market, gate di lancio.

## Come aggiornare (30 secondi)

1. **Hai finito un'attività?** Taglia la riga da `roadmap.csv`, incollala in
   `ARCHIVE.csv` con `done_on=YYYY-MM-DD` (la colonna `parent` non serve lì).
2. **Nuova attività?** Aggiungi una riga a `roadmap.csv` scegliendo il
   `milestone`. Se non riesci a decidere sotto quale traguardo sta, quasi sempre
   vuol dire che non serve adesso.
3. **Un traguardo è passato?** Il suo test in `done_when` è la prova: o lo passi
   o no. Quando passa, sposta le sue ultime attività in archivio.
4. Rigenera:
   ```bash
   python3 roadmap/build_roadmap.py     # scrive roadmap.md + roadmap.html
   python3 roadmap/sync_status.py       # controlla commit e schema
   ```
5. Commit dei CSV **insieme** a `roadmap.md` e `roadmap.html` rigenerati al
   passo 4 — nessuno li rigenera al posto tuo. La CI fallisce (job `build` di
   `ci.yml`) se li dimentichi o dimentichi di rilanciare lo script prima di
   committare: rigenera i file allo stesso modo e confronta il risultato.

## Le quattro regole

Il vecchio schema non è fallito per trascuratezza: mancavano queste.

1. **Un traguardo è uno stato del mondo, mai un contenitore di attività.**
   Se non riesci a scrivere «è fatto quando una persona vera può…», è un tema —
   e i temi non finiscono mai. Il vecchio schema ne aveva dieci.
2. **Due livelli, e niente sotto la giornata prende una riga.**
   Traguardo → attività, punto. «Riga in piccolo sul profilo con la data della
   verifica» è un messaggio di commit, non una riga di roadmap.
3. **Nessuna data senza una dipendenza o un orologio esterno.**
   Quasi tutte le date vecchie servivano a far comparire le barre, ed è per
   questo che risultava in ritardo un solo item: le date venivano riscritte in
   silenzio. O qualcosa la blocca, o la decide qualcuno fuori, o va in `PARK`.
4. **Costruito ma spento si scrive `Dormant`, non archiviato.**
   Tre funzioni erano chiuse mentre erano spente in produzione: il ritentativo
   notturno (`CRON_SECRET` mancante), la pipeline email (`RESEND_API_KEY`
   mancante), il substrato pagamenti (Stripe). Con la condizione che le accende
   scritta accanto, «fatto» continua a voler dire «funziona per un utente».

## Convenzione commit (facoltativa, aiuta `sync_status.py`)

Metti l'id dell'attività fra parentesi nel messaggio: `feat(41.1): indirizzo
strutturato`. `sync_status.py` lo riconosce e segnala se quell'attività è ancora
aperta nel CSV, o se l'id non esiste ancora nel tracker.

## Dove si vede il roadmap

- **Nel progetto Claude, sempre:** `roadmap.md` è sincronizzato dal repo.
- **La vista completa:** apri `roadmap/roadmap.html` (nessun server, nessuna
  dipendenza — è un file solo).
- **In chat:** «mostrami il roadmap» lo rende leggendo i CSV correnti.

## Automazione

Non c'è più un bot che rigenera e ricommitta: un push fatto con `GITHUB_TOKEN`
non fa ripartire la CI sul nuovo commit, quindi lascerebbe la PR con la HEAD
priva del check richiesto. Il job `build` di `ci.yml` rigenera `roadmap.md` e
`roadmap.html` in CI e fallisce se non corrispondono ai file committati — la
rigenerazione (passo 4 sopra) e il commit restano un passo manuale.
