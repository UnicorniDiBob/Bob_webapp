# Passaggio di consegne — 17 settembre 2026 (Lucio, con Claude)

> Aggiunge la giornata di oggi in cima. Le voci del 14 settembre e quelle
> portate avanti restano sotto, invariate.

## Cosa ho fatto — Lucio (17 settembre)

Ramo **`feat/mappa-88-nil-e-base-pro`**, 8 commit, PR aperta. **Quattro
migrazioni applicate in produzione oggi: 084, 085, 086, 087.** Advisor
rieseguiti dopo: nessun rilievo nuovo, resta solo il `Leaked Password
Protection` di sempre (vuole il piano Pro).

- **084 — Milano da 28 zone a 88 nuclei.** `city_zones` è ora la griglia dei
  NIL del Comune (ds964, CC-BY), centro calcolato dal poligono. I 28 nomi corti
  restano in `src/lib/zones.ts` (area di André, non toccata) e vivono come
  `city_zones.group_slug`: `coverage_keys_for` emette anche il gettone del
  gruppo, quindi una richiesta che dice «Navigli» incontra ancora chi copre
  Ronchetto sul Naviglio. **In produzione: 88 zone, 35 con gruppo, 28 gruppi.**
  L'unica copertura esistente si è ricalcolata da sola sul cerchio: 47 nuclei,
  57 gettoni pubblicati.
- **085 — la base del professionista.** `professionals` ha comune (codice
  ISTAT), provincia, regione e CAP. Colonne che accettano il vuoto: **chi era
  già iscritto non si blocca**, gli arriva una voce nuova nella checklist del
  profilo. Nel modulo di iscrizione il CAP è obbligatorio e il comune si sceglie
  da elenco, non si scrive.
- **086 — i 7.904 comuni italiani in database**, con `comuni_nel_cerchio()` e
  `cities.comune_istat`. In produzione: 7.904 righe, 7.856 con coordinate, 133
  in provincia di Milano, Milano con 42 CAP.
- **087 — la copertura impara il comune.** Il cerchio produce anche i comuni che
  tocca e il gettone `comune:<istat>` entra nel confronto. Un cerchio che tocca
  Milano NON dichiara «comune: Milano»: lì vale la griglia fine.

- **La mappa esce da Milano**: confini comunali ISTAT (CC BY 4.0) in 107 file,
  uno per provincia, in `public/geo/province/`. Le aree si scelgono
  cliccandole; il click resta della mappa e a dire quale area è stata toccata è
  un point-in-polygon, perché tracciati SVG che prendono gli eventi rompono il
  trascinamento.

- **L'Italia sotto la mappa** (ramo `feat/mappa-italia`, da mergiare).
  `public/geo/italia.geojson`: 110 forme di provincia, 138 KB compressi,
  caricate una volta sola e accese a ogni ingrandimento. Sopra, i comuni delle
  province che stanno nell'inquadratura — **fino a sei insieme, non più una
  sola**: chi lavora a Monza copre anche Milano e Como. Sotto lo zoom 8 i
  comuni non si caricano affatto. Le genera
  `scripts/build_italia_province.py`; 13 prove nuove in `src/lib/italia.test.ts`.
- **`/admin/copertura`** (stesso ramo): mappa + tabella dei professionisti per
  comune, con l'elenco dei **buchi** (richieste senza copertura) e due export,
  SVG della mappa e CSV della tabella, per le presentazioni. Solo admin, non
  CS. **Da verificare in locale e in produzione dopo il merge: non ho potuto
  avviare il server di sviluppo da questa sessione.**

- **La mappa strappava, e adesso no** (stesso ramo). Cinque misure: i comuni
  non si disegnano sotto lo zoom 8 (erano una macchia grigia sul nord Italia);
  i vertici si proiettano una volta sola in Mercatore e a ogni fotogramma resta
  una moltiplicazione; un tracciato SVG per piano invece di uno per forma (da
  ~880 `setAttribute` a tre); si arrotonda al pixel saltando i doppioni; e il
  riquadro filtra prima del point-in-polygon, che girava a ogni movimento del
  mouse. Sul banco di prova: **12,2 → 1,0 ms** a vista nazionale, **5,2 → 0,2**
  a vista cittadina, senza contare il DOM.

## Fine giornata: cosa è applicato, e una deriva trovata

**Applicate tutte e sei: 084, 085, 086, 087, 088, 089.** Advisor rieseguiti dopo
l'ultima. Verificato sui dati veri: 88 zone a Milano, 7.904 comuni, tutte e 10
le richieste esistenti hanno il loro comune (Milano), `professionals_score` ha
la firma nuova a cinque argomenti. Il sito è in produzione: `/come-funziona`
dice «poi chi copre il tuo comune» e `/geo/province/MI.geojson` risponde.

**IL CONTROLLO DI DERIVA DICE CHE LA PRODUZIONE È INDIETRO DI TRE MIGRAZIONI.**
Ricostruito lo schema dai soli file del repo e confrontato con la produzione,
mancano in produzione:

| cosa | da dove | stato in produzione |
|---|---|---|
| `requests.quote_mode`, `requests.scope` | 082 | assenti |
| `subservices.quote_level`, `quote_fields`, `superseded_by` | 082/081 | assenti |
| tabella `subservice_migration_review` | 081 | assente |
| funzione `canonical_subservice_id` | 081 | assente |
| deduplicazione dei 7 sotto-servizi doppi | 081 | non fatta: 120 righe |

Cioè **081, 082 e 083 sono su `main` ma non sono state applicate**. Il codice del
quote intake è quindi deployato sopra uno schema che non ha le sue colonne: se
una pagina le legge, risponde errore. Non è roba nostra — è l'iniziativa quote
flow di André — ma andava detta il giorno in cui si scopre, non il giorno in cui
un cliente ci sbatte contro.

**Due rilievi nuovi degli advisor**, e sono la stessa cosa scritta due volte:
`professionals_score` è `SECURITY DEFINER` ed è chiamabile da `anon` e da
`authenticated` via `/rest/v1/rpc`. Non è una novità della 089: i permessi sono
identici a quelli che la 072 aveva dato il 13 settembre, e la funzione serve
proprio a far ordinare gli elenchi pubblici. Va deciso se lasciarla così
(scrivendo perché, come si è fatto per le funzioni della 057) o spostarla.

## Cosa deve sapere André

- **Le quattro migrazioni sono già applicate in produzione**, e il codice che le
  usa è sulla PR, non ancora in `main`. Fino al merge il sito vive con lo schema
  nuovo e il codice vecchio: regge, perché tutte le colonne nuove accettano il
  vuoto e le funzioni vecchie continuano a esistere.
- **Per applicare il seed dei comuni ho acceso l'estensione `http` e l'ho spenta
  subito dopo** (il canale delle migrazioni non regge 731 KB in una volta; il
  file è pinnato al commit c4b500e). Verificato che sia spenta: `select count(*)
  from pg_extension where extname='http'` torna 0.
- `src/lib/zones.ts` **non è stata toccata**: il percorso del cliente funziona
  esattamente come prima.
- **Trappola nuova, vale per tutti:** la 084 contiene un `create or replace` di
  `private.coverage_keys_for`. Rigiocarla dopo la 087 riporta indietro la
  funzione e i gettoni escono monchi, senza un solo errore.

## Cosa è a metà — 17 settembre

- **`professionals_score` (072) non pesa i gettoni `comune:`**: oggi un incontro
  per comune ordina come se valesse zero. È il prossimo giro.
- **La chat del cliente offre ancora tre città.** Finché non cambia, un
  professionista che copre Bergamo non riceve richieste da lì. Il CAP nella
  richiesta però esiste già (046): da lì al comune è una riga, e quella parte si
  può fare senza toccare `BobChat` — il passo «in che città?» invece è di André.
- **16 comuni senza confine disegnato** (fusioni successive al nostro elenco
  ISTAT 2020) e **26 col centro fuori dalla propria forma** (comuni fatti di
  pezzi separati): entrambe scritte in `docs/NOTE_E_DECISIONI.md`.
- **La riga RoPA A22** («Base del professionista») è scritta ma **da rileggere**.

---

# Passaggio di consegne — 14 settembre 2026 (Lucio, con Claude)

> Sostituisce quello del 12 settembre sera e ne porta avanti tutte le voci
> ancora aperte, comprese quelle di André. HANDOFF.md si sovrascrive a ogni
> sessione, **ma quello che è a metà si porta avanti, non si butta**.

## Cosa ho fatto — Lucio (14 settembre)

Ramo **`feat/verifica-finestra-e-testi`**, **nessuna migrazione, niente
applicato in produzione oggi**. `npx tsc --noEmit` e `npm run lint` passano; la
build la fa la CI.

- **I testi del ricontrollo non promettono più quello che la regola non
  mantiene.** Tre righe su quattro di `MOTIVO_RICONTROLLO_TESTO` dicevano che
  il badge non si tocca finché non lo guarda una persona: dalla mig 080 (13/09)
  non è più vero — `verification_badge_until` spegne l'etichetta alla fine della
  finestra anche se nessuno di noi ha aperto il caso. Adesso dicono quello che è
  rimasto vero: il **livello** lo toglie solo una persona, con motivazione
  (art. 22 GDPR), e l'etichetta torna da sola appena il controllo passa.
- **La finestra ha una data, e il pro la legge.** `fraseEtichettaFinoAl()` in
  `src/lib/vat.ts` scrive in un posto solo il giorno in cui l'etichetta smette
  di comparire: la usano il riquadro verde e quello del ricontrollo in
  `VatVerification`, e la notifica del ricontrollo, che prima aveva
  `quando: null` e nessuna data nel testo. Un preavviso senza data non è un
  preavviso (Reg. P2B art. 4).
- **La finestra dell'ultima settimana vale anche sui ricontrolli.**
  `ScadenzaVerificaPopup` guardava solo `vat_expires_at`: su una cessazione —
  che apre il caso subito e spegne l'etichetta sette giorni dopo, mesi prima
  della scadenza annuale — non si apriva mai. Ora la data è quella di
  `scadenzaBadge()`, la stessa che spegne il badge, e
  `scadenza_verifica_vista_al` conserva quella.
- **Deciso e scritto in `docs/NOTE_E_DECISIONI.md` (voce 14/09), non
  costruito**: cosa racconta la barretta dell'SLA, che quando sforiamo non è
  dovuto nulla, e che i piani con quello che comprendono vanno nel contratto che
  il pro accetta **quando sottoscrive l'abbonamento** — non in una policy di
  registrazione. Con la forma che serve per le clausole dell'art. 1341 c.c.

## Cosa ho fatto — Lucio (12 settembre, tarda sera)

Ramo **`feat/calendario-tutto-schermo-orari-liberi`**, 1 commit, **non
mergiato e non in produzione**. Nessuna migrazione.

- **Il calendario dentro la proposta in chat.** `/messaggi` → «Proponi un
  appuntamento» ora monta `ProCalendar`: il dialog passa da `max-w-sm` a
  `max-w-3xl` con testa e piede fissi e corpo scrollabile, e il click su uno
  spazio libero riempie data e ora. Gli appuntamenti si leggono con `select("*")`
  e da 120 giorni indietro, se no mese e anno sarebbero vuoti.
- **Tasto a tutto schermo** (`cal-fullscreen`): pannello in `createPortal` su
  `document.body`, `z-[70]`, Esc per uscire, `body` bloccato mentre è aperto.
  Non usa l'API fullscreen del browser — su iOS non funziona sugli elementi
  normali. Con l'espansione cambiano le misure: celle del mese a
  `calc((100vh - 15rem) / righe)` (104px da ridotto, erano 76), giorni dell'anno
  da `h-5` a `h-8`, griglia ore a `calc(100vh - 12rem)`, sei appuntamenti per
  cella invece di due.
- **Le quattro viste in un pannello apribile** al posto dei quattro bottoni, con
  scorciatoie **D / W / M / Y** (disattivate dentro input, textarea, select e
  contenteditable).
- **Durata libera, in ore + minuti**, al posto della tendina 30/60/90/120 — sia
  nella proposta in chat sia in `AppointmentDialog`, dove sparisce anche il
  minimo di 15 minuti. Un orario **fuori dalle fasce dichiarate** è un avviso
  ambra, non più un blocco; la guardia sulla doppia prenotazione resta un blocco.

### Chiuso: mergiato, deployato, verificato dal vivo

PR **#67 mergiata**, `main` a `ded5373`, deploy di produzione **READY**. La build
l'ha fatta la CI: dal ponte del desktop non era eseguibile (Next va in `SIGBUS`
sul filesystem montato, e **fallisce identico su `main` pulito**, quindi non era
il codice). In locale erano passati `npx tsc --noEmit` e `npm run lint`.

Verificato su www.meetonda.com con un account pro, a 1440px e a 390px:

- pannello delle viste con le quattro voci e le lettere D/W/M/Y; la scorciatoia
  da tastiera cambia vista e non scatta dentro i campi;
- tutto schermo: pannello `fixed inset-0` a `z-70` figlio di `<body>`, copre
  tutta la finestra, `body` bloccato mentre è aperto e ripristinato all'uscita,
  Esc chiude e la vista scelta resta;
- mese a 1440: griglia 1334px, colonna di fianco sparita, celle 190×104 —
  espanso 199×132, il mese intero sta nella pagina; anno espanso: 12 mesi
  visibili tutti insieme;
- dialog «Proponi un appuntamento»: 768px, calendario dentro, click su uno
  spazio libero riempie data e ora («Scelto: lunedì 14 settembre alle ore 09:00»);
- durata libera: 0h20 accettata, 2h20 accettata, 0h00 disabilita l'invio;
- fuori fascia: 05:00 di lunedì mostra l'avviso ambra **e lascia l'invio attivo**;
  09:00 non lo mostra;
- a 390px: dialog 358px con margini da 16, nessuno scorrimento orizzontale, barra
  del calendario su una riga sola, mese a tutto schermo leggibile.

Console pulita (un solo 401 di refresh auth, pre-login, non correlato).

### Quello che è a metà

- Niente, su questo pezzo.

## Cosa ho fatto — Lucio (12 settembre, sera)

Tutto sul ramo **`feat/piani-plus-matrice`**, 15 commit, mergiato con `main` di
oggi pomeriggio (il clone locale era rimasto 42 commit indietro). **In
produzione non ho messo niente, e nessuna migrazione è applicata.**

- **Il listino è una matrice sola** (`src/lib/piani.ts`): ogni funzione è una
  riga con tre stati — c'è / non c'è / in arrivo — e gli elenchi puntati delle
  pagine si generano da lì. `/per-i-professionisti` mostra la tabella dentro il
  kit nuovo, al posto delle tre schede. Il piano **«Bob Pro» si chiama «Bob
  Plus»**: cambia solo l'etichetta, l'id nel database resta `pro`.
- **Il badge di verifica dice «Verificato» e basta**, non più «Pro»/«Pro+»: i
  due livelli restano distinti dentro, lo staff ha `VERIFICATION_LABEL_STAFF`.
- **La verifica dura un anno** (`078_scadenza_verifica.sql`): data, trigger che
  la scrive quando si concede un livello, backfill una tantum per chi è già
  verificato. Preavviso a 30 giorni nella campanella e finestra nell'ultima
  settimana lavorativa. **Alla scadenza il badge cade da solo** — decisione di
  Lucio, è una scadenza dichiarata e preavvisata, non un giudizio.
- **Il ricontrollo ha una coda sua** (`079_ricontrollo_verifica.sql`): stato
  `recheck` + motivo (scadenza | cessazione | procedura | intestazione), sezione
  **Ricontrollo** in admin sopra la coda delle prime richieste, e il giro
  notturno che rinnova da solo chi il VIES conferma ancora e apre un caso quando
  un numero che prima confermava non lo conferma più. Chi era stato verificato a
  mano non viene richiamato: per lui il VIES non dice niente di utile.
- **SLA della coda dichiarato a 5 giorni lavorativi** (`SLA_VERIFICA_GIORNI_LAVORATIVI`),
  con la barretta di stato nella pagina della verifica: ricevuta → in gestione →
  esito, più «documenti richiesti».
- **Area di lavoro**: lo stato del profilo si richiude in un pallino verde sopra
  il calendario quando non manca niente; calendario con quattro viste (Giorno,
  Settimana, Mese, Anno) e l'anno sempre scritto; mese e anno prendono tutta la
  pagina; la finestra «nuovo appuntamento» contiene il calendario vero, si
  sceglie cliccando lo spazio libero.

## Cosa è a metà — Lucio (12 settembre, sera)

- **Il calendario nel piano Free.** La tabella lo toglie al Free, il prodotto lo
  dà ancora a tutti. È l'unico punto dove la pagina dice una cosa e l'app ne fa
  un'altra: vale anche per recensioni e risalto nei risultati.
- **La caduta del badge non è mai stata esercitata su dati veri.** La regola
  c'è (mig 080, applicata) e il giro notturno gira, ma l'unico pro verificato
  scade il 12/09/2027: il cron esamina 0 righe ogni notte e nel repo non esiste
  nessun test. È viva, non è provata.
- **La barretta dell'SLA non racconta ancora il ciclo deciso il 14/09**: dice
  ricevuta → in gestione → esito, non distingue «il controllo automatico non è
  passato» da «stiamo revisionando i documenti» e non dice niente quando
  sforiamo. Spec in `docs/NOTE_E_DECISIONI.md`, voce 14/09.
- **Lo sforamento dell'SLA non esce dalla pagina admin**: la coda mostra «SLA
  sforata di N giorni» e mette i casi sforati in cima, ma nessuno viene
  avvisato e non succede niente se nessuno apre quella pagina. Il giro notturno
  che già gira è il posto dove contarli.
- **I ToS pro non dicono niente dell'SLA né degli effetti del declassamento**:
  `docs/legal/SCHELETRO_ToS_Professionisti.md` ha ancora `[DA INSERIRE]` su
  «SLA di esame». Tocca un testo legale: cambia la versione dei termini.
- **Richieste → In corso → Conclusi** e la cancellazione delle chat concluse:
  scritte in `docs/NOTE_E_DECISIONI.md`, non costruite. Dipendono dalla macchina
  a stati di `request_professionals`, che non viene mai aggiornata dopo
  l'inserimento.
- **«Prossimi appuntamenti» e «Impegni del giorno»** sono tornati nella colonna
  di destra dopo una prova senza: se si decide di toglierne uno, sta in git.

## Cosa ho applicato in produzione che l'altro deve sapere — Lucio

- **PR #65 mergiata**, `main` a `03fb047`, Vercel ha già deployato: su
  www.meetonda.com i piani si chiamano Free / **Bob Plus** / Bob Business e
  `/per-i-professionisti` mostra la tabella riga per riga. Verificato dall'esterno.
- **Migrazioni 078 e 079 applicate** su Supabase, in quest'ordine, dopo il merge.
  Controllato dopo: le quattro colonne esistono
  (`professional_verification.vat_expires_at`, `recheck_reason`,
  `recheck_opened_at`, `profiles.scadenza_verifica_vista_al`), il trigger
  `trg_set_verification_expiry` è installato, e il backfill ha dato una scadenza
  all'unico professionista verificato: **12 settembre 2027**. Da quella data in
  poi il ricontrollo tocca a noi.
- **Advisor di sicurezza rilanciati dopo le due migrazioni: nessun finding
  nuovo.** Resta solo la leaked password protection disattivata, che chiede il
  piano Pro di Supabase ed è già segnata nel Piano.

### La lezione di stasera, che vale più delle righe qui sopra

Fra il merge e l'applicazione delle migrazioni c'è stata una finestra in cui il
codice in produzione chiedeva colonne che nel database non esistevano ancora, e
non è passata inosservata: `/impostazioni/verifica` diceva **«Non verificato» a
un professionista verificato** (la select falliva e la riga tornava vuota) e la
coda partita IVA in admin risultava **vuota** per lo stesso motivo. Le due
guardie che avevo messo — la campanella che tace se la lettura fallisce — hanno
retto; le due pagine no.

La regola scritta dice «il file della migrazione sta nella PR **prima** che la
migrazione sia applicata», e l'abbiamo rispettata. Quello che manca alla regola
è la seconda metà: **fra il merge e l'applicazione non deve passare tempo**, e
se passa va messo in conto che quelle pagine sono rotte. Il modo per non
rischiarlo è applicare la migrazione **prima** di mergiare il codice che la usa,
quando è retrocompatibile — e queste due lo erano: aggiungono colonne, non ne
tolgono.

## Portato avanti dal 12 settembre, mattina (André) — andato in produzione

Niente Supabase, niente migrazioni, nessun advisor da rilanciare. Solo
interfaccia e un componente nuovo.

- **Blocco B chiuso: una larghezza sola, 1600px, su ogni pagina.**
  `container-bob` è `100rem` e vale per tutto — pubblico e applicazione. In rem
  e non in px, così cresce se qualcuno ha alzato il testo nelle impostazioni del
  browser.
- **Due strade abbandonate, tutte e due mie**, e vale la pena sapere perché per
  non ripercorrerle:
  - *Il doppio livello* (1120 per il sito, 1600 per l'applicazione) costringeva
    a notare che una pagina è diversa dall'altra. Via `container-app`, via
    `src/lib/layout.ts`, via la logica sul percorso in `Header`, `ProBanner` e
    `CancellazioneBanner`. **`Footer` è tornato componente server.**
  - *La scala tipografica sul viewport* (`clamp` sulla base in `html`) era
    peggio: si rompeva dove il codice è in px — il calendario sarebbe diventato
    **più** affollato, non meno — e scavalcava la scala che l'utente ha già
    scelto nel sistema operativo.
- **Una regola nuova, che era una correzione vera.** Il contenitore decide la
  **cornice** e dipende solo dalla pagina; la misura di lettura si applica al
  **contenuto dentro**, mai al contenitore. `/notifiche` e `/supporto`
  scrivevano `container-bob max-w-2xl` e stringevano la cornice a 672px
  trascinandosi dietro intestazione e piede: passando dalla dashboard alle
  notifiche la pagina saltava da 1600 a 672. Ora usano `.colonna-lettura` su un
  blocco interno.
- **Il calendario è stato guardato dal vivo e regge**: con le etichette a 11px e
  l'ora a 64px un appuntamento da mezz'ora tiene le sue righe. Era l'unico punto
  aperto del blocco A. **Blocco A chiuso.**
- **Bob ha una faccia.** `src/components/Bob.tsx`: testa grande in proporzione
  da cartone, salopette sopra la camicia, scarponi di cuoio. Deciso guardando
  cinque stili e quattro tenute. Il ragionamento sta in
  `claude/MASCOT_bob_12set.md`.

## Cosa è a metà — André (12 settembre, mattina)

- ~~`Bob.tsx` è in `main` ma non lo usa nessuna pagina.~~ **Chiusa il 12 sera**:
  Bob è sulla home, su `/come-funziona` e su `/per-i-professionisti`.
- ~~La home nuova esiste solo come mock.~~ **Chiusa il 12 sera**: è in
  produzione, con le fasce, le illustrazioni e le animazioni allo scorrimento.
- ~~Le scene attorno a Bob vivono solo nel mock.~~ **Chiusa il 12 sera**: stanno
  in `SceneBob.tsx`, `ScalaDeiMestieri.tsx`, `BobConCariola.tsx`.
- ~~Il footer a quattro colonne esiste solo nel mock, con quattro link morti.~~
  **Chiusa il 12 sera**: il footer è in produzione e tutti e tredici i link
  puntano a rotte che esistono — verificato, i quattro link morti del mock non
  sono mai stati spediti.
- **Le altre tre tenute di Bob** (camicia e cintura, alta visibilità, polo e
  grembiule) sono disegnate ma non sono nel repo. Servono quando si faranno le
  sezioni per mestiere: il grembiule racconta le pulizie meglio del gilet.
- **La palette del marchio resta indaco e giallo.** Ne sono state guardate sei.
  Se un giorno si cambia, non è la mascotte: sono i pulsanti, i chip, il logo,
  il calendario, l'anteprima sui social. **Va deciso prima del pilota, non
  dopo.**

## Cosa è a metà — André (12 settembre, sera)

> **Queste voci erano andate perse.** La sera del 12 abbiamo scritto
> `HANDOFF.md` tutti e due: Lucio alle 17:28, André alle 17:59. Il file si
> sovrascrive a ogni sessione, quindi è arrivata in `main` una versione sola e
> l'altra è rimasta sul ramo `design/pagina-pro`. Recuperate il 13 mattina.
> **Il formato va cambiato**: le sezioni per persona che ci sono qui sopra sono
> la strada giusta, ma finché il file è uno e si riscrive, chi salva per secondo
> perde. La proposta minima è che ognuno tocchi solo la propria sezione.

- **La decisione sui termini è di Lucio e non è ancora presa.** `TERMS_VERSION`
  è ferma a `2026-07-v1` di proposito. La sezione 9 sull'ordinamento è stata
  riscritta ed è in produzione: se quella correzione conta come modifica dei
  termini ai sensi dell'**art. 3(2) P2B**, ai professionisti va dato un
  preavviso di almeno 15 giorni. Secondo noi è una rettifica per rendere
  accurata una dichiarazione, non un obbligo nuovo — ma non è una decisione da
  prendere di straforo dentro un commit di design. **Finché non è presa, la
  versione dei termini dice il falso: il testo è cambiato e il numero no.**
- **`.card` è usata 138 volte da una definizione sola** in `globals.css`.
  Cambiare quella definizione cambia quaranta pagine in un pomeriggio, comprese
  quelle che nessuno ha ancora toccato. **È la cosa più economica del progetto**
  e non è ancora stata fatta.
- **Il blocco C dell'audit è stato guardato da vicino: non così, e non prima di
  gennaio.** Le sei finestre non sono un problema solo.
  - Il difetto vero è che **15 file ricopiano a mano `fixed inset-0 z-50`** con
    la loro copia dell'`useEffect` per Escape e per il blocco dello scroll: non
    esiste nessun componente `Modal` condiviso. `TermsDialog.tsx` è l'unico
    fatto bene — usa l'elemento nativo `<dialog>`, che dà focus trap, Escape e
    blocco dello scroll gratis — e nessuna delle altre lo riusa.
    `InstantBookingDialog` (667 righe, tre passi, la funzione del piano a
    pagamento) non ha né Escape, né blocco dello scroll, né `role="dialog"`.
  - **Quella che merita davvero una rotta è solo la prenotazione**, ed è un bug
    di conversione, non di stile: a `InstantBookingDialog` riga 357, se non sei
    loggato il pulsante porta a `/login?returnTo=` + il *pathname*, cioè la
    pagina del professionista. Dopo il login torni sul profilo, la finestra è
    chiusa, e quello che avevi scritto è perso.
  - `QuoteDialog` e `RequestDialog` **non si possono spostare da sole**: vivono
    dello stato di `BobChat`, che è una macchina a **9 stati tutta in
    `useState`** sulla home, senza nessuna rappresentazione nell'URL.
  - Due ostacoli da sapere prima di aprire una rotta nuova: `next.config.mjs` ha
    `/dashboard/:sezione+` → `/impostazioni/:sezione+`, quindi **ogni rotta nuova
    sotto `/dashboard/` finisce su una pagina che non esiste**; e
    `middleware.ts` protegge per **prefisso** (`ROTTE_PRIVATE = ["/dashboard",
    "/messaggi", "/impostazioni"]`), quindi una `/prenota/...` nuova nasce
    **pubblica** finché non la aggiungi lì.
- **Le pagine che restano da portare nello stile nuovo**, in ordine: `/servizi`
  e `/citta` (corte, 65 e 90 righe, quasi identiche — si fanno in una passata),
  `/professionisti`, `/servizi/[slug]`. **Poi l'area privata, con un criterio
  diverso**: la dashboard non deve somigliare alla home. Ci lavori dentro, non
  la guardi. Quello che passa di là è la somiglianza di famiglia — stesso
  trattamento delle schede, stesso ritmo dei titoli, **Bob negli stati vuoti** —
  non l'impaginazione a fasce.
- **L'animazione della scala dei mestieri non è mai stata vista muoversi.** È
  verificato che il calcolo risponde alla posizione (angoli diversi a quote
  diverse), ma non è stato possibile far scorrere la pagina da remoto:
  `scrollTop` non si muove attraverso l'estensione su localhost. **Va guardata
  con gli occhi.** Se è troppo o troppo poco, sono due colonne di numeri in cima
  a `ScalaDeiMestieri.tsx`: `ampiezza` quanto ampio il gesto, `passo` quanto
  veloce — più piccolo è il passo, più veloce va.
- **`/come-funziona` è passata da quattro passi a tre.** I vecchi 3 e 4
  («confronti prezzo e rating», «contatti chi preferisci») erano lo stesso
  momento raccontato due volte, ed erano già uniti in home. Niente è stato
  tolto: il contenuto vive nel terzo. **È una decisione di contenuto, non di
  stile**: se non convince, si torna indietro.
- **L'ancora `#come-funziona` su `/per-i-professionisti` non la linka più
  nessuno in pagina.** Il bottone che ci puntava è stato tolto; l'`id` è rimasto
  perché un link incollato o un segnalibro lo usano ancora.
- **Due righe di copy sono state scritte da noi** su `/per-i-professionisti`:
  l'occhiello «I vantaggi» e il titolo «Cosa cambia, per te». Quella sezione non
  aveva titolo e i quattro blocchi partivano da `h3` sotto un `h1`.
- **Il verde delle banconote (`#4ec27a`) non è nella palette** e vive solo dentro
  `BobConCariola.tsx`. È voluto: i soldi devono leggersi come soldi, non come un
  pezzo di Bob. Se un giorno serve altrove, va deciso allora — non ereditato di
  nascosto da un'illustrazione.

## Applicato in produzione da André il 12 settembre — resta valido

- **Niente su Supabase oggi.** Solo deploy Vercel da `main`.
- **`container-bob` è l'unico contenitore.** Chi scrive una pagina nuova usa
  quello e basta: `container-app` e `src/lib/layout.ts` **non esistono più**. Se
  li trovi citati in un documento, il documento è vecchio.
- **Per stringere il testo si usa `.colonna-lettura`** su un blocco interno, mai
  `max-w-*` sul contenitore. Il perché è scritto in `globals.css` accanto alla
  classe.
- **`Bob.tsx` è un server component**: niente `useId`, niente `<defs>`/`<use>`
  (gli id lì dentro sono globali al documento e due Bob nella stessa pagina
  collidono), niente JavaScript spedito al browser. Le braccia stanno fuori dal
  corpo apposta: una posa nuova è una rotazione, non un disegno nuovo.

## Cosa è a metà — portato avanti dall'11 settembre (André)

- **Il calendario non è mai stato guardato dal vivo.** È dietro il login, che
  la sessione di lavoro non aveva. È l'unico punto a rischio di tutto il blocco
  A: **11px dentro un blocco da mezz'ora**. Se due righe non entrano, si alza
  ancora `HOUR_PX_WEEK` in `src/lib/calendar.ts` o si riportano le etichette a
  10px lasciando tutto il resto — una riga in entrambi i casi. **Da fare al
  primo login.**
- **Il blocco B dell'audit — la larghezza — è il prossimo, e ha una scadenza
  vera.** Oggi `container-bob` è 1120px fissi e serve sia le pagine pubbliche
  sia la dashboard: su uno schermo da 1840px **720px sono margine vuoto, il 39%
  dello schermo**, e il calendario ne riceve 676. I margini sono più larghi del
  calendario. Serve un `container-app` largo per dashboard, messaggi e
  impostazioni, lasciando `container-bob` a 1120 per le pagine pubbliche, dove
  è giusto. **Ogni schermata costruita da qui a gennaio nasce dentro il guscio
  attuale**: fatto adesso, quello che viene dopo nasce giusto; fatto a
  dicembre, si rifà quello che c'è in mezzo.
- **Il blocco C — le modali che diventano pagine — è il costoso.**
  `InstantBookingDialog` sono 667 righe dentro `max-w-lg` (512px);
  `QuoteDialog`, `RequestDialog` e `AppointmentDialog` stanno fra 320 e 345
  righe dentro 448px. Una modale va bene per «sei sicuro?», non per un flusso
  di lavoro senza URL e senza tasto indietro. Tocca routing e struttura: 1–2
  settimane, e **non deve atterrare nelle ultime 4–6 settimane prima del
  pilota**.
- **Restano 6 `font-mono`** che cadono sul mono di sistema. Schibsted non ha un
  monospaziato; l'abbinamento naturale è IBM Plex Mono o JetBrains Mono. Non
  urgente, ma è l'ultimo pezzo di tipografia non scelta.

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
- **La sezione 9 dei ToS pro elenca parametri che non sono più quelli** e non
  nomina il criterio che oggi viene primo. Il testo pronto da incollare è in
  `docs/RICERCA.md` §4. È un file dell'area di Lucio: va nel suo PR, e insieme
  all'apertura dei pagamenti, col preavviso art. 3 P2B.

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
  3 P2B, minimo 15 giorni**. Nello stesso giro va allineata la sezione 9
  sull'ordinamento (testo pronto in `docs/RICERCA.md` §4).
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
