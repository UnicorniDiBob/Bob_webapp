# Registro dei trattamenti (ROPA) — Bob / meetonda.com

**Art. 30 GDPR.** Titolare: vedi `src/lib/company.ts` (i campi legali sono
`[PLACEHOLDER]` fino a gennaio 2027 — scelta consapevole, non una dimenticanza).
Contatto privacy: `COMPANY.privacyEmail`.

Compilato il 7 agosto 2026 leggendo lo schema Supabase e il codice, non a
memoria. Dove non ho potuto verificare una cosa dal codice o dal database l'ho
scritta **DA CONFERMARE** invece di inventarla: quelle righe vanno chiuse da una
persona, non indovinate.

L'esenzione sotto i 250 dipendenti (art. 30(5)) qui non si applica: il
trattamento non è occasionale. Il registro è obbligatorio in pratica.

**Come si mantiene:** una riga per finalità, non una per tabella. Quando una
feature aggiunge una finalità si aggiunge una riga; quando cambia i dati o la
conservazione si aggiorna quella esistente. È il punto 3 della checklist in
DATA_COMPLIANCE.md §8.

---

## A1 — Account e autenticazione

| | |
|---|---|
| **Finalità** | Creare e gestire l'account, autenticare, applicare i termini accettati |
| **Base giuridica** | Contratto — art. 6(1)(b) |
| **Interessati** | Clienti, professionisti, staff |
| **Dati** | Email, password (hash, gestita da Supabase Auth), nome, ruolo, data di nascita (`profile_private.date_of_birth`), data e versione dei termini accettati |
| **Tabelle** | `users`, `profiles`, `profile_private`, `auth.users` (Supabase) |
| **Destinatari** | Supabase (responsabile, hosting DB e auth), Vercel (responsabile, hosting applicativo) |
| **Trasferimenti** | Supabase progetto in regione UE; i subresponsabili includono entità USA. Vercel: elaborazione primaria negli USA → trasferimento presente, coperto da DPA/SCC. Vedi DATA_COMPLIANCE §7.6 |
| **Conservazione** | Finché l'account è attivo; fino a 12 mesi dalla cancellazione (allineato all'informativa) |
| **Sicurezza** | RLS su tutte le tabelle, service-role key solo server-side, MFA sulle dashboard Supabase/Vercel, `profile_private` separata dal profilo pubblico |
| **Note** | La data di nascita serve a verificare la maggiore età (servizio riservato a maggiorenni). Verificare che non sia esposta oltre il necessario — **DA CONFERMARE** quali ruoli la leggono |

## A2 — Richieste di preventivo e abbinamento cliente/professionista

| | |
|---|---|
| **Finalità** | Raccogliere la richiesta, presentarla ai professionisti pertinenti, permettere al cliente di scegliere |
| **Base giuridica** | Contratto — art. 6(1)(b): è il servizio che l'utente chiede |
| **Interessati** | Clienti, professionisti |
| **Dati** | Descrizione del problema, servizio e sottoservizio, città, urgenza, fascia di budget, foto caricate, tipo di immobile, note di accesso, disponibilità, segnali di attenzione |
| **Tabelle** | `requests`, `request_professionals`, `job_briefs` |
| **Destinatari** | I professionisti invitati (che diventano **titolari autonomi** per l'uso che ne fanno — EDPB 07/2020), Supabase, Vercel |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Per la durata del rapporto; se la richiesta porta a una transazione, fino alla prescrizione ordinaria (DATA_COMPLIANCE §5) |
| **Sicurezza** | RLS; il professionista vede solo le richieste a cui è stato invitato (`my_assigned_request_ids`) |
| **Note** | L'abbinamento resta **"il cliente scegle"**, non assegnazione automatica: è la scelta che tiene Bob fuori dall'Allegato III dell'AI Act e dalla direttiva sul lavoro tramite piattaforme. Non cambiarla senza rifare l'analisi |

## A3 — Indirizzo dell'intervento, con consegna progressiva

| | |
|---|---|
| **Finalità** | Permettere al professionista di valutare la trasferta prima di preventivare, e di raggiungere il cliente dopo che l'appuntamento è confermato |
| **Base giuridica** | Contratto — art. 6(1)(b) |
| **Interessati** | Clienti |
| **Dati** | **Prima dell'accettazione:** quartiere (`requests.zone_slug`) o CAP (`requests.postal_code`), oppure la sola città. **Dopo la conferma dell'appuntamento:** via e civico, note di accesso (`request_addresses`), copia-snapshot su `appointments.location_address`. Indirizzi salvati dal cliente per riuso: `customer_addresses` |
| **Tabelle** | `requests.zone_slug`, `requests.postal_code`, `request_addresses`, `customer_addresses`, `appointments.location_address` |
| **Destinatari** | Il solo professionista accettato riceve via e civico. I professionisti invitati ma non ancora scelti ricevono esclusivamente quartiere o CAP. Staff admin/cs per assistenza |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Legata alla richiesta e all'appuntamento; cancellata con essi (percorso di cancellazione nella migrazione 044) |
| **Sicurezza** | `request_addresses` è una tabella separata perché la RLS in Postgres è di riga e non di colonna: separarla è l'unico modo di far leggere via e civico al cliente e al solo professionista accettato. Apertura governata da `can_see_request_address()`, che richiede un appuntamento confermato |
| **Minimizzazione** | Il quartiere ha grana da 1 a 2 km², il CAP milanese è equivalente. Lo sceglie il cliente, è facoltativo, e **non è ricavato dall'indirizzo**: se il cliente non lo indica, il professionista vede la sola città |
| **Note** | Migrazioni 044 (consegna progressiva), 045 (quartiere), 046 (CAP). `request_addresses` porta anche `coarse_lat/coarse_lng/coarse_radius_m`: si sovrappone in parte a `zone_slug` e a `job_briefs.zone` — **DA CONFERMARE** quale delle tre resta la fonte di verità, oggi ce ne sono tre |

## A4 — Messaggi tra cliente e professionista

| | |
|---|---|
| **Finalità** | Ospitare la conversazione necessaria a definire il lavoro |
| **Base giuridica** | Contratto — art. 6(1)(b). La scansione anti-disintermediazione, se attivata, va su legittimo interesse con LIA scritta — **DA CONFERMARE** se è attiva oggi |
| **Interessati** | Clienti, professionisti |
| **Dati** | Testo dei messaggi, allegati, stato di lettura |
| **Tabelle** | `request_messages` |
| **Destinatari** | Le due parti della conversazione; staff admin/cs |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Chat legate a una transazione: fino alla prescrizione. Chat non legate a transazioni: cancellate circa 90 giorni dopo la cancellazione dell'account (DATA_COMPLIANCE §5) |
| **Sicurezza** | RLS per partecipante |
| **Note** | La regola di progetto vieta di concatenare l'indirizzo nel testo dei messaggi: è stato corretto (voce 41.1 dell'archivio). Non reintrodurlo |

## A5 — Appuntamenti

| | |
|---|---|
| **Finalità** | Fissare, confermare e gestire l'incontro |
| **Base giuridica** | Contratto — art. 6(1)(b) |
| **Interessati** | Clienti, professionisti |
| **Dati** | Data e ora, luogo (`location_address`), stato, disponibilità del professionista |
| **Tabelle** | `appointments`, `professional_availability`, `professional_availability_blocks` |
| **Destinatari** | Le due parti; staff admin/cs |
| **Conservazione** | Come A2 |
| **Sicurezza** | RLS; la conferma dell'appuntamento è il fatto che apre l'indirizzo (vedi A3) |

## A6 — Recensioni e punteggi

| | |
|---|---|
| **Finalità** | Pubblicare le valutazioni dei professionisti |
| **Base giuridica** | Legittimo interesse — art. 6(1)(f), con LIA — **DA CONFERMARE che la LIA sia scritta**: la regola di progetto la richiede per ogni uso del legittimo interesse |
| **Interessati** | Clienti (autori), professionisti (oggetto) |
| **Dati** | Punteggio, testo, autore, richiesta collegata |
| **Tabelle** | `ratings` |
| **Destinatari** | Pubblico (le recensioni sono visibili sul sito) |
| **Conservazione** | Finché il profilo del professionista è attivo. **Sopravvive alla cancellazione dell'autore**, de-identificata: dalla migrazione 056 `ratings.customer_id` va a NULL invece di portarsi via la riga (chiude G16). Prima era ON DELETE CASCADE, quindi cancellare un cliente toglieva al professionista una valutazione che aveva guadagnato |
| **Sicurezza** | RLS in scrittura |
| **Note** | Solo le recensioni legate a una transazione realmente conclusa possono essere etichettate "verificate". Alla cancellazione dell'account l'autore va de-identificato ("Utente eliminato") e la recensione sopravvive: `ON DELETE SET NULL` più segnaposto. Il calcolo del punteggio aggregato deve restare spiegabile |

## A7 — Verifica dei professionisti (P.IVA)

| | |
|---|---|
| **Finalità** | Verificare che il professionista esista e sia in regola; prevenire abusi |
| **Base giuridica** | Legittimo interesse — art. 6(1)(f), prevenzione frodi e tutela dei clienti |
| **Interessati** | Professionisti |
| **Dati** | P.IVA, ragione sociale dichiarata e restituita, indirizzo sede, livello di verifica, esiti e cronologia, autore della decisione |
| **Tabelle** | `professionals`, `professional_verification`, `verification_events` |
| **Destinatari** | VIES (servizio della Commissione europea, interrogato da `src/lib/vies.ts`), staff admin/cs |
| **Trasferimenti** | VIES è UE. Nessun trasferimento aggiuntivo |
| **Conservazione** | Per la durata del profilo; la cronologia serve come prova della diligenza |
| **Sicurezza** | RLS; `verification_events` registra chi ha deciso (`actor_user_id`, `actor_role`) — accesso staff a minimo privilegio e tracciato |
| **Note** | La P.IVA di una ditta individuale è un dato personale. Il ritentativo notturno è **fermo**: `CRON_SECRET` non è configurato in produzione (vedi `roadmap/findings.csv`, severità critica) |

## A8 — Liste d'attesa per nuove città

| | |
|---|---|
| **Finalità** | Avvisare chi lo ha chiesto quando Bob apre nella sua città |
| **Base giuridica** | **Consenso** — art. 6(1)(a) |
| **Interessati** | Potenziali clienti |
| **Dati** | Email, città, momento del consenso (`consent_at`), **testo accettato (`consent_text`)**, **consenso promozionale separato e facoltativo (`marketing_consent_at`, NULL se non prestato)** |
| **Tabelle** | `city_waitlist` (solo service role) |
| **Destinatari** | Fornitore email (vedi A9), Supabase, Vercel |
| **Conservazione** | Fino al lancio nella città o alla revoca; comunque **non oltre 12 mesi** (DATA_COMPLIANCE §5, dati di prospect) |
| **Sicurezza** | Nessun accesso da ruolo anonimo o autenticato: solo service role |
| **Note** | **Per Bob non esiste il soft opt-in.** L'iscrizione a una lista d'attesa non è una vendita, quindi non abilita nulla di promozionale: l'email di lancio richiede una casella esplicita "contattami al lancio". È esattamente il punto su cui Verisure ha preso 400k € |
| **Corretto il 19/08/2026** | Questa riga dichiarava il consenso come base giuridica, ma il consenso non veniva raccolto: il form chiedeva solo l'email e la migrazione 015 dava a `consent_at` un `default now()`, quindi ogni iscrizione nasceva con la prova di un atto affermativo mai avvenuto — la forma peggiore, perché il registro sembrava in ordine. Rimedio: spunta obbligatoria nel form, controllo anche server-side nella route, salvataggio del testo accettato, e rimozione del default (migrazioni 053 e 054). Verificato prima di intervenire che `city_waitlist` avesse 0 righe: nessuna bonifica di consensi finti da fare. **La spunta può essere obbligatoria senza violare l'art. 7(4)**: l'avviso al lancio non è un extra agganciato a un altro servizio, è l'unico servizio che quel form offre. Il consenso promozionale, che sarebbe un extra, è una spunta separata e spenta |

## A9 — Email transazionali

| | |
|---|---|
| **Finalità** | Conferme, avvisi di nuovo messaggio, sicurezza dell'account, reimpostazione password |
| **Base giuridica** | Contratto — art. 6(1)(b) |
| **Interessati** | Clienti, professionisti |
| **Dati** | Email, nome, riferimenti minimi alla richiesta |
| **Codice** | `src/lib/email.ts`, `src/lib/notify.ts`, `src/app/api/notify/route.ts` |
| **Destinatari** | **Resend** (responsabile) |
| **Trasferimenti** | Resend è statunitense → trasferimento presente. **DA CONFERMARE: DPA firmato e meccanismo di trasferimento (DPF o SCC) documentato.** Fino a quella conferma questa riga è incompleta |
| **Conservazione** | **DA CONFERMARE**: quanto Resend conserva i log di invio |
| **Sicurezza** | Chiave solo server-side |
| **Note** | Oggi **dormiente**: senza `RESEND_API_KEY` ogni invio viene ignorato e l'endpoint risponde 200. Le email transazionali devono restare rigorosamente non promozionali: un contenuto commerciale dentro una notifica la trasforma in marketing senza consenso. DATA_COMPLIANCE §7.6 suggerisce un fornitore UE (Brevo, Mailjet, Scaleway) per eliminare del tutto l'analisi del trasferimento |

## A10 — Sintesi della richiesta generata da un LLM

| | |
|---|---|
| **Finalità** | Riassumere la richiesta al professionista; assistere il cliente nella chat di Bob |
| **Base giuridica** | Contratto — art. 6(1)(b): è parte della presentazione del servizio richiesto |
| **Interessati** | Clienti |
| **Dati inviati** | Descrizione del problema e attributi della richiesta, **senza via e civico** (rimossi: voce 41.2 dell'archivio) |
| **Codice** | `src/app/api/pro/request-summary/route.ts` (modello `claude-3-5-haiku-latest`), `src/app/api/bob/chat/route.ts`, `src/lib/bob.ts` |
| **Destinatari** | **Anthropic** (responsabile) |
| **Trasferimenti** | **DA CONFERMARE**: DPA firmato, regione UE o termini a conservazione zero, esclusione dell'addestramento sui dati di Bob. La regola di progetto li richiede tutti e tre |
| **Conservazione** | Nessuna conservazione lato Bob della richiesta inviata; l'output è transitorio |
| **Sicurezza** | Chiave solo server-side; minimizzazione e pseudonimizzazione del contenuto inviato |
| **Note** | **AI Act art. 50, applicabile dal 2 agosto 2026**: l'interazione con l'AI va etichettata. Voce aperta in `roadmap/findings.csv` con severità "serious". Nessuna decisione automatizzata che sospenda, escluda o retroceda un professionista passa da qui: se mai servisse, art. 22 impone un umano nel ciclo e la DPIA **prima** del lancio |

## A11 — Memoria delle preferenze del cliente

| | |
|---|---|
| **Finalità** | Non richiedere ogni volta le stesse informazioni (ultimo servizio, città, fascia di budget, urgenza preferita) |
| **Base giuridica** | Contratto — art. 6(1)(b) per la comodità del servizio richiesto. **Attenzione**: se questa memoria diventasse personalizzazione orientata all'engagement, la base contrattuale cade (EDPB 2/2019) e serve il consenso |
| **Interessati** | Clienti |
| **Dati** | Ultimo servizio, ultima città, ultima fascia di budget, urgenza preferita, contatore di ricerche |
| **Tabelle** | `customer_memory` |
| **Destinatari** | Nessuno fuori da Bob |
| **Conservazione** | Finché l'account è attivo; cancellata con l'account |
| **Sicurezza** | RLS per utente |
| **Note** | Non è profilazione con effetti giuridici. Se si aggiunge un'opzione di opposizione (art. 21), documentarla qui |

## A12 — Statistiche aggregate di ricerca

| | |
|---|---|
| **Finalità** | Capire quali servizi e città vengono cercati |
| **Base giuridica** | Legittimo interesse — art. 6(1)(f) |
| **Interessati** | Nessuno identificabile |
| **Dati** | Servizio, sottoservizio, città, origine, momento. **Nessun `user_id`, nessun IP**: la tabella non contiene dati personali |
| **Tabelle** | `search_events` |
| **Note** | Sta nel registro per completezza e per rendere evidente che è aggregata. **Non esiste ancora nessuno strumento di analytics**: quando si sceglierà, deve essere esente da consenso secondo il §7.2 del Garante (Plausible o Matomo). GA4, pixel pubblicitari o session replay richiedono prima un banner conforme |

## A13 — Accesso dello staff e tracciamento

| | |
|---|---|
| **Finalità** | Assistenza clienti, moderazione, decisioni di verifica |
| **Base giuridica** | Contratto per l'assistenza; legittimo interesse per la moderazione |
| **Interessati** | Clienti, professionisti |
| **Dati** | Accesso in lettura ai dati delle righe A1–A7 secondo il ruolo |
| **Meccanismo** | Ruoli distinti `admin` e `cs` (`is_admin()`, `is_admin_or_cs()`), 19 policy RLS |
| **Note** | Minimo privilegio e tracciamento sono richiesti dalla regola di progetto. `verification_events` traccia le decisioni di verifica; **DA CONFERMARE** se esiste un tracciamento equivalente per le semplici letture dei dati personali da parte dello staff — probabilmente no, ed è la lacuna più concreta di questa riga |

## A14 — Pagamenti e abbonamenti — **NON ATTIVO**

| | |
|---|---|
| **Stato** | Le tabelle esistono e sono **vuote**: `payments`, `refunds`, `disputes`, `payouts`, `subscriptions`, `subscription_invoices`, `pro_payment_accounts` (0 righe ciascuna). Stripe è citato in `src/app/api/pro/instant-book/route.ts` |
| **Finalità prevista** | Incassi, abbonamenti dei professionisti, pagamenti |
| **Base giuridica prevista** | Contratto per l'esecuzione; obbligo legale — art. 6(1)(c) per la conservazione fiscale |
| **Conservazione prevista** | Fatture **10 anni** (DATA_COMPLIANCE §5) |
| **Destinatari previsti** | Stripe: responsabile per il pagamento, **titolare autonomo** per antifrode e antiriciclaggio |
| **Note** | Riga da completare **prima** di incassare il primo euro, non dopo. Il DPA di Stripe promette la notifica di violazione a Bob entro 48 ore: va collegata allo stesso playbook degli artt. 33/34 |

## A15 — Questionario di onboarding dei professionisti

| | |
|---|---|
| **Finalità** | Raccogliere all'iscrizione mestiere, città e zona di lavoro, anzianità e canale di provenienza, per proporre il professionista alle richieste pertinenti |
| **Base giuridica** | Contratto — art. 6(1)(b) per mestiere/città/zona/esperienza (senza, il matching non funziona); legittimo interesse — art. 6(1)(f) per il canale di provenienza (facoltativo, metrica di marketing) — **LIA da scrivere** |
| **Interessati** | Professionisti |
| **Dati** | Mestiere/categoria, città, zona (testo libero), anni di esperienza, come ci ha conosciuto, piano scelto |
| **Tabelle** | `onboarding_answers` (mig 052) |
| **Destinatari** | Supabase, Vercel (come A1) |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Finché l'account esiste; cancellazione a cascata con l'utente (FK on delete cascade) |
| **Sicurezza** | RLS: legge solo l'interessato e lo staff admin/cs |
| **Note** | Introdotto il 14/08/2026 col flusso di onboarding. Il campo "come ci hai conosciuto" è dichiarato facoltativo nel form |

## A16 — Documenti di verifica dei professionisti

| | |
|---|---|
| **Finalità** | Permettere al professionista di fornire i documenti richiesti dallo staff per la verifica (visura, attestati, documento d'identità) — completa A7 |
| **Base giuridica** | Come A7 (misura precontrattuale/contratto per il badge richiesto dal professionista) |
| **Interessati** | Professionisti |
| **Dati** | File caricati (possono contenere documento d'identità), nome file, esito dell'esame, note dello staff |
| **Tabelle** | `verification_documents` + bucket storage **privato** `verifica-documenti` (mig 052) |
| **Destinatari** | Supabase, Vercel (come A1) |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Con la pratica di verifica, finché il profilo esiste (allineata ad A7); righe cancellate a cascata con l'account. **ATTENZIONE**: i file nel bucket NON si cancellano a cascata — vanno rimossi nel processo di cancellazione account (vedi punto 8 sotto) |
| **Sicurezza** | Bucket privato, path per-utente, lettura solo proprietario+staff (RLS storage), accesso staff via link firmati a scadenza 1h, mai URL pubblici |
| **Note** | Chiude il buco del 10.2: prima i documenti giravano via email, fuori piattaforma |

## A17 — Codici promozionali (beta)

| | |
|---|---|
| **Finalità** | Attivare piani a pagamento in betatesting, in assenza del checkout (M7); tracciare chi ha riscattato cosa per revocare al lancio |
| **Base giuridica** | Contratto — art. 6(1)(b) |
| **Interessati** | Professionisti |
| **Dati** | Codice riscattato, utente, data del riscatto |
| **Tabelle** | `promo_codes`, `promo_redemptions` (mig 052) |
| **Destinatari** | Supabase, Vercel (come A1) |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Finché l'account esiste (cascata); i codici in sé non sono dati personali |
| **Sicurezza** | Codici non leggibili né enumerabili dal client (nessuna policy per anon/authenticated); convalida solo server-side |
| **Note** | Da ritirare quando Stripe (12.1) va live: la riga A14 prende il suo posto |

## A18 — Comunicazioni commerciali (novità e offerte dei partner)

*Aggiunta il 19 agosto 2026, con la migrazione 053.*

| | |
|---|---|
| **Finalità** | Inviare comunicazioni promozionali a chi le ha chieste: novità di Bob (`bob_news`) e offerte di servizi in partnership per chi lavora in proprio (`partner_offers`) |
| **Base giuridica** | **Consenso** — art. 6(1)(a), uno per finalità |
| **Interessati** | Clienti, professionisti |
| **Dati** | Utente, finalità, stato (prestato/revocato), testo accettato, origine della scelta, momento |
| **Tabelle** | `communication_consents` (mig 053) |
| **Codice** | `src/components/ComunicazioniForm.tsx`, `src/app/dashboard/comunicazioni/page.tsx` |
| **Destinatari** | Fornitore email (vedi A9), Supabase, Vercel. **Ai partner non viene comunicato nessun indirizzo**: se ci sarà un'offerta, la manda Bob |
| **Trasferimenti** | Come A1 e A9 |
| **Conservazione** | Finché l'account esiste; cancellazione a cascata con l'utente (`on delete cascade` su `users`). Non c'è interesse a conservare la prova del consenso di una persona che non esiste più |
| **Sicurezza** | RLS: un utente legge e scrive solo le proprie righe, lo staff legge in sola lettura. **Nessuna policy di update o delete, per nessun ruolo**: il registro è in sola aggiunta, e una revoca è una riga nuova con `granted = false`. Verificato con una prova riga per riga il 19/08/2026 (insert altrui rifiutato, finalità fuori elenco rifiutata, delete e update a zero righe) |
| **Note** | **Cosa NON sta qui, ed è il punto della riga.** Le comunicazioni di servizio (nuova richiesta, nuovo messaggio, appuntamenti, esito della verifica, sicurezza) stanno in A9 con base contrattuale e non sono disattivabili finché l'account è attivo. Rappresentarle come una preferenza revocabile sarebbe sbagliato in due direzioni insieme: darebbe per facoltativo ciò che è dovuto, e legherebbe il consenso commerciale al servizio, che è la costruzione vietata dall'art. 7(4). Per la stessa ragione **il consenso non è e non deve diventare un requisito della verifica del profilo**: al suo posto si chiede un'email confermata, che è raggiungibilità e non consenso |
| **DPIA** | Non innesca: nessun trattamento su larga scala, nessuna categoria particolare, nessuna profilazione — le comunicazioni non sono personalizzate sul comportamento. Se in futuro venissero segmentate sul comportamento di navigazione, la valutazione va rifatta e serve anche l'art. 122 del Codice Privacy (banner) |

## A19 — Assistenza clienti (ticket)

*Aggiunta il 19 agosto 2026, con la migrazione 055.*

| | |
|---|---|
| **Finalità** | Ricevere una richiesta di aiuto e rispondere |
| **Base giuridica** | Contratto — art. 6(1)(b) per gli utenti registrati (l'assistenza è parte del servizio). **Legittimo interesse** — art. 6(1)(f) per chi scrive senza account: rispondere a una richiesta che ci ha rivolto lui. Nessun consenso: non è marketing ed è l'interessato a iniziare — **LIA da scrivere**, come per le altre righe a legittimo interesse |
| **Interessati** | Clienti, professionisti, e chiunque scriva senza account (tipicamente chi non riesce ad accedere) |
| **Dati** | Email, categoria, titolo, racconto del problema in testo libero, e la nostra risposta. Il testo libero può contenere qualunque cosa la persona scelga di scriverci: è il rischio strutturale di ogni casella di assistenza, e si governa con la minimizzazione in risposta, non a monte |
| **Tabelle** | `support_tickets` (mig 055) |
| **Codice** | `src/app/supporto/`, `src/components/SupportoForm.tsx`, `src/app/api/supporto/route.ts`, `src/app/impostazioni/assistenza/`, `src/app/admin/assistenza/` |
| **Destinatari** | Supabase, Vercel (come A1). Staff admin e CS. **Nessun fornitore email**: la risposta vive dentro Bob |
| **Trasferimenti** | Come A1 |
| **Conservazione** | Utenti registrati: quanto l'account, poi **cancellazione a cascata**. Ticket **anonimi** (`user_id` null): non hanno un account che li porti via, quindi hanno una regola propria — **12 mesi**, come i dati di prospect (DATA_COMPLIANCE §5). La cancellazione periodica è lavoro di P3.9: qui la regola è dichiarata, il job la applicherà — **finché quel job non esiste, questa riga è incompleta** |
| **Sicurezza** | RLS provata riga per riga il 19/08 con un utente non-staff: vede solo i propri ticket, non può inserirne dal client (si passa dalla route con service role, dove stanno honeypot, validazione e tetto di 5 aperti), non può scrivere la risposta dello staff, non può cambiare lo stato né cancellare. Nessuna policy di delete per nessuno: un ticket si chiude, non si cancella |
| **Note** | **Cascata e non SET NULL, di proposito.** La tentazione è conservare il ticket slegandolo dalla persona per tenere lo storico: ma il ticket contiene un'email e il racconto del problema, quindi slegarlo lascerebbe dati personali orfani e non cancellabili — esattamente ciò che la regola di progetto vieta. Se servirà la statistica, si terrà un aggregato senza persone dentro, non il ticket svuotato |
| **DPIA** | Non innesca da sola: nessuna larga scala, nessuna profilazione, nessuna decisione automatizzata. Ma il testo libero può far arrivare categorie particolari (art. 9) non richieste — es. un problema di salute raccontato per spiegare un appuntamento mancato. Non si può impedire; si governa non chiedendole, non usandole per altro, e non ripetendole nella risposta |

## A20 — Chiusura e cancellazione dell'account

*Aggiunta il 19 agosto 2026, con la migrazione 056.*

| | |
|---|---|
| **Finalità** | Eseguire la richiesta di cancellazione, e nel frattempo impedire che l'account continui a operare |
| **Base giuridica** | Obbligo legale / esercizio di un diritto dell'interessato — artt. 17 e 12(3) GDPR. Per il codice del motivo conservato in forma anonima: **legittimo interesse** (capire perché le persone se ne vanno) su un dato che non è più personale — **LIA da scrivere**, come per le altre righe |
| **Interessati** | Clienti e professionisti. **Non lo staff**: un admin non si autocancella da qui (si porterebbe via l'accesso al pannello), la route lo rifiuta esplicitamente |
| **Dati** | Utente, momento della richiesta, scadenza, codice del motivo e nota libera — gli ultimi due **facoltativi** |
| **Tabelle** | `account_deletion_requests` (vive quanto la richiesta), `account_deletion_reasons` (**senza utente**), `professionals.deactivated_at` |
| **Codice** | `src/app/api/account/cancellazione/route.ts`, `src/app/api/cron/cancella-account/route.ts`, `src/components/CancellazioneAccount.tsx`, `src/components/CancellazioneBanner.tsx`, `src/lib/cancellazione.ts` |
| **Conservazione** | La richiesta e la nota libera muoiono con l'account (cascata). Il **codice** del motivo resta a tempo indeterminato, ma non è più un dato personale: nessun utente, nessun testo, solo codice + ruolo + data |
| **Sicurezza** | La richiesta richiede la **password** — non è attrito sul diritto, è la prova che chi lo esercita è la persona giusta: senza, chi trova un telefono sbloccato cancella l'account di un altro. L'annullamento è una delete della propria riga via RLS: è un diritto, non deve passare da noi. Nessuna insert dal client: la route con service role è l'unico posto dove creare la richiesta, spegnere il profilo e registrare il motivo anonimo possono avvenire insieme |
| **Le tre scelte che vengono dalla legge** | **(1)** Il motivo è facoltativo: l'art. 12(2) obbliga ad *agevolare* l'esercizio dei diritti, e una motivazione obbligatoria è un ostacolo. **(2)** I sette giorni stanno dentro l'art. 12(3) e non sono un ritardo ingiustificato ex art. 17(1) *perché sono dichiarati* — in `/impostazioni/accesso`, nell'avviso in cima a ogni pagina e in questa informativa. **(3)** Il profilo si **spegne subito**: se restasse visibile e continuasse a ricevere richieste, i sette giorni sarebbero un ritardo vero, non una cortesia |
| **Cosa la cascata NON porta via, e il cron sì** | I file in `verifica-documenti/<user_id>/` non sono righe: li rimuove il cron prima di cancellare l'account (era il punto 8 di questa lista). Se il bucket non risponde, l'account va via comunque e il contatore lo segnala: un file orfano non giustifica una cancellazione non eseguita |
| **Cosa resta di proposito** | Le recensioni scritte dalla persona, de-identificate (`customer_id` a NULL): appartengono anche al professionista che le ha ricevute. Il profilo pubblico non ha mai mostrato il nome dell'autore, quindi non cambia niente per chi legge |
| **DPIA** | Non innesca. Nessuna decisione automatizzata con effetti sulla persona: il processo *esegue* una scelta che la persona ha fatto, ed è reversibile per sette giorni |

---

## Cosa manca ancora (non inventato, da chiudere da una persona)

1. **DPA e meccanismi di trasferimento** per Resend (A9) e Anthropic (A10). Sono le due lacune che un controllo troverebbe per prime, perché sono documenti che esistono o non esistono.
2. **LIA scritte** per ogni riga con base "legittimo interesse": A6 recensioni, A7 verifica, A12 statistiche, e la moderazione in A13.
3. **Etichetta AI Act art. 50** (A10) — già applicabile dal 2 agosto 2026. **Metà fatta, verificata il 19/08/2026:** nella chat cliente l'etichetta c'è dall'8 agosto (`src/components/BobChat.tsx`, righe 775 e 781). Resta scoperta l'area professionista: la sintesi delle richieste generata dall'LLM (`ProRequestSummary`) non è etichettata come contenuto AI.
4. **Tracciamento delle letture** dei dati personali da parte dello staff (A13).
5. **Fonte di verità unica per la posizione** (A3): oggi `requests.zone_slug`, `request_addresses.coarse_*` e `job_briefs.zone` coesistono.
6. **Identità del titolare** in `src/lib/company.ts`: i `[PLACEHOLDER]` sono differiti a gennaio 2027 per scelta, ma l'informativa e questo registro hanno bisogno di un titolare reale prima di trattare dati di utenti veri su scala.
7. **Memo DPO** (DATA_COMPLIANCE §7.4): non obbligatorio a questa scala, ma la valutazione va messa per iscritto.
8. ~~**Cancellazione dei file di verifica** (A16)~~ — **chiuso il 19/08/2026 con la migrazione 056**: il cron `/api/cron/cancella-account` svuota `verifica-documenti/<user_id>/` prima di cancellare l'account. Vedi A20.
