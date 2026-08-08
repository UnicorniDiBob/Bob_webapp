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
| **Conservazione** | Finché il profilo del professionista è attivo |
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
| **Dati** | Email, città, momento del consenso (`consent_at`) |
| **Tabelle** | `city_waitlist` (solo service role) |
| **Destinatari** | Fornitore email (vedi A9), Supabase, Vercel |
| **Conservazione** | Fino al lancio nella città o alla revoca; comunque **non oltre 12 mesi** (DATA_COMPLIANCE §5, dati di prospect) |
| **Sicurezza** | Nessun accesso da ruolo anonimo o autenticato: solo service role |
| **Note** | **Per Bob non esiste il soft opt-in.** L'iscrizione a una lista d'attesa non è una vendita, quindi non abilita nulla di promozionale: l'email di lancio richiede una casella esplicita "contattami al lancio". È esattamente il punto su cui Verisure ha preso 400k € |

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

---

## Cosa manca ancora (non inventato, da chiudere da una persona)

1. **DPA e meccanismi di trasferimento** per Resend (A9) e Anthropic (A10). Sono le due lacune che un controllo troverebbe per prime, perché sono documenti che esistono o non esistono.
2. **LIA scritte** per ogni riga con base "legittimo interesse": A6 recensioni, A7 verifica, A12 statistiche, e la moderazione in A13.
3. **Etichetta AI Act art. 50** (A10) — già applicabile dal 2 agosto 2026.
4. **Tracciamento delle letture** dei dati personali da parte dello staff (A13).
5. **Fonte di verità unica per la posizione** (A3): oggi `requests.zone_slug`, `request_addresses.coarse_*` e `job_briefs.zone` coesistono.
6. **Identità del titolare** in `src/lib/company.ts`: i `[PLACEHOLDER]` sono differiti a gennaio 2027 per scelta, ma l'informativa e questo registro hanno bisogno di un titolare reale prima di trattare dati di utenti veri su scala.
7. **Memo DPO** (DATA_COMPLIANCE §7.4): non obbligatorio a questa scala, ma la valutazione va messa per iscritto.
