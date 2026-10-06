# Handoff — 5 ottobre 2026, Lucio (con Claude)

**Fatto:** le regole della prenotazione, PR #144, branch `conferma-prenotazione`.
- **Uno slot, un cliente.** Un vincolo nel database impedisce che due appuntamenti con un cliente si sovrappongano.
- **Preavviso per annullare.** È un'impostazione del pro in Impostazioni → Orari, 48 ore di base, fotografata alla conferma. Sostituisce la finestra per singolo servizio.
- **Annullamento.** Una sola strada per pro e cliente, `annulla_appuntamento`:
  - fuori dal preavviso si annulla dal sito, con un messaggio standard in chat;
  - dentro il preavviso si chiama: il numero dell'altra parte compare solo su un appuntamento confermato, e il pro registra l'annullamento con «concordato al telefono»;
  - il pro scrive sempre il motivo;
  - una prenotazione diretta disdetta chiude la richiesta come «disdetto», e su quella non si può recensire.
- **Storico.** Nuova tabella `appointment_events`.
- **Divieti.** Niente annullamento secco né eliminazione dal browser per gli appuntamenti attivi con un cliente.
- **Campanella.** Notifica prenotazioni, spostamenti, annullamenti e proposte da confermare, per pro e cliente.
- **Chat.** Un solo biglietto vivo per appuntamento; «Apri la chat» dal calendario e dagli appuntamenti del cliente.
- **Barra del cliente.** Arriva a «Appuntamento da confermare».

Prove: 13 prove che possono fallire, `scripts/prova_113_prenotazione_regole.sql`, tutte passate su Postgres 16 in Docker, insieme alla ricostruzione dai soli file. ROPA A5 e conservazione aggiornate.

**A metà:**
- **Verifica dal vivo.** Va fatta dopo il deploy, desktop e 390px, con pro e cliente di prova: si chiudono solo dopo quella i 6 rilievi di André del 3/10 e quello del 5/10 sull'appuntamento nato in chat.
- **Spostamento del pro dentro il preavviso.** Resta una proposta da accettare, senza la regola della telefonata.
- **Il cliente non sposta un appuntamento già confermato.**
- **Cron mancante.** `system_job_runs` non viene mai ripulita: `purge_stale_job_runs()` (049) non ha nessun cron, in produzione e nel repo. Va schedulata.
- **Pulizia del codice.** Sono pronti i candidati della ricerca sul codice inutile (~430 righe sicure, la prima è `src/app/api/admin/cs/route.ts`), ma non è stato toccato niente.

**Applicato in produzione:**
- **Migrazione 113.** Funzioni condivise riscritte dalle vive, con l'md5 verificato subito prima.
- **Migrazione 114.** Le due funzioni chiamabili dal browser spostate in `private`, con involucri SECURITY INVOKER.
- **Esito.** Advisor pulito, salvo i due rilievi vecchi. Nessuna variabile d'ambiente toccata.

---

# Handoff — 6 ottobre 2026, André (con Claude)

**Fatto:** area di tocco di 44px su mobile per i controlli della riga «Su 390px i link…» di `roadmap/findings.csv`: ramo con un solo pro in PR #145 (unita), ramo con più pro («Apri →», «Segna come concluso») e «Prenota» sul profilo del pro in 50523f1, ramo `fix/tap-targets-mobile-multipro` — solo classi, sotto sm; misurato in Chromium headless col CSS compilato a 390/320/1280, desktop identico a prima. La riga resta «Parziale»: gli altri controlli sotto i 40px della dashboard contati il 5/10 non sono stati identificati. Già fatto il 5/10: audit dal vivo del percorso B e del giro mobile, 6 rilievi in `findings.csv` (PR #143, unita).
**A metà:** il ramo `fix/tap-targets-mobile-multipro` è committato ma NON spinto né in PR; dopo il merge serve la verifica dal vivo su www.meetonda.com a 390px con un cliente che ha una richiesta con più pro (non provata con dati veri). Restano dal 5/10: il rapporto finale dell'audit, ordinato per gravità, non è scritto; l'appuntamento di prova di martedì 6/10 alle 9:00 con Milano Clean Squad andava disdetto dal lato pro — non verificato in questa sessione se lo sia stato.
**Applicato in produzione:** niente. Nessuna migrazione, nessuna variabile, nessun deploy: il codice di 50523f1 non è su main.
**Per Lucio:** la riga «La bozza di risposta del pro usa un LLM prima che il pro guardi il calendario» in `roadmap/findings.csv` aspetta ancora una tua conferma — per quella rotta esistono un'etichetta IA visibile, una pseudonimizzazione del testo oltre il solo indirizzo, e un DPA firmato col fornitore, come chiede `docs/DATA_COMPLIANCE.md`?
