# Passaggio di consegne — 5 settembre 2026, sera (Lucio, con Claude)

> Sostituisce quello del 5 settembre mattina. HANDOFF.md si sovrascrive a ogni
> sessione, **ma quello che è a metà si porta avanti, non si butta**: le voci
> aperte del 28 agosto–2 settembre stanno in fondo, nella loro sezione.

## Cosa è andato in produzione oggi

Le sei correzioni del mattino sono mergiate (PR #27–#33) e Vercel le ha
deployate. **Conseguenza da gestire: 1 professionista su 6 ha gli orari
salvati.** Ora che `/api/pro/slots` legge `professional_availability` invece
della finestra fissa 8-18, gli altri 5 non mostrano nessuno slot ai clienti —
è il comportamento giusto, ma finché non confermano i loro orari il cliente
deve scrivere in chat per fissare. Vanno chiesti, o messi a mano da admin.

## Cosa ho fatto dopo (tre rami, nessuno mergiato)

Basati su `origin/main` a `98f5ddc`, lint pulito e build verde su tutti e tre.

- **`fix/admin-utenti-nome-vuoto`** — `(u.full_name ?? "?")[0].toUpperCase()`
  copre il null e non la stringa vuota: `""[0]` è `undefined` e la pagina
  `/admin/users` smette di aprirsi per admin e cs, cioè l'unica pagina da cui
  si potrebbe rimediare. La stringa vuota la produceva la nostra interfaccia
  (nessun `required`, nessun trim, PATCH che scriveva qualunque cosa): chiuse
  tutte e tre le porte. Latente, 0 nomi vuoti in produzione su 14 profili.
- **`fix/doppioni-navigazione`** — tre doppioni in un ramo solo perché sono la
  stessa famiglia: il ritorno al lavoro di `ImpostazioniShell` ora è
  `md:hidden` (stessa cura del doppione «Impostazioni» del 29/08); i cinque
  «Parla con Bob» che puntavano a `/` ora puntano a `/#bob` come tutti gli
  altri; via «Vai ai messaggi» da `ProWorkspace`, che conviveva con la bolla
  flottante. **Non toccata** la fascia «Parla con Bob» delle due pagine
  servizi: è un invito contestuale con un titolo suo, non un bottone nudo, ed
  è l'unico invito a Bob che vede un professionista lì.
- **`feat/avvisi-di-servizio`** — nuovo. Migrazione **071** (tabella
  `avvisi_servizio` + `profiles.avvisi_visti_al`), pannello `/admin/avvisi`,
  finestra al primo accesso, poi voce nella campanella, scadenza automatica.

## Cosa è a metà

- **I tre rami non sono in produzione.** Vanno aperte le PR e mergiate.
- **La 071 NON è applicata su Supabase**, e va bene così: il file sta nel PR
  prima, come da regola. Dopo il merge: applicarla, poi **rilanciare gli
  advisor di sicurezza** (è l'unica migrazione della giornata).
- **Verifica dal vivo su www.meetonda.com, desktop e 390px**: da fare per le
  sei di stamattina (già online) e per i tre rami nuovi dopo il merge.
- **Gli avvisi non li vede chi non è loggato.** Volutamente: lo stato «già
  visto» ha bisogno di un account. Se un giorno serve dire «il sito è fermo» a
  chi non è entrato, serve una fascia pubblica separata — la policy di lettura
  è `to authenticated`, quindi è un cambio consapevole, non una dimenticanza.
- **Due cose trovate ieri, ancora aperte, da mettere nel Piano:**
  - `appointments.customer_name` è il nome di una persona in testo libero, su
    14 righe senza legame a nessun account: nessuna cancellazione, nessuna
    conservazione.
  - la cancellazione account non tocca `appointments`: `customer_id` ha
    `on delete set null`, quindi la riga resta con dentro il nome.

## Cosa ho applicato in produzione che l'altro deve sapere

**Niente sul database.** Nessuna migrazione applicata, nessuna modifica allo
schema. Le query su Supabase sono state di sola lettura (quanti professionisti
hanno gli orari, quanti profili hanno il nome vuoto). Le sei PR del mattino le
ha mergiate Lucio a mano.

Nota su come è stato verificato il ramo degli avvisi, perché conviene rifarlo:
`scripts/schema_check.sh` gira in un contenitore con `postgresql-16` e
`postgresql-16-cron` installati, e il replay **001 → 071 dai soli file del
repo dà 0 errori**. L'impronta a otto righe è stata prodotta ma **non è stata
confrontata con la produzione**: quel passo resta da fare a mano con
`scripts/schema_fingerprint.sql`, come dice la regola settimanale.

## Cosa è a metà — portato avanti dal 28 agosto–2 settembre

Nessuna di queste è chiusa.

- **La ricerca non ha interfaccia**: il risolutore (068) è pronto e nessuna
  pagina lo chiama. Deciso che vive dentro `/professionisti`.
- **069 pronta e NON applicata**: prima il PR.
- **`getProfessionals` carica tutti i professionisti e filtra in JavaScript**:
  va portato in SQL. I pesi sono decisi e vanno pubblicati in pagina (art. 5
  P2B).
- **Due verità sugli interventi**: `professional_services` (che ha il prezzo) e
  `professionals.subservice_slugs`. Va scelta una. E 4 pro su 6 non dichiarano
  nessun intervento.
- **Slot sponsorizzati** e **registro delle ricerche a vuoto** (`search_events`,
  senza `user_id`, 12 mesi): non costruiti.
- **Le bande di fiducia** (sopra 0.80 risposta, 0.40-0.80 «forse cercavi») non
  sono rispettate dall'interfaccia.
- **La chat non passa `zone` a `/api/match`** — codice di André.
- **28 zone nostre contro 88 nuclei ufficiali**: decisione di prodotto aperta.
- **Tariffa nell'unità del mestiere e costi accessori**: colonne in database,
  nessuna interfaccia. La pagina azienda dice ancora «€/h» fisso.
- **Il worker maplibre non viene emesso nel bundle di Next.**
- **`Leaked Password Protection` da accendere prima del pilota** (vuole il
  piano Pro): l'unico rilievo che gli advisor continuano a dare.
- **SMTP personalizzato non configurato**: 2 email all'ora per tutto il
  progetto.
- **Da fare a mano su Supabase, aperto dal 28/08**: aggiungere
  `https://www.meetonda.com/auth/conferma` e
  `http://localhost:3000/auth/conferma` ai Redirect URLs.
- **Il clone locale tende a restare indietro**: `git fetch origin` all'inizio di
  ogni sessione, e per i numeri di migrazione guardare la storia applicata su
  Supabase, non solo i file.
