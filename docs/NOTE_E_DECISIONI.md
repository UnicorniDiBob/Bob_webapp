# BOB — Note e decisioni di lavoro

Annotazioni permanenti che accompagnano la roadmap (artifact "Bob Roadmap" /
`roadmap.csv`). L'artifact si rigenera da CSV e non conserva note: questo file
nel repo è la casa stabile. Aggiungere in cima, non cancellare.

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
