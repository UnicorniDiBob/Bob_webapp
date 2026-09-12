# RICERCA.md — trovare un professionista su Bob

**Che cosa è questo documento.** Le decisioni prese sulla ricerca per parole
chiave e sull'ordine in cui compaiono i professionisti: che cosa abbiamo scelto
e *perché*. È autorevole sull'INTENTO, mai sullo stato — per sapere che cosa
esiste davvero si guardano `origin/main`, lo schema vivo su Supabase e le
risposte della produzione, come dice la regola del progetto. L'ultima sezione
dà una fotografia datata, e invecchia dal giorno dopo.

**A chi serve.** A chi tocca la ricerca dopo di noi, e a chi deve rispondere
alla domanda «come fate a decidere chi viene prima?» — che è una domanda di
prodotto, ma anche un obbligo di legge (§5).

Rimandi: `docs/DATA_COMPLIANCE.md` §2 per l'AI e l'art. 22, §5 per la
conservazione. `SEO.md` per i volumi di ricerca che giustificano le scelte.

---

## 1. Il problema

Chi cerca un servizio ha sempre avuto due strade: **chiedere a Bob**, oppure
**scorrere l'elenco** con due tendine (città e servizio). Manca la terza, che è
quella che la gente usa dappertutto: **scrivere quello che le serve**.

Le due tendine chiedono al cliente un lavoro che dovremmo fare noi: sapere in
quale delle quindici categorie sta il suo problema. Chi ha un rubinetto che
perde non pensa «idraulico», pensa «rubinetto che perde».

Le parole, però, il catalogo le ha già: **15 servizi e 120 interventi**. Quello
che mancava era il ponte fra come parla il cliente e come si chiama la voce.

## 2. Le tre parti

| | che cos'è | dove vive |
|---|---|---|
| **Vocabolario** | come si scrive una cosa → a quale voce di catalogo porta | `search_terms` (mig. 067) |
| **Risolutore** | una frase → il luogo + i punti di catalogo, con un punteggio | `search_resolve()` (mig. 068-069), `src/lib/search.ts` |
| **Ranking** | dato un punto di catalogo → in che ordine mostrare i professionisti | §4 |

Sono separate di proposito. Il vocabolario si può correggere senza toccare il
codice; il risolutore si può cambiare senza rifare il ranking; il ranking si
può ritarare senza rimettere mano al vocabolario.

## 3. Il vocabolario e il risolutore

### Come cresce il vocabolario

I **nomi ufficiali** si generano dal catalogo stesso: aggiungere un intervento
in admin e rigiocare i due `insert` della 067 lo rende cercabile. Non c'è una
lista da tenere allineata a mano.

I **sinonimi** sono scritti come li scrive un cliente («rubinetto che perde»,
non «perdita rubinetto o sifone») e si aggiungono da `/admin/catalogo`, senza
deploy. La fonte da cui crescono è il **registro delle ricerche a vuoto**: le
frasi che non hanno trovato niente sono, letteralmente, la lista dei sinonimi
che mancano.

Le voci «Altro (…)» restano fuori dal vocabolario di proposito: sono la casella
di ripiego di un modulo, non qualcosa che una persona cerca.

### I quattro modi di somigliare

| fiducia | come | esempio |
|---|---|---|
| 1.00 | la frase È un termine | `scarico otturato` |
| 0.85 | un termine sta dentro la frase, parola intera | `mi si è otturato lo scarico` |
| 0.80 | un termine comincia con quello che ho battuto | `idra` → Idraulico |
| 0.40–0.99 | somiglianza: trigrammi, o quante parole piene tornano | `zanzarire`, `rubinetti` |

Sotto 0.40 non si risponde. Con due o più parole piene, almeno una deve essere
in comune: senza quella regola la somiglianza cieca, su una frase lunga,
inventa parentele.

A parità di banda (0.05) vince prima la corrispondenza esatta, poi
**l'intervento sul mestiere**: chi scrive «pulizie fine locazione» ha già detto
il mestiere e ha aggiunto il lavoro, e portarlo su «Pulizie» butta via proprio
l'informazione in più.

### Le bande di fiducia sono un obbligo dell'interfaccia

- **≥ 0.80** → è una risposta. Si possono mostrare i risultati.
- **0.40–0.80** → è un «forse cercavi». Va detto, non affermato.
- **< 0.40** → non si è capito. Si mostra il ripiego onesto (il mestiere padre,
  con l'etichetta che dice che quell'intervento non è dichiarato) e Bob.

Non è una raffinatezza. Esempio vero: «ho bisogno di un preventivo per il
bagno» dà due candidati a 0.45 che con la frase hanno in comune una parola
sola, «bagno». Fra i due non decide il senso, decide l'alfabeto. A quel livello
proporre è onesto, affermare no.

**L'ordine in cui arrivano i match non è per punteggio** (è per banda). Chi li
riordina per `score` disfa la 069.

## 4. In che ordine compaiono i professionisti

Il punteggio è **deterministico e pubblicato**. Nessun apprendimento, nessuna
personalizzazione, nessun LLM che decide l'ordine: tre cose che renderebbero
impossibile rispondere a un professionista che chiede perché è settimo.

**Due fasi, non una somma sola** (mig. 072).

1. **Chi dichiara proprio il lavoro cercato sta in un gruppo che viene prima.**
   Nessun punteggio di merito lo scavalca. In una somma unica un profilo pieno
   di stelle avrebbe potuto superare chi fa esattamente quel lavoro, che è la
   domanda che il cliente ha fatto. Il gruppo però **non esclude**: chi fa il
   mestiere e non ha dichiarato quel lavoro resta in elenco, sotto, e la scheda
   lo dice.
2. **Dentro il gruppo ordina il punteggio di merito, 0-100.**

| voce | punti | perché |
|---|---|---|
| area: zona / città / provincia / regione / macro / Italia | 20 / 15 / 8 / 4 / 3 / 2 | chi è vicino serve meglio; chi copre l'Italia deve comparire, non vincere |
| valutazione | fino a 25 | vedi sotto |
| tempo di risposta **misurato** | fino a 20 | ≤30 min 20, ≤2 h 16, ≤8 h 12, ≤24 h 8, ≤72 h 4, oltre 0 |
| prezzo **dichiarato**, in qualunque forma | 15 sul lavoro cercato, 10 su qualcosa che offre | un prezzo che non c'è non fa decidere nessuno |
| disponibilità | 10 con orari + prenotazione immediata, 7 con orari | disponibilità vera, non una promessa |
| verifica | verificato 7, in corso 3 | M4 dice che il livello deve pesare in modo visibile |
| completezza della scheda | fino a 3 | presentazione, nome dell'attività, almeno un lavoro dichiarato |

**La valutazione, in due passaggi.** Prima si smorza verso la media della
piattaforma con peso 5: `(media_sua × n + media_piattaforma × 5) / (n + 5)`.
Poi si mappa sulla scala: 3,0 stelle valgono 0 punti, 5,0 valgono 25. Il
secondo passaggio non è cosmetico — con tutte le medie fra 4,5 e 5,0 la prima
formula da sola distribuiva **meno di un punto su venticinque**, cioè non
distingueva nessuno. Con 14 valutazioni in tutta la piattaforma questa voce
resta comunque quasi piatta: è giusto che lo sia, e si sveglia da sé quando le
recensioni arrivano.

**Prezzo vuol dire prezzo, non forbice** (mig. 077). Contano la forbice, il
solo massimo e la **tariffa nell'unità del mestiere** (`rate_amount`, per
esempio 20 €/ora): `coalesce(min_price, max_price, rate_amount)`. Fino alla 077
la voce guardava solo `min_price`, e tre righe con la tariffa oraria contavano
come «senza prezzo» — chi aveva risposto nel modo giusto per il suo mestiere
prendeva meno punti di chi aveva risposto nel modo che ci aspettavamo noi.
Verificato in produzione: su una ricerca di «pulizie ordinarie» quel
professionista passa da 10 a 15 punti, nessun altro cambia. **Resta aperto il
lato interfaccia**: la scheda mostra la forbice, quindi quelle tariffe il
cliente ancora non le vede. Il punteggio premia la dichiarazione — il buco è
nostro, non suo — ma la frase «un preventivo che non c'è non ti aiuta a
decidere» è mantenuta a metà finché la scheda non scrive la tariffa.

**Quello che non sappiamo non toglie punti.** Tempo di risposta non ancora
misurato: 10 su 20, il centro. Orari non dichiarati: 5 su 10. Nessuna
valutazione: la media della piattaforma. Un ordinamento che punisce l'assenza
di dati misura noi, non il professionista — cinque pro su sei non hanno orari
perché non li abbiamo mai chiesti, e lo stesso vale per i prezzi mancanti su 8
righe di offerta su 13.

**Il tempo di risposta è misurato, non dichiarato.**
`professionals.response_time_label` è una frase che il professionista scrive su
di sé e **non entra nel punteggio**: premiarla vorrebbe dire premiare chi
scrive, non chi risponde. La misura è la mediana dei minuti fra il primo
messaggio del cliente su una richiesta e la prima risposta del professionista
su quella richiesta, ultimi 90 giorni.

**A parità di punteggio si sorteggia**, con un seme che cambia ogni giorno e
non a ogni richiesta (così la pagina è stabile per chi la ricarica). Con sei
professionisti, senza sorteggio chi ha il nome fortunato prenderebbe tutti i
contatti per sempre.

**Che cosa NON entra nel punteggio**, e resta fuori finché non è scritto qui:
comportamento del singolo cliente, cronologia delle sue ricerche, qualunque
profilazione, qualunque pagamento. Il ranking è uguale per tutti.

**Dove è calcolato.** `public.professionals_score(ids, città, zona, intervento)`
(mig. 072, riscritta dalla 075), `security invoker` con `search_path` fissato.
Restituisce **le singole voci** e non solo il totale, perché a un
professionista che chiede perché è settimo si risponde con gli addendi.

La 072 era nata `security definer`, perché il tempo di risposta si calcola su
`request_messages`, che un visitatore non può leggere — e non deve. Gli advisor
l'hanno segnalata due volte (lint 0028 e 0029) e avevano ragione: una funzione
`definer` chiamabile da chiunque è una porta che va guardata, non spiegata.
La **075** separa le due cose invece di conviverci:

- `public.professional_signals` — una riga per professionista con la **mediana
  dei minuti di prima risposta** e su quante conversazioni è calcolata.
  Lettura pubblica di proposito: è un parametro di ordinamento dichiarato, e
  pubblicarlo come dato è più onesto che calcolarlo di nascosto. Nessuna policy
  di scrittura per nessun ruolo — un professionista che potesse scrivere il
  proprio tempo di risposta lo renderebbe una dichiarazione, cioè esattamente
  quello che volevamo evitare. `on delete cascade`: la riga muore con lui.
- `public.aggiorna_segnali_professionisti(ids)` — il calcolo, in un posto solo,
  `definer` ma con `execute` revocato a `public`, `anon` e `authenticated`
  (stesso schema della 074): la chiamano il trigger e il cron, non il browser.
- un trigger su `request_messages` aggiorna il professionista **appena
  risponde**, e il lavoro notturno `aggiorna-segnali-professionisti` (04:10
  UTC, traccia in `system_job_runs`) ripassa tutti — la finestra dei 90 giorni
  è mobile, e senza il giro chi smette di rispondere terrebbe per sempre la
  mediana buona dell'ultima volta.

Tutte le altre tabelle che il punteggio consulta — `professionals`, `cities`,
`ratings`, `professional_services`, `professional_coverage_public`,
`professional_availability` — hanno già una policy di lettura pubblica, quindi
da qui in poi il punteggio non tocca più niente di privato.

`getProfessionals` conserva la catena di spareggi vecchia come rete di
sicurezza (`ordinaSenzaPunteggio`) e la usa solo se la funzione non risponde:
serve alla finestra fra il merge e l'applicazione della 072, in cui Vercel ha
già pubblicato il codice e Supabase non ha ancora la funzione. **Si toglie
quando la 072 è applicata e verificata, non prima.**

**Il filtro è ancora in JavaScript.** Chi entra in elenco lo decide ancora
`getProfessionals` in memoria, con la regola di compatibilità della 057/058
(nessuna area dichiarata = tutta la città di iscrizione). Il punteggio è in
SQL, la selezione no: con seicento professionisti va spostata anche quella.

**Allineato il 12 settembre 2026, e i pesi non si pubblicano più.**

Le due dichiarazioni pubbliche sullo stesso meccanismo — `/come-funziona#ordine`
verso i clienti (art. 22 c. 4-bis Cod. Cons.) e la sezione 9 dei termini per i
professionisti (art. 5 Reg. UE 2019/1150) — ora dicono la stessa cosa, nello
stesso ordine. Prima divergevano: la sezione 9 elencava «completamento dei
lavori sulla piattaforma», che non è più una voce a sé, non nominava il criterio
che viene prima di tutti, e non diceva quale parametro pesasse più di quale.

**Decisione: i numeri esatti (20/25/20/15/10/7/3) sono stati tolti da entrambe.**
La norma chiede «i parametri principali» e «l'importanza relativa di tali
parametri», non i pesi né la formula: l'importanza relativa si dichiara con
l'ordine, ed è quello che fanno adesso i due testi. Attenzione a metà della
frase — un elenco piatto, senza ordine dichiarato, **non** basterebbe: mancherebbe
l'«importanza relativa».

I pesi restano dove sono sempre stati, in
`supabase/migrations/072_punteggio_ordinamento.sql`. Il giorno che cambiano,
cambia l'**ordine** in cui i parametri sono scritti — sulla pagina e nei termini,
nello stesso commit. Oggi quell'ordine è: valutazione, poi area e tempo di
risposta a pari merito, poi prezzo, disponibilità, verifica, completezza.

**Resta da decidere a Lucio:** se questa correzione sia una modifica dei termini
ai sensi dell'art. 3(2) P2B, che vuole un preavviso ai professionisti. È una
rettifica per rendere accurata una dichiarazione, non un obbligo nuovo — ma
`TERMS_VERSION` è rimasta a `2026-07-v1` di proposito, e va cambiata solo
insieme a quella decisione.

### Dove sono dichiarati, e perché basta un link

I parametri stanno in **una sezione sola**, `/come-funziona#ordine`, e da ogni
elenco di professionisti ci si arriva col link «Come ordiniamo i risultati»
(`src/components/ComeOrdiniamo.tsx`).

Non è una scorciatoia: l'**art. 22 comma 4-bis del Codice del Consumo** — che
recepisce l'art. 7(4-bis) della direttiva 2005/29 — chiede esattamente «una
sezione specifica dell'interfaccia online, **direttamente e facilmente
accessibile dalla pagina in cui sono presentati i risultati**». Il link È il
meccanismo che la norma descrive, a tre condizioni: la sezione esiste davvero,
si raggiunge *da dove si vedono i risultati* (non solo dal fondo del sito), e
l'etichetta dice di che si tratta.

Un componente e non quattro righe uguali, perché il giorno in cui il modo di
ordinare cambia va cambiato dappertutto insieme: quattro copie a mano sono
quattro occasioni per dimenticarne una, e una pagina rimasta indietro dichiara
il falso.

**La sezione descrive il codice di OGGI, non i pesi di questo documento.** Oggi
`getProfessionals` ordina per precisione dell'area, verifica, valutazione,
tariffa. Quando il ranking passa in SQL coi pesi della tabella qui sopra, la
sezione si aggiorna *nello stesso commit*.

Com'era prima, per memoria: la dichiarazione stava scritta in pagina solo su
servizio×città, e **ne dimenticava il primo criterio** — la precisione
dell'area, che dalla 057/058 è quello che pesa di più. Le altre tre pagine di
elenco non dichiaravano niente.

### Perché questo resta fuori dall'art. 22

Il punteggio è una formula pubblicata, non una decisione automatizzata su una
persona: non sospende, non esclude e non declassa nessun professionista. Se un
domani il posizionamento dovesse *penalizzare* qualcuno per il suo
comportamento, quella diventa un'altra cosa e serve l'uomo nel processo
(`DATA_COMPLIANCE.md` §2). Un eventuale ripiego su Bob per interpretare la
frase **non decide l'ordine** e va etichettato come AI (AI Act art. 50).

## 5. Le posizioni a pagamento

**La regola.** Al massimo **uno slot fra i primi tre e uno a metà elenco**,
marcati **«Sponsorizzato»**, scelti fra i professionisti con un piano a
pagamento e ordinati fra loro per pertinenza. **L'elenco organico non si tocca:
restano tutti lì, nello stesso ordine che avrebbero avuto.** Un professionista
che paga compare *in più*, non *al posto di*.

**Perché slot etichettati e non punti in più.** Un bonus dentro il punteggio
mescola merito e pagamento in un numero solo, e il cliente non può sapere quale
risultato ha pagato per stare lì. Con lo slot etichettato lo sa leggendo.

**La disclosure è obbligatoria, non facoltativa.**

- Dir. 2005/29/CE, All. I punto 11-bis (recepito in **art. 22 c. 4-bis Codice
  del Consumo**): presentare un risultato di ricerca senza dire che il
  posizionamento è a pagamento è una pratica sleale **in sé**.
- **Reg. UE 2019/1150 (P2B) art. 5**: verso i professionisti vanno dichiarati i
  parametri principali e se e come un pagamento li influenza.

**Attenzione a una riga che oggi è vera e domani non lo sarà.** La sezione
`/come-funziona#ordine` dichiara «**Nessuna posizione è a pagamento**». Il
giorno del primo slot sponsorizzato quella riga diventa falsa su una pagina
pubblica: va **sostituita, non tolta**. Ora sta in un posto solo, quindi è una
modifica sola — prima erano quattro pagine da ricordare.

**Il link però non copre il pagamento.** L'allegato I punto 11-bis è una
pratica sleale *in sé* e pretende la dichiarazione **dentro i risultati**:
l'etichetta «Sponsorizzato» va sulla scheda, dove la persona sta guardando.
Nessun rimando la sostituisce. Quindi il giorno degli slot cambiano due cose:

1. la scheda sponsorizzata prende l'etichetta — obbligatoria, visibile, non
   rimandabile;
2. la sezione dice che esistono spazi a pagamento, come sono scelti, e che non
   cambiano l'ordine degli altri.

I termini per i professionisti (§9 di `/termini/professionisti`) **lo
promettono già**: «il posizionamento a pagamento è chiaramente identificato
come tale ai clienti». L'etichetta non è una scelta di prodotto ancora aperta,
è una promessa già firmata.

Quegli stessi termini però elencano fra i criteri anche cose che il ranking
**non usa**: reattività nelle risposte, completamento dei lavori sulla
piattaforma, completezza del profilo. Dichiarare parametri che non esistono è
l'errore opposto a quello che abbiamo appena corretto. Da sfoltire al prossimo
`TERMS_VERSION` — che è un cambio sostanziale e tocca ciò che gli utenti hanno
accettato, quindi va fatto di proposito e non di sfuggita.

## 6. Che cosa dichiara un professionista

**`professional_services` è la verità** (mig. 070): una riga per intervento
offerto, col suo prezzo, la sua unità di misura e la prenotazione immediata.
`professionals.subservice_slugs` è deprecata e la eliminerà la 072 o la 073
(la 071 è gli avvisi di servizio) — ma **solo
dopo** che il codice ha smesso di leggerla, perché Vercel pubblica `main` da sé
mentre le migrazioni passano da Supabase a mano.

Il prezzo può mancare: dichiarare dodici lavori non deve obbligare a fissare
dodici prezzi. Un intervento senza prezzo è pertinente lo stesso — semplicemente
non prende i punti del prezzo.

Una riga con `subservice_id` NULL vuol dire «il mestiere, nessun intervento
specifico»: la crea l'iscrizione, ed è la ragione per cui esiste il punteggio
20 «solo mestiere».

### Il modulo del professionista: di chi è, e l'idea di ricavarlo dai lavori chiusi

Il modulo che chiede a un professionista quali lavori fa **non esiste**: le
dichiarazioni di oggi le ha messe la 070 a mano, su sei professionisti. Il
lavoro è **di Lucio** (deciso da André il 9 settembre 2026), e va discusso con
lui prima di scriverlo, perché due requisiti cambiano il progetto:

1. **Deve costare al professionista il meno possibile.** Un elenco di 105
   caselle da spuntare non lo compila nessuno.
2. **Dovrebbe aggiornarsi da sé, in base ai lavori che il professionista
   chiude.** Chi ha davvero riparato tre lavandini lo ha dimostrato meglio di
   chi ha spuntato una casella.

**La seconda idea è possibile, ma non con i dati di oggi.** Verificato sulla
produzione il 9 settembre 2026:

- La catena esiste: `appointments.request_id` → `requests.subservice_id`, e in
  parallelo `appointments.professional_service_id`.
- **`requests.subservice_id` è NULL su 10 righe su 10.** La colonna c'è e
  nessuno la scrive: quindi oggi un lavoro chiuso non sa dire *quale* lavoro
  era. Numeri: 29 appuntamenti, 7 completati, 9 con una richiesta collegata, 6
  con un'offerta collegata.
- La strada `professional_service_id` è circolare: punta a una riga che dà per
  già fatta la dichiarazione che vorremmo ricavare.

**Prerequisito, e sta sul lato cliente (André):** quando nasce una richiesta,
scriverci dentro l'intervento riconosciuto. `search_resolve` restituisce già
`subservice_id` con un punteggio di certezza — è esattamente il pezzo che
manca. Senza questo, ricavare le dichiarazioni dai lavori chiusi non ha
sorgente.

**Il modulo serve comunque**, perché un professionista appena iscritto ha zero
lavori chiusi: la deduzione può solo *aggiungere* a una prima dichiarazione,
non sostituirla. Ma può essere piccolo: i lavori più comuni del mestiere già
spuntati, e il professionista togliere quelli che non fa.

**Due vincoli da non scoprire dopo:**

- Una dichiarazione dedotta **sposta un professionista nell'ordinamento**. Per
  la regola del progetto e per l'art. 22 GDPR, qualunque cosa che
  deprioritizza un professionista vuole un umano nel giro. La forma che
  soddisfa entrambi: la deduzione **propone** («abbiamo visto che hai fatto X,
  confermi?»), costa un tocco, e **non toglie mai** un lavoro da sé.
- Se «i lavori dedotti dagli incarichi chiusi» diventa un parametro, va scritto
  nei parametri pubblicati (§4 e `/come-funziona#ordine`) e nei termini verso i
  professionisti (art. 5 P2B). Aggiungere un parametro senza dirlo è la cosa
  che quelle due pagine esistono per evitare.

## 7. Che cosa si registra delle ricerche, e che cosa no

Una casella di ricerca raccoglie dati personali che nessuno ha chiesto: le
persone ci scrivono indirizzi e numeri di telefono. Quindi:

- **niente `user_id`**, come già per `search_events` dalla 026;
- si registra la **frase normalizzata**, con le **cifre tolte** e un tetto di
  **60 caratteri** — abbastanza per capire che manca il sinonimo «bagno», non
  abbastanza per conservare una via e un civico;
- **conservazione 12 mesi** (dato di prospect, `DATA_COMPLIANCE.md` §5);
- riga nel registro dei trattamenti, RLS attiva, lettura al solo staff.

Lo scopo è uno solo e va scritto: **far crescere il vocabolario**. Non è
analytics di prodotto e non diventa un profilo di nessuno.

## 8. Come si verifica

Non basta leggere il codice — su questo progetto l'ordine delle rotte ha già
sorpreso due volte.

1. Un mazzo di frasi vere contro `search_resolve`, coi luoghi dentro: esatto,
   prefisso, refuso, ordine invertito, zona con due nomi nell'etichetta,
   «vicino a me», solo-luogo, sola punteggiatura.
2. La catena intera: frase → intervento → **professionisti veri**. È l'unica
   prova che conta, e va rifatta dopo ogni cambio al vocabolario.
3. `scripts/schema_check.sh` (replay dai soli file) e gli advisor di sicurezza
   dopo ogni migrazione.
4. Dal vivo su www.meetonda.com, desktop **e 390px**.

## 9. Stato al 9 settembre 2026 — fotografia, non verità

Invecchia dal giorno dopo: la verità è il repo, lo schema vivo e la produzione.

**C'è**: vocabolario (491 termini, 0 senza token, tutti e 105 gli interventi
non-«Altro» coperti); risolutore con bande e ordinamento per specificità;
`professional_services` come verità unica (13 righe, 12 con l'intervento
preciso, 5 pro su 6); la casella di ricerca su `/professionisti`, con i
suggerimenti mentre si scrive, la pastiglia che mostra come ha capito e le tre
bande rispettate; **il punteggio di merito 0-100 della 072**, con le due fasi
di §4 e gli addendi in chiaro, `security invoker` dalla 075 e con il tempo di
risposta in una tabella pubblica sua (`professional_signals`), aggiornata da un
trigger e da un giro notturno; la richiesta che ricorda **quale** lavoro era
(`requests.subservice_id`, scritto dalla ricerca e dal brief di Bob).

**Non c'è**: la selezione di chi entra in elenco, ancora in JavaScript e in
memoria; gli slot sponsorizzati e la sostituzione della frase «Nessuna
posizione è a pagamento»; il registro delle **ricerche a vuoto** — attenzione,
`search_events` esiste dalla 026 e registra gli slug, ma non la frase digitata
né il fatto che non abbia trovato niente; la schermata che chiede al
professionista i suoi interventi (di Lucio, vedi §6); il `drop column` di
`subservice_slugs`.

**Da allineare**: la sezione 9 dei termini per i professionisti elenca
parametri che non sono più questi. Vedi il riquadro in §4.

**Il limite vero non è il codice, è il dato**: «scarico otturato» oggi non
trova nessuno perché nessuno l'ha dichiarato — non perché la ricerca non
funzioni. Otto righe di offerta su 13 non hanno un prezzo e un solo
professionista su sei ha gli orari, e da oggi quelle due assenze costano punti
veri nel ranking: 15 il prezzo, 5 la disponibilità. È la ragione per cui la
schermata delle dichiarazioni vale più di qualunque altra cosa nella lista.
