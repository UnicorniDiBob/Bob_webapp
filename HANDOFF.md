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

**Fatto:** ramo `fix/chat-cancel-ticket-customer` (da main 53d1785, due commit, NON spinto): in chat il cliente trova «Disdici» / «Chiama per annullare» sul biglietto confermato, con la stessa regola e lo stesso componente dell'area personale (`statoDisdetta()`, ripiego 48 ore), e sul biglietto annullato torna visibile il messaggio con il «Motivo: …». Provato con il rendering del componente (cliente e pro, confermato, dentro e fuori dal preavviso, concluso, annullato: 10 casi, 4 falliscono sul codice di main); lint, build e test passano. In `roadmap/findings.csv` aggiornata la riga dell'appuntamento nato in chat (la parte dell'area personale l'ha probabilmente già corretta la 113) e aggiunte due righe: la policy di inserimento dei messaggi che non controlla il mittente (per Lucio) e l'orario proposto dal cliente che non si ritira. Prima, oggi: area di tocco di 44px su mobile (PR #145 e #146, unite).
**A metà:** il ramo va spinto e messo in PR; dopo il merge, verifica dal vivo su www.meetonda.com, desktop e 390px, con una proposta in chat confermata e futura (il ritocco del motivo sull'annullato non è stato visto renderizzato nella pagina vera, solo nel codice). Poi `feat/customer-move-appointment` (spostamento da parte del cliente, migrazione 115), che parte da un main con questo ramo dentro. Restano dal 5-6/10: verifica a 390px del ramo con più pro dopo #146; il rapporto finale dell'audit ordinato per gravità non è scritto. L'appuntamento di prova del 6/10 alle 9:00 con Milano Clean Squad risulta annullato nel database (letto il 6/10).
**Applicato in produzione:** niente. Nessuna migrazione, nessuna variabile, nessun deploy.
**Per Lucio:** due righe aspettano te in `roadmap/findings.csv`: la bozza di risposta del pro che usa un LLM (etichetta IA, pseudonimizzazione, DPA?) e la nuova «Il cliente può scrivere in chat come se avesse scritto il professionista». Nella riga sull'orario proposto dal cliente c'è anche una cosa letta nella funzione viva: `appointments_customer_guard` non guarda `proposed_by`, quindi dall'API il cliente potrebbe confermare da solo la propria controproposta.
