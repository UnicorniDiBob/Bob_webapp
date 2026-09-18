# BOB — Note e decisioni di lavoro

Annotazioni permanenti che accompagnano la roadmap (artifact "Bob Roadmap" /
`roadmap.csv`). L'artifact si rigenera da CSV e non conserva note: questo file
nel repo è la casa stabile. Aggiungere in cima, non cancellare.

---

## 2026-09-14 · Verifica: cosa vede il pro mentre aspetta, e dove vanno scritte le regole dell'abbonamento (decisioni di Lucio)

**La barretta dell'SLA entra solo quando il controllo automatico non passa.**
Quando arriva una richiesta il primo a guardarla è il controllo automatico: se
conferma, non c'è nessuna attesa da raccontare e nessuna barretta. Se non
conferma, allora entra l'SLA e la barretta dice che **la richiesta verrà presa
in esame**. Da lì il ciclo:

- **se ci servono documenti**, la barretta lo segna e passa al livello
  successivo;
- **mandati i documenti**, dice che stiamo revisionando i documenti;
- **se ne chiediamo altri**, il ciclo si ripete da capo;
- **a controllo concluso** dice che il processo è completato, e poi sparisce.

**Se sforiamo i 5 giorni lavorativi: una riga, e nient'altro.** Sulla linea del
tempo compare «ci stiamo mettendo più del previsto». Nessun indennizzo, nessuna
corsia preferenziale, nessuna promessa: *non succede nulla*. La cifra la
misuriamo per noi (`vat_review_opened_at`, mig 080), non per prometterla.

**Dove va scritto che non è dovuto nulla, e dove vanno i piani.** Verificato il
14/09, da far confermare al legale prima del go-live:

- **Il d.lgs. 70/2003 (art. 12) non ci obbliga**: gli obblighi informativi
  precontrattuali del commercio elettronico **non si applicano ai contratti fra
  non consumatori**, e i professionisti sono utenti business. Da lì, niente.
- **Il Regolamento P2B (UE) 2019/1150 sì**: i termini vanno redatti in modo
  chiaro, restare disponibili, e devono indicare **i motivi per cui il servizio
  può essere limitato, sospeso o cessato** (art. 3); ogni restrizione va
  motivata e preavvisata (art. 4) — è la norma che regge la perdita
  dell'etichetta — e le modifiche vogliono un preavviso di almeno 15 giorni
  (art. 8), che i nostri termini già danno.
- **L'art. 1341 comma 2 c.c. è il punto che decide la forma.** «Se sforiamo non
  è dovuto nulla» è una **limitazione di responsabilità**; nello stesso elenco
  stanno la **sospensione del servizio** e il **rinnovo tacito**
  dell'abbonamento (che abbiamo, mig 074). Sono clausole che richiedono
  approvazione specifica, e la Cassazione (ord. 20945/2026) ha detto che **la
  spunta non basta**: vanno isolate dalle condizioni generali, accettate a
  parte e con un log dell'accettazione.

**Conclusione operativa.** I piani e cosa comprende ciascuno, l'SLA di esame e
la riga sullo sforamento non bastano in una policy accettata alla creazione
dell'account: vanno nel **contratto che il professionista accetta quando
sottoscrive l'abbonamento**, e le tre clausole dell'elenco 1341 (responsabilità,
sospensione, rinnovo tacito) vanno isolate con un'accettazione propria. Prima di
scriverle va chiuso lo scarto noto fra la tabella dei piani e il prodotto (il
calendario dato anche al Free): un contratto che descrive piani che non
corrispondono è peggio di nessun contratto.

**Fatto lo stesso giorno** (ramo `feat/verifica-finestra-e-testi`): i testi del
ricontrollo non promettono più che il badge regge finché non lo guarda una
persona — dalla mig 080 non è vero — e il giorno in cui l'etichetta si spegne
adesso è scritto dove il pro lo legge, notifica compresa, oltre che nella
finestra dell'ultima settimana, che ora si apre anche sui ricontrolli e non solo
sulla scadenza annuale.

---

## 2026-09-12 · Verifica, stato del profilo, area di lavoro (decisioni di Lucio)

**SLA della coda di verifica: 5 giorni lavorativi.** È il tempo che dichiariamo
al professionista quando chiede la verifica, salvo imprevisti. Va scritto nei
ToS pro ("SLA di esame") e mostrato al pro mentre aspetta: il silenzio, su una
cosa che ha pagato e che lo tiene fuori dalle ricerche, è la parte che fa male.
Durante l'attesa una **barretta discreta** (fatta il 12/09) che dice **lo stato
della richiesta e basta**: ricevuta → in gestione → esito, più il caso
«documenti richiesti». Non i passi interni della lavorazione — al pro non serve
sapere quale archivio abbiamo interrogato, e raccontarglielo promette un
meccanismo invece di uno stato — e **nessun conto alla rovescia**: i 5 giorni si
leggono come promessa, non come cifra che scorre. Sparisce ad approvazione
ottenuta; se la richiesta non è accolta resta, piena, perché «non accolta» è uno
stato che va letto. Manca ancora il **timestamp di ingresso in coda**: finché
non c'è, l'SLA non lo misura nessuno — e un countdown a video sarebbe una cifra
inventata.

**Scadenza della verifica: ANNUALE** (chiude 10.4, che proponeva 6 mesi).

Sul ricontrollo automatico va corretta un'idea sbagliata, perché ritorna ogni
volta che si parla di frequenza: **ripassare il VIES spesso non serve a niente.**
Il VIES risponde solo per chi è iscritto agli scambi intra-UE, che tra gli
artigiani è la minoranza; per tutti gli altri un esito negativo **non è un
segnale**, è la normalità, e non può far partire niente — né una richiesta di
documenti né un controllo. Quindi:

- Il ricontrollo automatico ha senso **solo per chi è stato verificato DAL
  VIES**, e solo come **cambio di stato**: da confermato a non più confermato.
  Lì sì che vuol dire qualcosa, e costa centesimi.
- Per tutti gli altri — la maggioranza, verificata da una persona — non esiste
  oggi nessun ricontrollo gratuito. Vale l'anno, e il lavoro si taglia in due
  modi onesti: **a campione** invece che su tutti, e **su evento** (una
  segnalazione, una contestazione, un dato che cambia). Il ricontrollo di massa
  automatico arriva solo col gradino 3 a pagamento (Openapi), non prima.
- Quello che l'automatismo non chiude finisce in una sezione admin dedicata,
  **Ricontrollo**, separata dalla coda delle prime verifiche: sono due lavori
  diversi e mescolarli li nasconde entrambi.

**Il preavviso è a due tempi** (migrazione 078, scritta il 12/09): a **30 giorni**
una notifica nella campanella — c'è tempo, si dice dove si leggono le cose da
fare — e nell'**ultima settimana lavorativa** una finestra sull'area di lavoro,
perché lì la posta in gioco cambia: alla scadenza il profilo torna «Iscritto» e
perde l'etichetta che i clienti guardano per prima. La finestra si chiude una
volta per account (`profiles.scadenza_verifica_vista_al`, che contiene la data
di scadenza per cui è stata chiusa: al rinnovo si riarma da sola).

**L'orologio parte da adesso per chi è già verificato**, una volta sola: il
backfill della 078 ha la guardia `vat_expires_at is null`, quindi rigirare la
migrazione non sposta avanti nessuna scadenza. Per le verifiche nuove la data la
scrive un **trigger**, non le route: i livelli si concedono da due posti diversi
(controllo automatico ed esame umano) e una scadenza dimenticata in uno dei due
è una verifica eterna che non nota nessuno.

**Alla scadenza il badge cade da solo** (scelta di Lucio del 12/09, opzione A).
Non contraddice «nessun declassamento automatico»: quella regola parla di una
decisione DISCREZIONALE su una persona — un esame andato male, una segnalazione
— che resta umana. Qui non si giudica nessuno: scade una validità dichiarata,
annunciata 30 giorni e una settimana prima, uguale per tutti e con la data
scritta sul profilo. È esattamente la forma che il Regolamento P2B (art. 4)
chiede per una restrizione: motivazione e preavviso.

**Non è ancora costruito.** Oggi la data esiste e il preavviso esiste, ma
nessuna pagina pubblica legge `vat_expires_at` e nessun giro notturno porta la
riga in Ricontrollo: la finestra preavvisa di un declassamento che non avviene.
Servono tre pezzi, in quest'ordine: (1) l'etichetta pubblica considera scaduta
una verifica scaduta — è una regola di LETTURA, non una scrittura, quindi
reversibile e senza dati persi; (2) il giro notturno che mette in Ricontrollo
chi è scaduto, così qualcuno lo rifà; (3) la sezione Ricontrollo in admin. Va
chiuso prima del pilota.

Resta la regola già scritta: **nessun declassamento automatico**, mai (art. 22
GDPR). La cessazione della P.IVA non aspetta l'anno: è un evento, e quando lo
vediamo va in Ricontrollo subito.

**Il badge dice «Verificato» e basta** (12/09). I livelli si chiamavano «Pro» e
«Pro+», cioè come i piani: un professionista sul piano Free non poteva avere il
badge «Pro», e uno sul piano Plus si vedeva scritto «Pro» addosso. Due scale con
gli stessi nomi. Fuori adesso si legge **Verificato** per entrambi i livelli, con
la data; dentro restano distinti e lo staff ha le sue etichette
(`VERIFICATION_LABEL_STAFF`), perché chi lavora la coda deve sapere se c'è anche
un esame documentale. Questo chiude anche, di fatto, la domanda «livello Pro+:
attivare o rimuovere»: il livello resta, ma non ha più un nome commerciale.

**La cessazione della P.IVA ha un posto dove finire** (migrazione 079). Stato
nuovo `recheck` con un **motivo** che è un dato, non una frase — scadenza,
cessazione, procedura, intestazione — perché decide l'ordine della coda, le
parole che scriviamo al professionista e la motivazione scritta che il P2B
(art. 4) pretende se poi il livello cade davvero. Il giro notturno fa la
distinzione che conta: chi è stato verificato **dal VIES** si ricontrolla da
solo (se il registro conferma ancora, la scadenza si sposta di un anno e non
disturbiamo nessuno; se **non** conferma più un numero che prima confermava,
quello è un segnale vero e apre un caso); chi è stato verificato **da una
persona** non viene nemmeno richiamato, perché per lui un «non risulta» del VIES
non vuol dire niente — va in ricontrollo per scadenza e lo rifà una persona.
**Qui non si declassa nessuno**: il livello resta intatto finché non decide un
umano.

**Resta da decidere una cosa sola su questo**: quanto può restare aperto un caso
di cessazione con il badge ancora acceso. Oggi resta aperto finché qualcuno non
lo guarda — cioè dipende dalla coda, che è esattamente il modo in cui un badge
diventa falso senza che nessuno l'abbia deciso.

**Lo stato del profilo sparisce quando è a posto** (fatto il 12/09). Il riquadro
«Il tuo profilo» resta aperto solo se manca qualcosa o se non compari; a giro
completo resta un pallino verde, col testo al passaggio del cursore, e si
riapre con un clic. Di conseguenza **è stata tolta la notifica «Il tuo profilo è
nelle ricerche»**: era di livello «fatto» e ripeteva uno stato permanente, cioè
insegnava a non aprire la campanella.

**«Bloccato da un admin» oggi non esiste.** Le uniche due ragioni per cui un
profilo non compare sono: spento (da lui o per cancellazione account) e nessun
servizio dichiarato. Un blocco deciso da noi è una **restrizione del servizio**:
serve una colonna con il **motivo** (non un booleano) e, per il Regolamento P2B
art. 4, motivazione scritta e preavviso. È una migrazione e una decisione, non
una riga di copy.

**Area di lavoro: le richieste hanno un ciclo, e si vede.** Con dieci richieste
aperte il calendario finisce sotto chilometri di scroll. Tre posti, non uno:

1. **Richieste** — quelle nuove, non ancora prese in carico. Sezione propria,
   con la bozza di risposta. Da qui il pro la **trasferisce nella chat**: è
   quel gesto, non un campo nascosto, che accende il lavoro.
2. **In corso** — le chat dei lavori aperti.
3. **Conclusi** — ci finiscono **da sole** quando il lavoro viene segnato come
   finito. Nessun archivio a mano.

Deve essere intuitivo: un tasto per stato, il numero accanto, e la stessa
parola in dashboard e in pagina. Dipende da una cosa già aperta: la macchina a
stati di `request_professionals`, che oggi non viene mai aggiornata dopo
l'insert (per questo una richiesta già risposta resta in cima per sempre).

**Le chat: il pro le cancella, noi le conserviamo.** Il professionista deve
poter cancellare una chat conclusa e poter impostare un tempo di cancellazione
automatica. Quello che cancella è **la sua vista**: i messaggi di un lavoro con
la Garanzia Bob ci servono come prova in caso di contestazione e si conservano
fino alla prescrizione (DATA_COMPLIANCE §5), poi li porta via la retention. Va
scritto così anche a video — «non la vedi più tu» è una promessa che possiamo
mantenere, «è sparita» no — e va messa una riga nel registro dei trattamenti.

---

## 2026-08-03 · 10.x — Blocco 10 in produzione: cosa è cambiato nelle regole

Il blocco 10 è passato da motore a funzione visibile. Le tre cose che vale la
pena ricordare perché cambiano una regola, non solo il codice:

1. **"Esiste" non prova "è sua".** Il VIES restituisce anche l'intestazione, e
   fino al 01/08 il codice la confrontava col nome del profilo **senza
   bloccare**: chiunque poteva incollare la partita IVA di un'azienda vera e
   prendersi il badge. Ora il livello automatico richiede la corrispondenza; il
   confronto è stretto (due parole significative, 60% di copertura) e gira su
   tutti i nomi che già abbiamo, registrando quale ha deciso. Una partita IVA
   verificata può appartenere a un solo profilo (indice unico, mig 039).

2. **Una società in liquidazione ha la partita IVA ATTIVA e il VIES la
   conferma.** Verificato su Alitalia in A.S., Banca Popolare di Vicenza e
   Veneto Banca in LCA: `isValid: true` tutte. Il riscontro fiscale da solo
   direbbe "Pro" a un'azienda ferma da otto anni. Intercettiamo il segnale nella
   denominazione e mandiamo in coda (mai rifiuto automatico).

3. **Gratuito e automatizzabile esiste solo il VIES**, che copre la minoranza.
   Agenzia delle Entrate, Registro Imprese e INI-PEC sono gratuiti ma vogliono
   una persona davanti a un browser. Listino Openapi letto il 01/08: stato +
   denominazione **2-5 centesimi per professionista**, PEC dell'impresa 3
   centesimi. Lo stesso controllo a mano costa ~50 centesimi di tempo: il
   gradino 3 è la voce più economica del processo, non la più cara.

Decisione ancora aperta e in mano a Lucio (milestone 10.11): cosa sblocca
davvero il livello — gate sulle categorie, peso nel ranking, durata. Metà dei
task rimasti dipende da quella risposta.

## 2026-07-19 · 10.0 — Ricerca verifica P.IVA (esito)

**Come si verifica una P.IVA italiana, in pratica:**

1. **Checksum** (gratis, offline): la P.IVA è 11 cifre con cifra di controllo
   (algoritmo tipo Luhn). Primo filtro nel form — scarta subito refusi.
2. **VIES** (API gratuita UE, SOAP/REST): ⚠️ **NON basta come verifica
   principale.** Contiene solo le P.IVA iscritte all'archivio VIES per
   operazioni intra-UE (opt-in sul mod. AA9/12 o in area riservata AdE).
   L'artigiano locale tipico NON è iscritto → assenza dal VIES ≠ P.IVA
   invalida. Utilizzabile solo come segnale positivo aggiuntivo.
3. **Agenzia delle Entrate "Verifica P.IVA"** (gratis, ufficiale): restituisce
   stato (attiva/sospesa/cessata), denominazione o nome del titolare, data
   inizio attività. MA: solo web, protetto da CAPTCHA, nessuna API pubblica →
   niente integrazione diretta (e niente scraping).
4. **Provider commerciali** (Openapi "Company", InfoCamere/Registro Imprese,
   Cerved): API REST a consumo su fonte ufficiale AdE/InfoCamere, restituiscono
   stato + denominazione + ATECO ecc. → **questa è la via programmatica.**
   Costo dell'ordine dei centesimi per chiamata; volumi bassi (verifiche
   una-tantum per pro iscritto).

**DAC7 (D.Lgs. 32/2023, dir. UE 2021/514):** i gestori di piattaforme che
facilitano servizi personali con corrispettivo noto devono raccogliere,
**verificare** e comunicare annualmente all'AdE (scad. 31/1) i dati fiscali dei
venditori (CF/P.IVA inclusi). Oggi Bob è fuori perimetro (nessun pagamento
transita), ma dal flusso protetto (blocco 19, 2027) ci rientra: la raccolta e
verifica della P.IVA diventa un obbligo di legge, non una scelta.

**Questione lavoratori occasionali senza P.IVA:** la prestazione occasionale
esiste (lavoro autonomo non abituale, ritenuta 20%, soglia contributiva INPS
5.000 €/anno) ma per Bob è problematica: (a) chi si iscrive a un marketplace
per trovare clienti in modo continuativo difficilmente è "non abituale";
(b) le 5 categorie core (idraulico, elettricista, ecc.) richiedono impresa
abilitata DM 37/2008 — il lavoro occasionale non qualificato lì è illegale e
un rischio di responsabilità.
*(Aggiornamento 20/07/2026: il terzo argomento originario — coerenza col
posizionamento "emersione del lavoro nero" — è stato rimosso per decisione di
Lucio: quel posizionamento è abbandonato, vedi
`docs/DECISIONE_posizionamento_2026-07-20.md`.)*
**Proposta in attesa di decisione:** P.IVA obbligatoria per tutti i pro al
lancio; eventuale tier "occasionale" solo se in futuro si aprono categorie
soft (ripetizioni, dog sitting…), con autodichiarazione, limiti e senza badge
"Verificato".

**Come si comportano i competitor (verificato 2026-07-19):**

| Piattaforma | P.IVA all'iscrizione | Verifica | Note |
| --- | --- | --- | --- |
| Instapro | **Obbligatoria** ("valida e attiva", requisito T&C anche per persone fisiche) | Sì, all'ingresso | Ne fa un claim di fiducia: "tutti i nostri professionisti hanno P.IVA" |
| ProntoPro | Non richiesta all'ingresso (iscrizione libera e gratuita) | No fiscale; badge "Top Pro" = solo recensioni (12+ con media ≥4.8) | Conseguenza nota: qualità percepita bassa, contatti contestati (v. Competitor Gap xlsx) |
| Cronoshare | Non richiesta | No | Pubblica perfino guide "fatturare senza P.IVA" (prestazione occasionale) |
| StarOfService | Non richiesta | No | Modello lead-gen aperto, nessun presidio fiscale |

Pattern: il mercato si divide tra piattaforme aperte (massima offerta, rischio
qualità scaricato sul cliente) e Instapro che usa la P.IVA obbligatoria come
argomento di vendita. Nessuno fa la via di mezzo: ingresso aperto + verifica
come gate di visibilità. È lo spazio per Bob (v. decisione 10.x).

**Cosa chiedono esattamente all'iscrizione (verificato 2026-07-19):**
- *Instapro* (fonte: support + T&C): nome azienda, nome titolare/contatto,
  indirizzo aziendale, telefono, email, **P.IVA valida e attiva**, **metodo di
  pagamento** (i lead si pagano). Il funnel più pesante del mercato.
- *ProntoPro* (funnel /prosignup percorso dal vivo): servizio offerto →
  "azienda o libero professionista?" → nome e cognome → zona/contatti.
  **Niente P.IVA, niente documenti, niente metodo di pagamento** — nemmeno
  per categorie DM 37 (test fatto con "Idraulico"). I crediti si comprano dopo.
- *Cronoshare / StarOfService*: categoria + zona + contatti. Nessun controllo
  fiscale o documentale.
- **Nessun competitor chiede documenti d'identità all'iscrizione.** La verifica
  documentale nel mercato esiste solo come programma di fiducia premium
  (benchmark: Google Guaranteed), mai come gate d'ingresso.

**Decisione proposta — livelli di verifica (in attesa di ratifica):**
- L0 Iscritto: nome, email, categoria, città. Frizione identica a ProntoPro.
  Profilo creabile, domanda visibile in forma anonima. Nessun documento.
- L1 P.IVA verificata (automatica, un campo, zero upload): sblocca matching e
  contatto clienti nelle categorie regolamentate. Checksum + API stato attiva
  + confronto denominazione.
- L2 Badge "Verificato Bob" (facoltativo): documento + visura (e DM 37 per
  impiantisti). Non è un gate: è un boost di ranking/conversione, se lo
  guadagna chi vuole. Risponde all'obiezione "documenti = frizione inutile".
- Categorie soft future: L0 basta, con etichetta "occasionale dichiarato".

**Architettura proposta 10.1:** checksum nel form → chiamata server-side al
provider commerciale alla registrazione pro (stato attiva + confronto
denominazione/nome) → esito e snapshot salvati in tabella dedicata (audit,
RLS staff) → badge "Verificato" pieno solo dopo step manuale 10.2 (documento
+ visura). Privacy: la P.IVA di una ditta individuale è dato personale →
riga nel registro trattamenti, base giuridica contratto (poi obbligo legale
con DAC7), retention allineata alla policy (DATA_COMPLIANCE).

## 2026-07-18 · 25b — Fix privacy + follow-up aperto

Data di nascita e consenso termini spostati in `profile_private` (mig 027):
la policy 003 esponeva l'intera riga `profiles` dei professionisti ad anon
(verificato con `set role anon`). **Follow-up aperto:** `profiles.phone` dei
pro resta pubblicamente leggibile per la stessa policy (oggi vuoto per tutti)
→ spostarlo in `profile_private` prima del go-live.

## 2026-07-18 · 9.x — Analisi (debito tecnico e limiti noti)

- Aggregazioni calcolate in pagina: ok a volumi demo, da rifattorizzare in
  viste/aggregazioni DB nel launch hardening (blocco 15).
- Storico cambi abbonamento (mig 025) parte dal 18/07/2026: churn/disdette
  attendibili solo da quella data.
- Ricerche per categoria (mig 026): eventi anonimi by design (mai user_id né
  testo libero). Conta solo brief completati; chat abbandonate non tracciate —
  decisione aperta se loggarle.
- Export Excel: dipendenza `xlsx` (SheetJS).

## 2026-07-18 · repo — Nota migrazioni

La migration applicata live col nome `021_profile_age_terms_and_city_geo` nel
repo si chiama `024_…` (rinumerata per collisione con il lavoro parallelo
021–023 di André). Schema identico, solo il nome nella history diverge.

## 2026-08-01 · Bob — Memoria cliente e concordanza grammaticale

**Memoria cliente.** Il saluto "Bentornato! L'ultima volta cercavi…" usa la
memoria solo se `customer_memory.updated_at` è entro 24h e si mostra una volta
per sessione del browser (flag in `sessionStorage`, chiave per `user.id`). Prima
scattava a ogni mount con `step === "intent"`, quindi a ogni login e a ogni
refresh, e senza controllo di freschezza: in produzione riproponeva una ricerca
di 12 giorni prima. Retention lato DB nella migrazione 034 (`pg_cron`
giornaliero, purga a 30 giorni). Vedi DATA_COMPLIANCE §5 e il registro
trattamenti.

**Concordanza grammaticale (mig 035).** In sette punti il nome del servizio
veniva incollato dopo un `un` fisso: giusto per i nove mestieri maschili
singolari, sbagliato per gli altri sei ("un pulizie", "un traslochi", "un
sviluppo web"). `services` ha ora `gender`, `is_plural`, `takes_article`;
l'articolo si deriva in `src/lib/italian.ts` (`withArticle`, `quale`).

- **Aggiungendo un servizio a catalogo, compilare i tre campi.** I default
  (`'m'`, `false`, `true`) riproducono il comportamento vecchio, quindi un
  servizio dimenticato non rompe nulla ma può leggersi male. Non c'è una UI
  admin per creare servizi: si inseriscono da Supabase, quindi il promemoria
  vive qui.
- `takes_article = false` per i nomi di categoria non numerabili ("Grafica e
  Logo", "Musica e intrattenimento"): con qualsiasi articolo suonano sbagliati.
- **Limite noto:** manca il plurale del nome ("elettricista" → "elettricisti").
  Le frasi che lo richiedevano ("trovi X verificati") sono state riscritte per
  parlare di "professionisti". Se in futuro serve il plurale, va una colonna
  `name_plural`, non un'euristica sul suffisso.

## 2026-09-17 · Le 88 zone di Milano, e da dove viene l'elenco dei CAP

**Milano passa da 28 zone a 88 (mig. 084).** Le 28 erano un elenco corto
scritto a mano per il cliente in chat; al professionista servono per dire dove
lavora, e lì non bastavano: 55 nuclei su 88 non avevano nessuna casella, e la
mappa li disegnava senza poterli scegliere. La griglia sono ora i NIL del
Comune (dataset ds964, CC-BY), con il centro di ogni zona **calcolato dal
poligono** e non copiato dal CSV dei centroidi: è il punto che sta dentro la
forma che si vede sulla mappa.

- I 28 nomi corti restano in `src/lib/zones.ts` (percorso del cliente, area di
  André, non toccata) e diventano `city_zones.group_slug`. `coverage_keys_for`
  emette anche il gettone del gruppo, così una richiesta che dice «Navigli»
  incontra chi copre Ronchetto sul Naviglio.
- **Scelta da rivedere se cambia la liquidità:** il gettone del gruppo si
  emette se il professionista copre **almeno uno** dei nuclei del gruppo, non
  tutti. Con sei professionisti attivi perdere incontri veri costa più che
  allargare di un quartiere. La riga da cambiare è nella 084.
- Due nuclei erano fuori dai gruppi per un confronto fatto sulle stringhe:
  «PTA ROMANA» non contiene «PORTA ROMANA», e i Giardini di Porta Venezia sono
  scritti «GIARDINI P.TA VENEZIA». Rimessi dentro nel generatore.

**Il CAP all'iscrizione, e la sua fonte (mig. 085).** Comune e regione si
scelgono da un elenco, il CAP è obbligatorio nel modulo. L'elenco completo e
ufficiale dei CAP è di Poste Italiane e **non è aperto**: quello che usiamo per
proporli arriva da `matteocontrini/comuni-json`, dove i comuni vengono
dall'archivio ISTAT (CC BY 3.0 IT, attribuzione dovuta e scritta nel file
generato) mentre **per i CAP la fonte dichiara di non applicare alcuna
licenza**, perché a sua volta li ha raccolti da terzi.

- Decisione di Lucio, 17/09/2026: si usa lo stesso, con l'attribuzione scritta
  nel file generato e in questa voce, perché l'alternativa (OSM, ODbL con
  share-alike sul database derivato) costa di più e copre peggio.
- **Conseguenza pratica, ed è il motivo per cui è scritto qui:** l'elenco non è
  garantito completo, quindi il CAP si **suggerisce**, non si impone. Il
  vincolo in database controlla le cinque cifre, non l'appartenenza al comune,
  e nel modulo c'è sempre la via d'uscita «il mio non è in elenco».
- Il file (`src/lib/data/comuni-italia.json`, 900 KB) non va mai importato da
  un componente del browser: lo legge solo `/api/geo/comuni`, lato server.

## 2026-09-17 (sera) · I confini dei comuni, un file per provincia

Per disegnare l'area di lavoro fuori Milano servono le forme dei comuni.
`scripts/build_confini_province.py` le ritaglia dai **confini comunali ISTAT
distribuiti da openpolis/geojson-italy in CC BY 4.0** e ne scrive uno per
provincia in `public/geo/province/`: 107 file, in media 56 KB, 6 MB in tutto.
L'attribuzione sta dentro ogni file, nella proprietà `fonte` — è un obbligo
della licenza, non una cortesia.

- **Un file per provincia e non uno solo**: tutta Italia sono decine di
  megabyte, e la mappa deve caricare quello che guardi, non il paese intero.
- **Niente tile, come per Milano**: nessun fornitore, quindi l'IP del
  professionista e il pezzo d'Italia che sta guardando non escono da Bob.
- **Semplificazione con Douglas-Peucker**, tolleranza 0,0005° (~55 m), non «un
  punto ogni N» che sui confini frastagliati taglia i promontori e lascia i
  rettilinei. Si cambia con `--tolleranza`: a 0,001 i file dimezzano e le forme
  restano riconoscibili a scala di provincia.

### Tre cose trovate facendolo, che restano vere anche domani

1. **I codici ISTAT della Sardegna non combaciano fra i due elenchi.** Le
   province sarde sono state rifatte e il codice del comune comincia col codice
   della provincia: stesso paese, due numeri. Sono 377 comuni. Il generatore li
   appaia per nome e regione, e c'è una prova in `src/lib/confini.test.ts` che
   fallisce se quel pezzo si rompe — senza, mezza isola sparirebbe in silenzio.
2. **16 comuni del nostro elenco non hanno una forma** (Bardello, Bregano,
   Monteciccardo, Moransengo…): i confini sono più recenti del nostro elenco
   ISTAT 2020 e quei comuni nel frattempo si sono fusi. Sulla mappa resteranno
   un pallino. Si chiude aggiornando l'elenco dei comuni, che oggi non
   aggiorniamo perché ci portiamo dietro i CAP della stessa fonte.
3. **26 comuni hanno il proprio centro fuori dal proprio confine** — Caorle,
   Portoferraio, Pedemonte, Ponza: comuni fatti di pezzi separati, o a forma di
   C, dove il centro medio cade nel mare o nel comune accanto. Non è un errore
   da correggere: il cerchio lavora sul punto, e il punto è quello. Lo script
   lo controlla a ogni passata (99,7% dentro) proprio per accorgersi se un
   giorno quella percentuale crollasse, che vorrebbe dire due Italie diverse.

## 17 settembre 2026 — l'Italia sotto la mappa, e più province insieme

Lo screenshot del pomeriggio: la provincia di Milano disegnata, e intorno il
colore di fondo. «Manca ancora l'Italia e i comuni.» È lo stesso problema del
28 agosto dentro Milano — «non si vede proprio Milano sotto» — su scala
nazionale: senza un disegno d'insieme la propria città è sospesa nel vuoto e
non si capisce dove si è.

### Tre piani, che sono lo stesso disegno visto da tre distanze

`public/geo/italia.geojson` sono 110 forme di provincia, 428 KB (138 compressi),
caricate una volta sola e accese a ogni ingrandimento. Sopra, i comuni delle
province che stanno nell'inquadratura; sopra ancora, i quartieri dove la città
li pubblica. Come una carta stradale: allargando resta il paese, entrando
compaiono i comuni.

### Perché le province come sfondo e non i comuni

Un'Italia fatta di 7.904 comuni, anche diradata, resta un file grosso e a zoom
basso è un groviglio di righe. 110 forme danno la sagoma del paese e
abbastanza struttura per orientarsi, con settanta volte meno disegno.

### Perché più province di comuni insieme, e non una sola

Fino a oggi la mappa teneva una provincia per volta e cambiare provincia
buttava via la precedente. Ma chi lavora a Monza copre anche Milano e Como: la
sua area sta su tre file. Adesso se ne tengono aperte fino a sei, scelte
dall'inquadratura e chieste **a movimento finito**, non durante il
trascinamento — durante sarebbero sessanta richieste al secondo per un file
solo che serve.

**Non si buttano mai** la provincia della base e quelle dove ha già acceso un
comune: se si buttassero, la sua scelta sparirebbe dallo schermo appena sposta
la mappa, e sembrerebbe cancellata.

### I due tagli che tengono il costo

1. **Sotto lo zoom 8 i comuni non si caricano affatto.** A quella distanza sono
   righe da mezzo pixel: sarebbero megabyte per non far vedere niente. Resta lo
   sfondo delle province, che a quella scala è il disegno giusto.
2. **Si proiettano solo le forme che toccano l'inquadratura.** Ogni forma porta
   adesso il proprio riquadro (`FormaComune.riquadro`), e il confronto costa un
   millesimo della proiezione. Senza, con sei province aperte il trascinamento
   si sentirebbe.

### La Sardegna, ancora — e una cosa trovata dalla prova

La fonte pubblica delle province ha ancora le quattro soppresse dalla riforma
del 2016 (CI, VS, OG, OT); il nostro elenco dei comuni ha quelle di adesso, e
la sigla è il **nome del file**. Le forme restano come sono — la sagoma
dell'isola non cambia, e per uno sfondo è tutto quello che serve — e cambia
solo la sigla: CI e VS diventano SU, OG diventa NU, OT diventa SS.

Il riquadro di ogni provincia, però, **lo decide il file dei comuni, non la
forma**. Prima versione: riquadro della forma, allargato con i centri dei
comuni. La prova ha trovato che il nord di Seulo restava fuori da SU — un
comune che, guardando solo quel pezzo di mappa, non si sarebbe disegnato. Il
riquadro serve a rispondere a «in questa inquadratura ci sono comuni di quel
file?», e l'unica risposta esatta è il riquadro del file stesso.

Fonte: confini provinciali ISTAT via openpolis/geojson-italy, CC BY 4.0,
attribuzione dentro il file e nel controllo della mappa.

## 18 settembre 2026 — la mappa strappava: cinque misure, e i numeri

Con l'Italia accesa e sei province aperte la mappa ha cominciato a strappare.
Nello screenshot si vedeva anche il motivo principale: una macchia grigia sul
nord Italia, che erano i comuni di sei province disegnati a livello nazionale.

### 1. Sotto lo zoom 8 i comuni non si disegnano (non solo: non si caricano)

Il controllo c'era già, ma solo sul CARICAMENTO: le province già in memoria
continuavano a disegnarsi. A quella scala sono 772 forme che diventano una
macchia, e costano tutto il fotogramma per non far vedere niente. È la misura
che rende di più ed è anche quella giusta da vedere.

### 2. I vertici si proiettano una volta sola, non a ogni fotogramma

In Mercatore la X dipende solo dalla longitudine e la Y solo dalla latitudine, e
lo schermo è una trasformazione **lineare** di quelle due — finché la mappa non
è ruotata né inclinata, che qui non succede (la bussola è disattivata). Quindi
ogni vertice diventa due numeri in un `Float64Array` quando il file arriva, e a
ogni fotogramma resta una moltiplicazione e una somma: niente trigonometria,
niente allocazioni, niente chiamate a maplibre. La trasformazione si tara su due
punti veri chiesti a `project()`, due volte per fotogramma invece di centomila.
Se la mappa risulta ruotata o inclinata si torna a `project()` per vertice.

### 3. Un tracciato solo per piano, non uno per forma

Le forme spente hanno tutte lo stesso colore: stanno in un `<path>` unico.
Restano separate solo quelle accese, che sono poche. Da ~880 `setAttribute` per
fotogramma a tre. Il `<title>` per forma è sparito con i tracciati: il nome del
comune adesso lo dice una targhetta in alto a destra, che si vede subito invece
di aspettare il secondo del browser.

### 4. Si arrotonda al pixel e si saltano i doppioni

Due vertici che cadono sullo stesso pixel sono un vertice. A livello nazionale
un confine da 220 punti ne lascia una quarantina: è una semplificazione che si
adatta all'ingrandimento senza precalcolare nessun livello di dettaglio. E
`Math.round` al posto di `toFixed(1)`, che è formattazione di stringhe.

### 5. Il riquadro prima del ray casting

Il click resta della mappa e chi è stato toccato lo dice un point-in-polygon.
Girava su tutte le forme **a ogni movimento del mouse**. Adesso prima si guarda
il riquadro — un confronto fra numeri — e il conto vero tocca a una o due
forme. Più un fotogramma di ritmo su `mousemove`, che arriva a raffica.

### I numeri

Banco di prova sui file veri (solo l'aritmetica e le stringhe, senza il DOM,
quindi il guadagno vero è più grande):

| | prima | dopo |
|---|---|---|
| vista nazionale | 12,2 ms/fotogramma | **1,0** |
| vista cittadina | 5,2 ms/fotogramma | **0,2** |

Sedici millisecondi è il bilancio di un fotogramma a 60 al secondo: prima se ne
andavano quasi tutti nel disegno, e restava lo strappo.
