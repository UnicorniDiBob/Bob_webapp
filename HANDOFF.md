# Passaggio di consegne — 12 settembre 2026, sera (André, con Claude)

> Sostituisce quello del 12 mattina e ne porta avanti tutte le voci ancora
> aperte, nelle sezioni in fondo. HANDOFF.md si sovrascrive a ogni sessione,
> **ma quello che è a metà si porta avanti, non si butta**.

## In produzione stasera: NIENTE

`main` è ferma al merge #61 di stamattina. Tutto il lavoro del pomeriggio sta
su **tre rami spinti e non mergiati**. Niente Supabase, nessuna migrazione,
nessun advisor da rilanciare.

Chi riprende domani parte da qui.

## I tre rami, e l'ordine di merge conta

| ramo | cosa contiene | di chi |
|---|---|---|
| `design/kit-sezioni` | il kit di componenti + `/come-funziona` rifatta | André |
| `design/pagina-pro` | `/per-i-professionisti` rifatta + Bob di profilo | André |
| `legal/parametri-ordinamento` | le due dichiarazioni sull'ordinamento allineate | **area di Lucio** |

**`design/pagina-pro` contiene già il commit di `design/kit-sezioni`**, perché è
nato sopra di lui. Va mergiato **dopo**: prima `kit-sezioni`, poi `pagina-pro`.
Al contrario, GitHub mostrerà il kit due volte.

`legal/parametri-ordinamento` è indipendente e può andare quando vuole — ma è un
file di Lucio, con una decisione aperta (sotto).

## Cosa c'è dentro, in breve

**Lo stile della home è diventato un kit.** `src/components/sezioni.tsx`:
`Fascia` (banda a tutta larghezza, sfondo bianco/tenue/indaco), `TestaSezione`,
`Passo`, `Blocco` (l'affermazione con la riga gialla, che sostituisce la
scheda). Prima «lo stile della home» non era uno stile: era un file. Rifare le
pagine copiando quel JSX avrebbe prodotto quaranta pagine leggermente diverse —
cioè il difetto da cui siamo partiti.

**Due pagine ci sono passate sopra**, `/come-funziona` e
`/per-i-professionisti`. La home usa il kit senza cambiare aspetto.

**Bob ha imparato tre cose**: il verso `schiena`, il verso `profilo`, la posa
`indica`, e sa tenere un attrezzo in mano (`attrezzoDestro`/`attrezzoSinistro`,
più `fuoriBordo` per quando l'attrezzo esce dal viewBox). Il ragionamento sta
in `claude/MASCOT_bob_12set.md`, aggiornato stasera.

**Tre illustrazioni nuove**: la scala dei mestieri su `/come-funziona` (quattro
Bob di schiena che muovono il braccio mentre scorri), Bob di profilo con la
cariola di banconote su `/per-i-professionisti`, e la bilancia.

**I pesi del punteggio non si pubblicano più.** Su `/come-funziona#ordine` i
«fino a 20 / 25 / 20…» sono spariti: la norma chiede i parametri principali e
la loro **importanza relativa**, non i pesi né la formula. L'importanza relativa
ora si dichiara con l'**ordine** in cui i parametri sono elencati — quindi
quell'ordine non è impaginazione, è una dichiarazione. Se cambiano i pesi in
`072_punteggio_ordinamento.sql`, cambia l'ordine, **nello stesso commit**, sulla
pagina e nei ToS pro.

## Cosa è a metà — mio (12 settembre sera)

- **Niente di tutto questo è in produzione.** Tre PR da aprire e mergiare. La
  CI gira lint + build sulla PR: **è l'unico posto dove la build viene provata
  davvero**, perché nella sessione di lavoro `npm run build` non è mai arrivato
  in fondo.
- **L'animazione della scala non è mai stata vista muoversi.** Ho verificato
  che il calcolo risponde alla posizione (angoli diversi a quote diverse), ma
  non sono riuscito a far scorrere la pagina da remoto: `scrollTop` non si
  muove attraverso l'estensione su localhost. **Va guardata con gli occhi.** Se
  è troppo o troppo poco, sono due colonne di numeri in cima a
  `ScalaDeiMestieri.tsx`: `ampiezza` quanto ampio il gesto, `passo` quanto
  veloce — più piccolo è il passo, più veloce va.
- **`/come-funziona` è passata da quattro passi a tre.** I vecchi 3 e 4
  («confronti prezzo e rating», «contatti chi preferisci») erano lo stesso
  momento raccontato due volte, ed erano già uniti in home. Niente è stato
  tolto: il contenuto vive nel terzo. **È una decisione di contenuto, non di
  stile**: se non convince, si torna indietro.
- **L'ancora `#come-funziona` su `/per-i-professionisti` non la linka più
  nessuno in pagina.** Il bottone che ci puntava è stato tolto. L'`id` è
  rimasto perché un link incollato o un segnalibro lo usano ancora.
- **Due righe di copy le ho scritte io** su `/per-i-professionisti`: l'occhiello
  «I vantaggi» e il titolo «Cosa cambia, per te». Quella sezione non aveva
  titolo e i quattro blocchi partivano da `h3` sotto un `h1`, saltando un
  livello.
- **Il guardaroba di Bob resta non costruito.** Sulla scala i quattro mestieri
  si distinguono per l'attrezzo in mano, non per la tenuta. Funziona, è un
  ripiego.
- **Il verde delle banconote (`#4ec27a`) non è nella palette** e vive solo
  dentro `BobConCariola.tsx`. È voluto: i soldi devono leggersi come soldi. Se
  un giorno serve altrove, va deciso allora, non ereditato di nascosto.

## Per Lucio, sul ramo `legal/parametri-ordinamento`

La sezione 9 dei ToS pro elencava parametri che non sono più quelli, non
nominava il criterio che viene primo, e **non diceva quale parametro pesasse più
di quale** — che è metà dell'obbligo dell'art. 5 P2B («i parametri principali
**e le ragioni della loro importanza relativa**»). Ora dice la stessa cosa della
pagina pubblica, nello stesso ordine.

**Resta una decisione tua, e l'ho lasciata aperta di proposito:**
`TERMS_VERSION` è ancora `2026-07-v1`. Se questa correzione conta come modifica
dei termini ai sensi dell'**art. 3(2) P2B**, ai professionisti va dato un
preavviso di almeno 15 giorni. Secondo me è una rettifica per rendere accurata
una dichiarazione, non un obbligo nuovo — ma non è una decisione da prendere di
straforo dentro un commit di design. Decidila tu, e cambia la versione insieme a
quella decisione.

## Regole nuove, da sapere prima di scrivere codice

Sono in `CLAUDE.md`, sezione **«Layout e illustrazioni»**. In sintesi:

- **`justify-self-center` su una cella di griglia la stringe al contenuto**, non
  la centra soltanto. Una cella che contiene qualcosa con `w-full max-w-[N]` non
  arriverà mai a N. Costato stamattina: una scena a 300px invece di 520, il
  telefono a 102 invece di 177 e l'intestazione che leggeva «IDRAULI…». Una
  classe, quattro sintomi.
- **Una scena a percentuali ha bisogno di una larghezza vera**: i disegni
  rimpiccioliscono, il testo dentro no — si taglia. E non somiglia a un problema
  di larghezza, somiglia a un pezzo mancante.
- **Ogni breakpoint va misurato, non dedotto.** La stessa scena al 34% regge a
  1600px e non regge a 390px.
- **Un oggetto che ha un suo verso chiede un Bob con lo stesso verso.** Se quel
  verso non esiste, si aggiunge al personaggio; non si piega l'oggetto. Questa
  è costata tre tentativi sulla cariola.
- **`tsc` e `lint` non guardano il CSS.** Una graffa di troppo in `globals.css`
  passa tutti e due i controlli e manda la pagina in 500. Si vede solo aprendo
  la pagina — che è il motivo per cui la regola del progetto dice di provare con
  le richieste invece che leggendo il file.

## Cosa è a metà — portato avanti dal 12 mattina (André)

- **Il blocco C dell'audit — le modali che diventano pagine — è stato guardato
  da vicino e la conclusione è: non così, e non prima di gennaio.** Le sei
  finestre non sono un problema solo. Il difetto vero è che **15 file ricopiano
  a mano `fixed inset-0 z-50`** con la loro copia dell'`useEffect` per Escape e
  scroll: non esiste nessun componente `Modal` condiviso, e `TermsDialog.tsx` è
  l'unico fatto bene (usa l'elemento nativo `<dialog>`, che dà focus trap,
  Escape e blocco dello scroll gratis). `InstantBookingDialog` — 667 righe, tre
  passi, la funzione che vendi a pagamento — non ha né Escape né blocco dello
  scroll né `role="dialog"`.
  - **Quella che merita davvero una rotta è solo la prenotazione.** Riga 357: se
    non sei loggato il pulsante porta a `/login?returnTo=` + il *pathname*, cioè
    la pagina del professionista. Dopo il login torni sul profilo, la finestra è
    chiusa e quello che avevi scritto è perso. È una perdita di conversione su
    una funzione del piano a pagamento.
  - `QuoteDialog` e `RequestDialog` **non si possono spostare da sole**: vivono
    dello stato di `BobChat`, che è una macchina a **9 stati tutta in `useState`**
    sulla home, senza nessuna rappresentazione nell'URL. Dare una rotta a loro
    vuol dire prima darne una a BobChat.
  - Due ostacoli concreti da sapere prima: `next.config.mjs` ha
    `/dashboard/:sezione+` → `/impostazioni/:sezione+`, quindi **ogni rotta
    nuova sotto `/dashboard/` finisce su una pagina che non esiste**; e
    `middleware.ts` protegge per **prefisso** (`ROTTE_PRIVATE = ["/dashboard",
    "/messaggi", "/impostazioni"]`), quindi una `/prenota/...` nuova nasce
    **pubblica** finché non la aggiungi lì.
- **Il paragrafo 5 dell'audit — «il look da AI» — non è mai stato messo a
  piano.** A, B e C erano tipografia, larghezza e modali. La lamentela numero
  uno non aveva un blocco suo, ed è la ragione per cui il lavoro sembrava
  girare a vuoto. Adesso ce l'ha: il kit, e le pagine una per volta.
  - Restano da fare, in ordine: `/servizi` e `/citta` (corte, 65 e 90 righe,
    quasi identiche — si fanno in una passata), `/professionisti`,
    `/servizi/[slug]`. **Poi l'area privata, con un criterio diverso**: la
    dashboard non deve somigliare alla home. Ci lavori dentro, non la guardi.
    Quello che passa di là è la somiglianza di famiglia — stesso trattamento
    delle schede, stesso ritmo dei titoli, **Bob negli stati vuoti** — non
    l'impaginazione a fasce.
  - Il numero che conta: `.card` è usata **138 volte** ed è definita in un punto
    solo. Cambiare quella definizione cambia quaranta pagine in un pomeriggio.
    È la cosa più economica del progetto e non è ancora stata fatta.
- **Le altre tre tenute di Bob** (camicia e cintura, alta visibilità, polo e
  grembiule) sono disegnate ma non sono nel repo.
- **La palette del marchio resta indaco e giallo.** Se un giorno si cambia, non
  è la mascotte: sono i pulsanti, i chip, il logo, il calendario, l'anteprima
  sui social. **Va deciso prima del pilota, non dopo.**
- **Restano 6 `font-mono`** che cadono sul mono di sistema. L'abbinamento
  naturale è IBM Plex Mono o JetBrains Mono. Non urgente.

## Applicato in produzione il 12 mattina — resta valido

- **Blocco A e blocco B chiusi.** `container-bob` è `100rem` (1600px) e vale per
  tutto, pubblico e applicazione. **`container-app` e `src/lib/layout.ts` non
  esistono più**: se li trovi citati in un documento, il documento è vecchio.
- **Per stringere il testo si usa `.colonna-lettura`** su un blocco interno, mai
  `max-w-*` sul contenitore. Il contenitore decide la **cornice**; la misura di
  lettura si applica al **contenuto dentro**.
- **La home nuova è in produzione**, con la mascotte, le scene, le animazioni
  allo scorrimento e il footer a quattro colonne. I quattro link morti del mock
  (*Requisiti minimi*, *Lavora con noi*, *Blog*, *Contatti stampa*) non sono mai
  stati spediti: il footer punta solo a rotte che esistono, verificato.
- **`Bob.tsx` è un server component**: niente `useId`, niente `<defs>`/`<use>`
  (gli id lì dentro sono globali al documento e due Bob nella stessa pagina
  collidono), niente JavaScript spedito al browser. Le braccia stanno fuori dal
  corpo apposta: una posa nuova è una rotazione, non un disegno nuovo.
- **La scala tipografica è globale**: 13/15/17 invece di 12/14/16, pavimento dei
  grigi a `/65`. `text-2xs` (11px) esiste e va usato **solo** per i dati fitti,
  cioè il calendario.

## Applicato in produzione l'11 settembre — resta valido

- **Niente su Supabase oggi.** Nessuna migrazione, nessun oggetto nuovo,
  nessun advisor da rilanciare. Solo un deploy Vercel da `main`.
- **Ho toccato 18 file dell'area di Lucio** — tutto `src/app/admin/**` più
  `src/components/admin/CatalogInstantEditor.tsx` — e questo **strappa la
  regola** «un'edit nell'area dell'altro va nel suo PR». L'ho fatto lo stesso
  perché era una sostituzione meccanica e globale, non una modifica funzionale:
  lo stesso passaggio di `text-bob-ink/45` → `/65` su tutto il progetto.
  Lasciare fuori l'admin avrebbe significato un admin con contrasti diversi dal
  resto del sito e una seconda passata da fare dopo. **Ma la regola è stata
  attraversata e va detto, non nascosto**: Lucio, se preferisci che l'admin
  torni com'era, è un `git revert` selettivo su quei 18 file.
- **La scala è globale da adesso.** Qualunque componente nuovo scritto da qui
  in avanti eredita 13/15/17 invece di 12/14/16, e i grigi hanno un pavimento a
  `/65`. Se qualcosa sembra «troppo grande» rispetto a com'era, non è il
  componente: è il token, e si discute in `tailwind.config.ts`.
- **`text-2xs` (11px) esiste e va usato solo per i dati fitti**, cioè il
  calendario. Non è una nuova taglia generica: se serve testo piccolo altrove,
  quasi sempre la risposta giusta è `text-xs`.

## Cosa è a metà — portato avanti dal 10 settembre (André)

- **La scheda non mostra la tariffa.** La 077 da' i punti a chi dichiara un
  prezzo in qualunque forma, ma la scheda pubblica stampa solo la forbice:
  quelle tre tariffe orarie il cliente non le vede ancora. Il punteggio premia
  la dichiarazione — il buco e' nostro, non del professionista — ma la frase
  «un preventivo che non c'e' non ti aiuta a decidere» su
  `/come-funziona#ordine` e' mantenuta a meta' finche' la scheda non la scrive.
  E' la voce vecchia «tariffa nell'unita' del mestiere», e da oggi ha un motivo
  in piu' per essere chiusa: e' interfaccia, non punteggio.
- **La selezione di chi entra in elenco è ancora in JavaScript e in memoria.**
  Il punteggio è in SQL, il filtro no: con seicento professionisti va spostato
  anche quello.
- **`ordinaSenzaPunteggio` si può togliere** ora che la 072 è applicata. Non
  l'ho fatto: una rete di sicurezza si smonta con calma, non lo stesso giorno.
- **Slot sponsorizzati**: non costruiti. Quando si fanno, nello **stesso
  commit** va sostituita la frase «Nessuna posizione è a pagamento» in
  `/come-funziona#ordine` — sostituita, non cancellata — e la targhetta
  «Sponsorizzato» va **dentro** l'elenco (all. I punto 11-bis).
- **Registro delle ricerche a vuoto**: dalla **078** (la 076 e' dei doppioni,
  la 077 e' andata al prezzo). Attenzione: `search_events`
  **esiste già** dalla 026 e registra gli slug, non la frase digitata né il
  fatto che non abbia trovato niente. È un paio di colonne, non una tabella.
- **`drop column subservice_slugs`**: solo dopo che nessun codice la legge più.
- ~~La sezione 9 dei ToS pro elenca parametri che non sono più quelli.~~
  **Scritta il 12 sera, sul ramo `legal/parametri-ordinamento`** — vedi la
  sezione «Per Lucio» in cima. Il blocco «testo pronto da incollare» in
  `docs/RICERCA.md` §4 **non c'è più**: conteneva i pesi, che abbiamo deciso di
  non pubblicare. Resta da decidere se serva il preavviso art. 3(2) P2B e se
  `TERMS_VERSION` vada cambiata.

## Applicato in produzione nei giorni scorsi — resta valido

- **072, 075 e 077 applicate su Supabase**, advisor rilanciati dopo ognuna:
  pulito tranne `Leaked Password Protection`. La 077 sostituisce la stessa
  funzione, quindi non aggiunge oggetti nuovi — e l'ho verificato invece di
  darlo per scontato.
- **Roba nuova che gira da sola**: un cron alle 04:10 UTC
  (`aggiorna-segnali-professionisti`, traccia in `system_job_runs` — se un
  giorno non compare, non è girato) e un **trigger su `request_messages`** che
  a ogni risposta di un professionista riscrive la sua riga in
  `professional_signals`. È l'unica cosa che scrive quella tabella: nessuna
  policy di scrittura per nessun ruolo, di proposito.
- **Quello che ho applicato è il file meno la cornice** `begin;`/`commit;`: lo
  strumento di migrazione apre la sua transazione e una annidata litiga. Tutto
  il resto è identico al file in `main`.
- **Numeri riconciliati con Lucio**: appuntamenti con un nome in chiaro e
  nessun account **22, con 16 nomi distinti**; righe di offerta senza forbice
  **8, di cui 3 con una tariffa** — quindi senza *nessun* prezzo sono 5. Su
  entrambi i conteggi ora siamo d'accordo, verificati sul database.
- **Numerazione: la 075 sono i segnali e la 077 e' il prezzo. La 076 resta
  libera per i doppioni del catalogo**, che e' di Lucio: un numero prenotato
  resta prenotato anche se il file non c'e' ancora. Sotto la storia di come si
  era rotta.
- **Numerazione: la 075 sono i segnali, non i doppioni del catalogo.** Il
  handoff del 9 la prenotava a parole per i doppioni; nessun file era stato
  scritto, quindi non è andato perso niente — ma **i doppioni, il registro
  delle ricerche a vuoto e il `drop column` partono dalla 076**. Lezione: un
  numero di migrazione si prende dalla storia applicata **e dai rami spinti**,
  non da un documento non mergiato.
- **L'impronta a otto righe non è ancora stata confrontata con la produzione**
  (`scripts/schema_fingerprint.sql`): aperta dal 5 settembre, ora con quattro
  migrazioni in più addosso.

## Cosa è a metà — portato avanti dal 9 settembre (Lucio)

Nessuna di queste è chiusa. La sua PR #46 (conto alla rovescia, avviso sulla
pagina di accesso, `reset_account_prova.sql` in git) **è mergiata**: quella
voce non c'è più.

- **Durante un fermo l'iscrizione è nascosta, non spenta.** `/login` è anche la
  pagina di registrazione, e ogni iscrizione consuma una delle 2 email/ora del
  mailer di Supabase — il tetto di tutto il progetto. La #46 toglie il modulo
  dalla pagina, ma `signUp` parte dal browser e va dritta a Supabase: l'unico
  modo di spegnerlo davvero è «disable signups» nelle impostazioni Auth, che
  però blocca anche noi. Contro l'iscrizione per sbaglio basta; come barriera
  dura no, e va saputo prima del pilota.
- **Il 503 non è ancora provato in produzione con traffico vero.** Il fermo
  rapido funziona (provato dal vivo), ma nei log non c'è nessun 503 servito.
  Si prova in un modo solo: fermare Bob davvero, per quindici minuti, con
  qualcuno che guarda.
- **Il modulo «quali di questi lavori fai?» non esiste ancora.** Le proposte
  sono scritte — `claude/PROPOSTE_questionario_pro_09set.md`, tre opzioni,
  consigliata la B (caselle più forbice di prezzo) — e va deciso dove vive:
  onboarding **e** impostazioni, con `ready_at` che non si accende finché non
  c'è almeno un intervento dichiarato. **È la voce che vale più di tutte**:
  l'ordinamento poggia su quella dichiarazione, e le righe di oggi le ho messe
  a mano con la 070.
- **Prima del modulo vanno chiusi i doppioni del catalogo (ora dalla 076).** Il
  catalogo è stato seminato due volte, 8 voci il 3 giugno e 112 l'8 luglio con
  la 014: dove il nome nuovo era diverso dal vecchio sono rimaste **entrambe**.
  Sono otto, sei hanno un gemello quasi identico, e **sette su otto hanno già
  un professionista attaccato**. Il vocabolario della 067 è generato dal
  catalogo, gemelli compresi: chi cerca «imbiancatura» e chi cerca
  «tinteggiatura» finisce su due elenchi diversi. Un modulo costruito su questa
  lista fa scegliere fra due caselle identiche e ci mette dentro la
  dichiarazione del pro per sempre. Quadro completo nell'artifact «Catalogo dei
  lavori di Bob». **Nota utile: un controllo sui nomi identici dentro lo stesso
  mestiere trova zero** — sono gemelli di significato, non di stringa, ed è per
  questo che nessuno se n'era accorto.
- **I ToS pro, al momento dei pagamenti.** L'art. 3 pubblicato non nomina la
  data della disdetta, quindi oggi non contraddice niente; la bozza 4.3 sì.
  Vanno allineati **insieme all'apertura dei pagamenti e non dopo**, e
  modificare i termini verso utenti business richiede il **preavviso dell'art.
  3 P2B, minimo 15 giorni**. La sezione 9 sull'ordinamento **è già scritta**
  sul ramo `legal/parametri-ordinamento`: se il preavviso serve, i due
  cambiamenti viaggiano insieme e con un solo avviso.
- **Verifica dal vivo delle sei correzioni del 5 mattina e dei rami del 5
  sera**: quella della ricerca e dell'ordinamento è fatta, questa no.
- **Un errore da non ripetere** (suo, tenuto qui perché serve): una finestra di
  manutenzione di prova messa contando che il codice non fosse in produzione, e
  la PR mergiata tredici secondi dopo. Una riga di prova va messa con una
  finestra nel futuro, o non messa quando un merge è in gioco.

## Cosa è a metà — portato avanti dal 28 agosto-5 settembre

- **1 professionista su 6 ha gli orari salvati.** Gli altri cinque non mostrano
  nessuno slot: comportamento giusto, ma il cliente deve scrivere in chat. E da
  oggi quell'assenza costa punti nel ranking (5 su 10, il centro): vanno
  chiesti.
- **Gli avvisi non li vede chi non è loggato**, volutamente: la policy della
  071 è `to authenticated`. La fascia della 073 invece arriva a tutti.
- **La cancellazione account non tocca `appointments`**: `customer_id` ha
  `on delete set null`, la riga resta con dentro il nome in chiaro.
- **La chat non passa `zone` a `/api/match`**: i parametri sono solo `city`,
  `service`, `maxPrice`. Codice mio.
- **28 zone nostre contro 88 nuclei ufficiali**: decisione di prodotto aperta.
- **Tariffa nell'unità del mestiere e costi accessori**: colonne in database,
  nessuna interfaccia. La pagina azienda dice ancora «€/h» fisso. Dalla 077 il
  punteggio la conta, quindi resta solo il lato che il cliente vede — ed è il
  lato che manca.
- **Il worker maplibre non viene emesso nel bundle di Next.**
- **`Leaked Password Protection` da accendere prima del pilota** (vuole il
  piano Pro): l'unico rilievo che gli advisor continuano a dare.
- **SMTP personalizzato non configurato**: 2 email all'ora per tutto il
  progetto, e nessuna funzione che dipende dalle email di autenticazione è
  spedibile finché non c'è.
- **Da fare a mano su Supabase, aperto dal 28/08**: aggiungere
  `https://www.meetonda.com/auth/conferma` e
  `http://localhost:3000/auth/conferma` ai Redirect URLs.
- **Il clone locale tende a restare indietro**: `git fetch origin` all'inizio
  di ogni sessione, e per i numeri di migrazione guardare la storia applicata
  su Supabase **e i rami spinti**, non solo i file di `main`.
