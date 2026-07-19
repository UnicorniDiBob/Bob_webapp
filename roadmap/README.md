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
| `BOB_Roadmap_Gantt.xlsx` | Output generato. Non modificarlo a mano: si rigenera. |

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

## Barre Gantt

Si disegnano da sole in Excel/LibreOffice via *conditional formatting* dalle
colonne Status + Start + End. Verde = Done, blu = In progress, grigio = Planned,
ambra = Milestone. Il mese corrente è evidenziato in rosso nell'intestazione.
