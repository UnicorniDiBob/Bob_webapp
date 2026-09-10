# Passaggio di consegne — 10 settembre 2026 (André, con Claude)

> Sostituisce quello del 9 settembre di Lucio (PR #48) e ne porta avanti tutte
> le voci ancora aperte, nelle sezioni in fondo. HANDOFF.md si sovrascrive a
> ogni sessione, **ma quello che è a metà si porta avanti, non si butta**.
>
> Nota di processo, perché è costata due giorni: ieri e oggi i due handoff sono
> vissuti su rami mentre `main` teneva quello dell'8. Due rami che riscrivono
> lo stesso file dalla stessa base **non si mergiano in fila**: il secondo
> conflitta. La regola pratica è una sola — **il handoff si mergia il giorno
> che si scrive**, e chi arriva dopo riscrive sopra quello che trova in `main`.
> Questo file è la fusione dei due giorni, fatta a mano su `main`.

## Cosa è andato in produzione (10 settembre — il punteggio è vivo)

- **La 072 è applicata** (07:02 UTC). `professionals_score` esiste,
  `getProfessionals` non ricade più su `ordinaSenzaPunteggio`: **il punteggio
  in elenco è acceso**. Chiude la voce che il handoff del 9 lasciava aperta.
- **075 · I segnali pubblici, applicata** (07:35 UTC). La 072 era nata
  `security definer` e chiamabile da chi visita il sito, perché il tempo di
  risposta si calcola su `request_messages`. Due rilievi advisor (0028 e 0029),
  e avevano ragione. La 075 separa le due cose: `professional_signals` (una
  riga per professionista con la **mediana dei minuti di prima risposta** e su
  quante conversazioni), `aggiorna_segnali_professionisti()` con `execute`
  revocato a public/anon/authenticated, un **trigger** su `request_messages`
  che aggiorna il pro appena risponde, e il lavoro notturno
  **`aggiorna-segnali-professionisti` alle 04:10 UTC** con traccia in
  `system_job_runs`. `professionals_score` è tornata **`security invoker`**:
  non legge più niente di privato. **Advisor dopo: solo `Leaked Password
  Protection`.** I punteggi prima e dopo la riscrittura sono identici.
- **Come ordina, in due tempi.** Primo: chi ha dichiarato *quel* lavoro sta in
  un gruppo che viene prima, e nessun punteggio lo scavalca. Poi, dentro il
  gruppo, cento punti: area 20, valutazione 25, **tempo di risposta misurato**
  20, **prezzo dichiarato** 15, disponibilità 10, verifica 7, completezza 3.
  Quello che non abbiamo misurato vale il centro della scala e non toglie
  punti. Pubblicato su `/come-funziona#ordine`, spiegato in `docs/RICERCA.md`
  §4.
- **Due scelte da sapere**: i punti vanno a chi *dichiara* un prezzo, non a chi
  costa meno (premiare il numero più basso su prezzi che nessuno verifica
  premia chi scrive meno); e il numero di lavori conclusi non è più una voce a
  sé, entra come peso delle valutazioni, per non contarlo due volte e non
  punire due volte chi ha appena cominciato.
- **La richiesta ricorda quale lavoro era** (PR #42): `requests.subservice_id`
  lo scrive la ricerca e lo scrive il brief di Bob. Era la colonna vuota su
  cui poggia l'idea di dedurre le dichiarazioni dai lavori chiusi.
- **Le ancore funzionano anche a freddo** (PR #50). `VaiAllAncora` in
  `src/app/layout.tsx`: al montaggio, se c'e' un hash e il bersaglio esiste, lo
  porta in vista — con qualche tentativo ravvicinato, perche' sopra il
  bersaglio si montano da soli la fascia del fermo e la finestra degli avvisi e
  spostano il punto giusto, e smettendo al primo tocco dell'utente. Prima
  `/come-funziona#ordine` aperto da un link incollato lasciava la pagina in
  cima: il clic dentro il sito funzionava, un link condiviso no, e la sezione
  sull'ordinamento e' proprio quella che l'art. 22 co. 4-bis vuole
  raggiungibile. Verificato dal vivo: `scrollY` 809 su `#ordine` e 723 su
  `#come-funziona`, sezione a 96px, dal primo campione. **`behavior: "instant"`
  non e' cosmetico**: `globals.css` mette `scroll-behavior: smooth` su `html`,
  e un'animazione non parte in una scheda che non e' in primo piano — cioe'
  esattamente il caso del link aperto da un messaggio.
- **077 · Il prezzo conta anche quando e' una tariffa, applicata.** La voce
  «prezzo» guardava solo `min_price`: ora conta
  `coalesce(min_price, max_price, rate_amount)`. Tre righe con la tariffa
  oraria contavano come «senza prezzo». In produzione: su «pulizie ordinarie»
  Milano Clean Squad passa da 10 a 15 punti, nessun altro cambia, FOTOPRO resta
  a 0 perche' un prezzo non ce l'ha davvero. Advisor dopo: solo `Leaked
  Password Protection`.
- **Il punteggio si e' mosso da solo su traffico vero.** FOTOPRO e' passato da
  52.43 a 62.43 senza che nessuno toccasse niente: il suo tempo di risposta e'
  passato da «mai misurato» (10, il centro) a **2 minuti** (20). Il trigger
  della 075 ha registrato una risposta vera in `professional_signals` e
  l'ordine e' cambiato. E' la prima volta che la reattivita' misurata funziona
  su traffico reale e non in una prova.
- **Le due fasi si vedono all'opera.** Su «pulizie ordinarie» Milano Clean
  Squad e' primo con **71.21** davanti a IdroMilano con **71.63**: ha meno
  punti e sta davanti perche' ha dichiarato il lavoro cercato. E' la regola,
  non un difetto.
- **Verifica dal vivo FATTA** su www.meetonda.com, desktop e 390px reali — per
  la parte ricerca/ordinamento la voce aperta dal 5 settembre è chiusa. Visto
  funzionare: i suggerimenti dal server («bagno allagato» → *Emergenza
  allagamento, idraulico*), la targhetta «Stai cercando», l'URL che si
  canonicalizza in `?q=…&service=idraulico`, la scheda che dice «Offre
  emergenza allagamento», **l'ordine in pagina identico al punteggio SQL**
  (71.63 / 68.77 / 66.66 / 66.21 / 64.66 / 52.43), il link «Come ordiniamo i
  risultati» che atterra sulla sezione esatta, e a 390px `scrollWidth` esatto
  390 su entrambe le pagine, zero elementi più larghi del telefono.

## Cosa è a metà — mio

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

## Cosa ho applicato in produzione che l'altro deve sapere

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
