# Passaggio di consegne — 9 settembre 2026 (Lucio, con Claude)

> Sostituisce quello dell'8 settembre. HANDOFF.md si sovrascrive a ogni
> sessione, **ma quello che è a metà si porta avanti, non si butta**: le voci
> ancora aperte di André e quelle vecchie stanno in fondo, nelle loro sezioni.

## Cosa è andato in produzione (9 settembre — fermo, disdetta, avvisi)

Bob adesso sa **chiudersi**, non solo dire che si chiuderà. E la disdetta ha
una data invece di una promessa.

- **La 071 è applicata** (15:09). `avvisi_servizio` e `profiles.avvisi_visti_al`
  esistono: la funzione non è più «online e silenziosamente morta». Il handoff
  dell'8 diceva il contrario ed era vero fino a stamattina.
- **073 · Il fermo per manutenzione** (PR #44, applicata e provata). Una
  tabella `manutenzioni` sola regge tre cose: il preavviso la annuncia, il
  middleware chiude la porta, la pagina di cortesia spiega perché. Vincolo di
  esclusione (una finestra alla volta), **durata massima 24 ore** — ogni fermo
  si riapre da solo, che è l'unico modo per non lasciarlo acceso per
  dimenticanza. Lettura fino ad `anon`, perché il middleware la interroga con
  la chiave pubblica e la fascia di preavviso deve arrivare anche a chi non ha
  un account.
- **Il middleware risponde 503 con `Retry-After`**, non 200 e non 302: un 200
  con scritto «siamo fermi» manda in indice la manutenzione al posto della
  home. `/login` e `/auth` restano aperti, altrimenti chi deve riaprire e non
  ha la sessione resta fuori con tutti. **Fallisce aperto**: se Supabase non
  risponde il sito resta su, perché un controllo che chiude Bob per una query
  andata storta è un guasto che ci facciamo da soli.
- **`/admin/manutenzione`**, solo admin: programmazione a data e ora con
  preavviso automatico (che è un avviso della 071, non una seconda copia della
  stessa frase), e **fermo rapido sotto tre chiavi** — durata obbligatoria,
  motivo pubblico da scrivere, la parola `FERMA BOB` battuta a mano.
- **074 · La disdetta ha una data** (PR #45, applicata e provata). Piano che
  non costa niente a chi ce l'ha → effetto **subito**; piano pagato → fine del
  **mese di abbonamento in corso**, contato dal giorno di attivazione di quel
  piano. Oggi vale sempre il primo ramo, perché i piani si attivano con un
  codice: **il secondo si accende da solo il giorno del primo pagamento**,
  senza che nessuno debba ricordarsi di cambiare una frase. Si può annullare
  finché non scatta, e scegliere un altro piano la cancella.
- **Il fermo si legge prima di entrare, e si vede scorrere** (PR #46). Conto
  alla rovescia «Torniamo fra 12:34» sulla pagina 503, sull'avviso di accesso,
  sulla fascia rossa dello staff e nel pannello admin, tutti dalla stessa
  funzione; alla scadenza la pagina si ricarica da sola ogni quindici secondi.
  La pagina di cortesia **non dice più dove entra lo staff**: a noi non serviva
  e a chiunque passasse spiegava che una porta c'è e dov'è. E durante un fermo
  **da `/login` si entra e basta**: il pannello di iscrizione sparisce, con in
  cima l'avviso, così chi non ha un account legge che siamo fermi prima di
  provare a entrare invece di scoprirlo dopo.
- **`scripts/reset_account_prova.sql` è in git** (stesso PR): era l'unica copia
  di una cosa che gira contro la produzione.
- **Advisor di sicurezza rilanciati dopo ogni migrazione: puliti.** Resta solo
  `Leaked Password Protection`, che vuole il piano Pro.

## Cosa è a metà

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
  c'è almeno un intervento dichiarato.
- **Prima del modulo va chiusa la 075 sui doppioni del catalogo.** Il catalogo
  è stato seminato due volte, 8 voci il 3 giugno e 112 l'8 luglio con la 014:
  dove il nome nuovo era diverso dal vecchio sono rimaste **entrambe**. Sono
  otto, sei hanno un gemello quasi identico, e **sette su otto hanno già un
  professionista attaccato**, perché erano le prime della lista quando abbiamo
  compilato i profili a mano. Il vocabolario della 067 è stato generato dal
  catalogo, gemelli compresi: chi cerca «imbiancatura» e chi cerca
  «tinteggiatura» finisce su due elenchi di professionisti diversi. Un modulo
  costruito su questa lista fa scegliere fra due caselle identiche e ci mette
  dentro la dichiarazione del pro per sempre. Quadro completo nell'artifact
  «Catalogo dei lavori di Bob».
- **I ToS pro, al momento dei pagamenti.** L'art. 3 pubblicato non nomina la
  data della disdetta, quindi oggi non contraddice niente; la bozza 4.3 sì.
  Vanno allineati **insieme all'apertura dei pagamenti e non dopo**, e
  modificare i termini verso utenti business richiede il **preavviso dell'art.
  3 P2B, minimo 15 giorni**: va annunciato prima, non fatto e basta.
- **Verifica dal vivo su www.meetonda.com, desktop e 390px**: portata avanti
  dal 5 settembre, ancora non fatta.
- **L'impronta a otto righe non è ancora stata confrontata con la produzione**
  (`scripts/schema_fingerprint.sql`): aperta dal 5 settembre.

## Cosa ho applicato in produzione che André deve sapere

- **071, 073 e 074 applicate su Supabase**, advisor puliti dopo ognuna. La 074
  aggiunge anche un lavoro notturno, `applica-disdette-scadute` alle 03:40, che
  scrive il suo giro in `system_job_runs`: se un giorno non compare, non è
  girato.
- **La 072 è mergiata e deployata, ma NON è applicata su Supabase.**
  `professionals_score` non esiste in produzione: `getProfessionals` ricade su
  `ordinaSenzaPunteggio`, quindi **il punteggio nuovo in elenco è spento**.
  Niente è rotto — la rete di sicurezza regge — ma è esattamente la situazione
  della 071 di ieri, e da fuori sembra fatta. **È tua: applicala tu, poi
  advisor.** Finché non è applicata, `ordinaSenzaPunteggio` non si può togliere.
- **Account di prova azzerati** (`sig.mozzato@gmail.com`,
  `cliente.prova@bobapp.it`) per provare il primo ingresso. Lo script aveva tre
  difetti, tutti corretti nel ramo `feat/fermo-orologio`: le cancellazioni lato
  cliente stavano dentro `if v_pro is not null`, quindi su un account solo
  cliente appuntamenti e recensioni **non venivano toccati**; l'elenco degli
  ammessi ora è un ciclo invece di una riga da cambiare a mano; e il contatore
  `promo_codes.used_count` viene scalato, prima cresceva a ogni prova.
- **Due numeri del handoff dell'8 da correggere**, verificati sul database:
  `appointments` con nome in chiaro e nessun account sono **22, con 17 nomi
  distinti**, non 14 — e l'ultimo appuntamento è del 29 agosto, quindi il 14
  era sbagliato quando è stato scritto, non invecchiato. È il numero che conta
  per la cancellazione dei dati. E «8 righe su 13 senza prezzo» è esatto per
  `min_price`/`max_price`, ma **3 di quelle 8 hanno una tariffa in
  `rate_amount`**: senza nessun prezzo sono 5, e quelle 3 hanno un prezzo che
  il cliente non vede perché la scheda mostra la forbice.
- **Numerazione delle migrazioni**: 072, 073 e 074 sono prese. Il registro
  delle ricerche a vuoto e il `drop column subservice_slugs`, che il handoff
  dell'8 assegnava alla 072 o alla 073, partono dalla **075**.
- **Un errore mio, per non ripeterlo.** Per provare il fermo prima del merge
  avevo inserito una finestra di quattro minuti contando che il codice non
  fosse ancora in produzione; la #44 è stata mergiata tredici secondi dopo.
  Fra la fine del build e la scadenza della finestra www.meetonda.com può aver
  risposto 503 per uno o due minuti. **Nei log non c'è nessun 503**, quindi non
  l'ha vista nessuno — ma è stata fortuna: una riga di prova va messa con una
  finestra nel futuro, o non messa affatto quando un merge è in gioco.

## Cosa è a metà — portato avanti dall'8 settembre (André)

Nessuna di queste è chiusa.

- **I pesi sono pubblicati e il punteggio è scritto, ma non è vivo**: vedi
  sopra, la 072 non è applicata.
- **Slot sponsorizzati**: non costruiti. Quando si fanno, nello **stesso
  commit** va sostituita la frase «Nessuna posizione è a pagamento» in
  `/come-funziona#ordine` — sostituita, non cancellata — e la targhetta
  «Sponsorizzato» va **dentro** l'elenco (all. I punto 11-bis).
- **Registro delle ricerche a vuoto**: da fare, sarà la 075 o più avanti.
  Senza `user_id`, cifre rimosse, 60 caratteri, 12 mesi.
- **`drop column subservice_slugs`**: solo dopo che nessun codice la legge più.
- **Verifica dal vivo della casella di ricerca**, desktop e 390px: rinviata.
- **Trappola da conoscere prima di rigiocare la 067**: un replay della 067
  *dopo* la 068 riporta il trigger di normalizzazione alla versione senza
  `tokens`. La 069 installa un trigger separato che il replay non può disfare.
  In produzione oggi: 491 termini, 0 senza token.

## Cosa è a metà — portato avanti dal 28 agosto-5 settembre

- **1 professionista su 6 ha gli orari salvati.** Gli altri cinque non mostrano
  nessuno slot: comportamento giusto, ma il cliente deve scrivere in chat.
- **Gli avvisi non li vede chi non è loggato**, volutamente: la policy della
  071 è `to authenticated`. La fascia della 073 invece arriva a tutti, perché
  un fermo riguarda anche chi non ha un account.
- **La cancellazione account non tocca `appointments`**: `customer_id` ha
  `on delete set null`, la riga resta con dentro il nome in chiaro.
- **La chat non passa `zone` a `/api/match`** — verificato oggi nel codice: i
  parametri sono solo `city`, `service`, `maxPrice`. Codice di André.
- **28 zone nostre contro 88 nuclei ufficiali**: decisione di prodotto aperta.
- **Tariffa nell'unità del mestiere e costi accessori**: colonne in database,
  nessuna interfaccia. La pagina azienda dice ancora «€/h» fisso.
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
  su Supabase, non solo i file.
