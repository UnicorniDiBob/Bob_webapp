# Passaggio di consegne — 30 agosto 2026 (Lucio)

*Riscritto il 31 agosto. La versione precedente si era fermata alle 17:44 di
ieri: dava la migrazione 065 per «non ancora applicata» e non conosceva le due
PR successive. Se l'hai letta prima di adesso, quel quadro era vecchio di tre
ore.*

## Cosa ho fatto

**La scheda pubblica si intitola col nome dell'attività, non con quello del
titolare — 065, PR #17.** Fino a ieri il titolo era `profiles.full_name`. Sui
sei profili seminati a giugno non si vedeva, perché il seed ci aveva messo
delle ragioni sociali; alla prima iscrizione vera è comparso quello che il
codice fa davvero: «lucio mozzaglia» come titolo, e la ditta a sottotitolo.
Adesso c'è `professionals.business_name`, la chiede l'iscrizione (obbligatoria
ma precompilata con «Nome Cognome», così chi lavora in proprio non deve
inventarsi niente) e si rivede in «La tua azienda». Il nome del titolare resta
un dato nostro — assistenza, verifica P.IVA, fatturazione — e non compare più
in nessuna pagina pubblica. In `lib/data.ts` c'è `displayName`: le pagine
pubbliche usano quello, `fullName` resta per admin e interno. **Riga di RoPA
nuova: A21** — pubblicare il profilo di un professionista è una finalità
distinta dalla gestione dell'account, e non era scritta da nessuna parte.

**Meno testo sulla scheda.** Erano quattro riquadri incolonnati; su un profilo
appena iscritto tre erano intestazioni sopra il vuoto. Via il riquadro
«RECENSIONI — ancora nessuna recensione», via l'intestazione «CHI È», via il
paragrafo sotto il badge di verifica che ripeteva a parole la data e il caveat
già scritti nel badge. Le sezioni compaiono solo se hanno qualcosa dentro.

**Il giro guidato era lento per un anello che si alimentava da solo.**
L'effetto che porta l'elemento in vista dipendeva dall'OGGETTO passo, e
`GuidaPrimoAccesso` ricostruiva l'elenco dei passi a ogni render: ogni render
faceva ripartire uno `scrollTo({behavior:"smooth"})`, lo scroll faceva partire
l'evento scroll, l'evento rimisurava, la misura faceva un `setState`, il
`setState` faceva un render. Adesso si dipende dall'`id` del passo, l'elenco è
memoizzato, la misura è una per fotogramma (rAF) e non fa `setState` se il
rettangolo non è cambiato. L'alone ha la transizione solo mentre si cambia
passo. **E le tappe sono sei invece di undici:** le ultime quattro illuminavano
tutte lo stesso riquadro «stato», che ora è un passo solo con la lista dentro
il pannello e ogni riga mancante cliccabile.

**Cellulare all'iscrizione, facoltativo.** Chiederlo lì evita che resti una
spunta rossa nella checklist per settimane. Resta facoltativo: obbligarlo
sarebbe raccogliere un contatto per una funzione (le chiamate) che non esiste.

**La disdetta si chiama disdetta — PR #18, nessuna migrazione.** I ToS pro
(art. 3) e le FAQ di /per-i-professionisti promettono entrambi la disdetta «in
qualsiasi momento dall'area riservata, senza costi di disdetta né penali».
Dietro quella frase c'era un bottone «Passa a Free» dentro la griglia degli
altri piani: il declassamento funzionava, ma non si chiamava disdetta, non
diceva cosa si perde e non aveva una data. Ora `src/lib/disdetta.ts` tiene la
DATA DI EFFETTO in un posto solo (oggi immediata, perché non esiste nessun
periodo di fatturazione; la bozza ToS 4.3 promette già l'effetto «dalla fine
del periodo in corso», che sarà vero da 12.1/12.2), `funzioniPerse` si ricava
dai PIANI così segue il listino da sola, Free esce dalla griglia «Gli altri
piani», e la conferma dice cosa smette di funzionare, cosa resta, quando ha
effetto e che il badge di verifica già ottenuto NON viene tolto (art. 22:
nessun declassamento è automatico). **Corretto nello stesso giro, stessa classe
del bug dei promo_codes:** «Attivo dal» non si era mai visto, perché la pagina
leggeva `subscription_tier_events` dal browser e la 025 ha una sola policy di
select, per admin e cs — quattro righe esistenti, zero visibili al pro. Adesso
la data arriva dalla route col service role.

**Ricompilare il questionario non è più un vicolo cieco — 066, PR #19.**
`onboarding_answers` aveva una policy di INSERT e due di SELECT, e nessuna di
UPDATE: l'upsert della pagina, sulla riga che esiste già, è un UPDATE, e
Postgres rispondeva 42501. Le risposte sono il PRIMO passo del salvataggio e la
riga `professionals` nasce DOPO: qualunque interruzione in mezzo lasciava un
account con le risposte scritte e senza profilo pro, e da lì ogni tentativo
moriva sulla stessa riga. Non un account impallato: **un account che non poteva
più iscriversi**, ed è quello che era capitato a `sig.mozzato@gmail.com` alle
9:58. Non si vedeva perché supabase-js non lancia, restituisce `{ error }`, e
quell'oggetto non è un'istanza di `Error`: il ternario nel catch cadeva sempre
nel ramo generico e buttava via il messaggio, che diceva esattamente cosa non
andava. La 066 aggiunge la policy di UPDATE (ognuno tocca la propria riga; lo
staff continua solo a leggere) e `messaggioErrore()` legge anche `message` e
`code` degli errori PostgREST.

**Account di prova `sig.mozzato@gmail.com` azzerato due volte,** senza
cancellarlo: stessa password, nessuna email di Supabase consumata. La ricetta
non è più a memoria: sta in `scripts/reset_account_prova.sql`, con l'elenco
chiuso degli account di prova come protezione e le tre chiavi di localStorage
che il database non tocca. Ieri quel file esisteva **solo sul mio Mac**, non
tracciato.

**Piano scritto per i gruppi aziendali** — `docs/Bob_Gruppi_Aziendali_PIANO_30ago.md`,
niente costruito. Riprende lo spike #38.0 e ci mette sopra la richiesta del 30/08.

## Com'è la produzione adesso — verificato il 31/08, non a memoria

- `origin/main` = `f5e164e`, deploy Vercel **READY** su production.
- **065 e 066 sono applicate** e i due file sono nel repo: nessuna deriva fra
  schema e repo (l'ordine è stato rispettato: PR, migrazione, merge).
- `/professionisti` risponde con i sei profili intitolati col nome
  dell'attività: il rischio «elenco vuoto» della 065 non si è verificato.
- Advisor di **sicurezza**: un solo rilievo, `Leaked Password Protection`
  disabilitata (richiede il piano Pro, m11t7). Advisor di **performance**: 180
  rilievi — 128 `multiple_permissive_policies`, 11 `auth_rls_initplan`, 25 FK
  senza indice, 16 indici inutilizzati. È quello che manca a m11t4.
- `ready_at` è scritta per tutti e sei i professionisti (i trigger della 062
  funzionano): l'ultima, «foto pro», alle 18:55 del 30/08.

## Due cose rotte, trovate nella verifica dal vivo del 31/08

1. **«Contatta foto».** Il bottone della scheda e la barra fissa mobile prendono
   la PRIMA PAROLA del nome mostrato: era «Contatta Marco» quando il titolo era
   il nome della persona, con la 065 diventa «Contatta foto» per «foto pro» e
   «Contatta Mano» per «Mano Amica Milano». Vale per tutte le schede, in
   produzione ora. È figlio della 065 e va chiuso con lei: nome intero, o
   etichetta senza nome.
2. **La barra fissa mobile copre 69 px e nessuno li compensa.** A 390 px `body`
   e `main` hanno `padding-bottom: 0` e il footer finisce esattamente a
   `scrollHeight`: le ultime righe del footer stanno permanentemente sotto la
   barra.

Il resto della verifica passa: a 390 px la scheda è un riquadro solo, senza
intestazioni sopra il vuoto; a 1440 px nessuna barra fissa e nessuna sezione
vuota.

## Cosa è a metà

- **Il giro guidato non è stato verificato dal vivo**: serve una sessione
  autenticata da professionista, e rifarlo consuma lo stato dell'account di
  prova. Da fare insieme, in dieci minuti.
- **m11t9 è ancora aperta e non l'ha toccata nessuno:**
  `/api/pro/instant-slots` è pubblica per scelta scritta nel file e restituisce
  l'orizzonte di agenda libera di un pro dato un `psid`; `/api/pro/instant-book`
  chiede il login (401 senza) ma **non ha controllo di ruolo né rifiuto
  dell'auto-prenotazione**.
- **Due definizioni della stessa verità.** `private.pro_e_pronto` (062) e
  `getProfessionals()` in `lib/data.ts` dicono entrambe «almeno un servizio e
  profilo non spento», ma in due posti: l'elenco pubblico NON filtra su
  `ready_at`. Oggi coincidono; il giorno che una cambia, il pro legge «compari
  nelle ricerche» e non compare. `motivoInvisibile()` è già l'unico posto dove
  sta la frase — manca che l'elenco usi la stessa colonna.
- Restano aperti dal 28-30/08: la chat non passa ancora `zone` a `/api/match`
  (codice di André); 28 zone nostre contro 88 nuclei ufficiali; tariffa
  nell'unità del mestiere e costi accessori senza interfaccia; il worker
  maplibre non emesso nel bundle; le zone servite non compaiono ancora sulla
  scheda del pro; `Leaked Password Protection` da accendere prima del pilota;
  SMTP personalizzato non configurato.

## Cosa ho applicato in produzione che l'altro deve sapere

- **Migrazioni 065 e 066 applicate il 30/08**, entrambe col file nel repo prima
  dell'applicazione. Chi ha un clone vecchio: `git pull`. La colonna
  `professionals.business_name` esiste, le pagine pubbliche leggono
  `displayName`, e `onboarding_answers` ha una policy di UPDATE.
- **Il 31/08 non ho toccato nessuno schema e nessun dato.**
- Solo dati, il 30/08: l'azzeramento dell'account di prova
  `sig.mozzato@gmail.com`, due volte. Nessun altro record.
- Da fare a mano su Supabase, ancora dal 28/08: aggiungere
  `https://www.meetonda.com/auth/conferma` e `http://localhost:3000/auth/conferma`
  ai Redirect URLs, e decidere l'SMTP personalizzato.
