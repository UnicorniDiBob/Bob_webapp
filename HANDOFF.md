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

**Fatto:** ramo `feat/customer-move-appointment` (da main 6036a76, due commit, NON spinto): il cliente sposta un appuntamento confermato con la regola della disdetta (fuori dal preavviso «Cambia orario» fra gli orari liberi, dentro «Chiama per spostare»), sulla riga dell'area personale e sul biglietto in chat. Lo spostamento torna da confermare; se il pro rifiuta, da qualunque strada, il database rimette confermato l'orario di prima (migrazione 115: `sposta_appuntamento()` SECURITY INVOKER e trigger `spostamento_rifiutato`, nessuna funzione condivisa riscritta). Prove: 12 prove della 115 e le 13 della 113 su Postgres 16 in Docker, dopo la ricostruzione dai soli file (0 errori), e la 115 applicata due volte di fila; 21 prove di rendering dei biglietti; lint, build, test; la route risponde 401/405 come la disdetta. Prima, oggi: PR #147 unita («Disdici» sul biglietto in chat, motivo visibile sull'annullato) e area di tocco di 44px (PR #145 e #146).
**A metà:** il ramo va spinto e messo in PR, e la PR la rivede Lucio PRIMA di applicare la 115. Dopo l'applicazione: advisor di sicurezza Supabase; poi verifica dal vivo su www.meetonda.com, desktop e 390px, con un pro e un cliente di prova (sposta, rifiuta, approva, dentro il preavviso), e della PR #147 (disdetta dal biglietto, motivo sull'annullato). Non provati senza una sessione vera: i clic di «Cambia orario», «Approva» e «Rifiuta» nel browser. Il messaggio del pro rifiutando dall'area di lavoro (ProWorkspace) resta «troviamo un altro orario» accanto a quello del database «resta confermato l'orario di prima». Restano dal 5-6/10: verifica a 390px del ramo con più pro dopo #146; il rapporto finale dell'audit ordinato per gravità non è scritto.
**Applicato in produzione:** niente. La migrazione 115 è solo nel ramo, NON applicata. Nessuna variabile, nessun deploy.
**Per Lucio:** la 115 aspetta la tua revisione nella PR (riusa il tuo interruttore `bob.annullamento` e aggiunge un `grant execute` su `private.quando_breve`; il trigger nuovo dipende dall'ordine alfabetico dei BEFORE: deve venire dopo `riproponi_se_spostato`). In `roadmap/findings.csv` aspettano te la bozza di risposta del pro che usa un LLM e «Il cliente può scrivere in chat come se avesse scritto il professionista»; nella riga sull'orario proposto dal cliente c'è anche `appointments_customer_guard` che non guarda `proposed_by`.
