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

## Cosa è a metà

- **Le 063 e 064 NON sono applicate**: i file sono nelle PR, l'applicazione su
  Supabase è il passo successivo al merge (regola: prima il file nella PR).
  Finché la 064 non è applicata, le colonne di sconto non esistono e la route
  `/api/onboarding/promo` risponderebbe con un errore di colonna mancante sulla
  `select`: **la 064 va applicata insieme al merge, non dopo con calma.**
- **Advisor da rilanciare** dopo l'applicazione della 063 (deve tornare a zero
  WARN nuovi) e della 064 (nessuna funzione nuova, ma la regola è la regola).
- **Verifica dal vivo su www.meetonda.com** — desktop e 390px — ancora da fare:
  il deploy non c'è. Da guardare in particolare: la campanella dentro l'header
  su mobile (il menu ☰ adesso ha cinque voci, ho aggiunto `flex-wrap`), e il
  pop-up del promemoria sotto i 400px.
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

- **Migrazione 062 applicata** il 30/08 alle 10:13 UTC. Sei righe
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
