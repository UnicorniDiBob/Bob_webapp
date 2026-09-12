# Passaggio di consegne — 12 settembre 2026, sera (Lucio, con Claude)

> Aggiornato dopo il merge della PR #65 e l'applicazione delle migrazioni.

> Sostituisce quello dell'11 settembre e ne porta avanti tutte le voci ancora
> aperte, nelle sezioni in fondo. HANDOFF.md si sovrascrive a ogni sessione,
> **ma quello che è a metà si porta avanti, non si butta**. Scritto e mergiato
> lo stesso giorno.

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

### Quello che è a metà

- **`npm run build` non l'ho eseguito.** Il clone è stato lavorato attraverso il
  ponte del desktop: la build di Next va in `SIGBUS` sul filesystem montato, e
  **fallisce allo stesso modo su `main` pulito**, quindi non è il codice. Passati
  invece `npx tsc --noEmit` e `npm run lint`, entrambi puliti. **La build va
  rifatta in locale prima del merge**, e comunque la fa la CI sulla PR.
- **Nessuna verifica live.** Non ho potuto avviare `npm run dev` (stesso motivo).
  Restano da guardare con gli occhi: il calendario dentro il dialog a 390px, il
  pannello a tutto schermo su desktop, e la vista mese espansa con un mese pieno.

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
- **Alla scadenza il badge non cade ancora davvero**: mancano la regola di
  lettura sull'etichetta pubblica e il giro che porta le righe scadute in
  Ricontrollo.
- **Quanto può restare aperto un caso di cessazione** col badge acceso: non
  deciso. Oggi dipende da quanto ci mette qualcuno a guardarlo.
- **L'SLA non è misurato**: manca il timestamp di ingresso in coda, la regola di
  escalation e la riga nei ToS pro.
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

- **`Bob.tsx` è in `main` ma non lo usa nessuna pagina.** Entra in scena quando
  si costruisce la home. È voluto, ma è anche la situazione da tenere d'occhio:
  un componente che nessuno usa marcisce in fretta.
- **La home nuova esiste solo come mock, non come codice.** La direzione è
  decisa e non è la larghezza: lo schermo si riempie **di contenuto** — fasce a
  tutta larghezza che si alternano (chiara, grigia, indaco piena, gialla),
  illustrazioni grandi, animazioni allo scorrimento. Da fare: riscrivere
  `src/app/page.tsx`, il footer nuovo, le animazioni. **Non è una serata.**
- **Le scene attorno a Bob vivono solo nel mock**: il telefono del passo 1, le
  schede del passo 2, il fumetto del passo 3, il telefono della sezione app.
  Vanno portate nel repo insieme alla home.
- **Il footer a quattro colonne** (Esplora, Supporto, Professionisti, Bob
  Italia) esiste solo nel mock. Quattro voci puntano a pagine **che non
  esistono**: *Requisiti minimi*, *Lavora con noi*, *Blog*, *Contatti stampa*.
  O si creano o si tolgono dal footer — non si spediscono link morti.
- **Le altre tre tenute di Bob** (camicia e cintura, alta visibilità, polo e
  grembiule) sono disegnate ma non sono nel repo. Servono quando si faranno le
  sezioni per mestiere: il grembiule racconta le pulizie meglio del gilet.
- **La palette del marchio resta indaco e giallo.** Ne sono state guardate sei.
  Se un giorno si cambia, non è la mascotte: sono i pulsanti, i chip, il logo,
  il calendario, l'anteprima sui social. **Va deciso prima del pilota, non
  dopo.**

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
