# Verifica P.IVA: cosa serve per farla davvero (blocco 10.1)

Analisi operativa, 31/07/2026. Aggiorna e in parte **corregge** la ricerca del
19/07 (`NOTE_E_DECISIONI.md` §10.0) alla luce di test tecnici reali.

---

## 1. La correzione: il VIES è più utile di quanto avevo concluso

Il 19/07 avevo scritto che il VIES «non basta» perché contiene solo le partite
IVA iscritte per operazioni intra-UE. **Resta vero in teoria, ma i test dicono
che in pratica copre più di quanto pensassi** — e soprattutto: esiste un'**API
REST pubblica, gratuita e senza autenticazione**, che restituisce anche la
denominazione.

Endpoint (Commissione europea):
```
GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/{partitaIVA}
```

**Test eseguiti il 31/07/2026** su due partite IVA reali e pubbliche:

| P.IVA | Soggetto | `isValid` | `name` restituito | `address` |
| --- | --- | --- | --- | --- |
| 12485671007 | Openapi SpA | `true` | `OPENAPI SPA` | Viale F. T. Marinetti 221, 00143 Roma RM |
| 06012790876 | Baze S.r.l. Società Benefit | `true` | `BAZE S.R.L. SOCIETA' BENEFIT` | Piazza di Cestello 10, 50124 Firenze FI |

**Test aggiuntivi 31/07/2026** (stesso endpoint):

| P.IVA | Soggetto | Esito |
| --- | --- | --- |
| 00743110157 | Motorola Solutions Italia S.r.l. | `isValid: true`, denominazione restituita |
| 12345678901 | numero inesistente | `isValid: false`, `userError: "INVALID"`, `name: "---"` |

*(Correzione del 01/08: la riga qui sopra diceva "checksum valido". Non lo è —
per 1234567890 la cifra di controllo corretta è 3, quindi il numero valido
sarebbe 1234567890**3**. Quel test interrogava il VIES direttamente, saltando il
gradino 1: nel flusso vero un numero così si ferma prima, senza uscire da casa
nostra. Per provare la coppia "checksum ok + inesistente" si usa 12345678903.)*

Quindi il VIES distingue correttamente un numero formalmente valido ma
inesistente: il checksum da solo non basta, e la combinazione dei due gradini
funziona. Nota tecnica: il campo `name` vale `"---"` quando il dato non c'è, e
il client lo normalizza a `null`.

Risposta JSON utile: `isValid`, `requestDate` (timestamp da conservare come prova
della data del controllo), `name`, `address`, `userError` ("VALID").

**Perché la copertura è migliore del previsto:** l'iscrizione al VIES si può
chiedere già all'apertura della partita IVA (modello AA9/12) ed è **necessaria
per chi acquista servizi digitali dall'estero** — Google Ads, AWS, qualunque SaaS
in reverse charge. Di fatto quasi ogni impresa che fa pubblicità online o usa
software in abbonamento è iscritta.

**Limite che resta, e va misurato sul campo:** l'artigiano che non ha mai fatto
operazioni intra-UE può non essere iscritto, e in quel caso il VIES risponde
`isValid: false` — che **non significa partita IVA inesistente**. Il campione
testato è di due sole aziende, entrambe "digitali": non è rappresentativo degli
idraulici. La misura vera si farà sui primi pro reali (vedi §5, telemetria).

---

## 2. L'architettura consigliata: tre gradini, dal gratis al pagamento

**Gradino 1 — Checksum (già fatto, gratis, offline).**
`src/lib/vat.ts`: normalizza l'input, valida le 11 cifre e il carattere di
controllo. Scarta refusi e numeri inventati senza spendere nulla. Testato.

**Gradino 2 — VIES (gratis, nessun contratto, nessuna chiave).**
Se risponde `isValid: true` abbiamo **conferma + denominazione**: sufficiente per
concedere il livello "Pro". Costo zero, nessun fornitore, nessun DPA (vedi §4).

**Gradino 3 — Provider commerciale (a pagamento, solo se il VIES non risponde).**
Serve per i casi in cui il VIES dà `false`: interroga la banca dati ufficiale
(Agenzia Entrate / InfoCamere) e restituisce stato e denominazione. Candidati
italiani: **Openapi** (ha sandbox gratuita e documentazione pubblica),
**InfoCamere / Registro Imprese**, **Cerved**, **A-Cube**. Ordine di grandezza:
centesimi per chiamata; da confermare col listino al momento dell'attivazione.

Con questa cascata il costo reale è **vicino a zero**: si paga solo la coda dei
casi non coperti dal VIES, una volta per professionista.

*(L'Agenzia delle Entrate resta esclusa come integrazione diretta: il suo
servizio di verifica è solo web e protetto da CAPTCHA, senza API pubblica. Non
si aggira, e non serve.)*

---

## 3. Limiti tecnici da gestire nel codice

- **`isValid: false` è ambiguo.** Può voler dire: partita IVA inesistente,
  cessata, o semplicemente non iscritta al VIES. Non deve mai produrre un
  "respinto" automatico: va messa in coda per il gradino 3 o per l'esame umano.
- **Nome che non combacia.** Le ditte individuali risultano spesso col nome della
  persona, le società con la ragione sociale; il profilo Bob può avere un nome
  commerciale diverso. Per questo `nameLooksConsistent()` in `lib/vat.ts`
  *segnala* la discordanza senza decidere.
- **Disponibilità del servizio.** Il VIES è un servizio pubblico che a volte è
  lento o restituisce errori temporanei (`MS_UNAVAILABLE`). Serve timeout breve
  (3-5 s), niente blocco della UI, e ritentativo differito: la verifica è
  asincrona, non un requisito per completare l'iscrizione.
- **Rate limiting.** Nessun limite documentato per uso normale, ma va evitato di
  interrogarlo a ogni caricamento pagina: si interroga **una volta**, si salva
  l'esito con la data, si ripete solo alla scadenza.
- **Il dato invecchia.** Una partita IVA attiva oggi può cessare domani: da qui
  la necessità di una scadenza della verifica (proposta: 6 mesi) e di un
  ricontrollo periodico.
- **Non dice se il pro è abilitato.** Il VIES conferma l'esistenza fiscale, non
  i requisiti tecnico-professionali (D.M. 37/2008): quelli restano al livello
  "Pro+" con esame documentale umano.

---

## 4. Permessi, contratti e adempimenti

**Per il VIES: nessun permesso, nessun contratto, nessuna chiave API.** È un
servizio pubblico della Commissione europea, interrogabile liberamente. Va però
chiamato **da server** (route API Next.js), non dal browser: così non esponiamo
il traffico degli utenti verso terzi e controlliamo il rate.

**Per il provider commerciale (gradino 3), serve:**
1. **Contratto/account** con il fornitore (Openapi ha sandbox gratuita per i
   test: si può integrare tutto senza spendere).
2. **DPA — accordo sul trattamento dei dati (art. 28 GDPR)**: gli inviamo una
   partita IVA riferita a una persona fisica (ditta individuale), quindi un dato
   personale. Va verificato se il fornitore agisce da responsabile del
   trattamento o da titolare autonomo, e conservato l'accordo.
3. **Server UE** o garanzie equivalenti per i trasferimenti.

**Adempimenti privacy nostri, in ogni caso (anche col solo VIES):**
- **Riga nel registro dei trattamenti**: finalità "verifica dei requisiti dei
  professionisti", base giuridica **esecuzione del contratto** (art. 6.1.b) e,
  in prospettiva, **obbligo legale** quando scatterà DAC7.
- **Informativa aggiornata**: dire che verifichiamo la partita IVA presso banche
  dati pubbliche e che conserviamo l'esito.
- **Retention**: quanto teniamo lo snapshot della risposta. Proposta: finché il
  profilo è attivo + il periodo utile a difendersi da contestazioni.
- **Minimizzazione**: già rispettata dallo schema (migration 029) — la partita
  IVA sta in tabella con RLS stretta, pubblicamente si espone solo livello e
  data, mai il numero.
- **Human in the loop**: nessun declassamento o esclusione automatica.
  L'esito negativo apre un caso, non chiude un profilo (regola già fissata, e
  richiesta anche dall'art. 22 GDPR).

**Nessuna autorizzazione o abilitazione serve a noi** per fare queste verifiche:
non stiamo esercitando un'attività regolamentata, stiamo controllando un dato
pubblico sui nostri utenti. (Diverso sarebbe definirci "mediatori": vedi
`RICERCA_intermediazione_e_1341.md`.)

---

## 5. Cosa implementare, in ordine

1. **Route API server-side** `POST /api/pro/verifica-piva`: checksum → VIES →
   salvataggio esito in `professional_verification` + evento in
   `verification_events`. Con timeout e gestione degli stati ambigui.
2. **UI nel profilo pro** (`/dashboard/profilo`): campo partita IVA, esito
   immediato del checksum, stato della verifica, cosa sblocca il livello.
3. **Coda in admin**: i casi che il VIES non conferma, con azione umana
   (concedi / richiedi documenti / rifiuta con motivazione).
4. **Badge pubblico** sul profilo del professionista: etichetta + **data** +
   tooltip con cosa significa e cosa non significa (già scritto nei ToS).
5. **Telemetria del gradino 2**: contare quanti pro reali il VIES conferma e
   quanti no. È il dato che dirà se il gradino 3 serve davvero o se è marginale
   — e quindi se aprire un contratto con un fornitore.
6. **Ricontrollo periodico** (proposta 6 mesi) con declassamento assistito.

I punti 1-4 li posso fare **subito, senza account e senza spese**, perché il
VIES non richiede nulla. Il punto 5 dà la risposta sul se e quando fare il
gradino 3.

## 5-bis. Stato al 31/07/2026 (fine giornata)

Fatto e in repo:

- **Gradino 1** — `src/lib/vat.ts` (checksum, normalizzazione, confronto nomi).
- **Gradino 2** — `src/lib/vies.ts` (client server-side, tre esiti distinti).
- **Motore** — `POST /api/pro/verifica-piva` (i tre gradini, limite 3/24h,
  registro eventi, nessun rifiuto automatico).
- **Punto 2 — UI nel profilo pro** — `src/components/VatVerification.tsx`,
  innestato in `/dashboard/profilo`: checksum mentre digita, tasto di verifica,
  stato corrente, motivazione visibile al pro, e la riga che dice che il numero
  non è pubblico. Il caso "non nel VIES" è spiegato come non-rifiuto.
- **Punto 4 — Badge pubblico** — `VerificationLevelBadge` in
  `src/components/ui.tsx`: etichetta + **data** + tooltip con cosa attesta e
  cosa **non** attesta (allineato al §3.2 dei ToS professionisti). Vive sul
  profilo pubblico, nelle card di elenco e nei risultati della chat di Bob.
  Sostituisce il vecchio badge "Verificato" su quelle tre superfici: quello
  diceva più di quanto avessimo controllato e non portava la data. Resta in uso
  nella dashboard del pro e in admin, dove indica l'approvazione dello staff.
- **Migration 038** (applicata in produzione il 31/07 col nome provvisorio
  034; rinumerata perché nel frattempo sono arrivate 034/035 di André, e
  perché la 036 e la 037 — anch'esse sul badge — sono state applicate live
  **senza file in repo**: drift da sanare, vedi l'intestazione del file 038)
  — tre cose: (a) livello e data rispecchiati su
  `professionals` da un trigger, così il badge pubblico non passa più da una
  vista `security_invoker = off` (era un ERROR dell'advisor Supabase aperto
  dalla 029, ora chiuso; la P.IVA resta in `professional_verification` con RLS
  stretta); (b) colonne `vat_review_*` per lo stato e la motivazione dell'esame
  umano; (c) eventi `documents_requested` e `vat_rejected` nel registro.
  Applicata in Supabase il 31/07/2026.

- **Punto 3 — coda in admin** — sezione in cima a `/admin/professionals`
  (la voce di menu si chiamava già "Verifiche"), più
  `POST /api/admin/verifiche/[id]`. Tre azioni umane: concedi Pro, chiedi
  documenti, rifiuta — con **motivazione obbligatoria** (minimo 15 caratteri)
  sulle ultime due, perché è quella che il professionista legge nel profilo e
  riceve per email: obbligo di motivazione del Reg. UE 2019/1150. Ogni azione
  scrive in `verification_events` con autore e data; se il registro non
  accetta la scrittura la route risponde errore invece di far finta di niente.
  Nella stessa sezione ci sono anche i **livelli attivi**, così una
  concessione automatica sbagliata si revoca da lì e non via SQL.
  In dashboard admin c'è il contatore dei casi aperti.
- **Email di esito** (`lib/email.ts`): tre eventi nuovi, dormienti finché non
  c'è `RESEND_API_KEY`. Testo di servizio, mai promozionale, con un piè di
  pagina che dice il vero motivo dell'invio.

Correzioni fatte durante la revisione del 01/08 (valgono come nota per il
futuro, erano tutti errori veri):

- Un secondo tentativo **non confermato** da parte di chi era già verificato
  riscriveva `vat_checked_at` lasciando il livello: il badge pubblico avrebbe
  detto "Pro · oggi" sulla base di un controllo fallito. Ora chi è già
  verificato riceve 409 e il cambio di P.IVA passa dallo staff.
- Le `update` della route pro non guardavano l'errore: si poteva rispondere
  "verificata" con il database invariato.
- La data del VIES (`"2026-03-11+01:00"`, senza orario) diventava il giorno
  prima in UTC. Ora è normalizzata alla mezzanotte del suo fuso e tutte le
  date si formattano con `timeZone: "Europe/Rome"`, altrimenti il pro e il
  cliente leggevano due giorni diversi per lo stesso controllo.
- Il pro con richiesta in coda non poteva correggere un numero sbagliato:
  doveva aspettare di essere **respinto**. Ora il campo resta disponibile.
- `revoke ... from anon, authenticated` non toglie il grant implicito a
  `PUBLIC`: la revoca era inefficace (la 032 lo faceva già giusto).
- La policy di INSERT su `professionals` non vincolava le colonne nuove: un
  pro poteva teoricamente nascere `documents_verified`. Ora è nella policy,
  non solo in un effetto collaterale dei trigger.

Non fatto:

- **Punto 5 — telemetria** e **punto 6 — ricontrollo periodico**: invariati.
- Nessun canale per **caricare i documenti**: "chiedi documenti" oggi apre uno
  scambio via email, non un upload. Da valutare quando arriva il livello Pro+.
- **Riga nel registro dei trattamenti** (DATA_COMPLIANCE §4): da aggiungere,
  finalità "verifica dei requisiti dei professionisti", base giuridica
  esecuzione del contratto. Il testo per l'informativa è già quello mostrato
  nella card del profilo pro.
- L'ordinamento degli elenchi **non** è stato toccato: continua a pesare il
  vecchio `verification_status`. Se il livello deve contare nel ranking è una
  decisione da prendere (vedi §6), non un dettaglio tecnico.

## 5-ter. "Esiste" non vuol dire "è sua" (correzione del 01/08, sera)

Domanda di Lucio: la verifica ci dice solo che la partita IVA esiste, o anche
che è la sua? Risposta: il VIES restituisce **anche la denominazione**
dell'intestatario, ma fino a stasera il codice la confrontava col nome del
profilo **senza bloccare**: se il numero era valido il livello veniva concesso
lo stesso e la discordanza finiva in una nota. Quindi chiunque poteva incollare
la partita IVA di un'azienda vera e prendersi il badge.

Corretto così:

- **Concessione automatica solo se l'intestazione corrisponde** al nome del
  profilo. In tutti gli altri casi — nome diverso, oppure denominazione non
  restituita — il caso va in coda per l'esame umano. Nessun rifiuto: solo
  nessuna concessione automatica.
- **Una partita IVA verificata appartiene a un solo profilo**: controllo nella
  route e indice unico parziale nel database (migration 039). Due richieste
  *in attesa* sullo stesso numero restano possibili — capita col
  commercialista o col refuso — e le decide una persona.

Conseguenza da mettere in conto: la coda diventa la via normale, non
l'eccezione. Le ditte individuali passano in automatico (il registro riporta
nome e cognome della persona); le società e chi usa un nome commerciale
finiscono davanti a un operatore.

## 5-quater. Chi non è nel VIES: da dove si verifica davvero

Il VIES copre solo chi è abilitato alle operazioni intra-UE. Per gli altri, in
ordine di costo:

1. **Agenzia delle Entrate — "Verifica partita Iva"**
   (`telematici.agenziaentrate.gov.it/VerificaPIVA/`). Gratuito e ufficiale, ed
   è **più completo del VIES**: restituisce stato (attiva / sospesa per affitto
   d'azienda / cessata), **denominazione o cognome e nome del titolare**, data
   di inizio attività ed eventuale appartenenza a un Gruppo IVA. Protetto da
   CAPTCHA (immagine e audio), nessuna API pubblica: **non si integra e non si
   aggira**, ma è esattamente lo strumento che l'operatore usa nella coda. È la
   risposta operativa per la maggioranza dei nostri professionisti.
2. **Registro Imprese** (registroimprese.it). Ricerca libera su denominazione,
   sede e stato dell'impresa: utile a confermare che l'impresa esiste ed è
   attiva, e in prospettiva è la stessa fonte dove guardare i requisiti
   D.M. 37/2008 per il livello Pro+.
3. **Provider commerciale (gradino 3)**: Openapi, InfoCamere, Cerved, A-Cube.
   Stessi dati dell'Agenzia via API, centesimi a chiamata. Se la telemetria
   conferma che la maggioranza non è nel VIES, questo smette di essere
   "eventuale" e diventa il modo per non annegare la coda.
4. **Prova di possesso via PEC (INI-PEC, AgID/InfoCamere)**. Idea diversa dalle
   prime tre: invece di chiedersi *se* la partita IVA esiste, si verifica che il
   professionista **controlli** la casella PEC associata a quel soggetto,
   inviando un codice usa-e-getta. Risponde alla domanda vera — è sua? — che
   nessuna delle fonti sopra risolve da sola, ed è gratuita. Da valutare: la
   ricerca INI-PEC è pubblica via web, l'accesso via API è riservato, quindi
   servirebbe un intermediario (di nuovo Openapi & co.) oppure il recupero
   manuale nella coda.

Nota: nessuna di queste fonti, da sola, dimostra la **titolarità**. Le prove
solide restano tre: la corrispondenza dell'intestazione (gratis, automatica,
copre le ditte individuali), il codice inviato alla PEC del soggetto, e il
livello Pro+ con documento e visura.

## 5-quinquies. Firma delle decisioni e registro consultabile (01/08)

- Ogni evento porta ora **nome e ruolo di chi ha agito**, fotografati al momento
  del fatto (migration 040), oltre al riferimento all'account. Serve perché
  `actor_user_id` ha `on delete set null`: quando un collaboratore lascia il
  team, senza l'istantanea il registro perderebbe il nome proprio delle
  decisioni che quella persona ha firmato. Provato: cancellato l'account, la
  firma resta leggibile.
- La scheda del caso in admin mostra **chi ha firmato l'ultima decisione**, e
  sotto c'è lo **storico dei controlli** di quel professionista. In fondo alla
  coda, chiuso, il **registro completo** degli ultimi movimenti con la firma di
  ciascuno: non in prima pagina, ma a un clic.
- `verification_events` resta **append-only**: nessuna policy di update o
  delete per i ruoli applicativi. È la proprietà che lo rende una prova; non va
  tolta per comodità.
- Non è una firma crittografica. Se un domani servisse opponibilità verso terzi
  (contenzioso con un professionista escluso, richiesta di un'autorità), il
  passo successivo è una catena di hash sulle righe del registro, o la firma
  del riepilogo con una chiave conservata fuori dal database. Oggi sarebbe
  complessità senza un problema da risolvere.

## 5-septies. Quanto costa automatizzare davvero (listino letto il 01/08/2026)

Prezzi presi dal listino pubblico di Openapi (`openapi.com/pricing`), IVA
esclusa, "singola" = pagamento a consumo senza abbonamento:

| Servizio | A consumo | In abbonamento | Cosa ci darebbe |
| --- | --- | --- | --- |
| Company Status Check – Italy | € 0,02 | — | stato della partita IVA |
| Company Name – Italy | € 0,001 | — | denominazione |
| Start Company Data – Italy | € 0,05 | da € 0,015 | stato + denominazione + dati base, in tempo reale |
| Advanced Company Data – Italy | € 0,10 | da € 0,028 | come sopra, più completo |
| European VAT Check (VIES) | € 0,02 | da € 0,014 | quello che oggi facciamo gratis da soli |
| Company Registered e-mail Address – Italy | € 0,03 | da € 0,015 | **la PEC dell'impresa** — la strada del codice di possesso |
| Tax Code Check for a Person – Italy | € 0,045 | da € 0,0081 | riscontro del codice fiscale |
| Freelancer Data Check – Italy | € 0,80 | — | dati del libero professionista (2 ore lavorative) |
| Visura ditta individuale | € 2,90 | da € 2,75 | documento vero, per il livello Pro+ |

**Il conto per noi.** Quello che serve al gradino 3 è stato + denominazione:
`Company Status Check` + `Company Name` fanno **2,1 centesimi**, oppure
`Start Company Data` a **5 centesimi** con tutto in una chiamata. Una volta per
professionista, perché l'esito lo conserviamo.

- 100 professionisti verificati: **2–5 €**
- 500 professionisti: **10–25 €**
- 500 professionisti con ricontrollo semestrale: **20–50 € l'anno**

**Il confronto che conta.** Lo stesso controllo fatto a mano è due minuti di
una persona: a 15 €/ora sono circa **50 centesimi** a professionista, cioè
**dieci-venti volte il costo dell'API**, e con tempi di ore o giorni invece di
secondi. Il gradino 3 non è una spesa da valutare: è la voce più economica del
processo. Quello che va valutato è il contorno — contratto, DPA art. 28, server
UE, riga nel registro dei trattamenti.

Nota interessante emersa dal listino: la **PEC dell'impresa costa 3 centesimi**.
Rende praticabile la prova di possesso (codice inviato alla PEC del soggetto),
che è l'unica cosa che dimostra davvero *è sua* e non solo *esiste*.

## 5-octies. Verifica a pagamento per il professionista? (nota di discussione)

Idea di Lucio: far pagare la verifica al professionista. Con i numeri sopra la
domanda cambia di natura, perché **il costo non è il problema**: cinque
centesimi non si fanno pagare per coprirsi. Se si fa pagare, è una scelta di
posizionamento, e ha due facce.

A favore: un piccolo importo filtra chi non è serio, crea valore percepito e
lega un ricavo alla fiducia invece che ai contatti (come fa Instapro, che
vende i lead).

Contro, e pesa: il badge che i clienti guardano diventa **acquistabile**. Il
messaggio "verificato" vale finché significa *abbiamo controllato*, non *ha
pagato*; se i due si confondono, si sta vendendo esattamente il segnale che si
voleva dare. In più la frizione arriva nel momento peggiore — oggi ci sono
cinque professionisti e il problema è farla usare, non monetizzarla. E c'è una
coda operativa: se la verifica è a pagamento e l'esito è negativo, va deciso
prima cosa succede al pagamento, e scritto nei ToS.

Proposta: **la verifica base della partita IVA resta inclusa** — costa
centesimi ed è il pavimento di qualità del marketplace, non un servizio
accessorio. Se si vuole monetizzare la fiducia, il posto giusto è il livello
**Pro+**, dove il costo vero c'è davvero (esame documentale umano, visura a
2,90 €), oppure la visibilità. Nel frattempo il banner nella dashboard è già
predisposto: il prezzo è una costante unica in
`src/components/VerificaPromoBanner.tsx`, oggi `null` (= "inclusa nel pilota");
si scrive lì il giorno della decisione e il testo si adegua da solo. L'incasso
non è integrato di proposito.

## 5-sexies. Quando la coda non basterà più (nota per il futuro)

Promemoria da rileggere quando i professionisti iscritti superano qualche
decina, o quando la coda smette di svuotarsi in giornata.

Gratuito **e** automatizzabile c'è solo il VIES, che copre la minoranza. Tutte
le altre fonti gratuite — Agenzia delle Entrate, Registro Imprese, INI-PEC —
richiedono una persona davanti a un browser: sostenibili con dieci casi al
giorno, non con cento. Il costo vero non è il prezzo delle chiamate API
(centesimi, **una volta per professionista**, perché l'esito lo conserviamo:
cinquecento pro sono pochi euro) ma il tempo di chi lavora la coda —
cinquecento controlli manuali da due minuti sono una ventina di ore.

Mossa consigliata quando arriva quel momento, o prima se c'è tempo:
**integrare la sandbox di Openapi**, che è un ambiente di prova gratuito e
senza contratto. Non risponde su partite IVA vere, ma permette di scrivere e
collaudare tutto il gradino 3 a costo zero; il giorno della decisione si cambia
la chiave, si carica il credito e il codice è già provato. Prima di accendere
servono comunque contratto, **DPA ex art. 28**, server UE e la riga nel
registro dei trattamenti.

## 6. Decisioni che restano tue

- **Quali categorie richiedono almeno "Pro"** per contattare i clienti
  (proposta: le 5 core, dove l'abilitazione è un tema di sicurezza).
- **Durata della verifica** prima del ricontrollo (proposta: 6 mesi).
- **Cosa fa un "Iscritto"**: profilo visibile ma senza contatto? del tutto
  invisibile ai clienti?
- Se aprire ora la **sandbox Openapi** o attendere i dati della telemetria.

## Fonti
- VIES REST API, Commissione europea — test eseguiti il 31/07/2026 su
  `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/{vat}`
- Servizio "Verifica partita IVA" dell'Agenzia delle Entrate (solo web, con
  CAPTCHA, nessuna API pubblica) — agenziaentrate.gov.it
- D.Lgs. 32/2023 (DAC7); Reg. UE 2016/679 (GDPR artt. 6, 22, 28); D.M. 37/2008
- Schema dati: `supabase/migrations/029_professional_verification.sql`
- Validazione: `src/lib/vat.ts` (testata su P.IVA reali il 30/07/2026)
