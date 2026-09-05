# Passaggio di consegne — 5 settembre 2026 (Lucio, con Claude)

> Sostituisce quello del 2 settembre (André). HANDOFF.md si sovrascrive a ogni
> sessione, **ma quello che è a metà si porta avanti, non si butta**: le voci
> aperte del 28 agosto–2 settembre stanno più sotto, nella loro sezione.

## Cosa ho fatto

Sei rami, uno per bug, tutti basati su `origin/main` a `089abdf`, tutti con
`npm run lint` pulito e `npm run build` verde. Non sono mergiati: vanno aperti
come PR e passati dalla CI. **Nessuna migrazione: niente da applicare su
Supabase.**

- **`fix/dashboard-doppio-cerca`** — nella dashboard del cliente «Cerca un
  professionista» e «Parla con Bob» erano due bottoni primari sullo stesso
  schermo, tutti e due verso `/#bob`. Tolto quello in pagina.
- **`fix/orari-veri-non-standard`** — `/api/pro/slots` non leggeva
  `professional_availability`: aveva dentro lun-sab 8-18 scritto nel codice e
  lo mostrava al cliente come disponibilità del professionista. Ora legge le
  fasce vere; zero fasce = zero slot e `orariConfermati: false`, e
  l'interfaccia invita a proporre un orario in chat. `computeFreeSlots` è
  rimossa dal repo, non deprecata. **Da sapere prima di mergiare: 1
  professionista su 6 ha gli orari salvati.** Appena questo va in produzione,
  gli altri 5 smettono di mostrare slot finché non li confermano.
- **`fix/azienda-prezzi-salvati`** — `/impostazioni/azienda` diceva «✓ Salvato»
  e buttava via `min_price`, `max_price` e `price_note` quando mancava il
  servizio principale (regressione di `8f65505`). Ora la conferma arriva solo
  se è stato scritto tutto.
- **`fix/richiesta-inviata-davvero`** — `RequestDialog` non controllava gli
  errori di `request_professionals`, `request_messages` e `request_addresses`
  e mostrava comunque la spunta verde. Ora li controlla; se la consegna
  fallisce la richiesta torna a `draft` e il cliente lo legge.
- **`fix/export-appuntamenti-completi`** — l'export art. 15/20 leggeva
  `appointments` solo per `customer_id`, che scrive solo la prenotazione
  diretta: gli appuntamenti nati in chat mancavano. Ora si legge anche per
  `request_id`. **In produzione recupera 9 appuntamenti su 2 clienti.**
- **`feat/appuntamento-nel-calendario`** — ogni data di appuntamento è
  cliccabile e apre «lo metto nel tuo calendario?»: file `.ics` da
  `GET /api/appuntamenti/[id]/ics` (permessi lasciati alla RLS) o link a Google
  Calendar. Dentro l'evento solo titolo, giorno, ora, durata.

## Cosa è a metà

- **Nessuno dei sei rami è in produzione.** Vanno aperte le PR, fatta passare
  la CI e mergiate.
- **Verifica dal vivo su www.meetonda.com, desktop e 390px: da fare** dopo il
  merge, per i cinque rami che toccano l'interfaccia.
- **Gli orari dei 5 professionisti senza fasce** vanno chiesti, o messi a mano
  da admin, prima o subito dopo il merge di `fix/orari-veri-non-standard`.
- **Due cose trovate strada facendo, non sistemate, da aprire nel Piano:**
  - `appointments.customer_name` è testo libero con il nome di una persona, e
    su 14 righe (`source = 'pro'`) non è legata a nessun account: nessun
    percorso di cancellazione, nessuna regola di conservazione. Va deciso cosa
    ne facciamo — è la stessa famiglia di problemi dell'export.
  - la cancellazione account non tocca `appointments`: `customer_id` ha
    `on delete set null`, quindi la riga resta con dentro il nome. Da guardare
    insieme al punto sopra.

## Cosa ho applicato in produzione che l'altro deve sapere

**Niente.** Nessuna migrazione, nessuna modifica allo schema, nessun advisor
rilanciato. Le uniche interrogazioni su Supabase sono state di sola lettura,
per contare quanti professionisti hanno gli orari e quanti appuntamenti
l'export stava perdendo.

## Cosa è a metà — portato avanti dal 28 agosto–2 settembre

Nessuna di queste è chiusa da questa sessione.

- **La ricerca non ha interfaccia**: il risolutore (068) è pronto e nessuna
  pagina lo chiama. Deciso che vive dentro `/professionisti`.
- **069 pronta e NON applicata**: prima il PR.
- **`getProfessionals` carica tutti i professionisti e filtra in JavaScript**:
  va portato in SQL. I pesi sono decisi e vanno pubblicati in pagina (art. 5
  P2B).
- **Due verità sugli interventi**: `professional_services` (che ha il prezzo) e
  `professionals.subservice_slugs`. Va scelta una. E 4 pro su 6 non dichiarano
  nessun intervento: la ricerca per intervento trova poco perché il dato non
  c'è.
- **Slot sponsorizzati** e **registro delle ricerche a vuoto** (`search_events`,
  senza `user_id`, 12 mesi): non costruiti.
- **Le bande di fiducia** (sopra 0.80 risposta, 0.40-0.80 «forse cercavi») non
  sono rispettate dall'interfaccia.
- **La chat non passa `zone` a `/api/match`** — codice di André. Finché non lo
  fa, `requests.zone_slug` resta NULL.
- **28 zone nostre contro 88 nuclei ufficiali**: decisione di prodotto aperta.
- **Tariffa nell'unità del mestiere e costi accessori**: colonne in database,
  nessuna interfaccia. La pagina azienda dice ancora «€/h» fisso.
- **Il worker maplibre non viene emesso nel bundle di Next.**
- **`Leaked Password Protection` da accendere prima del pilota** (vuole il
  piano Pro): l'unico rilievo che gli advisor continuano a dare.
- **SMTP personalizzato non configurato**: 2 email all'ora per tutto il
  progetto. Quindici minuti di lavoro più 8-10 giorni di warm-up.
- **Da fare a mano su Supabase, aperto dal 28/08**: aggiungere
  `https://www.meetonda.com/auth/conferma` e
  `http://localhost:3000/auth/conferma` ai Redirect URLs.
- **Il clone locale tende a restare indietro**: `git fetch origin` all'inizio di
  ogni sessione, e per i numeri di migrazione guardare la storia applicata su
  Supabase, non solo i file.
