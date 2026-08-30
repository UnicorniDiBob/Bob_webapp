# Passaggio di consegne — 30 agosto 2026

## Cosa ho fatto

**La 062 è applicata in produzione** (30/08, 10:13 UTC). Sei professionisti su
sei hanno `ready_at` valorizzata: lo stato «compari nelle ricerche» adesso lo
scrive il database e non più il browser. Gli advisor rilanciati subito dopo
hanno acceso due WARN nuovi — le due funzioni-trigger della 062 sono
`SECURITY DEFINER` in `public` e quindi esposte su `/rest/v1/rpc/` — e la
**migrazione 063** le revoca. È la stessa riga che hanno già tutte le altre
funzioni-trigger del progetto (032, 038, 047, 048, 049, 052): nella 062
mancava, e nulla lo ha impedito perché nulla lo controlla.

**Le notifiche di servizio stanno in un posto solo.** Campanella nell'header
(su ogni pagina) più `/notifiche` per il dettaglio. Raccoglie quello che prima
viveva in quattro linguaggi diversi: la verifica della partita IVA (era un
riquadro sulla dashboard, `VerificaPromoBanner`, ora rimosso), le risposte
dello staff ai ticket (erano dentro `/impostazioni/assistenza` e non
avvisavano nessuno), la cancellazione dell'account, lo stato del profilo.
Nessuna tabella nuova: `src/lib/notifiche.ts` **deriva** le voci da righe che
esistono già, quindi niente RLS, niente retention, niente riga di RoPA. Lo
stato «letto» è una data in localStorage — preferenza d'interfaccia, non un
dato personale. Il contatore distingue le notizie (contano finché non le apri)
dalle cose da fare (contano finché non sono fatte).

**Il motivo per cui non compari è una frase, non un rimando.** `motivoInvisibile()`
sta in `lib/notifiche.ts` e la usano identica il riquadro dell'area di lavoro,
la campanella e il promemoria. Prima il riquadro diceva «il primo punto qui
sotto è quello che ti tiene fuori».

**Promemoria giornaliero.** Alla prima apertura di ogni giorno, a chi non
compare nelle ricerche, un pop-up dice cosa manca e dove si sistema. Una volta
al giorno, mai durante l'iscrizione o la guida, e si spegne da solo quando il
profilo entra nelle ricerche.

**Il codice sconto sconta, non decide il piano — migrazione 064.**
`promo_codes` prende tre percentuali (free/pro/business); BOB-FOUNDER-2026 è
100% su tutti e tre. Il campo di inserimento è passato in cima a
`/onboarding/piano` perché cambia i prezzi che stai per leggere, i tre piani si
vedono scontati e la scelta resta a chi si iscrive. Il server applica il piano
solo se con gli sconti costa zero (o se si scende a Free). `grants_tier` resta
come piano *consigliato*: smette solo di essere applicata da sola.

**Un difetto trovato per strada:** `/impostazioni/piano` leggeva
`promo_redemptions -> promo_codes` con una join dal browser, ma `promo_codes`
ha policy solo per lo staff. La join tornava `null` e la pagina scriveva «Con
il codice —». Adesso quei dati arrivano dalla route, con il service role.

**«La tua azienda» non butta più via quello che hai scritto.** Se mancava il
servizio principale, `handleSave` usciva *prima di scrivere qualunque cosa*:
titolo, «chi sei», anni, tariffe e nota non venivano salvati e uscendo dalla
pagina erano persi, con l'errore stampato milletrecento pixel sotto il campo
che lo causava. Il servizio decide **una** cosa — la visibilità (062) — non se
il resto del profilo si possa salvare: adesso il resto si salva sempre e il
servizio mancante è un avviso di visibilità, con la stessa frase di campanella
e promemoria. Restano bloccanti solo città (NOT NULL) e un titolo leggibile, e
quando bloccano la pagina scorre sul campo e ce lo mette dentro il fuoco. In
più «ci sono modifiche non salvate» e l'avviso del browser prima di chiudere.

Prima di scrivere una riga ho eseguito in produzione **le stesse letture e
scritture della pagina** con ruolo `authenticated` e l'`auth.uid()` di
sig.mozzato, in una transazione poi annullata: 15 servizi visibili, entrambe le
scritture accettate, `ready_at` che si accende. Il database non c'entrava — ed
è anche la prova che la protezione riscritta dalla 062 regge sul percorso vero.

## Cosa è a metà

- **Le 063 e 064 sono applicate** (30/08, dopo il merge delle PR #13/#14/#15).
  Advisor rilanciati: i due WARN sulle funzioni-trigger sono spariti. Resta
  **un solo rilievo, preesistente e non nostro**: *Leaked Password Protection
  Disabled* — un interruttore in Authentication → Passwords che confronta le
  password con HaveIBeenPwned. Da accendere prima del pilota.
- **Verifica dal vivo su www.meetonda.com** — desktop e 390px — ancora da fare.
  Il deploy di produzione è READY su `c80f91d`, ma dalla sessione non si arriva
  al sito e l'estensione Chrome non risultava collegata. Da guardare: la
  campanella dentro l'header su mobile (il menu ☰ adesso ha cinque voci, ho
  aggiunto `flex-wrap`), il pop-up del promemoria sotto i 400px, e il nuovo
  terzo stato «salvato ma non compari» in fondo a «La tua azienda».
- **`npm run build` non gira nel clone montato via bridge** (il worker esce con
  SIGBUS). Le due PR sono state costruite a parte, in un container pulito, e
  passano: `✓ Compiled successfully`, 64 pagine generate, `tsc --noEmit` e
  `next lint` verdi. La CI resta il cancello.
- `roadmap/next.csv` ha ancora aperta la riga «Decidere se used_count conta i
  riscatti vivi o quelli di sempre»: **decisa e chiusa dalla migrazione 060**,
  e oggi verificata in produzione (cancellando il riscatto di prova il
  contatore è tornato da 1 a 0). Va spostata in ARCHIVE.csv e rigenerata la
  roadmap.
- Restano aperti dal 28-29/08: la chat non passa ancora `zone` a `/api/match`
  (codice di André); 28 zone nostre contro 88 nuclei ufficiali; tariffa
  nell'unità del mestiere e costi accessori senza interfaccia; il worker
  maplibre non emesso nel bundle.

## Cosa ho applicato in produzione che l'altro deve sapere

- **Migrazioni 062, 063 e 064 applicate** il 30/08 (la 062 alle 10:13 UTC, le
  altre due subito dopo il merge). `BOB-FOUNDER-2026` è 100% su tutti e tre i
  piani e `used_count` è 0.
- La 062, nel dettaglio: Sei righe
  `professionals` toccate: tutte e sei adesso hanno `ready_at`.
- **Account di prova `sig.mozzato@gmail.com` riportato a zero** (non cancellato,
  quindi stessa password e nessuna email di Supabase consumata):
  `onboarding_completed_at` a null, servizi/zone/orari/telefono/portfolio
  cancellati, risposte del questionario cancellate, riscatto promo cancellato,
  piano riportato a `free`, riga di verifica ripulita. Serve a rifare il primo
  ingresso da capo. Effetto collaterale utile: `used_count` di
  BOB-FOUNDER-2026 è tornato a 0 da solo — il trigger della 060 funziona.
- Resta da fare a mano su Supabase (dal 28/08): aggiungere
  `https://www.meetonda.com/auth/conferma` e `http://localhost:3000/auth/conferma`
  ai Redirect URLs, e decidere l'SMTP personalizzato (il mailer interno manda 2
  email/ora per tutto il progetto).
