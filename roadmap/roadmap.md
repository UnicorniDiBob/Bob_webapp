# BOB — Roadmap per traguardi

_Generato da `milestones.csv` + `roadmap.csv` — non modificare a mano. Aggiorna i CSV e rilancia `python3 roadmap/build_roadmap.py` (o lascia fare alla GitHub Action)._

**Stato:** 52 attività aperte · 3 pronte ma spente · 29 parcheggiate · 91 chiuse (in `ARCHIVE.csv`)

**Track:** Client/Pro → André · Internal → Lucio · Shared

## Controllo di realtà

**Il ritentativo notturno gira dall'8 agosto: il finding era vecchio di undici giorni** — _Chiusa 19 ago 2026 — era gia' falsa_

SUPERATA. Questa riga diceva 'non ha mai girato, CRON_SECRET non e' impostato in produzione' e citava un 503. Era vero quando e' stata scritta, cioe' prima dell'8 agosto. Verificato il 19/08 leggendo system_job_runs: 11 giri consecutivi dall'8 al 18 agosto, tutti ok=true, l'ultimo il 18 alle 22:50 UTC, ognuno di durata un secondo. La riga 10.14 ('resta: CRON_SECRET + un deploy') era ancora 'In progress' per la stessa ragione: nessuno era tornato a guardare. Spostata in ARCHIVE. LA LEZIONE, che vale piu' del finding: un pannello di controllo di realta' non riletto diventa esso stesso una fonte di dati sbagliati - due delle quattro righe aperte qui erano superate. Da qui in poi va rigenerato a ogni traguardo chiuso, come dice la regola 5.

**L'etichettatura AI Act art. 50 nella chat c'e', dall'8 agosto** — _Chiusa 19 ago 2026 — era gia' falsa_

SUPERATA. Questa riga diceva 'no labelling found in src/components/BobChat.tsx'. Verificato il 19/08: l'etichetta e' alle righe 775 e 781 dello stesso file - un title esplicito "Bob e' un assistente basato su intelligenza artificiale" e la dicitura visibile "Assistente AI". La nota di chiusura di M2 lo diceva gia' ('in produzione dall'8 agosto, obbligo art. 50 in vigore dal 2') ma questo pannello non era stato aggiornato. RESTA APERTO IL PEZZO GEMELLO, e non e' la stessa cosa: nell'area professionista i contenuti generati da AI non sono etichettati (il riassunto delle richieste in ProRequestSummary). Sta nel piano del 18/08 come P2.8.

**There is no analytics tool at all — every 2027 KPI gate is currently unfalsifiable** — _Never installed_

The cookie policy page describes analytics, but nothing is wired: no Plausible, no Matomo, no tag of any kind in the source. The two KPI milestones (60–80 pros / 150 req-mo; 600 pros / 1,500 req-mo) cannot be measured today, and the admin "Analisi" dashboard computes its aggregates in the page at demo volumes.

**Five SECURITY DEFINER helpers are published as public RPC endpoints** — _Chiusa 8 ago 2026_

RISOLTA dalla migrazione 048, applicata in produzione l'8 agosto. Le cinque funzioni vivono ora in uno schema `private` non esposto e le 21 policy che le chiamano (non 19: il conteggio precedente era basso) sono state riscritte col nome qualificato. Il rimedio suggerito dall'advisor (revocare EXECUTE) sarebbe stato distruttivo e non e' stato usato. Verificato dopo l'applicazione: 0 funzioni SECURITY DEFINER in public eseguibili da anon o authenticated, policy 83 prima e 83 dopo, 0 policy che citano ancora i nomi non qualificati. Prove funzionali: login pro reale su /dashboard e /messaggi, admin e anonimo via claim JWT, trigger protect_professional_columns su entrambi i rami.

**La deriva NON era chiusa: il repo non riusciva a ricostruire un database, si fermava alla 032** — _Era piu' grave di quanto scritto — chiusa 8 ago 2026_

Questa riga diceva 'healed, worth a tidy'. Sbagliato. public.rls_auto_enable() - la funzione dietro l'event trigger ensure_rls, che accende la RLS su ogni tabella nuova in public - esisteva in produzione e in nessun file del repo, creata a mano. La 032 revoca l'EXECUTE su quella funzione, quindi su un clone nuovo la 032 si fermava con 'function does not exist' e con lei TUTTE le migrazioni dalla 032 alla 046. Nessun controllo lo diceva perche' nessuno aveva mai provato a ricostruire. RISOLTA: la 047 dichiara funzione ed event trigger copiando la definizione da pg_get_functiondef carattere per carattere, la revoke nella 032 e' diventata condizionale, e scripts/schema_check.sh rende la verifica ripetibile. I cinque nomi orfani nella storia live erano invece tutti gia' coperti (013 e 038): quella parte era davvero cosmetica, la mappa e' nel README delle migrazioni.

**Leaked password protection non attivabile: richiede il piano Pro** — _Accettata consapevolmente — non disponibile sul piano free_

L'advisor di sicurezza chiede di attivare il controllo delle password compromesse (HaveIBeenPwned). Provato l'8 agosto: il salvataggio viene rifiutato con 'Configuring leaked password protection via HaveIBeenPwned.org is available on Pro Plans and up'. L'organizzazione Bob e' sul piano free, quindi il finding NON e' risolvibile in codice ne' in configurazione. ACCETTATA per ora: 12 account, tutti di test, nessun utente reale. MITIGAZIONI al suo posto, disponibili sul free: lunghezza minima della password portata da 6 a 8 caratteri - VERIFICATA il 9 agosto rileggendo il campo nel dashboard, non solo dichiarata (il salvataggio dell'intero form poteva essere stato annullato dal rifiuto del toggle Pro: non lo e' stato). Requisiti di composizione: impostati nello stesso salvataggio, non riletti - se qualcuno passa da quella schermata, vale la pena guardarli. CONDIZIONE CHE ANNULLA L'ACCETTAZIONE: al passaggio al piano Pro, e in ogni caso PRIMA di far registrare professionisti reali (outreach da ottobre, M8) o clienti reali. A quel punto va attivata e questa riga va richiusa come risolta. Il gate di M1 ammette esplicitamente questa strada: 'every advisor finding fixed OR documented as accepted'.

**Il registro dei giri cron scrive solo sul giro a vuoto** — _Parziale — basta per il gate, non per il quadro completo_

La 049 aggiunge system_job_runs e registraGiro() in api/cron/verifica-piva, ma la chiamata e' solo sul ramo 'niente in attesa'. Un giro che elabora davvero dei casi non lascia ancora una riga. Basta per il cancello 1 di M1 (dimostrare che il cron gira), non per sapere cosa ha fatto. Rimedio: una registraGiro() al return finale della route, con i contatori confermati/daEsaminare/ancoraGiu gia' calcolati nel corpo.

**Il codice fondatori non ha ne' scadenza ne' tetto di utilizzi** — _Trovata 19 ago 2026_

BOB-FOUNDER-2026 concede Bob Business e la descrizione dice 'revocabile'. Nel database, pero', max_uses e' NULL e expires_at e' NULL: chiunque abbia il codice ottiene Business gratis, per un numero illimitato di account, senza data di fine. 'Revocabile' oggi significa soltanto 'finche' non lo disattiva qualcuno a mano da admin'. Il piano del 18/08 assume che i promo dei primi sessanta scadano a febbraio (P2.16, procedura di decadenza) e costruisce sopra quell'assunzione: nel database non c'e' niente che scada. Con 3 professionisti a piano pagante non e' un problema; da ottobre, con il codice che gira nell'outreach, e' un problema di ricavi e anche di P2B (un declassamento a sorpresa richiede preavviso e motivazione, art. 4). SEGNALATA ANCHE UNA DERIVA MINORE, sulla stessa tabella: promo_codes.used_count dice 1 mentre le righe in promo_redemptions sono 0. Il contatore viene incrementato al riscatto e non decrementato quando il riscatto sparisce - e' emerso cancellando l'account di test sig.mozzato@gmail.com il 19/08. Va deciso se used_count conta i riscatti vivi (allora serve un trigger, e va riportato a 0) o quelli di sempre (allora e' corretto, ma un account cancellato consuma per sempre uno slot quando max_uses esistera').


## M1 · The build tells the truth

**Finestra:** 2026-08-06 → 2026-08-14 · **0 aperte, 5 chiuse**

**Perché:** CHIUSA IL 9 AGOSTO 2026, cinque giorni dentro la finestra. Ogni piano piu' sotto assume che board, repo e produzione dicano la stessa cosa. CORRETTO L'8 AGOSTO, dopo aver provato a eseguire il controllo invece di descriverlo: il problema non era che la storia delle migrazioni e il repo litigassero su cinque nomi. Quei cinque nomi erano gia' coperti (013 e 038) - davvero cosmetici. Il problema vero era che il repo NON RICOSTRUIVA AFFATTO un database: public.rls_auto_enable() esisteva in produzione e in nessun file, la 032 ne revoca l'EXECUTE, quindi un clone nuovo si fermava alla 032 e perdeva tutto fino alla 046. Nessun controllo lo diceva perche' nessuno aveva mai provato a ricostruire. Piu' tre item marcati Done che non girano. Questa milestone costa poche ore e rende verificabile, invece che assunto, tutto quello che viene dopo. CHIUSURA: il ritentativo notturno ha girato per la prima volta nella notte fra l'8 e il 9 agosto - una riga in system_job_runs, ok = true, outcome {"esaminati": 0}, durata un secondo. Partito alle 22:31 UTC contro le 22:00 chieste da vercel.json: i cron di Vercel non garantiscono il minuto esatto, irrilevante per un lavoro che deve solo girare a giornata finita.

**È fatto quando:** Lo script di ricostruzione (scripts/schema_check.sh) applica 001->NNN su un Postgres vuoto con 0 errori e le otto impronte di schema coincidono con la produzione - NON "supabase db diff pulito": con la numerazione NNN_nome.sql la CLI non riesce ad appaiare i file e quel diff non e' utilizzabile qui; il ritentativo notturno ha dimostrabilmente girato almeno una volta (una riga in system_job_runs); ogni finding dell'advisor e' risolto oppure accettato per iscritto CON una condizione di scadenza; DATA_COMPLIANCE.md e' davvero nel repo.

<details><summary>5 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 7b | Migrations backfill 001-017, CI (build+lint), RLS performance cleanup (018) | Claude | 2026-07-16 |
| T1 | Roadmap tracker automation: CSV source + generator + Markdown + GitHub Action | André | 2026-07-19 |
| N1 | Ricostruzione del database dai soli file del repo: RISOLTA con la 047 (dichiara public.rls_auto_enable() e l'event trigger ensure_rls, che esistevano in produzione e in nessun file) + revoke condizionale nella 032. Prima di questo un clone nuovo si fermava alla 032 e perdeva tutto fino alla 046: il repo non ricostruiva niente. I 5 nomi orfani nella storia live erano invece gia' coperti da 013 e 038 - quella parte era davvero cosmetica, la mappa e' nel README delle migrazioni. NIENTE `supabase db diff` in CI: con la numerazione NNN_nome.sql la CLI non appaia i file e quel diff non e' utilizzabile qui. Il controllo giusto e' scripts/schema_check.sh: rigioca 001->NNN su un Postgres vuoto e confronta otto impronte con la produzione. Verificato l'8 agosto: 0 errori, otto impronte identiche. | Claude | 2026-08-08 |
| N2 | Advisor pass: da 10 WARN a 1, con 0 ERROR. ATTENZIONE, la prescrizione originale di questa riga era distruttiva: revocare EXECUTE avrebbe rotto l'accesso a tutta l'applicazione, perche' 21 policy su 11 tabelle chiamano quelle funzioni e una policy e' valutata coi privilegi di chi interroga. Fatto invece con la 048: le cinque funzioni (non quattro: c'e' anche can_see_request_address, dalla 044) spostate in uno schema `private` non esposto e le 21 policy riscritte col nome qualificato. Verificato: 0 funzioni SECURITY DEFINER in public eseguibili da anon o authenticated, policy 83 prima e 83 dopo, login pro reale e admin funzionanti. Leaked password protection NON attivabile: richiede il piano Pro, salvataggio rifiutato dal dashboard. Accettata per iscritto in findings.csv con condizione di scadenza (prima dei pro reali). Mitigazioni al suo posto: lunghezza minima password da 6 a 8 e requisiti di composizione. | Claude | 2026-08-08 |
| N3 | Tracker sullo schema per traguardi: milestones.csv con why/done_when, ARCHIVE.csv, il generatore produce roadmap.md + roadmap.html, GitHub Action al push. L'xlsx e' ritirato per davvero: BOB_Roadmap_Gantt.xlsx non e' piu' tracciato da git (rimosso a luglio) e roadmap/README.md scrive perche' - le barre per singola attivita' rendevano il grafico illeggibile e quasi tutte le date erano inventate per farle comparire. Resta solo una copia non tracciata sul disco locale, innocua. Verificato il 9 agosto: il generatore valida gli stati di attivita' E di traguardo, e avvisa se un traguardo e' chiuso con attivita' ancora aperte. | Claude | 2026-08-09 |

</details>


## M2 · We hold only what we can justify

**Finestra:** 2026-08-06 → 2026-08-31 · **0 aperte, 11 chiuse**

**Perché:** AGGIORNATO L'8 AGOSTO — 4 delle 6 condizioni sono chiuse e verificate. L'indirizzo esatto non va piu' a cinque estranei (mig 044-046, consegna progressiva, verificata anche nel browser con un login pro reale) e la chat dichiara di essere un assistente AI (in produzione dall'8 agosto, obbligo art. 50 in vigore dal 2). RESTA URGENT per una ragione precisa e ancora vera: il telefono di un professionista e' leggibile da un visitatore anonimo. profiles ha lettura pubblica dalla 003 - giusto, e' cosi' che funzionano i profili pubblici - ma profiles.phone sta nella stessa tabella, e la RLS agisce sulle righe, non sulle colonne. Provato l'8 agosto come ruolo anon: 5 righe viste, 1 telefono leggibile. Restano anche 3 richieste pre-044 con via e civico dentro la prosa libera (problem_description): la bonifica non li aveva estratti perche' erano in mezzo a una frase, come documenta l'intestazione di src/lib/redact.ts. Il confine LLM e' coperto da stripAddresses(), ma il dato grezzo e' ancora li'. CHIUSA IL 14 AGOSTO: il telefono del pro spostato in tabella propria con RLS (mig 051, dopo che il tentativo a una riga della mig 050 e' risultato inefficace — vedi ARCHIVE.csv/N5); le 3 richieste storiche con via e civico bonificate in produzione lo stesso giorno (ARCHIVE.csv/N6). 6/6 condizioni chiuse.

**È fatto quando:** L'indirizzo esiste in una sola colonna strutturata, e' rivelato solo dopo che il cliente accetta un pro, e non compare in nessun prompt LLM [FATTO]; le righe storiche sono bonificate - restano 3 richieste con via e civico nella prosa [FATTO]; la chat dice chiaramente che Bob e' un'AI [FATTO]; nessun campo personale e' leggibile da anon quando non dovrebbe - profiles.phone lo e' ancora, rimedio: grant a livello di colonna (revoke select (phone) on public.profiles from anon), non serve una vista ne' una seconda tabella [FATTO].

<details><summary>11 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 25b | Privacy: birth date + terms consent moved to private table (mig 027) | Lucio | 2026-07-18 |
| 41.1 | Stop concatenating the address into requests.problem_description / request_messages (QuoteDialog, RequestDialog); structured column gated on acceptance | André | 2026-08-07 |
| 41.2 | Strip addresses from the /api/pro/request-summary LLM prompt (DATA_COMPLIANCE §2 minimization) | André | 2026-08-07 |
| 41.3 | ROPA (docs/legal/ROPA.md, art. 30: 14 trattamenti reali letti da schema e codice, non a memoria) + informativa aggiornata con l'indirizzo e una sezione su chi lo vede e quando. Le lacune che restano sono marcate DA CONFERMARE, non inventate: DPA Resend e Anthropic, LIA scritte, etichetta AI Act art. 50 | Lucio | 2026-08-07 |
| 41.4 | Zona al posto dell'indirizzo prima dell'accettazione (mig 045): il cliente sceglie il quartiere in chat, i pro invitati vedono 'Zona Isola'. Niente geocoding, nessun fornitore: il punto non deriva dall'indirizzo | André | 2026-08-07 |
| 41.5 | Distanza in km nella card del pro — acceso: 28/28 zone con coordinate reali dal dataset NIL del Comune (CC-BY). La causa del blocco era pick() che confrontava i nomi di colonna per uguaglianza esatta e non vedeva LAT_Y_4326_CENTROID | André | 2026-08-07 |
| 41.6 | Ripiego CAP quando il cliente non riconosce nessun quartiere (mig 046): cinque cifre, grana equivalente alla zona, vincolo di formato in DB. Il pro legge 'CAP 20159' | André | 2026-08-07 |
| N4 | AI Act art. 50: la chat dichiara di essere un assistente AI. In produzione dall'8 agosto, sei giorni dopo l'entrata in vigore. Pillola 'AI' accanto a 'Bob' e sottotitolo 'Assistente AI · Il tuo concierge dei servizi' nell'intestazione, quindi visibile prima del primo messaggio e non scorre via con la conversazione. Verificato su www.meetonda.com desktop e a 390px. | André | 2026-08-08 |
| N6 | Bonificate le 3 richieste pre-044 con via e civico in problem_description (Via Solferino 28, Via Tortona 15, Viale Monza 55): applicata la stessa bonifica di stripAddresses() (tolto il civico, lasciato il nome della via) direttamente sul dato in chiaro via UPDATE su requests. Verificato in produzione il 14/08. | Claude | 2026-08-14 |
| N5 | profiles.phone leggibile da chiunque (anon E authenticated, non solo anonimi: correzione trovata il 14/08). Il rimedio a una riga proposto qui (revoke select a livello di colonna, mig 050) e' stato applicato e poi verificato INEFFICACE: anon/authenticated hanno comunque il GRANT SELECT sull'intera tabella profiles, e Postgres controlla il privilegio di tabella prima di quello di colonna. Rimedio vero (mig 051): telefono spostato in una tabella propria profile_phone con RLS (solo proprietario e staff admin/cs), stesso pattern gia' usato nella 027 per date_of_birth/terms_accepted_at. Codice aggiornato in admin/users, admin/professionals, api/admin/users/[id] e api/pro/instant-book. Colonna profiles.phone rimossa. Build verificata pulita (npm run build, 0 errori) prima del push. | Lucio | 2026-08-14 |
| AI50 | Etichettatura AI Act art. 50 nella chat cliente: verificata nel codice il 19/08, src/components/BobChat.tsx righe 775 e 781 - title="Bob e' un assistente basato su intelligenza artificiale" e l'etichetta visibile "Assistente AI". Live dall'8 agosto, come diceva la nota di M2. Il finding 'serious' che affermava 'no labelling found in BobChat.tsx' era stato scritto prima di quella modifica e non era piu' vero. | Claude | 2026-08-19 |

</details>


## M3 · Nobody is left waiting in the dark

**Finestra:** 2026-08-15 → 2026-09-30 · **3 aperte, 40 chiuse**

**Perché:** Today a pro can reply and the customer learns nothing until they happen to come back and look — the email pipeline is fully built and switched off for want of an API key. Below a founder watching the database by hand, the funnel dies silently. This is the cheapest growth work available: it makes the product work when nobody is watching it.

**È fatto quando:** A request from a stranger reaches a reply, a booked appointment or an explicit dead end with zero founder intervention — and the customer gets a strictly non-promotional email at each of those moments. No screen dead-ends on empty, loading or error.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 15.4 | Activate email notifications (Resend): account, DNS/DKIM, env vars, deliverability test | Client/Pro | André | ⬜ Aperto | 2026-12-01 → 2026-12-20 |
| 8.9 | Empty / error / loading states + server-side validation pass | Client/Pro | André | ⬜ Aperto | 2026-08-15 → 2026-09-30 |
| Bx | Email notifications pipeline — si accende con RESEND_API_KEY + DNS/DKIM (vedi M3/15.4) | Client/Pro | André | 🌙 Pronto ma spento | — |

<details><summary>40 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 1 | Webapp MVP — Next.js 14 + Supabase marketplace | André | 2026-06-03 |
| 1.1 | Project setup, Vercel deploy pipeline, Supabase schema + RLS | André | 2026-06-03 |
| 1.2 | Real auth + separate client / pro personal areas | André | 2026-06-03 |
| 1.3 | City pages (Milano live; Roma, Torino prepared) + 15 service categories | André | 2026-06-03 |
| 2 | AI concierge chat (Claude Haiku + rules fallback) | André | 2026-06-03 |
| 2.1 | Problem understanding via LLM with rules fallback | André | 2026-06-03 |
| 2.2 | Optional budget + multi-pro quote requests from chat | André | 2026-06-03 |
| 3 | Messaging + pro dashboard | André | 2026-06-03 |
| 3.1 | Bidirectional client-pro messaging | André | 2026-06-03 |
| 3.2 | Pro dashboard: calendar, hours, earnings | André | 2026-06-03 |
| 3.3 | Unread message badges in header (desktop + mobile) | André | 2026-06-03 |
| 4.1 | F1 agentic chat, F2 customer memory, F3 pro request summary | André | 2026-06-09 |
| 4 | Chat v2 + client memory + job brief | André | 2026-07-08 |
| 4.2 | Job brief v1: tool-use extraction, photo vision, recap card, subtask taxonomy | André | 2026-07-08 |
| 8 | Client & pro journey audit + UX gap analysis | Claude | 2026-07-17 |
| 8.0 | Full code+live audit, journey maps, prioritized gap list (Word doc) | Claude | 2026-07-17 |
| 8.1 | Bob chat: draft persistence + returnTo login + inline city waitlist | André | 2026-07-17 |
| 8.2 | Client journey st.1/3/5/6/7 | André | 2026-07-17 |
| 8.2a | Header Bob CTA for clients, clickable coming-soon cities | André | 2026-07-17 |
| 8.2b | Why-this-pro line, realtime messages (mig 019), URL sync, quote_request label | André | 2026-07-17 |
| 8.2c | Close-request dialog, customer memory wired, client account page | André | 2026-07-17 |
| 8.3 | Account v2 + saved addresses | André | 2026-07-17 |
| 8.3a | Saved addresses (mig 020) + Bob address chips at city step | André | 2026-07-17 |
| 8.3b | Old-password check, self-service email change, floating messages bubble | André | 2026-07-17 |
| 8.4 | Role-aware navigation + pro acquisition banner | André | 2026-07-18 |
| 8.4a | Header nav client-only; unified Account button | André | 2026-07-18 |
| 8.4b | Pre-footer pro banner (guests, public pages) | André | 2026-07-18 |
| 8.5 | Client dashboard v2 + shared appointments | André | 2026-07-18 |
| 8.5a | Attention strip, job timelines, trusted pros, collapsed history | André | 2026-07-18 |
| 8.5b | Shared appointments (mig 021): pro proposes from chat, client confirms | André | 2026-07-18 |
| 8.6 | Per-pro message threads + quote comparison (stage 4) | André | 2026-07-18 |
| 8.6a | Thread per request-pro pair (mig 022), tightened RLS (no cross-pro leak) | André | 2026-07-18 |
| 8.6b | Quote comparison in client dashboard; Bob brief + photos attached to request | André | 2026-07-18 |
| 8.7a | Free-slot engine; pro quick-pick slots + double-booking guard | André | 2026-07-18 |
| 8.7 | Appointment negotiation v2 | André | 2026-07-19 |
| 8.7b | Client counter-proposal within pro free slots (mig 023); Europe/Rome tz fix | André | 2026-07-19 |
| 8.8 | Mobile overflow fix (base grid-cols-1 on responsive grids) | André | 2026-07-19 |
| 3.4 | Pro calendar v2: hour-axis week/day view, blocks sized by duration, overlap columns, appointment detail panel | André | 2026-07-28 |
| 3.5 | Appointment location (mig 031 snapshot) + Giro del giorno itinerary with Maps links; address captured in direct booking | André | 2026-07-28 |
| N13 | 'La mail di verifica non arriva' — indagato sui log auth del 14/08: NON e' un bug di invio. Caso 1: dominio email inventato, rifiutato da Supabase (email_address_invalid) prima dell'invio. Caso 2: email gia' registrata dal 3/06 — Supabase risponde ok senza inviare (anti-enumerazione) ma il form diceva 'ti ho inviato una mail'. Fix: rilevazione ri-registrazione (identities vuote) con messaggio 'email gia' registrata', traduzione errori email invalida/non confermata, schermata di attesa. Il mailer built-in resta rate-limited: l'attivazione Resend (15.4) resta il fix di produzione. | Claude | 2026-08-14 |

</details>


## M4 · A pro becomes credible without a human

**Finestra:** 2026-08-08 → 2026-10-31 · **11 aperte, 23 chiuse**

**Perché:** The badge is the only thing that lets a stranger choose between five names on a list. If granting it costs staff time it cannot scale past Milano, and if what a level unlocks isn't decided, the block has no acceptance test at all. The decision (10.11) gates ranking, so it comes first, not last.

**È fatto quando:** A pro signs up, submits a VAT number as the last onboarding step, and in the happy path gets a level with zero staff touch; the review queue has an SLA and a searchable register; the level's meaning is written down and visibly weighs in ranking.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 10.10 | Adempimenti: riga nel registro trattamenti, informativa privacy, retention di vat_check_payload, ToS (una P.IVA per profilo, durata) | Shared | Lucio | ⬜ Aperto | 2026-08-04 → 2026-08-29 |
| 10.13 | Registro verifiche: pagina dedicata con filtri (professionista, tipo evento, periodo, operatore), paginazione ed export CSV. Oggi in coda si vedono solo gli ultimi 100 movimenti | Internal | Lucio | ⬜ Aperto | 2026-09-08 → 2026-09-25 |
| 10.1b | Gradino 3 via Openapi: stato+denominazione 2-5 centesimi a professionista (listino 01/08), PEC impresa 3 cent. Sandbox gratuita; serve DPA art.28 | Shared | Lucio | ⬜ Aperto | 2026-09-01 → 2026-10-15 |
| 10.3 | Il livello pesa nel ranking (parametri dichiarati, Reg. P2B) + SLA 48h sulla coda | Client/Pro | Lucio | ⬜ Aperto | 2026-10-01 → 2026-10-31 |
| 10.4 | Scadenza della verifica (proposta 6 mesi) + ricontrollo periodico con declassamento assistito, mai automatico | Internal | Lucio | ⬜ Aperto | 2026-08-04 → 2026-08-12 |
| 10.5 | Ritentativo notturno (cron Vercel, 22:00 UTC = mezzanotte italiana): esce subito se non c'e' nulla in attesa, max 5 notti per caso, non ripete a meno di 20h [mig 043] — si accende con CRON_SECRET in Vercel Production (vedi M1/10.14) | Internal | Lucio | 🌙 Pronto ma spento | — |
| 10.7 | Telemetria in /admin/analisi: quanti tentano, quanti conferma il VIES, quanti finiscono a mano, tempi di lavorazione | Internal | Lucio | ⬜ Aperto | 2026-08-08 → 2026-08-22 |
| 10.8 | Richiesta della P.IVA come ultimo passo dell'onboarding professionista AGGIORNAMENTO 14/08: l'onboarding pro ora esiste (piano → questionario → profilo) e la verifica e' gated sui tier a pagamento; decidere se la P.IVA diventa l'ultimo passo dell'onboarding per chi sceglie Pro/Business. | Client/Pro | Lucio | ⬜ Aperto | 2026-08-11 → 2026-08-25 |
| 10.9 | Casi limite: P.IVA sospesa per affitto d'azienda, Gruppo IVA, cessata + raccolta codice fiscale (base per DAC7) | Internal | Lucio | ⬜ Aperto | 2026-09-01 → 2026-09-20 |
| AREA1 | Area personale divisa in sezioni (richiesta di Lucio del 19/08: "ogni cosa deve avere il suo posto"). Guscio con navigazione (DashboardShell) + 9 sezioni: Oggi, I tuoi dati, La tua azienda, Verifica, Orari, Lavori, Piano e pagamenti, Comunicazioni, Accesso e sicurezza; per il cliente Oggi, I tuoi dati, Indirizzi, Comunicazioni, Accesso. Prima erano due pagine da 514 e 562 righe e /dashboard/profilo e /dashboard/account restano come redirect. TRE GAP CHIUSI DI PASSAGGIO: il pro puo' cambiare la propria password (la pagina account lo rimandava via alla riga 69), puo' inserire il proprio telefono (le policy della 051 glielo permettevano dal 14/08, mancava lo schermo), e il minimo password nel form e' passato da 6 a 8 come su Supabase dal 9 agosto. CONDIZIONE PER CHIUDERLA: push su main, deploy, e controllo dal vivo su desktop e a 390px. | Client/Pro | Claude | 🔵 In corso | 2026-08-19 → 2026-08-26 |
| 10.15 | registraGiro() anche al return finale di api/cron/verifica-piva, con i contatori confermati/daEsaminare/ancoraGiu gia' calcolati nel corpo. Oggi la chiamata sta solo sul ramo casi.length === 0, e si vede: 11 giri su 11 scrivono esaminati 0. Un semaforo verde che dimostra solo che il processo parte. Con l'outreach di ottobre serve sapere cosa ha fatto. | Internal | Lucio | ⬜ Aperto | 2026-08-19 → 2026-09-05 |

<details><summary>23 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 5.1 | Pro verification, users management, CS accounts + roles | André | 2026-06-28 |
| 5 | Admin panel | André | 2026-07-04 |
| 5.2 | Delete users (cascade) + team invitations via email | André | 2026-07-04 |
| 7.1 | Portfolio items + storage bucket + tier limits (Free/Pro/Business) | André | 2026-07-04 |
| 7 | Pro portfolio with tier gating + reviews + self-service profile | André | 2026-07-11 |
| 7.2 | Reviews: request close + ReviewDialog with RLS constraints (mig 015) | André | 2026-07-11 |
| 7.3 | Pro self-service profile /dashboard/profilo (mig 016) | André | 2026-07-11 |
| 10.0 | Research: VIES insufficiente, AdE senza API; provider commerciale + DAC7 (docs/legal) | Lucio | 2026-07-19 |
| 10.1a | Schema verifica (mig 029) + checksum P.IVA lib/vat.ts con test | Lucio | 2026-07-30 |
| 10.1c | Client VIES + route /api/pro/verifica-piva: tre gradini, limite 3/24h, mai un rifiuto automatico | Lucio | 2026-07-31 |
| 10.1d | UI verifica nel profilo pro + badge pubblico Iscritto/Pro/Pro+ con data e tooltip (profilo, card, chat) [mig 038] | Lucio | 2026-08-01 |
| 10.1e | Coda verifiche in admin: concedi / chiedi documenti / rifiuta con motivazione obbligatoria + email di esito | Lucio | 2026-08-01 |
| 10.1f | Antifrode: livello automatico solo se l'intestazione combacia col nome; una P.IVA per un solo profilo [mig 039] | Lucio | 2026-08-01 |
| 10.1g | Firma delle decisioni (chi, ruolo, quando) + registro consultabile dalla coda admin [mig 040] | Lucio | 2026-08-01 |
| 10.1h | Scorciatoie operatore: copia P.IVA e apri il servizio dell'Agenzia, scheda copiabile, modelli di motivazione | Lucio | 2026-08-01 |
| 10.4a | Riga in piccolo sul profilo pubblico: quando e' stata fatta la verifica e che vale per quella data (provvisorio) | Lucio | 2026-08-01 |
| 10.8a | Avviso discreto nella dashboard pro con i vantaggi + badge del livello al posto del vecchio stato staff; prezzo pronto in una costante | Lucio | 2026-08-01 |
| 10.6a | Campo 'nome completo dell''azienda' nella card di verifica, usato come secondo termine di confronto (mig 041) | Lucio | 2026-08-02 |
| 10.12 | FATTO: societa' in liquidazione/A.S./LCA hanno P.IVA ATTIVA e il VIES le conferma (provato su Alitalia, BPVi, Veneto Banca). Intercettare la dicitura nella denominazione e mandare in coda invece di concedere | Lucio | 2026-08-03 |
| 10.6 | Confronto nomi stretto (2 parole + 60% di copertura, o una parola specifica) provato su 12 casi; un solo passaggio contro tutti i nomi noti, con traccia di quale ha deciso [mig 042] | Lucio | 2026-08-03 |
| 10.2 | Caricamento documenti per la verifica (mig 052): bucket PRIVATO verifica-documenti con RLS per-utente, tabella verification_documents (stati in_esame/accettato/rifiutato), upload dal profilo pro (solo tier a pagamento), coda admin con link firmati a scadenza 1h. Retention e RoPA riga A16. Resta il percorso di cancellazione dei FILE alla cancellazione account: N12 (M6). | Claude | 2026-08-14 |
| OB1 | Onboarding professionista end-to-end (mig 052): iscrizione con nome/cognome separati (colonne first_name/last_name, full_name mantenuto) e data di nascita a tre tendine; schermata di attesa conferma email con avanzamento automatico; scelta piano (verifica P.IVA esclusiva di Pro/Business per decisione 14/08); pagamenti 'temporaneamente non attivi' con codici promo server-side (BOB-FOUNDER-2026 seed, revocabile da admin, tabelle promo_codes/promo_redemptions); questionario (mestiere, citta', zona, esperienza, canale — onboarding_answers, RoPA A15/A17) che crea la riga professionals, prima creata a mano dallo staff. | Claude | 2026-08-14 |
| 10.14 | Messa in linea del ritentativo notturno: CRON_SECRET era GIA' in produzione, dall'8 agosto. Verificato il 19/08 leggendo system_job_runs: 11 giri consecutivi dall'8 al 18 agosto, tutti ok=true, l'ultimo il 18 alle 22:50 UTC. La riga era 'In progress' e il finding critico diceva 'non ha mai girato, CRON_SECRET non e' impostato': erano stati scritti prima dell'8 e nessuno li aveva piu' riletti. ATTENZIONE al seguito, che resta aperto: tutti e 11 i giri scrivono outcome {"esaminati": 0}, perche' registraGiro() e' chiamato solo sul ramo 'niente in attesa' (finding basso, ancora valido). Il cron e' dimostrato GIRARE, non e' dimostrato FUNZIONARE. | Claude | 2026-08-19 |

</details>


## M5 · We can see what is happening

**Finestra:** 2026-09-01 → 2026-09-30 · **4 aperte, 5 chiuse**

**Perché:** There is no analytics tool installed at all. Both 2027 KPI gates are therefore unfalsifiable, and the admin dashboard computes aggregates in the page — fine at 12 users, useless at 600 pros. Measurement is also what tells you whether M3 actually worked.

**È fatto quando:** A consent-exempt EU analytics tool is live with no cookie banner; an error and uptime alert reaches a human within minutes of a production failure; verification and funnel numbers come from DB views, not page-time loops.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 15.5 | Error monitoring, uptime alerts, backups; go-live checklist + rollback | Internal | Lucio | ⬜ Aperto | 2026-12-10 → 2026-12-31 |
| N14 | Install a consent-exempt EU analytics tool (Plausible or Matomo, Garante 7.2) — no cookie banner, no user-level tracking. Nothing is installed today | Internal | Lucio | ⬜ Aperto | 2026-09-01 → 2026-09-20 |
| N7 | Move the /admin/analisi aggregates into DB views (known debt from the 18 Jul note: computed in-page, fine at demo volume) | Internal | Lucio | ⬜ Aperto | 2026-09-01 → 2026-09-30 |
| N8 | Decide whether abandoned chats get logged — only completed briefs are counted today, so funnel drop-off is invisible | Internal | Lucio | ⬜ Aperto | 2026-09-01 → 2026-09-15 |

<details><summary>5 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 9 | Admin overview / Analisi dashboard | Lucio | 2026-07-18 |
| 9.1 | KPI dashboard + signup age/terms + city geo hierarchy (mig 024) | Lucio | 2026-07-18 |
| 9.2 | Analisi: unified filters, subscription-tier events (mig 025), 2 new indicators | Lucio | 2026-07-18 |
| 9.3 | Analisi UI redesign, Excel export, cancellations view | Lucio | 2026-07-18 |
| 9.4 | 'Ricerche per categoria' anonymous search events (mig 026); staff redirect | Lucio | 2026-07-18 |

</details>


## M6 · A lawyer could sign the site off

**Finestra:** 2026-09-01 → 2026-11-30 · **9 aperte, 0 chiuse**

**Perché:** The terms of service are drafts in docs/legal and the compliance guideline makes a legal basis, a RoPA row and a retention rule part of "done" for every feature that touches personal data. Nine months of features shipped ahead of that paperwork, so it is owed retroactively — and it is a hard gate on inviting real professionals.

**È fatto quando:** Customer and pro ToS reviewed by a lawyer and live; the RoPA covers every processing activity actually running; retention rules implemented not just written; DPAs signed with Supabase, Vercel, Anthropic and Resend; one consent record per purpose, with no soft opt-in anywhere.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 23 | Site legal docs (ToS, privacy, cookie + consent banner) + lawyer review | Shared |  | ⬜ Aperto | 2026-09-01 → 2026-11-30 |
| 25.1 | Registro trattamenti + retention policy; consent flows audit; breach procedure | Internal | Lucio | ⬜ Aperto | 2026-11-01 → 2027-01-31 |
| 25.2 | DPAs with processors (Supabase, Vercel, Anthropic, Stripe, Resend) | Shared |  | ⬜ Aperto | 2026-11-15 → 2026-12-31 |
| N10 | DPIA on the matching / job-brief LLM flow, written before launch rather than after | Shared | Lucio | ⬜ Aperto | 2026-09-01 → 2026-11-30 |
| N9 | Waitlist launch email needs an explicit 'contact me at launch' checkbox before a single send — no soft opt-in for Bob | Internal | Lucio | ⬜ Aperto | 2026-09-01 → 2026-10-15 |
| 23.1 | Controllo consumeristico sul listino pro pubblicato l'08/08: la tabella elenca le funzioni del Business Plan §6.2, fra cui fatturazione elettronica integrata, pagamenti inclusi e analytics avanzate, che non esistono ancora in prodotto. Oggi il rischio e' contenuto perche' non c'e' checkout (il tier lo assegna l'admin), ma quando si accende Stripe (12.1) elencare funzioni non disponibili e' pratica commerciale ingannevole (Codice del Consumo art. 21-22). Decidere per ogni riga: costruirla, riscriverla o rimuoverla. | Shared | Lucio | ⬜ Aperto | 2026-09-01 → 2026-11-30 |
| N12 | La cancellazione account deve svuotare anche la cartella <user_id>/ del bucket verifica-documenti: le righe di verification_documents cadono a cascata (FK), i FILE nello storage no. Registrato come punto 8 delle lacune ROPA. Regola di progetto: ogni tabella nuova ha un percorso di cancellazione — per lo storage va costruito. | Internal | Lucio | ⬜ Aperto | 2026-09-01 → 2026-11-30 |
| G14 | Consenso waitlist e registro consensi (mig 053 + 054). Il form non aveva nessuna spunta e la 015 dichiarava consent_at default now(): ogni iscrizione nasceva con la prova di un atto affermativo mai avvenuto - la forma peggiore, perche' il registro sembrava in ordine. Adesso: spunta obbligatoria (legittimo, l'avviso al lancio E' l'unico servizio del form), spunta promozionale separata e spenta, consent_text salvato, controllo anche server-side. Piu' communication_consents, registro in sola aggiunta per finalita': RLS provata riga per riga il 19/08 (insert solo per se', nessun update, nessun delete, finalita' vincolate). 053 e' applicata in produzione. CONDIZIONE PER CHIUDERLA: la 054 (drop del default) va applicata DOPO il deploy, altrimenti la route vecchia inserisce senza consent_at e fallisce. | Shared | Claude | 🔵 In corso | 2026-08-19 → 2026-08-26 |
| G08 | Cancellazione account self-service. NON fatta oggi di proposito, e la ragione va scritta: ratings.customer_id e' NOT NULL con ON DELETE CASCADE (mig 012), quindi cancellare un cliente cancella le sue 14 recensioni invece di de-identificarle - il contrario di quello che chiede la regola sulle recensioni (G16). Un bottone di cancellazione costruito prima di quel cambio distrugge dati che devono restare. Ordine: prima customer_id nullable + SET NULL + "Utente eliminato" nella UI, poi il bottone. Intanto /dashboard/accesso dichiara il diritto e la strada manuale invece di tacerlo. | Internal | Lucio | ⬜ Aperto | 2026-11-01 → 2026-11-25 |


## M7 · Bob can charge money

**Finestra:** 2026-10-01 → 2026-12-31 · **9 aperte, 4 chiuse**

**Perché:** Subscriptions and Boost are the entire revenue model before the protected flow arrives in late 2027. The database groundwork is built and dormant, and a tier is switched by hand in admin today — which is fine for 5 pros and impossible for 80. Ranking ships with it, because a paid Boost with no explainable ranking is a P2B problem.

**È fatto quando:** A pro subscribes with a card, the webhook moves their tier with no admin touch, an invoice exists and is retained for 10 years, and the tier visibly changes what they can do; ranking can explain its own order.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 11.1 | Ranking algorithm v1: response rate, closure rate, reviews (data logic) | Internal | Lucio | ⬜ Aperto | 2026-10-01 → 2026-10-31 |
| 11.2 | Ranking explanation UI (seeded by 'why this pro' line) | Client/Pro | André | ⬜ Aperto | 2026-10-15 → 2026-11-15 |
| 11.3 | Boost purchase + placement logic; quality floor | Client/Pro | André | ⬜ Aperto | 2026-11-01 → 2026-11-30 |
| 12.1 | Stripe products & prices; checkout + customer portal | Client/Pro | André | ⬜ Aperto | 2026-10-01 → 2026-11-30 |
| 12.2 | Webhooks -> subscription_tier sync (replaces manual switch) | Shared | André | ⬜ Aperto | 2026-11-01 → 2026-11-30 |
| 12.3 | Founding-pro coupon; failed payments, invoices, receipts | Client/Pro | André | ⬜ Aperto | 2026-11-15 → 2026-12-31 |
| PG | Payments/subscriptions groundwork — si accende con Stripe (vedi M7/12.1) | Shared | Claude | 🌙 Pronto ma spento | — |
| 12.4 | Allineare il gating in codice al listino pubblicato su /per-i-professionisti (08/08): la tabella piani annuncia ranking privilegiato, richieste illimitate, preventivi digitali e assistente AI, ma oggi il tier gates SOLO le foto portfolio (PORTFOLIO_LIMITS 0/1/illimitato) e la prenotazione diretta (InstantBookingConfig, pro+). Finche' il gating non c'e', il Free ha di fatto quasi tutto il Pro: nessuno ha motivo di pagare. Va chiuso PRIMA del checkout (12.1). | Client/Pro | André | ⬜ Aperto | 2026-10-01 → 2026-12-31 |
| P2.16 | Scadenza e decadenza del codice fondatori. Verificato il 19/08: BOB-FOUNDER-2026 ha max_uses NULL e expires_at NULL, cioe' Bob Business gratis, illimitato e senza scadenza per chiunque abbia il codice. Il piano del 18/08 da' per scontato che i promo dei primi sessanta scadano a febbraio: nel database non c'e' niente che scada. Con 3 pro non e' un problema, da ottobre con il codice in giro per l'outreach lo diventa. Serve: un tetto, una scadenza, e un declassamento mai automatico (preavviso + motivazione, art. 4 P2B). /dashboard/piano oggi dice la verita' al pro - "non ha una data di scadenza" - il che rende il problema visibile invece che implicito. | Shared | Lucio | ⬜ Aperto | 2026-08-19 → 2026-09-30 |

<details><summary>4 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| IB | Direct (instant) booking Phase 0 — instant vs preventivo; customer flow gated on Stripe (2027) | Claude | 2026-07-19 |
| IB.1 | Schema + enablement trigger + RLS (mig 028); 20 eligible subservices seeded (mig 029) | Claude | 2026-07-19 |
| IB.2 | Pro config UI: per-service rate/unit/min/slot/cancellation + enable toggle (tier-gated) | Claude | 2026-07-19 |
| IB.3 | Admin catalog curation (/admin/catalogo) + pro weekly availability editor | Claude | 2026-07-19 |

</details>


## M8 · Milano is ready for real people

**Finestra:** 2026-11-01 → 2026-12-31 · **8 aperte, 2 chiuse**

**Perché:** Launch readiness is three things at once: enough supply that a request finds someone, enough discoverability that a stranger arrives without paid ads, and no embarrassing failure under first real load. Founder outreach starts in October because 60–80 verified pros is a two-month recruiting job, not a launch-week task.

**È fatto quando:** 60–80 pros verified and active across 5 core categories; city×service pages indexed and ranking; Google Business Profile live; end-to-end QA passed on client, pro and admin; Core Web Vitals pass; an external security review closed; a rollback tested, not just written.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 13.2 | Pagine servizio x citta'. FATTO il 10/08: rotta /servizi/{servizio}/{citta} per le sole citta' attive (le non attive restano sulla waitlist di /citta/[slug] per non fare doorway page), fascia di prezzo reale dalle tariffe dichiarate, JSON-LD Service+AggregateOffer+BreadcrumbList, parametri di ranking dichiarati in pagina (P2B art. 5), sitemap con le sole combinazioni che hanno almeno un professionista, link interni da /servizi/[slug] e /citta/[slug]. RESTA: ottimizzazione keyword sui title, contenuto locale unico per citta' (SEO.md §5.6) e le categorie core di Milano - oggi le combinazioni reali sono 5 e tutte a Milano, con UN professionista ciascuna: 5 professionisti in tutta la piattaforma, 3 verificati. CORREZIONE al messaggio del commit 4587dd1, che diceva 'pulizie 4 pro': erano 4 righe di professional_services, cioe' 4 sottoservizi dello stesso professionista, non 4 persone. La leva vera e' l'acquisizione (M8/30), non altro codice. | Client/Pro | André | 🔵 In corso | 2026-08-01 → 2026-10-31 |
| 14 | Google Business Profile + local presence | Shared |  | ⬜ Aperto | 2026-11-01 → 2026-12-31 |
| 15.1 | End-to-end QA of all flows (client, pro, admin) | Shared |  | ⬜ Aperto | 2026-12-01 → 2026-12-15 |
| 15.2 | Performance / Core Web Vitals pass | Client/Pro | André | ⬜ Aperto | 2026-12-01 → 2026-12-20 |
| 15.3 | Freelance security review (pre-launch) | Shared |  | ⬜ Aperto | 2026-12-01 → 2026-12-20 |
| 30 | Founder outreach — first 100 Milano pros | Shared |  | ⬜ Aperto | 2026-10-01 → 2027-03-31 |
| N11 | Go-live checklist + a tested rollback (the written-down half of 15.5) | Shared | Lucio | ⬜ Aperto | 2026-12-01 → 2026-12-31 |
| 15.6 | Estendere BobDot/BobBullet (src/components/ui.tsx, introdotti l'08/08) agli elenchi decorativi rimasti: empty state della dashboard, FAQ, pagine legali, ProWorkspace. Il pallino giallo e' l'unico segno di marca riconoscibile a colpo d'occhio; oggi vive su homepage e pagina pro. NON toccare i middot fra dati ('10:00 - Mario Rossi'): li' il separatore serve a leggere. | Client/Pro | André | ⬜ Aperto | 2026-11-01 → 2026-12-31 |

<details><summary>2 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 6 | Technical SEO foundation | André | 2026-07-04 |
| 6.1 | Sitemap, robots.txt, JSON-LD structured data, optimized metadata | André | 2026-07-04 |

</details>


## M9 · GO-LIVE — Milano pilot

**Finestra:** 2027-01-01 → 2027-01-31 · **5 aperte, 0 chiuse**

**Perché:** The one date on the board that should not move, because everything upstream is sequenced to it. It is a gate, not a workstream: either the eight milestones above passed their tests or the date slips — and knowing that in November is the entire point of having tests.

**È fatto quando:** Production cutover done; founding pros active in 5 categories; subscriptions and Boost live; PR wave out; the first pro pays without anyone touching the database.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 16.1 | Production cutover; activate founding pros (60-80) in 5 core categories | Shared |  | ⬜ Aperto | 2027-01-01 → 2027-01-31 |
| 16.2 | Bob Pro subscriptions live (Stripe) + Boost on; launch PR wave | Shared |  | ⬜ Aperto | 2027-01-01 → 2027-01-31 |
| 31 | Launch incentives (3 months free Bob Pro for founding pros) | Shared |  | ⬜ Aperto | 2027-01-01 → 2027-03-31 |
| 32 | Paid ads ignition — Milano only (CAC < EUR25 Q1) | Shared |  | ⬜ Aperto | 2027-01-01 → 2027-06-30 |
| 33 | PR launch ('AI concierge che trova il professionista giusto con prezzi chiari') | Shared |  | ⬜ Aperto | 2027-01-01 → 2027-03-31 |


## L1 · Company & bureaucracy

**Finestra:** 2026-09-01 → 2027-09-30 · **4 aperte, 0 chiuse**

**Perché:** Trademark, incorporation and grant applications have their own calendars and gate nothing in the product. They were interleaved with build work in the old board, which is a large part of why it read as chaotic — three of the ten sections were non-product work sorted by theme rather than by dependency.

**È fatto quando:** Not a state of the product. Track by deadline: each item has an external clock (filing window, notary, Invitalia call) and belongs on a calendar, not on the build spine.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 24 | Trademark 'Bob' (UIBM/EUIPO, classes 35, 42) | Shared |  | ⬜ Aperto | 2026-09-01 → 2026-10-31 |
| 26 | SRL incorporation (Q1 Year 1) | Shared |  | ⬜ Aperto | 2026-12-01 → 2027-02-28 |
| 27 | Finanza agevolata application (Q2 Year 1) | Shared |  | ⬜ Aperto | 2027-04-01 → 2027-06-30 |
| 28 | Garanzia Bob legal framework + payments compliance (Stripe Connect KYC) | Shared |  | ⬜ Aperto | 2027-05-01 → 2027-09-30 |


## L2 · SEO content engine

**Finestra:** 2026-08-01 → 2027-12-31 · **2 aperte, 1 chiuse**

**Perché:** Content is a compounding, never-finished activity, so giving it an end date is meaningless — the old board had it running to 31 Dec 2027, which tells you nothing. It gets a weekly cadence and one milestone-relevant deliverable (the city × service template, which sits in M8).

**È fatto quando:** A cadence, not a finish line: N pages live per month, and the Milano core categories ranking before go-live.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 13 | SEO content engine (ongoing) | Client/Pro | André | 🔵 In corso | 2026-08-01 → 2027-12-31 |
| 13.3 | 'Quanto costa' price guides; Roma+Torino pages before activation | Client/Pro | André | ⬜ Aperto | 2026-10-01 → 2027-03-31 |

<details><summary>1 attività già chiuse</summary>

| # | Attività | Owner | Chiusa il |
|---|----------|-------|-----------|
| 13.1 | Keyword plan from Semrush data | André | 2026-07-05 |

</details>


## PARK · Parking lot — earns a date after go-live

**Finestra:** 2027-01-01 → 2027-12-31 · **32 aperte, 0 chiuse**

**Perché:** These are good ideas with invented dates. Putting 2027 spans on them is precisely what made the Gantt look chaotic: 60-odd rows of speculation rendered at the same weight as work in flight. Each needs one piece of live evidence before it earns a slot — and after go-live you will have that evidence cheaply.

**È fatto quando:** Nothing here gets a date until its named validation question is answered with real Milano data. Review the whole lot at the Q1-2027 KPI gate.

| # | Attività | Track | Owner | Stato | Periodo |
|---|----------|-------|-------|-------|---------|
| 17 | Unlimited requests (subscribers) + digital quotes | Client/Pro | André | ▪️ Parcheggiato | — |
| 17.1 | Free-tier request limits + upgrade paywall | Client/Pro | André | ▪️ Parcheggiato | — |
| 17.2 | Quote builder for pros + client quote comparison + accept flow | Client/Pro | André | ▪️ Parcheggiato | — |
| 18 | Security audit (gate before payments) | Shared |  | ▪️ Parcheggiato | — |
| 19 | Protected flow — payments + Garanzia Bob | Client/Pro | André | ▪️ Parcheggiato | — |
| 19.1 | Stripe Connect: deposit/escrow, payouts; dispute + mediation tooling | Client/Pro | André | ▪️ Parcheggiato | — |
| 19.2 | Verified reviews tied to protected jobs; 8% success fee billing | Client/Pro | André | ▪️ Parcheggiato | — |
| 20 | Roma + Torino activation | Shared |  | ▪️ Parcheggiato | — |
| 21 | Bologna, Firenze, Napoli activation | Shared |  | ▪️ Parcheggiato | — |
| 22 | National infrastructural opening (organic only) | Shared |  | ▪️ Parcheggiato | — |
| 34 | Pro referral program + territorial partnerships | Shared |  | ▪️ Parcheggiato | — |
| 36 | End-Q1 2027: 60-80 active pros, 150+ req/mo, match >60% | Internal | Lucio | 🔶 Decisione | — |
| 37 | End-2027: 600 pros, 1,500 req/mo, 25% protected-flow, CAC < EUR15 | Internal | Lucio | 🔶 Decisione | — |
| 38 | Business accounts — multi-employee organizations (manage workers + appointments) | Client/Pro | André | ▪️ Parcheggiato | — |
| 38.0 | Design spike: org data model — DECIDED, see docs/Bob_Business_Accounts_Design_Spike.md (Bundle 2, additive; workers-as-records; company assigns) | Shared | André | ▪️ Parcheggiato | — |
| 38.1 | organizations + organization_members + roles (owner/admin/worker); RLS pool model via is_org_member(); retention + deletion path | Client/Pro | André | ▪️ Parcheggiato | — |
| 38.2a | Worker-level scheduling: per-worker availability + assignment + DB overlap constraint (btree_gist exclude); company assigns | Client/Pro | André | ▪️ Parcheggiato | — |
| 38.2b | Communication step 1 (office-as-hub): company identity + worker attribution (sender_member_id); dispatcher messages/reschedules for worker | Client/Pro | André | ▪️ Parcheggiato | — |
| 38.3 | Business onboarding + docs: company VAT/visura verification, seat management (extends #10) | Internal | Lucio | ▪️ Parcheggiato | — |
| 38.4 | Multi-seat Business billing — per-seat via Stripe quantity (extends #12) | Client/Pro | André | ▪️ Parcheggiato | — |
| 38.5 | Compliance: employer-as-controller DPA + RoPA rows; Platform Work Directive / Annex III scope check | Shared | Lucio | ▪️ Parcheggiato | — |
| 38.6 | Step 2 (PILOT-GATED, form TBD): scoped worker access — per-job magic link or limited login; least-privilege RLS | Client/Pro | André | ▪️ Parcheggiato | — |
| 39 | Two-way reviews — business to client reliability signal (PRIVATE, not public consumer scores) | Client/Pro | André | ▪️ Parcheggiato | — |
| 39.0 | DPIA + LIA + policy: private reliability signal; retaliation guard; Art 22 no auto-exclude; transparency + right to object | Shared | Lucio | ▪️ Parcheggiato | — |
| 39.1 | Schema: customer reliability ratings tied to completed appointment/request; RLS; de-identify on deletion | Client/Pro | André | ▪️ Parcheggiato | — |
| 39.2 | Pro UI to rate reliability; customer transparency + right-to-reply; align with verified reviews #19.2 | Client/Pro | André | ▪️ Parcheggiato | — |
| 40 | Parking & vehicle-access metric (can my car reach the address? parking nearby?) | Client/Pro | André | ▪️ Parcheggiato | — |
| 40.0 | Address geocoding enabler (address to coarse zone; maps vendor DPA/EU) — prerequisite | Client/Pro | André | ▪️ Parcheggiato | — |
| 40.1 | ZTL / Area B & C vehicle-access checker (vehicle emission class + Milan zone rules) — deterministic, high value for out-of-town pros | Client/Pro | André | ▪️ Parcheggiato | — |
| 40.2 | Parking-difficulty index + nearby paid-garage links (research spike first; real-time free-spot count not feasible) | Client/Pro | André | ▪️ Parcheggiato | — |
| 40.3 | Map of the day itinerary in the pro calendar (pins in time order) — depends on 40.0 geocoding + vendor DPA | Client/Pro | André | ▪️ Parcheggiato | — |
| 10.11 | DECISIONE: cosa sblocca il livello — categorie con gate al contatto, durata, peso nel ranking, cosa puo' fare un Iscritto (doc §6). Parcheggiata il 14/08 (da decidere con André, data da destinarsi). NOTA 14/08 sera: una parte e' stata di fatto decisa da Lucio col nuovo onboarding — la verifica P.IVA e' ora ESCLUSIVA dei piani a pagamento (Pro/Business), il Free non la vede. Da ratificare con André insieme al resto della decisione. | Shared | Lucio | 🔶 Decisione | — |


---

### Le quattro regole

1. **Un traguardo è uno stato del mondo, mai un contenitore di attività.** Se non riesci a scrivere «è fatto quando una persona vera può…», è un tema, e i temi non finiscono mai.
2. **Due livelli, e niente sotto la giornata prende una riga.** Traguardo → attività. Il lavoro da mezz'ora sta nel log dei commit, che già lo traccia.
3. **Nessuna data senza una dipendenza o un orologio esterno.** Altrimenti va nel parcheggio.
4. **Quello che è costruito ma spento si scrive `Dormant`, non `Done`,** con la condizione che lo accende. «Done» deve continuare a voler dire «funziona per un utente».
