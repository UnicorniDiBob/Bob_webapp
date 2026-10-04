# Le Analisi per il professionista — specifica

**Per Lucio e André.** Scritto da Lucio con Claude, 4 ottobre 2026.
Autorevole sull'INTENTO: lo stato vero sta su `origin/main` e su Supabase. Ogni
numero di questo documento è stato letto sullo schema vivo
(`bijgitnulucdzluqjxrx`) il 4 ottobre, non dalle migrazioni.

Sostituisce l'artifact «Analisi nei piani di Bob» del 01/10, che sul Free era
confuso. Nessuna riga di codice di prodotto parte da qui finché Lucio non
approva il documento. Aggiornato il 4 ottobre pomeriggio con le risposte di
Lucio (§1.3) e con la Fase 0 costruita (migrazione 108).

---

## 1. Le decisioni

### 1.1 Il principio (Lucio, 03/10)

Quanto un professionista ha fatturato su Bob è un **fatto suo**: lo sappiamo
solo perché i lavori sono passati di qui, e il diritto di accesso (art. 15
GDPR) glielo darebbe comunque. Non si vende. Si vende il **ragionamento** sopra
quel numero: confronti nel tempo, scomposizioni, andamenti, e la possibilità di
metterci dentro anche il lavoro fatto fuori da Bob.

### 1.2 Le due risposte di Lucio (04/10)

**(a) «Analisi base» resta su tutti e tre i piani, Free compreso.** Il listino
(`src/lib/piani.ts`, riga «Analisi base», oggi `ARRIVO` su tutti e tre) non
cambia colonna. Diventerà `SI` sui tre quando la Fase 1 (§7) sarà in
produzione, non prima.

Cosa contiene: **il conto, più i conteggi.** Le quattro caselle che il pro ha
già in dashboard, l'elenco dei suoi lavori con gli importi, e quanti contatti,
quanti preventivi e quanti lavori conclusi ha avuto nel mese. Sono numeri
grezzi: niente rapporti, niente grafici, niente confronti. È esattamente quello
che la nota del listino promette già — «quanti contatti, quanti preventivi,
quanti chiusi» — quindi la nota resta vera così com'è.

La linea di confine è questa: **un conteggio è un fatto, un rapporto è un
ragionamento.** «Hai ricevuto 14 richieste e ne hai chiuse 3» è Free. «Chiudi
il 21%, e quando rispondi entro un'ora il 38%» è Plus.

**(b) Per ora niente confronto con la categoria in città.** Esce da tutti i
piani. Il §5 fissa comunque la soglia per quando tornerà, perché è la parte
che non si improvvisa.

### 1.3 Le risposte del 4 ottobre pomeriggio

- **Plus e Business hanno le stesse analisi.** Tutte e due hanno «Analisi
  avanzate», e per ora la parte analitica non li distingue. Niente riga
  «Analisi dei ricavi» solo Business: quello che il §3.4 descrive va su
  tutti e due.
- **Si confrontano i periodi, quali si vuole**: un anno con l'altro, un mese
  con lo stesso mese dell'anno prima, due intervalli qualunque. Vedi §3.7.
- **I dati si condensano.** Con i ricavi esterni le righe crescono in fretta,
  e il peso non deve esplodere dal nostro lato. Vedi §3.8.
- **Nei ricavi esterni un codice cliente, non un nome**, ma veloce da
  scrivere. Vedi §4.3.
- **Fase 0 approvata.** Si comincia dall'Analisi base.

Resta aperta una domanda sola:

1. **Confermi la linea «conteggio = Free, rapporto = Plus»?** È
   un'interpretazione della risposta (a), non una cosa che hai detto. In
   alternativa il Free vede solo le quattro caselle e l'elenco dei lavori, e
   l'«Analisi base» del listino diventa quella; ma allora la nota del listino
   («quanti contatti, quanti preventivi…») va riscritta.

   Lucio ha detto «iniziamo dall'Analisi base» senza obiezioni, ma non l'ha
   confermata in modo esplicito. La Fase 1 la segue.

---

## 2. Cosa vede ogni piano

| | Free | Plus | Business |
|---|---|---|---|
| Le quattro caselle (guadagni del mese, ore lavorate, ore prenotate, guadagni totali) | sì | sì | sì |
| Elenco dei lavori conclusi con gli importi, filtrabile per mese | sì | sì | sì |
| Conteggi del mese: richieste ricevute, risposte date, proposte inviate, accettate, concluse | sì | sì | sì |
| L'imbuto con le conversioni fra un passo e l'altro | — | sì | sì |
| Prima risposta contro chiusura | — | sì | sì |
| Richieste lasciate senza risposta | — | sì | sì |
| Andamento mese per mese di lavori e importi | — | sì | sì |
| Quali servizi portano lavori e quali solo proposte a vuoto | — | sì | sì |
| Ricavi esterni (inserimento a mano e da CSV, interruttore «solo Bob / tutto il mio lavoro») | — | sì | sì |
| Ricavi per zona (comune e CAP), valore medio e come cambia per zona | — | sì | sì |
| Confronto fra periodi: anno con anno, mese con mese, due intervalli qualunque (§3.7) | — | sì | sì |
| Stagionalità contro lo stesso mese dell'anno prima | — | sì | sì |
| Clienti che tornano | — | sì | sì |
| Saturazione dell'agenda (ore vendute contro ore disponibili) | — | sì | sì |
| «Copia immagine» e «copia numeri» su ogni grafico | — | sì | sì |
| Esportazione dei propri dati (art. 15/20) | sì | sì | sì |

L'ultima riga non è una funzione del piano: è un diritto, e lo diciamo qui
perché nessuno la metta dietro un abbonamento. Un pro che passa da Plus a Free
**continua a poter esportare** i ricavi esterni che ha scritto, anche se non
li vede più nei grafici.

Le Analisi avanzate si **guardano**, non si leggono: ogni sezione apre con un
grafico, e i numeri stanno sotto, con una frase che dice il numero che conta
(«Entro un'ora chiudi 5 richieste su 13»).

---

## 3. Da dove esce ogni numero

Sigle: **RP** = `request_professionals`, **RM** = `request_messages`,
**AP** = `appointments`. «Il pro» è `professionals.id`.

### 3.1 Tre fatti dello schema vivo che cambiano tutto il resto

1. **Gli stati non hanno storia.** `request_professionals` ha solo
   `created_at`. `appointments` non ha né `confirmed_at` né `completed_at` né
   `updated_at`. Lo stato viene sovrascritto, quindi «quante proposte ha fatto
   a settembre che poi sono state accettate» si ricostruisce solo dallo stato
   di oggi, e il mese di un lavoro concluso è il mese del suo `starts_at`, non
   quello in cui è stato concluso.
2. **Quando un cliente cancella l'account, il passato del pro si accorcia.**
   `requests.customer_id` è `on delete cascade`, e a cascata se ne vanno anche
   `request_professionals`, `request_messages` e `request_addresses`. Gli
   appuntamenti sopravvivono (`request_id` e `customer_id` passano a `null`).
   Risultato: l'imbuto di agosto di un pro, guardato a dicembre, ha meno
   richieste di quante ne avesse ad agosto. Un cruscotto i cui numeri passati
   cambiano da soli non è credibile, ed è un difetto che non si vede finché
   qualcuno non lo nota.
3. **Gli appuntamenti creati dal pro sono quasi muti.** Su 34 appuntamenti in
   produzione: 15 senza richiesta, 27 senza servizio (`professional_service_id`
   nullo), 27 senza cliente (`customer_id` nullo), 28 senza città. Il dialogo
   del pro (`AppointmentDialog.tsx`) chiede città in testo libero, nessun
   servizio e nessun comune. Ogni scomposizione per servizio, per zona o per
   cliente oggi vede circa un appuntamento su cinque.

Tutti e tre si risolvono **solo da qui in avanti**. È il motivo per cui la
Fase 0 (§7) viene prima di qualunque schermata.

### 3.2 Free — il conto

| Numero | Come si calcola oggi | Calcolabile oggi? | Limite |
|---|---|---|---|
| Guadagni del mese | Σ `AP.price` con `status = 'completed'` e `starts_at` nel mese | sì | È l'**importo dichiarato** dal pro, non l'incassato (`payments` è vuota). In pagina si chiama «importo dei lavori conclusi». Se un lavoro concluso non ha prezzo, oggi conta zero in silenzio (`computeStats`, `src/lib/messages.ts:379`): va detto («2 lavori senza importo»). |
| Ore lavorate (mese) | Σ `AP.duration_minutes` conclusi nel mese | sì | Durata **prevista**, non effettiva. |
| Ore prenotate | Σ durata degli appuntamenti `confirmed` futuri | sì | — |
| Guadagni totali | Σ `AP.price` conclusi, da sempre | sì | Come sopra. |
| Elenco dei lavori conclusi | righe `AP` `completed`: data, titolo, cliente, importo | sì | `customer_name` è testo libero del pro: lo vede già, non è un dato nuovo per lui. |
| Richieste ricevute | righe RP del pro con `status <> 'suggested'`, per `created_at` | **in parte** | Spariscono quando il cliente cancella l'account (§3.1.2). |
| Risposte date | richieste con almeno un RM `sender_type = 'professional'` di quel pro | **in parte** | Stessa cascata. |
| Proposte inviate | `AP` con `request_id` non nullo e `proposed_by = 'professional'`, contate per richiesta | sì | Non esiste un oggetto «preventivo»: il preventivo del pro **è** una proposta di appuntamento con un prezzo (RM `kind = 'appointment_proposal'`). La specifica usa la parola «proposta», non «preventivo», finché non esiste un oggetto vero. |
| Accettate | quelle proposte in `confirmed` o `completed` | sì | Per mese di `starts_at`, non di accettazione. |
| Concluse | `AP.status = 'completed'` | sì | Lo stato lo mette **solo il pro, a mano** (`AppointmentDetail.tsx:268`). Un pro che non lo segna non ha guadagni. Questo pesa più di tutti gli altri limiti. |

Oggi le quattro caselle si calcolano **nel browser**, da tutti gli
appuntamenti del pro (`computeStats`). La Fase 1 le sposta nella funzione SQL
del §6, così ogni piano legge gli stessi numeri da una fonte sola.

### 3.3 Plus — da dove arriva il tuo lavoro

| Numero | Come si calcola | Calcolabile oggi? | Cosa registrare da subito |
|---|---|---|---|
| Imbuto ricevute → risposte → proposte → accettate → concluse, con le conversioni | i cinque conteggi del §3.2, divisi a coppie | in parte | Registro degli eventi (§3.6): ogni passo con la sua data, sopravvive al cliente. |
| Prima risposta contro chiusura | per richiesta: min(RM del pro) − min(RM `customer`/`text`). Fasce: <1h, 1–4h, 4–24h, >24h. Per fascia, quante finiscono in `AP` `confirmed`/`completed` | in parte | Il registro. La formula è **identica** a quella di `aggiorna_segnali_professionisti()`, e deve restarlo: il numero che il pro vede qui è lo stesso che lo ordina nei risultati. Due definizioni di «prima risposta» sarebbero due verità. |
| Richieste lasciate senza risposta | ricevute, nessun RM del pro, `created_at` più vecchio di 48 ore | in parte | Il registro. |
| Andamento mese per mese | i conteggi e gli importi per mese, ultimi 12 mesi | sì, con i limiti del §3.1 | `completed_at` sugli appuntamenti. |
| Servizi che portano lavoro, servizi che portano solo proposte | per servizio: proposte, accettate, concluse, importo. Servizio da `requests.service_id`/`subservice_id` o da `AP.professional_service_id` | **no** per gli appuntamenti creati dal pro (27 su 34 senza servizio) | Servizio obbligatorio nel dialogo del pro (§3.6). |

**Soglia di campione, nel prodotto e non solo qui:** una percentuale si mostra
solo se il denominatore è **almeno 10**. Sotto, si mostrano i conteggi («3 su
7»). «Chiudi il 100%» su una richiesta sola è un numero vero e inutile.

### 3.4 Plus e Business — da dove arrivano i tuoi ricavi

| Numero | Come si calcola | Calcolabile oggi? | Cosa registrare da subito |
|---|---|---|---|
| Ricavi per zona (comune e CAP) | Σ `price` conclusi per `requests.comune_istat` / `postal_code` tramite `AP.request_id` | **no** per 28 appuntamenti su 34 (nessuna città, o solo testo libero) | `comune_istat` e `postal_code` sugli appuntamenti, scelti con `SceltaComune` nel dialogo del pro; copiati dalla richiesta quando c'è. |
| Valore medio del lavoro, e per zona | media di `price` conclusi | sì in totale, no per zona | Come sopra. |
| Stagionalità contro lo stesso mese dell'anno prima | stesso calcolo, mese M contro M−12 | **no, per costruzione**: il pilota parte a gennaio 2027, il primo confronto vero è gennaio 2028 | Niente: serve solo tempo. La sezione resta nascosta finché il pro non ha 13 mesi di storia, e lo dice. |
| Clienti che tornano | `AP.customer_id` con più di un lavoro concluso | **no** per gli appuntamenti creati dal pro (`customer_id` nullo in 27 su 34) | Niente di nuovo dal lato cliente: si contano solo i clienti registrati. Il pro lo legge scritto: «contati solo i clienti che ti hanno trovato su Bob». |
| Saturazione dell'agenda | ore di `confirmed` + `completed` nel mese ÷ ore disponibili (`professional_availability`, finestre settimanali, meno `professional_availability_blocks`) | sì | La disponibilità non ha storia: per i mesi passati si usa quella di oggi. Accettabile, purché scritto sotto il grafico. Se un giorno servirà, un'istantanea mensile nel registro. |

### 3.5 Il confronto di categoria — non ora, ma con una soglia scritta

Esce dai piani per decisione (b). Quando tornerà, le regole sono queste, e
non si ammorbidiscono:

- **Almeno 10 professionisti distinti** nel gruppo (categoria × città) nel
  periodo, esclusi `is_test_fixture` e il pro stesso dal conteggio dei «altri».
- **Nessun pro oltre il 30%** del volume del gruppo. Altrimenti la media è lui,
  e chi la guarda ne deduce il fatturato.
- **Solo la mediana e i quartili**, mai il minimo, il massimo o una media
  calcolata su meno di 10.
- **Vietate le scomposizioni** categoria × zona, categoria × sottoservizio e
  categoria × mese singolo. Con 10 pro in città, una zona ne ha due.
- Il gruppo si calcola su dati di Bob soltanto, **mai sui ricavi esterni**
  (§4.4).

Oggi in produzione ci sono 6 professionisti in tutto. La soglia non si
raggiunge in nessuna categoria, il che conferma la decisione (b) anche sui
numeri.

### 3.6 Cosa cominciare a registrare SUBITO

È il pezzo che vale di più del documento: un dato non raccolto non si
recupera, e il pilota parte fra tre mesi.

**A. Un registro degli eventi del lavoro del pro** — tabella
`professional_work_events`, sola aggiunta.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `professional_id` | uuid, FK `professionals` `on delete cascade` | Muore con il pro. |
| `evento` | text, check | `richiesta_ricevuta`, `prima_risposta`, `proposta_inviata`, `proposta_accettata`, `proposta_rifiutata`, `lavoro_concluso`, `lavoro_disdetto` |
| `avvenuto_al` | timestamptz | |
| `rif` | uuid, **senza FK** | Id della richiesta o dell'appuntamento. Serve solo a contare per richiesta. Senza FK, quando la richiesta sparisce resta un numero che non punta più a niente. |
| `service_id`, `subservice_id` | uuid | Catalogo, non persone. |
| `comune_istat` | text | Il comune, mai l'indirizzo. |
| `importo` | numeric | Solo su `proposta_*` e `lavoro_concluso`. |
| `minuti` | numeric | Solo su `prima_risposta`: minuti dalla prima domanda del cliente. |

**Nessuna colonna del cliente**: niente `customer_id`, niente nome. È questo
che permette al registro di sopravvivere alla cancellazione del cliente senza
conservarne i dati: resta «un lavoro di idraulica a Sesto, 180 €, il 12
marzo», che è il ricordo del pro e non la traccia del cliente. Lo scrivono i
trigger su RP (insert), RM (primo messaggio del pro per richiesta) e AP
(insert e cambio di stato). Nessuna scrittura dall'applicazione.

**B. Sugli appuntamenti:**
- `completed_at timestamptz`: valorizzato dal trigger al passaggio a
  `completed`, tolto se il lavoro torna aperto. È **quando è stato segnato**
  concluso. Il mese dell'importo resta quello di `starts_at`, cioè quando si
  è lavorato, come fanno già le caselle della dashboard: un lavoro di
  settembre segnato il 3 ottobre è un incasso di settembre.
- `comune_istat`, `postal_code`: nel dialogo del pro con `SceltaComune`, al
  posto della città in testo libero. Copiati dalla richiesta quando c'è.
- Il servizio: nel dialogo del pro, una tendina dai suoi
  `professional_services`. Facoltativa per non bloccare chi annota un lavoro
  al volo, ma proposta per prima.

**C. Il recupero, una volta sola:** la migrazione riempie il registro con
quello che c'è oggi (i dati vivi, con le date di oggi dove manca la data
vera, e un `evento` marcato come ricostruito). Non è storia vera, ed è per
questo che va fatto **prima** del pilota: da gennaio 2027 tutto il registro è
storia vera.

Né A né B sono interfaccia: sono una migrazione e due campi in un dialogo.
Sono la Fase 0, approvata da Lucio il 4 ottobre: la migrazione è
`supabase/migrations/108_registro_lavoro_pro.sql`.

### 3.7 Il confronto fra periodi

Tutti i confronti leggono **una vista sola**, `analisi_mesi_vive`: una riga
per pro, mese, servizio e comune, con i conteggi e le somme. Da lì si compone
qualunque periodo **a grana di mese**:

- un anno contro l'altro (gennaio-dicembre 2027 contro 2028);
- un mese contro lo stesso mese dell'anno prima;
- l'anno finora contro lo stesso tratto dell'anno prima;
- due intervalli qualunque di mesi interi, anche di lunghezza diversa
  (allora si confrontano le medie al mese, non i totali, e la pagina lo
  scrive).

Sotto il mese (settimane, giorni) si scende solo negli ultimi 25 mesi, dove il
registro ha ancora il dettaglio. Chi chiede «marzo 2025 giorno per giorno» nel
2028 riceve il totale di marzo e una riga che dice perché.

Il periodo si sceglie con due selettori («questo periodo» / «contro»), con
le scorciatoie che servono davvero: questo mese, mese scorso, anno finora,
ultimi 12 mesi, anno scorso. Il secondo selettore propone da solo lo stesso
periodo dell'anno prima.

**Regola che vale per tutti i grafici**: chi legge la vista **somma** le
righe del mese, non ne prende una. Un mese può avere una riga condensata e
una di dettaglio insieme (un lavoro di tre anni fa segnato concluso oggi).

### 3.8 Il peso dei dati: si condensa

Il registro del dettaglio vive **25 mesi**: abbastanza perché il confronto
con lo stesso mese dell'anno prima abbia sempre il dettaglio da tutte e due
le parti. Il 2 di ogni mese `condensa_analisi()` prende gli eventi più
vecchi, li riassume in `analisi_mesi` e li cancella, in un'istruzione sola:
gli eventi tolti sono esattamente quelli riassunti.

| | Una riga | Un pro attivo in un anno |
|---|---|---|
| Registro (dettaglio) | ~150 byte, più gli indici | ~1.500 eventi, ~350 KB |
| Mesi condensati | ~130 byte | ~120 righe, ~20 KB |

Con mille professionisti il registro si ferma intorno a 700-800 MB (25 mesi
di dettaglio) e il passato condensato cresce di ~20 MB l'anno. Senza
condensare cresceremmo di ~350 MB l'anno per sempre.

Le scelte che tengono piccola la riga: un enum per il tipo di evento (4 byte
contro ~20 di un testo), gli importi in centesimi interi, le colonne in
ordine di allineamento così che Postgres non sprechi spazio fra una e
l'altra, nessun dato del cliente.

**Un mese condensato non cambia più.** Se un lavoro di tre anni fa viene
riaperto, il dettaglio non c'è più e il mese resta com'era. È il prezzo della
compressione, e lo diciamo nella pagina dove serve.

**I ricavi esterni (Fase 2) seguono la stessa strada**: `analisi_mesi` ha già
la colonna `origine` (`bob` / `esterno`). Le righe scritte dal pro restano
intere per 25 mesi; poi si condensano nello stesso modo, e **prima**, quando
il pro apre la pagina, gli si propone di esportarle. Sono sue, e devono
poterle avere intere. Più un tetto: 5.000 righe esterne per pro e per anno,
largamente sopra il lavoro di un artigiano e abbastanza basso da fermare un
import sbagliato.

---

## 4. I ricavi esterni

### 4.1 Cosa sono

Il lavoro che il pro fa fuori da Bob, che ci dice lui. Senza, al primo anno il
cruscotto vede forse un decimo del suo lavoro vero e si guarda due volte. Con,
diventa «il quadro del tuo anno».

### 4.2 La tabella `ricavi_esterni`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `professional_id` | uuid, FK `professionals` `on delete cascade` | |
| `data_lavoro` | date | |
| `importo` | numeric(10,2), check ≥ 0 | |
| `service_id` | uuid, FK `services`, facoltativo | Dal catalogo, così si confronta con i lavori Bob. |
| `comune_istat`, `postal_code` | text, facoltativi | Stessi formati e stessi check di `requests`. |
| `codice_cliente` | text, facoltativo, max 20 caratteri | Vedi §4.3. |
| `nota` | text, max 200 | Per lui. |
| `origine` | text, check `manuale` / `csv` | |
| `lotto_import` | uuid, facoltativo | Per annullare un import intero in un colpo. |
| `creato_al` | timestamptz | |

### 4.3 Il cliente: un codice, non un nome

Bob non ha mai visto i clienti esterni. Se il pro scrive «Mario Rossi, via
Padova 12», Bob tratta quel dato **per conto del pro**: diventa responsabile
del trattamento (art. 28 GDPR), con un contratto da scrivere, per un dato che
non ci serve. Al grafico «clienti che tornano» basta sapere che due righe
riguardano la stessa persona. Quindi: un **codice libero** («C12», «condominio
Viale Monza») con l'avvertenza in pagina «non scrivere nomi né indirizzi», e
nessun campo per i contatti.

**Veloce da scrivere** (Lucio, 04/10). Il campo è una casella con
suggerimenti: mentre scrivi propone i codici che hai già usato, ordinati per
uso recente, e in cima c'è sempre «Cliente nuovo → C14», cioè il numero dopo
l'ultimo. Un cliente che torna si sceglie con due tasti, uno nuovo con uno. Nel
CSV la colonna `cliente` accetta qualunque testo e lo tratta come codice.

Anche così, un codice può identificare qualcuno. Per questo i ToS del Pro
avranno una riga: il pro è titolare di quello che scrive, Bob lo conserva per
fargli i conti e basta. Il controllo ce l'ha il pro: nessuno a Bob lo legge
(§4.4), e lui lo cancella quando vuole.

### 4.4 Separato dai nostri dati, per costruzione

Le analisi interne non devono mai mescolarsi con quello che un pro ha scritto
a mano: sono numeri di qualità diversa, raccolti per uno scopo diverso.

- **RLS: solo il proprietario.** `select`, `insert`, `update` e `delete` dove
  `professional_id` appartiene a `auth.uid()`. **Nessuna policy per lo
  staff**, né admin né cs. Se serve aiutare un pro con un import, lo si fa
  guardando il suo schermo, non il suo database.
- **Nessuna funzione interna la legge.** `AnalisiDashboard`, il punteggio di
  ordinamento, i segnali, il confronto di categoria: nessuno ha un `join` su
  `ricavi_esterni`. Lo verifica un test nuovo, che gira in CI con `npm test`:
  cerca il nome della tabella in `src/` e in `supabase/migrations/`, e fallisce
  se compare fuori dalla sua migrazione, dalle funzioni `analisi_*` del pro e
  dalla pagina che le legge.
- **Nelle funzioni del pro, ogni riga porta la sua origine** (`bob` /
  `esterno`), e l'interruttore «solo Bob / tutto il mio lavoro» filtra su
  quella. Predefinito: «solo Bob», perché è il numero che possiamo garantire.

### 4.5 L'import da CSV

- Colonne: `data`, `importo`, `servizio`, `comune`, `cap`, `cliente`, `nota`.
  Solo le prime due obbligatorie. Date `gg/mm/aaaa` e `aaaa-mm-gg`, importi
  con la virgola o con il punto.
- Massimo **2.000 righe** per file: un anno di un artigiano attivo sta sotto le
  1.000.
- **Anteprima prima di salvare**: le righe lette, quelle scartate e perché. Si
  salva tutto o niente.
- Righe identiche (stessa data, importo, cliente) segnalate come doppioni,
  non scartate in silenzio.
- Il file **non si conserva**: si legge nel browser, al server arrivano le
  righe.

### 4.6 Conservazione e cancellazione

- Si conservano finché c'è l'account del pro. Muoiono con lui a cascata, e il
  percorso di cancellazione dell'account esistente (A20) li prende senza
  codice in più.
- Il pro cancella una riga, un import intero (`lotto_import`), o tutto
  («cancella tutti i miei ricavi esterni»): `delete` vero, non logico.
- **Se il pro scende al Free le righe restano**, nascoste dai grafici ma
  esportabili. Se torna al Plus le ritrova. Cancellarle al cambio di piano
  sarebbe usare i suoi dati come leva commerciale.
- Entrano nell'esportazione art. 15/20 dell'account.

---

## 5. Cosa NON offriamo, e perché

- **Nessun confronto con un altro professionista con nome e cognome**, né una
  classifica. È il dato commerciale di qualcun altro, e una classifica di
  fatturato su un marketplace porta il pro a leggere il proprio rango come un
  giudizio di Bob.
- **Nessuna previsione di guadagno** finché il pro non ha almeno 12 mesi di
  storia. Prima è una retta tirata su tre punti, e qualcuno la userebbe per
  decidere se assumere.
- **Nessun «visite al tuo profilo»** costruito su tracciamento degli utenti
  (vedi §6.2). Se un giorno lo vogliamo, viene dallo strumento statistico
  esente, aggregato per pagina, e la decisione si prende a parte.
- **Nessun suggerimento automatico sul prezzo** («alza la tariffa del 10%»):
  è consulenza, è un'inferenza, e sbagliarla costa al pro.
- **Il confronto di categoria**, per ora (decisione b, §3.5).

---

## 6. Privacy

Due cose diverse, con basi giuridiche diverse. Nel codice e nei documenti non
si toccano.

### 6.1 I numeri del pro sul proprio lavoro

- **Base giuridica: contratto** (art. 6(1)(b)). È una funzione del servizio
  che il pro usa, Free compreso, calcolata su dati che trattiamo già per
  eseguire quel contratto. Nessun consenso.
- **Il registro degli eventi** (§3.6) è un trattamento nuovo nel senso della
  conservazione, perché sopravvive alla cancellazione del cliente. Non contiene
  dati del cliente per costruzione, e lo diciamo nell'informativa con una riga.
  Conservazione: vita dell'account del pro.
- **ROPA:** una riga nuova, **A26 — Analisi per il professionista**, con il
  registro degli eventi e i ricavi esterni (§4) come due categorie distinte.
- **DPIA:** nessun innesco (`DATA_COMPLIANCE.md`, controllo del §8:
  profilazione, tecnologia innovativa, combinazione di dati). Non c'è profilazione di clienti, non c'è
  punteggio, non c'è decisione automatizzata: i numeri informano il pro, non
  decidono niente su di lui. Va scritto nella PR della Fase 0, non dato per
  scontato.
- **Cosa vede il pro dei suoi clienti:** niente che non veda già. I clienti
  che tornano sono un conteggio; l'elenco dei lavori mostra il nome che c'è già
  nel suo calendario.

### 6.2 Il tracciamento degli utenti

- È **un'altra cosa**: misura come la gente usa il sito, non il lavoro del pro.
  Oggi **non c'è nessuno strumento installato** (verificato il 04/10: nessuna
  traccia di Plausible, Matomo, Vercel Analytics o gtag in `src/` e in
  `package.json`).
- Quando arriverà, sarà **esente da consenso**: Plausible o Matomo configurato
  secondo il §7.2 delle linee guida del Garante (`docs/DATA_COMPLIANCE.md`
  §1). Niente banner.
- **GA4, i pixel pubblicitari e il session replay vogliono prima un banner
  conforme.** Le Analisi del pro non devono dare un pretesto per installarli.
- Le Analisi del pro **non si costruiscono mai** sopra eventi di tracciamento,
  e il tracciamento non legge mai le tabelle delle Analisi.

---

## 7. Come si costruisce

### 7.1 L'architettura

Il dataset è piccolo (6 pro, 34 appuntamenti oggi; nel pilota qualche decina
di pro e qualche migliaio di righe). Quindi:

- **Una funzione SQL per cruscotto**: `analisi_base(p_da date, p_a date)` e
  `analisi_avanzate(p_da, p_a, p_contro_da, p_contro_a, p_con_esterni bool)`.
  Restituiscono `jsonb`, già aggregato. Lette da una pagina server.
- **`SECURITY INVOKER`**: il pro legge solo le sue righe perché la RLS lo
  vuole, non perché la funzione lo filtra. Il pro viene ricavato da
  `auth.uid()`, mai passato come parametro.
- **Il piano si controlla nella funzione**, non solo nella pagina:
  `analisi_avanzate` chiamata da un Free solleva un errore. Una pagina che
  nasconde un bottone non è un limite di piano (vedi il calendario del Free,
  01/10).
- **Nessuna vista materializzata** finché una funzione non supera i 300 ms su
  dati veri. Si misura, non si prevede.
- **Le quattro caselle si spostano nella funzione `analisi_base`** e
  `computeStats` diventa una lettura. Così il Free e il Plus non possono
  avere due «guadagni del mese» diversi.

### 7.2 Cosa si riusa da `src/app/admin/analisi/AnalisiDashboard.tsx`

- **`recharts`** (già in `package.json`) e i componenti `StatCard`,
  `ChartCard` e `FootNote`: si spostano in `src/components/analisi/` e li
  usano tutte e due le dashboard.
- **L'esportazione Excel** (`xlsx`, foglio Riepilogo + foglio Dati): stesso
  schema per l'esportazione del pro.
- **La prima risposta**: nella dashboard staff si calcola in TypeScript.
  Nella funzione del pro si usa la stessa formula di
  `aggiorna_segnali_professionisti()`. Quella dello staff andrebbe allineata
  nella stessa PR: tre definizioni dello stesso numero sono troppe.
- **Non si riusa** il modello «scarico tutto e aggrego nel browser»: per lo
  staff va bene, per il pro no. Ogni riga in più che arriva al browser è una
  riga che la RLS deve aver filtrato giusta.

### 7.3 Copia immagine, copia numeri

- **Copia numeri**: righe separate da tabulazione, con la riga di
  intestazione, `navigator.clipboard.writeText`. Incollate in Excel o in
  Fogli Google, finiscono già in colonne. Lo useranno più dell'altro.
- **Copia immagine**: `recharts` disegna un SVG. Lo si serializza, lo si
  disegna su un `canvas` al doppio della risoluzione, e il PNG va negli
  appunti con `ClipboardItem`. Safari vuole il `ClipboardItem` costruito con
  una promessa dentro il gesto dell'utente. Dove non va (Firefox su alcune
  versioni), si scarica il file. Nessuna libreria nuova.
- Ogni immagine porta in basso il periodo e «solo Bob» / «tutto il mio
  lavoro». Un grafico girato su WhatsApp senza didascalia diventa un numero
  falso.

### 7.4 Le fasi

| Fase | Cosa | Dipende da | Listino |
|---|---|---|---|
| **0 — subito** | Migrazione: registro degli eventi con i trigger, `completed_at`, comune e servizio sugli appuntamenti, recupero una tantum. Dialogo del pro con `SceltaComune` e il servizio. Riga ROPA A26, nota DPIA. | niente: si può fare anche prima dell'approvazione delle Fasi 1-3 | nessun cambio |
| **1 — Analisi base** | `analisi_base`, pagina «I tuoi numeri» nell'area del pro, le caselle spostate sul server, l'elenco dei lavori, i conteggi del mese, l'esportazione | Fase 0, risposta 1 del §1.3 | «Analisi base» `SI` sui tre piani |
| **2 — Analisi avanzate** | `analisi_avanzate`, imbuto, prima risposta, servizi, andamento, il confronto fra periodi (§3.7); ricavi esterni con l'import CSV; copia immagine e copia numeri | Fase 1 | «Analisi avanzate» `SI` su Plus e Business |
| **3 — I ricavi** | Dentro le Analisi avanzate: zone, valore medio, clienti che tornano, saturazione; stagionalità nascosta fino a 13 mesi | Fase 2 | nessun cambio: è sempre «Analisi avanzate», Plus e Business |

Ogni fase con la sua PR. La migrazione della Fase 0 si applica **nel giorno
del merge**, e dopo si fa girare l'advisor di sicurezza (RLS, `SECURITY
DEFINER` dei trigger, `search_path`). Le funzioni dei trigger sono `SECURITY
DEFINER` perché scrivono in una tabella dove il pro non scrive: quindi
`search_path` fisso e nessun parametro che venga da fuori.

---

## 8. Cosa può rendere questo documento sbagliato

- **Se il pro non segna i lavori come conclusi**, tutto il conto è vuoto.
  Prima di costruire la Fase 1 conviene guardare, sul pilota, quanti
  appuntamenti passati restano in `confirmed`. Se sono tanti, la soluzione è un
  promemoria al pro il giorno dopo il lavoro («l'hai fatto?»), non un altro
  grafico.
- **Se il preventivo diventa un oggetto vero** (oggi è una proposta di
  appuntamento), l'imbuto cambia passo e il registro guadagna un evento.
- **Se la cascata sul cliente cambia** (per esempio se le richieste concluse
  passano a una conservazione per 10 anni, come chiede il §5 di
  DATA_COMPLIANCE per le chat legate a una transazione), il registro resta
  comunque utile: è l'unico posto dove i passi hanno una data.
