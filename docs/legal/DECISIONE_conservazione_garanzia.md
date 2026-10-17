# Decisione — cosa resta del cliente alla chiusura dell'account

*Presa da Lucio e André il 17 ottobre 2026. Sostituisce la scelta della PR #194
(brief de-identificato con `access_notes` e `timing_availability` svuotati). È
una decisione sull'INTENTO: cosa fa davvero il codice lo dice il repo, non questo
file (CLAUDE.md, «Fonti di verità»).*

## La decisione

1. **Lavori senza Garanzia Bob — oggi tutti.** Alla chiusura dell'account si
   cancella tutto del cliente, brief compresi. **Nessuna copia de-identificata.**
   Restano soltanto:
   - i dati che una legge impone di tenere (fatture e registrazioni di
     pagamento, 10 anni — DATA_COMPLIANCE §5; accettazioni dei termini, ROPA A25);
   - le recensioni, de-identificate dalla migrazione 056 (`customer_id` a NULL),
     perché appartengono anche al professionista che le ha ricevute.
2. **Lavori con Garanzia Bob — oggi nessuno.** I dati del lavoro coperto restano
   **identificati**, in un **archivio ad accesso ristretto**, fino a
   `job_completed_at` + **2 anni** (**10 anni** per le categorie strutturali).
   Base giuridica: art. 17(3)(e) GDPR, accertamento, esercizio o difesa di un
   diritto in sede giudiziaria. **Si costruisce solo prima di vendere la prima
   garanzia**, non prima.
3. **Al professionista non si mandano dati del cliente alla cancellazione.**
   Quello che il pro ha già ricevuto durante il lavoro (consegna progressiva,
   ROPA A2/A3) resta sotto la sua titolarità autonoma; Bob non gliene consegna
   altro come «copia» al momento della chiusura.

## Perché

- Un brief anonimo non è anonimo: descrizione, zona, foto e testo libero bastano
  spesso a riconoscere una casa e chi ci abita. Svuotare due campi (PR #194)
  lasciava il resto, e il resto non serviva a nessuna finalità dichiarata.
- Per i lavori senza garanzia non c'è un obbligo di legge né una pretesa
  prevedibile che giustifichi di tenere il brief dopo la cancellazione: l'art. 17
  chiede di cancellare, e la richiesta stessa va già via a cascata
  (`requests_customer_id_fkey` ON DELETE CASCADE).
- Con la garanzia Bob si espone a contestazioni sul lavoro eseguito: lì i dati
  servono identificati, per il tempo in cui una contestazione è possibile, e solo
  a chi deve gestirla.

## Cosa fa il codice (17/10)

- `src/app/api/cron/cancella-account/route.ts`: prima i file (`svuotaFileUtente`,
  che ritrova le foto della chat proprio dai brief), poi `delete` di tutti i
  `job_briefs` del cliente in una sola istruzione, poi `deleteUser`. Se la
  cancellazione dei brief fallisce l'account non si cancella quella notte e il
  giro registra `falliti`.
- Unica chiave esterna verso `job_briefs`: `requests.brief_id` ON DELETE SET
  NULL. I tre trigger BEFORE UPDATE di `requests` lasciano passare il SET NULL
  fatto col service role (letti da `pg_get_functiondef` sulla produzione il
  17/10). Nessuna migrazione necessaria.
- Prova: `scripts/prova_cancellazione.mjs`, 17/10 — cancellati 2, falliti 0,
  zero brief del cliente, nessun id della prova nelle colonne uuid di `public`,
  `auth` e `storage`.

## Cosa manca prima della prima garanzia venduta

In `roadmap/findings.csv` (non bloccante oggi, bloccante dalla prima garanzia):
`requests.protection_status` per sapere quali lavori sono coperti; l'archivio
ristretto per quei lavori, con la sua scadenza (2 / 10 anni) e l'accesso a
privilegio minimo tracciato; il cron di cancellazione che li salta e li sposta
nell'archivio invece di cancellarli; l'informativa privacy aggiornata
(`src/app/privacy/page.tsx` oggi non nomina la garanzia né i 2 anni).
