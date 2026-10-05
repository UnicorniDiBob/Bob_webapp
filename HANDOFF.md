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

# Handoff — 5 ottobre 2026, André (con Claude)

**Fatto:** audit dal vivo del percorso B (richiesta e proposta in chat) e del giro mobile a 390px (pro di prova Milano Clean Squad, cliente demo Gianpiero). Aggiunti 6 rilievi nuovi a `roadmap/findings.csv` — nessuna via per disdire o spostare un appuntamento confermato nato da proposta, i link «Apri la conversazione»/«Segna come concluso» a 18px su mobile, una proposta confermabile senza nessun indirizzo, «Inviata» senza spunta per le richieste via «Contatta», una bozza di risposta del pro generata con un LLM da verificare contro `docs/DATA_COMPLIANCE.md`, e quattro righe «Recensisci» identiche che riempiono il primo schermo a 390px (pagina a 3887px). Aggiornate anche due righe del 3/10 (PR 129): la barra di avanzamento fallisce anche sul percorso della proposta in chat, non solo sulla prenotazione diretta (per questo caso la causa esatta non è stata isolata, segnalato onestamente invece di indovinare); il dialog coperto dall'header è confermato solo su desktop, e il codice conferma che non usa un portale. `roadmap.md` e `roadmap.html` rigenerati di conseguenza. PR #143 aperta verso main, non ancora unita.
**A metà:** l'appuntamento di prova di martedì 6 ottobre alle 9:00 con Milano Clean Squad è ancora sul calendario e va disdetto dal lato pro; il rapporto finale dell'audit, ordinato per gravità, non è ancora scritto.
**Applicato in produzione:** niente. Solo `roadmap/findings.csv`, `roadmap.md` e `roadmap.html` sono cambiati — nessun codice applicativo, nessuna migrazione, nessuna variabile toccata.
**Per Lucio:** la riga «La bozza di risposta del pro usa un LLM prima che il pro guardi il calendario» in `roadmap/findings.csv` aspetta una tua conferma — per quella rotta esistono un'etichetta IA visibile, una pseudonimizzazione del testo oltre il solo indirizzo, e un DPA firmato col fornitore, come chiede `docs/DATA_COMPLIANCE.md`?
