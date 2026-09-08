# Passaggio di consegne — 8 settembre 2026 (André, con Claude)

> Sostituisce quello del 5 settembre sera. HANDOFF.md si sovrascrive a ogni
> sessione, **ma quello che è a metà si porta avanti, non si butta**: le voci
> ancora aperte di Lucio e quelle vecchie stanno in fondo, nelle loro sezioni.

## Cosa è andato in produzione (4-6 settembre, ricerca)

La ricerca per parola chiave esiste e qualcuno la chiama. Prima c'era solo lo
scorrimento dell'elenco e la chat con Bob.

- **Migrazioni 067-070, applicate su Supabase** (file nel PR prima, come da
  regola). 067 vocabolario: `search_terms`, **491 termini** — 15 mestieri, 105
  interventi generati dal catalogo, 371 sinonimi. 068 risolutore:
  `search_resolve(frase, limite)` con quattro modi di riconoscimento (esatto,
  contenuto, prefisso, trigrammi) e una soglia di certezza a 0.80. 069 ordine
  per specificità: chi dichiara *quel* lavoro batte chi dichiara solo il
  mestiere. 070 una verità sulle offerte.
- **Casella di ricerca su `/professionisti`** (PR #38): suggerimenti dal
  server con pausa di 150 ms, Invio porta all'elenco filtrato con una
  targhetta rimovibile, l'URL si canonicalizza da sé (`service`, `city`).
  Sopra 0.80 dice «Stai cercando», sotto «Forse cercavi» con le alternative:
  **le bande di fiducia adesso sono rispettate dall'interfaccia.**
- **Chi fa proprio quel lavoro viene prima** (PR #39), e chi non lo ha
  dichiarato lo dice nella scheda. Provato con un caso truccato: un pro
  migliore su verifica, voto e prezzo resta **dietro** a chi ha dichiarato
  l'intervento, e ci resta anche con `&sort=prezzo`.
- **I parametri di ordinamento sono pubblicati** (PR #26): sezione
  `/come-funziona#ordine`, raggiunta da un link sotto l'elenco. Art. 22 co.
  4-bis Cod. Consumo chiede «direttamente e facilmente accessibile dalla
  pagina dei risultati»: un link dai risultati basta, la sezione a sé no.
- **`docs/RICERCA.md`**: come funziona, i pesi, cosa si registra e cosa no,
  e il ragionamento legale. Da leggere prima di toccare l'ordinamento.
- **Una verità sugli interventi: `professional_services`.**
  `professionals.subservice_slugs` è deprecata con un commento in colonna, la
  070 ha travasato le dichiarazioni mancanti. Stato vero oggi: **13 righe, 12
  con l'intervento preciso, 5 pro su 6 con almeno un intervento** — ma **8
  righe su 13 non hanno prezzo**, perché la 070 non se li è inventati.
- **`toCard` legge tutte le offerte, non la prima riga che capita** (d1bc1c2):
  prima Milano Clean Squad diceva «Tariffa su richiesta» pur avendo 20-28 €.

## Cosa è a metà

- **Il modulo per il professionista: «quali di questi lavori fai?».** Non
  esiste. È la voce che vale più di tutte adesso, perché l'ordinamento poggia
  su quella dichiarazione e le 6 righe di oggi le ho messe a mano con la 070.
  Finché non c'è, il vantaggio va a chi è stato compilato, non a chi lavora.
- **I pesi sono pubblicati ma non sono ancora un punteggio in SQL.** Chi
  dichiara il lavoro cercato viene prima perché il JavaScript lo raggruppa,
  non perché prende più punti. `getProfessionals` continua a caricare tutti i
  professionisti e a filtrare in memoria: va portato in SQL, e i pesi con lui.
- **Slot sponsorizzati**: non costruiti. Quando si fanno, nello **stesso
  commit** va sostituita la frase «Nessuna posizione è a pagamento» in
  `/come-funziona#ordine` — sostituita, non cancellata — e la targhetta
  «Sponsorizzato» va **dentro** l'elenco (all. I punto 11-bis, pratica
  sleale in sé se non si dichiara lì). Massimo uno slot nei primi tre e uno a
  metà elenco.
- **Registro delle ricerche a vuoto**: da fare, sarà la **072** (la 071 è di
  Lucio). Senza `user_id`, cifre rimosse, 60 caratteri, 12 mesi.
- **`drop column subservice_slugs`**: 072 o 073, solo dopo che nessun codice
  la legge più.
- **Verifica dal vivo del pezzo B** (casella di ricerca su www.meetonda.com,
  desktop e 390px): non fatta, rinviata da me.

## Cosa ho applicato in produzione che l'altro deve sapere

- **067, 068, 069, 070 applicate su Supabase.** Advisor di sicurezza
  rilanciati dopo, puliti: le estensioni `pg_trgm` e `unaccent` stanno nello
  schema `extensions`, non in `public`, le funzioni hanno `search_path`
  fissato, RLS su `search_terms` (lettura pubblica, scrittura admin).
- **Trappola da conoscere prima di rigiocare la 067**: un replay della 067
  *dopo* la 068 riporta il trigger di normalizzazione alla versione senza
  `tokens`, e i termini nuovi restano senza token — invisibili a tutto tranne
  la corrispondenza per parola. Riprodotto: 74 termini su 150. La 069
  installa un **trigger separato** che il replay non può disfare, e lo ripara
  con un `update`. In produzione oggi: **491 termini, 0 senza token.**
- **La 071 è mergiata e deployata, ma NON è applicata su Supabase.**
  `avvisi_servizio` non c'è, `profiles.avvisi_visti_al` non c'è. Le pagine
  pubbliche stanno in piedi perché `leggiAvvisiInCorso` fa `if (error) return
  []`: la funzione è online e silenziosamente morta, nessun avviso arriverà
  mai. **Non l'ho toccata: è di Lucio, la applica lui** — poi advisor.
- **`.gitignore`**: aggiunta `/Claude outputs/`, la cartella degli screenshot
  delle verifiche dal vivo. Non è un deliverable, non va nel repo.
- Replay `001 → 070` dai soli file del repo: **0 errori**. L'impronta a otto
  righe **non è ancora stata confrontata con la produzione** — resta il passo
  a mano con `scripts/schema_fingerprint.sql`, aperto dal 5 settembre.

## Cosa è a metà — portato avanti dal 5 settembre (Lucio)

- **Applicare la 071**, e poi **rilanciare gli advisor di sicurezza**.
- **Verifica dal vivo su www.meetonda.com, desktop e 390px**: da fare per le
  sei correzioni del 5 mattina e per i tre rami mergiati la sera.
- **1 professionista su 6 ha gli orari salvati.** Da quando
  `/api/pro/slots` legge `professional_availability`, gli altri 5 non mostrano
  nessuno slot: comportamento giusto, ma il cliente deve scrivere in chat.
  Vanno chiesti, o messi a mano da admin.
- **Gli avvisi non li vede chi non è loggato.** Volutamente: la policy di
  lettura è `to authenticated`. Una fascia pubblica sarebbe un'altra cosa.
- **`appointments.customer_name`** è il nome di una persona in testo libero,
  14 righe senza legame a nessun account: nessuna cancellazione, nessuna
  conservazione. E **la cancellazione account non tocca `appointments`**:
  `customer_id` ha `on delete set null`, la riga resta con dentro il nome.

## Cosa è a metà — portato avanti dal 28 agosto-2 settembre

Nessuna di queste è chiusa.

- **La chat non passa `zone` a `/api/match`** — codice di André.
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
