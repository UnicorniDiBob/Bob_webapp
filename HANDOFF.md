# Passaggio di consegne — 11 settembre 2026 (André, con Claude)

> Sostituisce quello del 10 settembre sera (PR #53) e ne porta avanti tutte le
> voci ancora aperte, nelle sezioni in fondo. HANDOFF.md si sovrascrive a ogni
> sessione, **ma quello che è a metà si porta avanti, non si butta**.
>
> Scritto e mergiato lo stesso giorno, come dice la regola imparata a caro
> prezzo il 9 e il 10.

## Cosa è andato in produzione (11 settembre — Bob ha un carattere)

Giornata su una cosa sola: il **blocco A** dell'audit design
(`claude/AUDIT_design_11set.md`). Nessuna migrazione, nessun tocco a Supabase,
nessuna modifica funzionale. Solo interfaccia.

- **Il carattere.** Prima `fontFamily.sans` era lo stack di sistema, cioè
  nessuna scelta mai fatta: `document.fonts` sulla home restituiva un array
  vuoto. Ora è **Schibsted Grotesk** (Bakken & Bæck, SIL Open Font 1.1),
  variabile 400–900 — deciso da André e Lucio guardando otto candidati resi
  dentro le schermate vere di Bob, non su una specimen page.
- **Caricato con `next/font/google`, non con un `<link>` a Google.** I file si
  scaricano alla build e si servono da `/_next/static/media/*.woff2`, cioè dal
  nostro dominio: il browser dell'utente non parla mai con Google, quindi non
  c'è un trasferimento di IP verso gli USA da mettere nell'informativa. La
  classe va su `<html>` e non su `<body>` perché il preflight di Tailwind mette
  `font-family` proprio lì.
- **La scala tipografica cambiata nel config, non nei componenti.** L'87% delle
  utility di dimensione (820 su 942) stava a 14px o meno, e la dimensione più
  frequente sullo schermo era 12px. Invece di 537 sostituzioni a mano, i token
  cambiano significato in `tailwind.config.ts`: `xs` 12→13, `sm` 14→15, `base`
  16→17, `lg` 18→19, `xl` 20→21, più un nuovo `2xs` da 11px per i dati fitti.
  Da `2xl` in su restano i valori di Tailwind. **Un file invece di centinaia, e
  si annulla in una riga** — se la scala non convince, si torna indietro senza
  toccare nessun componente.
- **I 56 `text-[10px]` e `text-[11px]`** scavalcavano la scala: ora passano per
  `2xs`. Non esistono più dimensioni fuori sistema.
- **475 grigi portati sopra la soglia di contrasto.** Misurati su `#fafafb`:
  `/40`=2.43, `/45`=2.78, `/50`=3.19, `/55`=3.69, `/60`=4.29, contro una soglia
  AA di 4.50. **Nessuno passava.** Mappati su `/65` (5.02) e `/70` (5.91)
  conservando l'ordine di intensità.
- **Il calendario ha più aria**: `HOUR_PX_WEEK` 56→64, `HOUR_PX_DAY` 72→80,
  perché con le etichette a 11px invece di 10 un appuntamento da mezz'ora non
  teneva più due righe.
- **Verifica dal vivo FATTA** su www.meetonda.com dopo il deploy, desktop e
  390px: font `__Schibsted_Grotesk_7aaf8b` attivo e auto-ospitato; dimensioni
  in pagina 13/15/16/17/24/30 — **il 12px non esiste più**; **81 testi
  controllati, zero sotto AA, contrasto peggiore 4.89**; a 390px `scrollWidth`
  esatto 390, nessun overflow.
- **Nota di metodo, perché l'errore è facile da rifare**: il primo giro di
  misura del contrasto dava 9 falsi positivi a 1.16:1. Erano i chip con
  `bg-black/5`. Risalire al primo sfondo non trasparente **non basta** — vanno
  composti tutti gli strati semitrasparenti fino a quello opaco, altrimenti un
  5% di nero viene letto come nero pieno.

## Cosa è a metà — mio (11 settembre)

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

## Cosa ho applicato in produzione che l'altro deve sapere

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
