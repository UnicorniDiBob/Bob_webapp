# Passaggio di consegne — 30 agosto 2026, sera (Lucio)

## Cosa ho fatto

**La scheda pubblica del professionista si intitola con il nome
dell'attività, non con quello del titolare — migrazione 065.** Fino a oggi il
titolo della scheda era `profiles.full_name`. Sui sei profili seminati a giugno
non si vedeva, perché il seed ci aveva messo delle ragioni sociali; alla prima
iscrizione vera è comparso quello che il codice fa davvero: «lucio mozzaglia»
come titolo, e la ditta relegata a sottotitolo. Adesso c'è
`professionals.business_name`, la chiede l'iscrizione (obbligatoria, ma
precompilata con «Nome Cognome», così chi lavora in proprio non deve inventarsi
niente) e si rivede in «La tua azienda». Il nome del titolare resta un dato
nostro — assistenza, verifica P.IVA, fatturazione — e non compare più in
nessuna pagina pubblica. In `lib/data.ts` c'è `displayName`: le pagine pubbliche
usano quello, `fullName` resta per admin e interno. **Riga di RoPA nuova: A21**,
che prima non esisteva — pubblicare il profilo di un professionista è una
finalità distinta dalla gestione dell'account, e non era scritta da nessuna
parte.

**Meno testo sulla scheda.** Erano quattro riquadri incolonnati; su un profilo
appena iscritto tre erano intestazioni sopra il vuoto. Via il riquadro
«RECENSIONI — ancora nessuna recensione, sii il primo a lavorare con X» (lo
stato è già nella riga dei dati, «Ancora senza recensioni»); via l'intestazione
«CHI È», che etichettava una descrizione già sotto il nome; via il paragrafo di
tre righe sotto il badge di verifica, che ripeteva a parole la data e il caveat
già scritti dentro il badge e nel suo tooltip. Le sezioni compaiono solo se
hanno qualcosa dentro.

**Il giro guidato era lento per un anello che si alimentava da solo.**
L'effetto che porta l'elemento in vista dipendeva dall'OGGETTO passo, e
`GuidaPrimoAccesso` ricostruiva l'elenco dei passi a ogni render: ogni render
faceva ripartire uno `scrollTo({behavior:"smooth"})`, lo scroll faceva partire
l'evento scroll, l'evento rimisurava, la misura faceva un `setState`, il
`setState` faceva un render. Tre correzioni: si dipende dall'`id` del passo e
non dall'oggetto; l'elenco dei passi è memoizzato; la misura è una per
fotogramma (rAF) e non fa `setState` se il rettangolo non è cambiato. In più
l'alone ha la transizione solo mentre si cambia passo — mentre si scorre a dito
si spegne, altrimenti insegue una posizione che cambia a ogni fotogramma ed è
quello che si vedeva strisciare.

**Le ultime quattro tappe erano la stessa tappa.** Il giro faceva un passo per
ogni cosa mancante, tutte ancorate allo stesso riquadro «stato», più una
chiusura ancorata ancora lì: cinque passi in fila che illuminavano lo stesso
rettangolo. Adesso il riquadro dello stato è **un passo solo** e la lista sta
dentro il pannello, con ogni riga mancante cliccabile. Sei passi invece di
undici, e ognuno mostra qualcosa di diverso. Accorciati anche i testi dei
cinque passi di spiegazione.

**Cellulare all'iscrizione, facoltativo.** Chiederlo lì evita che resti una
spunta rossa nella checklist per settimane. Resta facoltativo: obbligarlo
sarebbe raccogliere un contatto per una funzione (le chiamate) che non esiste
ancora.

**Account di prova `sig.mozzato@gmail.com` riportato a zero** — di nuovo, e con
la stessa ricetta del 30/08 mattina: non cancellato, quindi stessa password e
nessuna email di Supabase consumata. Azzerati `onboarding_completed_at`,
`ready_at`, titolo, descrizione, anni, tempo di risposta; cancellati servizi,
zone, orari, portfolio, telefono, riga e cronologia di verifica, risposte del
questionario, riscatto promo, consensi, e il ticket di prova. Piano riportato a
`free`. `BOB-FOUNDER-2026` è tornato a `used_count = 0` da solo (trigger della
060). Per rifare il primo ingresso da capo: accedere e aprire
`/onboarding/piano`, la dashboard riapre la guida da sola.

**Piano scritto per i gruppi aziendali** — `docs/Bob_Gruppi_Aziendali_PIANO_30ago.md`,
niente costruito. Riprende lo spike #38.0 e ci mette sopra la richiesta del 30/08.

## Cosa è a metà

- **La migrazione 065 NON è ancora applicata.** Il file è nella PR, come da
  regola. **L'ordine conta e in un verso solo:** il codice nuovo legge
  `business_name`, e se Vercel mette in produzione `main` prima che la colonna
  esista, PostgREST rifiuta la select e **l'elenco dei professionisti torna
  vuoto**. Quindi: PR aperta → 065 applicata → merge. La 065 al contrario è
  innocua (colonna nullable, backfill), applicarla in anticipo non rompe niente.
- **Advisor Supabase da rilanciare dopo l'applicazione della 065.** La 065 non
  aggiunge funzioni, ma la regola è la regola.
- **Verifica dal vivo su www.meetonda.com, desktop e 390px: da fare.** Vale per
  la scheda del professionista (il riquadro unico, la barra fissa in basso su
  mobile) e per il giro guidato a passo cambiato.
- **Il clone locale su questo Mac era in uno stato sporco**: `.git/index.lock`
  rimasto da una sessione precedente, HEAD su `main` fermo a `c48e0ed` con
  l'albero di lavoro a `4d082ca`. Il contenuto era tutto già spinto, niente
  perso. Il ramo di consegna riparte da `origin/main`.
- Restano aperti dal 28-30/08: la chat non passa ancora `zone` a `/api/match`
  (codice di André); 28 zone nostre contro 88 nuclei ufficiali; tariffa
  nell'unità del mestiere e costi accessori senza interfaccia; il worker
  maplibre non emesso nel bundle; `Leaked Password Protection` da accendere
  prima del pilota; SMTP personalizzato non configurato.

## Cosa ho applicato in produzione che l'altro deve sapere

- **Niente migrazioni applicate in questa sessione.** La 065 è ferma alla PR.
- **Solo dati:** l'azzeramento dell'account di prova `sig.mozzato@gmail.com`
  descritto sopra. Nessun altro record toccato, nessuno schema modificato.
- Da fare a mano su Supabase, ancora dal 28/08: aggiungere
  `https://www.meetonda.com/auth/conferma` e `http://localhost:3000/auth/conferma`
  ai Redirect URLs, e decidere l'SMTP personalizzato.
