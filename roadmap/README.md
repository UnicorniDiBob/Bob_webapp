# BOB — Roadmap tracker

Tracker vivo del progetto: **stato, date pianificate, data di completamento
effettiva** e **Track** (chi se ne occupa). Versionato nel repo così che
André e Lucio lavorino sullo stesso file.

## File

| File | Cos'è |
|---|---|
| `roadmap.csv` | **Fonte di verità.** Una riga per attività. Modifica qui. |
| `build_roadmap.py` | Genera `BOB_Roadmap_Gantt.xlsx` (barre Gantt + colori). |
| `sync_status.py` | Incrocia i commit git col CSV e segnala cosa aggiornare. |
| `roadmap.md` | Versione leggibile (auto-generata). Si vede nel progetto Claude. |
| `BOB_Roadmap_Gantt.xlsx` | Output generato — **non tracciato in git** (in `.gitignore`). Rigeneralo con lo script; la CI lo carica come artifact scaricabile. Ha 2 fogli: **Roadmap** (Gantt) e **Dati** (tabella filtrabile per owner/track/stato/scadenza in Excel). |

## Colonne del CSV

`kind` (section/project/task) · `id` · `track` (Client/Pro · Internal · Shared)
· `owner` · `status` (Done · In progress · Planned · Milestone) · `start` ·
`end` · `done_on` (YYYY-MM-DD, solo quando fatto) · `task`

## Track (chi fa cosa)

- **Client/Pro → André** — esperienza cliente e professionista (chat, dashboard,
  messaggi, appuntamenti, billing pro, SEO).
- **Internal → Lucio** — dati, dashboard admin, analisi, privacy, monitoring.
- **Shared** — infra, legale, go-to-market, milestone di lancio.

## Come aggiornare (30 secondi)

1. Hai finito un task? Nel `roadmap.csv` metti `status=Done` e `done_on=YYYY-MM-DD`.
2. Nuovo task? Aggiungi una riga (copia una simile, scegli `track`/`owner`).
3. Rigenera l'xlsx:
   ```bash
   python3 roadmap/build_roadmap.py
   ```
4. (Facoltativo) controlla l'allineamento coi commit:
   ```bash
   python3 roadmap/sync_status.py
   ```
5. Commit di `roadmap.csv` (e dell'xlsx se lo tieni nel repo).

## Convenzione commit (facoltativa, aiuta sync_status)

Metti l'id del task fra parentesi nel messaggio: `feat(8.9): stati vuoti/errore`.
`sync_status.py` lo riconosce e segnala se quel task è ancora `Planned`.

## Dove si vede il roadmap

- **Nel progetto Claude, sempre:** `roadmap.md` è sincronizzato dal repo, quindi
  compare fra i file del progetto ed è sempre aggiornato (testo leggibile).
- **A comando, in una chat Cowork:** chiedi "mostrami il roadmap" e viene reso
  come tabella o Gantt visivo leggendo `roadmap.csv` corrente.
- **Gantt completo con barre:** apri `BOB_Roadmap_Gantt.xlsx` in Excel/LibreOffice.

## Automazione (GitHub Action)

`.github/workflows/roadmap.yml` rigenera `xlsx` + `md` a ogni push che tocca
`roadmap.csv`, e li ri-committa (`[skip ci]`, nessun loop). Quindi in pratica:
modifichi solo il CSV, il resto si aggiorna da solo.

La CI committa **solo `roadmap.md`** (testo deterministico, nessun churn) e pubblica
l'`.xlsx` come *artifact* scaricabile dalla pagina della run. L'xlsx non sta in git
per evitare conflitti binari: chi lo vuole lo rigenera con `python3 roadmap/build_roadmap.py`
o lo scarica dall'ultima run della Action.

## Barre Gantt

Si disegnano da sole in Excel/LibreOffice via *conditional formatting* dalle
colonne Status + Start + End. Verde = Done, blu = In progress, grigio = Planned,
ambra = Milestone. Il mese corrente è evidenziato in rosso nell'intestazione.
