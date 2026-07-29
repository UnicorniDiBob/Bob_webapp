# Effetti legali della verifica — analisi di rischio (blocco 10)

**Non è un parere legale.** Lettura tecnica di supporto alle decisioni di
prodotto; la revisione avvocato resta prevista al blocco 23.3. Fonti citate in
fondo. Data: 2026-07-19.

## Domanda 1 — Verificare ci trasferisce automaticamente responsabilità?

**No, non automaticamente.** Era il timore storico ("se controllo, allora
"conosco", quindi divento responsabile di tutto"), ma il diritto UE lo ha
risolto espressamente.

- **Safe harbor hosting** (art. 6 DSA, Reg. UE 2022/2065, ex art. 14 Dir.
  2000/31 e art. 16 D.Lgs. 70/2003): la piattaforma non risponde dei contenuti
  caricati dagli utenti finché non ha "conoscenza effettiva" dell'illiceità e,
  saputolo, agisce per rimuoverli.
- **Clausola "Good Samaritan"** (art. 7 DSA): un provider *non* perde l'esenzione
  "solamente perché svolge indagini volontarie di propria iniziativa o adotta
  altre misure" per individuare/rimuovere contenuti illeciti. Tradotto: fare
  verifiche volontarie **non** fa scattare la responsabilità.
- **Giurisprudenza** (CGUE C-682/18 *YouTube e Cyando*): adottare misure
  tecniche di rilevamento non significa avere un "ruolo attivo" con conoscenza e
  controllo di tutti i dati. Codificato dall'art. 7 DSA.

Quindi la verifica in sé è protetta. **Il rischio non nasce dal verificare, ma
da due cose diverse:** (a) *cosa dichiariamo* di aver verificato, e (b) *quanto
attivamente selezioniamo/raccomandiamo* invece di far scegliere il cliente.

## Domanda 2 — Che rischi corriamo facendo le verifiche?

Tre binari di rischio, distinti dal safe harbor (che copre solo i "contenuti
illeciti", non la qualità del servizio né la veridicità delle *nostre* promesse):

1. **Pratica commerciale scorretta / ingannevole** (artt. 20-23 Codice del
   Consumo, D.Lgs. 206/2005). Se pubblichiamo il badge "Verificato" ma la
   verifica non è stata fatta, o è più debole di quanto il badge lascia
   intendere, è una pratica ingannevole verso il consumatore. Il rischio è
   *dichiarare più di quanto si controlla*, non controllare.

2. **Responsabilità da affidamento / apparenza + culpa in eligendo.** Più il
   nostro messaggio induce il cliente a fidarsi *della qualità* del pro ("di
   fiducia", "garantito", "il migliore per te") anziché di un *fatto verificato*
   ("P.IVA attiva al GG/MM/AAAA"), più ci avviciniamo ad assumere un obbligo
   sull'esito. Il cliente danneggiato può sostenere di aver fatto affidamento
   sulla nostra selezione.

3. **Perdita del safe harbor per "ruolo attivo"** (CGUE C-324/09 *L'Oréal v
   eBay*; C-236/08 *Google France*). Si perde l'esenzione se la piattaforma
   passa da ospite neutrale a soggetto che *ottimizza, promuove o seleziona* i
   contenuti in modo da averne conoscenza e controllo. Attenzione: verificare
   l'identità o la P.IVA **non** è il tipo di "ruolo attivo" che fa scattare
   questa perdita — lo è invece *scegliere e raccomandare* un professionista
   specifico al posto del cliente (modello Baze/concierge).

## Domanda 3 — Il caso Baze: quanta responsabilità si assume verificando?

Baze è il modello *opposto* al marketplace aperto: verifica pesantemente (86
parametri, colloquio telefonico, test psico-attitudinale, controllo referenze e
documenti) e ne fa il claim centrale ("Collaboratori certificati", "verificate
da noi"). Eppure — ed è la lezione — **nei T&C si assume pochissima
responsabilità**, e solo su ciò che controlla direttamente:

- Si qualifica come **"mandatario con rappresentanza" del cliente** solo per la
  parte amministrativa/burocratica (INPS, INAIL, buste paga, PagoPA) — art. 5 e
  12.2 T&C Famiglie.
- Si assume la responsabilità **"per eventuali errori imputabili alla propria
  attività"** — cioè la diligenza del *proprio* servizio amministrativo (art. 5).
- **Non** garantisce da nessuna parte la qualità, l'onestà o la condotta del
  lavoratore. La "Limitazione di Responsabilità" (art. 13) riguarda solo i
  pagamenti; l'esecuzione del lavoro resta un contratto bilaterale tra famiglia e
  lavoratore (art. 12.1, contratti collegati ex art. 1372 c.c.).
- Il pagamento è **diretto** cliente→lavoratore via Stripe Connect; Baze non
  entra nel flusso come parte (art. 5.1, 13).

**Insegnamento:** Baze verifica tanto e *vende* la verifica, ma contrattualmente
si assume solo il rischio operativo che sa controllare (la correttezza degli
adempimenti che esegue lei), e **disclaima quello che non può controllare** (il
comportamento del lavoratore). Verificare molto ≠ garantire molto: sono due leve
separate. Il claim di marketing ("certificati") vive accanto a un perimetro
contrattuale di responsabilità stretto e ben definito. È esattamente il template
che serve a Bob.

## Domanda 4 — Livelli di verifica = livelli di responsabilità?

**Sì, ma la responsabilità scala con ciò che DICHIARIAMO, non con quanto
controlliamo internamente.** La leva giuridica è la *semantica del claim*, non
lo sforzo di verifica. Mappatura sui livelli L0/L1/L2 (proposti nel 10.0):

| Livello | Cosa dichiariamo | Responsabilità che ci assumiamo | Come blindarla nei ToS |
| --- | --- | --- | --- |
| **L0 Iscritto** | Nulla ("profilo non verificato") | Nessuna legata alla verifica | Etichetta esplicita "non verificato" |
| **L1 P.IVA verificata** | Un fatto puntuale e databile: "P.IVA risultava attiva al GG/MM/AAAA" | Solo l'accuratezza di *quel* fatto *a quella data* | Enunciare il fatto e la data; nessuna proiezione sul futuro né sulla qualità |
| **L2 Badge "Verificato Bob"** | Documenti/abilitazione controllati a una certa data | L'esser stati diligenti nel controllo documentale *a quella data* | Definire il badge come "documenti verificati il GG/MM/AAAA", MAI come "professionista garantito/di fiducia" |

Principio operativo: **verifica fatti, enuncia fatti, metti la data, declina la
qualità.** Un badge che dice "documenti controllati il 3/6/2026" è un fatto
verificabile a rischio contenuto; un badge che dice "professionista di fiducia"
è una promessa di esito ad alto rischio. Stesso lavoro di verifica dietro,
esposizione legale opposta.

## Mitigazioni concrete per i ToS di Bob (blocco 23)

1. **Estraneità al contratto pro-cliente** (come tutti e 4 i competitor): Bob
   mette in contatto, non è parte del contratto d'opera.
2. **Ogni livello di verifica = dichiarazione di fatto datata**, mai garanzia di
   qualità/onestà/esito. Il badge certifica un controllo a una data, non la
   persona.
3. **"Il cliente sceglie", non auto-assegnazione** (già regola fissa del
   progetto, anche per restare fuori da Annex III AI Act / Platform Work
   Directive): tiene Bob fuori dalla zona "selettore attivo" occupata da Baze e
   preserva il safe harbor.
4. **Non pubblicizzare "verificato" se non verificato davvero** (evita la
   pratica ingannevole ex Codice del Consumo). Coerenza tra badge e controllo
   effettivo.
5. **Garanzia Bob = rimborso discrezionale da riserva dedicata**, non assunzione
   di responsabilità civile per l'operato del pro (già impostazione BP: riserva
   0,7% GMV protetto).
6. **Human in the loop** su ogni decisione di verifica/declassamento (già regola
   fissa privacy; rilevante anche AI Act se ci sarà scoring automatico).
7. **DAC7 (D.Lgs. 32/2023):** quando i corrispettivi passeranno dalla
   piattaforma, verificare i dati fiscali del venditore diventa un *obbligo di
   legge*, non una scelta né una responsabilità "assunta volontariamente" — un
   motivo in più per costruire L1 ora.

## Approvazione specifica delle clausole onerose — due regimi da non confondere

Domanda emersa il 19/07: se una clausola vessatoria è nulla, come può un flag
renderla valida? Risposta: **perché "vessatoria" indica due istituti distinti con
sanzioni diverse.**

| | **B2B — art. 1341, co. 2 c.c.** (ToS Professionisti) | **B2C — artt. 33-37 Cod. Consumo** (ToS Clienti) |
| --- | --- | --- |
| Presupposto | Condizioni generali predisposte unilateralmente | Squilibrio significativo dei diritti a danno del consumatore |
| Sanzione | **Inefficacia** della clausola ("non hanno effetto") | **Nullità di protezione** della clausola (art. 36), contratto valido per il resto |
| Natura del vizio | **Di forma**: manca l'approvazione specifica | **Sostanziale**: il contenuto è squilibrato |
| Sanabile? | **Sì**, con approvazione specifica per iscritto | **No.** La trattativa individuale effettiva esclude la vessatorietà (art. 34, co. 4), ma una checkbox non è trattativa. Per le clausole della *black list* (art. 36, co. 2 — es. esclusione di responsabilità per danno alla persona) la nullità è **insanabile in ogni caso** |
| Rilevabilità | Su eccezione di parte | **D'ufficio** dal giudice, a vantaggio del solo consumatore |
| Elenco | **Tassativo** (non estensibile per analogia) | Aperto (art. 33, co. 1) + lista esemplificativa (co. 2) + black list (art. 36, co. 2) |

**Conseguenze pratiche per Bob:**
- Lato **professionisti** il flag separato ha senso: sana un vizio di forma. Ma
  resta il dubbio se il point-and-click integri la "sottoscrizione" richiesta
  dalla norma — **orientamento non consolidato**; il flag è il minimo, la certezza
  richiederebbe firma elettronica avanzata (art. 20 CAD, D.Lgs. 82/2005).
- Lato **clienti consumatori** il flag **non serve a nulla**: nessuna checkbox
  rende valida una clausola squilibrata. L'unica strategia è **scrivere clausole
  che non siano squilibrate**: massimali proporzionati, nessuna esclusione per
  danni alla persona, foro del consumatore, manleva contenuta, modifiche con
  giustificato motivo e preavviso.
- Se l'approvazione specifica non regge lato pro, cadono le singole clausole
  (limitazioni, deroga di competenza, rinnovo tacito) ma **non il contratto**: si
  torna alla disciplina di legge (responsabilità piena, foro del convenuto).
  Questo è il rischio concreto da quantificare, non la nullità dell'accordo.

## Sintesi in una riga

Verificare **non** trasferisce responsabilità in automatico (art. 7 DSA la
protegge); il rischio nasce dal *promettere qualità* invece di *certificare
fatti datati*, e dal *selezionare al posto del cliente* invece di far scegliere.
Bob può verificare quanto vuole restando a rischio basso, se ogni livello resta
una dichiarazione di fatto verificabile e il cliente resta l'unico a scegliere.

## Fonti (consultate 2026-07-19)

- Reg. UE 2022/2065 (DSA), art. 6 (hosting), art. 7 (indagini volontarie / Good
  Samaritan), art. 8 (assenza obbligo generale di sorveglianza). Testo art. 7 e
  commento: dsa-library.com/article/7 · testo ufficiale:
  eur-lex.europa.eu/eli/reg/2022/2065/oj
- CGUE C-682/18 e C-683/18 *YouTube e Cyando*; C-324/09 *L'Oréal v eBay*;
  C-236/08 *Google France* (dottrina ruolo attivo/passivo del provider).
- D.Lgs. 70/2003 (attuazione Dir. e-commerce, esenzioni hosting), art. 16-17.
- D.Lgs. 206/2005 (Codice del Consumo), artt. 20-23 (pratiche commerciali
  scorrette/ingannevoli); artt. 66-bis ss. (foro del consumatore).
- Baze S.r.l. — Termini e Condizioni Famiglie:
  bazeapp.com/termini-e-condizioni/famiglie (artt. 3, 4, 5, 12, 13; ruolo di
  mandatario con rappresentanza, contratti collegati ex art. 1372 c.c.).
- D.Lgs. 32/2023 (DAC7), obblighi di raccolta/verifica/comunicazione dei dati
  dei venditori per i gestori di piattaforma.
