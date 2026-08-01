# Verifica P.IVA: cosa serve per farla davvero (blocco 10.1)

Analisi operativa, 31/07/2026. Aggiorna e in parte **corregge** la ricerca del
19/07 (`NOTE_E_DECISIONI.md` §10.0) alla luce di test tecnici reali.

---

## 1. La correzione: il VIES è più utile di quanto avevo concluso

Il 19/07 avevo scritto che il VIES «non basta» perché contiene solo le partite
IVA iscritte per operazioni intra-UE. **Resta vero in teoria, ma i test dicono
che in pratica copre più di quanto pensassi** — e soprattutto: esiste un'**API
REST pubblica, gratuita e senza autenticazione**, che restituisce anche la
denominazione.

Endpoint (Commissione europea):
```
GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/{partitaIVA}
```

**Test eseguiti il 31/07/2026** su due partite IVA reali e pubbliche:

| P.IVA | Soggetto | `isValid` | `name` restituito | `address` |
| --- | --- | --- | --- | --- |
| 12485671007 | Openapi SpA | `true` | `OPENAPI SPA` | Viale F. T. Marinetti 221, 00143 Roma RM |
| 06012790876 | Baze S.r.l. Società Benefit | `true` | `BAZE S.R.L. SOCIETA' BENEFIT` | Piazza di Cestello 10, 50124 Firenze FI |

**Test aggiuntivi 31/07/2026** (stesso endpoint):

| P.IVA | Soggetto | Esito |
| --- | --- | --- |
| 00743110157 | Motorola Solutions Italia S.r.l. | `isValid: true`, denominazione restituita |
| 12345678901 | numero con checksum valido ma inesistente | `isValid: false`, `userError: "INVALID"`, `name: "---"` |

Quindi il VIES distingue correttamente un numero formalmente valido ma
inesistente: il checksum da solo non basta, e la combinazione dei due gradini
funziona. Nota tecnica: il campo `name` vale `"---"` quando il dato non c'è, e
il client lo normalizza a `null`.

Risposta JSON utile: `isValid`, `requestDate` (timestamp da conservare come prova
della data del controllo), `name`, `address`, `userError` ("VALID").

**Perché la copertura è migliore del previsto:** l'iscrizione al VIES si può
chiedere già all'apertura della partita IVA (modello AA9/12) ed è **necessaria
per chi acquista servizi digitali dall'estero** — Google Ads, AWS, qualunque SaaS
in reverse charge. Di fatto quasi ogni impresa che fa pubblicità online o usa
software in abbonamento è iscritta.

**Limite che resta, e va misurato sul campo:** l'artigiano che non ha mai fatto
operazioni intra-UE può non essere iscritto, e in quel caso il VIES risponde
`isValid: false` — che **non significa partita IVA inesistente**. Il campione
testato è di due sole aziende, entrambe "digitali": non è rappresentativo degli
idraulici. La misura vera si farà sui primi pro reali (vedi §5, telemetria).

---

## 2. L'architettura consigliata: tre gradini, dal gratis al pagamento

**Gradino 1 — Checksum (già fatto, gratis, offline).**
`src/lib/vat.ts`: normalizza l'input, valida le 11 cifre e il carattere di
controllo. Scarta refusi e numeri inventati senza spendere nulla. Testato.

**Gradino 2 — VIES (gratis, nessun contratto, nessuna chiave).**
Se risponde `isValid: true` abbiamo **conferma + denominazione**: sufficiente per
concedere il livello "Pro". Costo zero, nessun fornitore, nessun DPA (vedi §4).

**Gradino 3 — Provider commerciale (a pagamento, solo se il VIES non risponde).**
Serve per i casi in cui il VIES dà `false`: interroga la banca dati ufficiale
(Agenzia Entrate / InfoCamere) e restituisce stato e denominazione. Candidati
italiani: **Openapi** (ha sandbox gratuita e documentazione pubblica),
**InfoCamere / Registro Imprese**, **Cerved**, **A-Cube**. Ordine di grandezza:
centesimi per chiamata; da confermare col listino al momento dell'attivazione.

Con questa cascata il costo reale è **vicino a zero**: si paga solo la coda dei
casi non coperti dal VIES, una volta per professionista.

*(L'Agenzia delle Entrate resta esclusa come integrazione diretta: il suo
servizio di verifica è solo web e protetto da CAPTCHA, senza API pubblica. Non
si aggira, e non serve.)*

---

## 3. Limiti tecnici da gestire nel codice

- **`isValid: false` è ambiguo.** Può voler dire: partita IVA inesistente,
  cessata, o semplicemente non iscritta al VIES. Non deve mai produrre un
  "respinto" automatico: va messa in coda per il gradino 3 o per l'esame umano.
- **Nome che non combacia.** Le ditte individuali risultano spesso col nome della
  persona, le società con la ragione sociale; il profilo Bob può avere un nome
  commerciale diverso. Per questo `nameLooksConsistent()` in `lib/vat.ts`
  *segnala* la discordanza senza decidere.
- **Disponibilità del servizio.** Il VIES è un servizio pubblico che a volte è
  lento o restituisce errori temporanei (`MS_UNAVAILABLE`). Serve timeout breve
  (3-5 s), niente blocco della UI, e ritentativo differito: la verifica è
  asincrona, non un requisito per completare l'iscrizione.
- **Rate limiting.** Nessun limite documentato per uso normale, ma va evitato di
  interrogarlo a ogni caricamento pagina: si interroga **una volta**, si salva
  l'esito con la data, si ripete solo alla scadenza.
- **Il dato invecchia.** Una partita IVA attiva oggi può cessare domani: da qui
  la necessità di una scadenza della verifica (proposta: 6 mesi) e di un
  ricontrollo periodico.
- **Non dice se il pro è abilitato.** Il VIES conferma l'esistenza fiscale, non
  i requisiti tecnico-professionali (D.M. 37/2008): quelli restano al livello
  "Pro+" con esame documentale umano.

---

## 4. Permessi, contratti e adempimenti

**Per il VIES: nessun permesso, nessun contratto, nessuna chiave API.** È un
servizio pubblico della Commissione europea, interrogabile liberamente. Va però
chiamato **da server** (route API Next.js), non dal browser: così non esponiamo
il traffico degli utenti verso terzi e controlliamo il rate.

**Per il provider commerciale (gradino 3), serve:**
1. **Contratto/account** con il fornitore (Openapi ha sandbox gratuita per i
   test: si può integrare tutto senza spendere).
2. **DPA — accordo sul trattamento dei dati (art. 28 GDPR)**: gli inviamo una
   partita IVA riferita a una persona fisica (ditta individuale), quindi un dato
   personale. Va verificato se il fornitore agisce da responsabile del
   trattamento o da titolare autonomo, e conservato l'accordo.
3. **Server UE** o garanzie equivalenti per i trasferimenti.

**Adempimenti privacy nostri, in ogni caso (anche col solo VIES):**
- **Riga nel registro dei trattamenti**: finalità "verifica dei requisiti dei
  professionisti", base giuridica **esecuzione del contratto** (art. 6.1.b) e,
  in prospettiva, **obbligo legale** quando scatterà DAC7.
- **Informativa aggiornata**: dire che verifichiamo la partita IVA presso banche
  dati pubbliche e che conserviamo l'esito.
- **Retention**: quanto teniamo lo snapshot della risposta. Proposta: finché il
  profilo è attivo + il periodo utile a difendersi da contestazioni.
- **Minimizzazione**: già rispettata dallo schema (migration 029) — la partita
  IVA sta in tabella con RLS stretta, pubblicamente si espone solo livello e
  data, mai il numero.
- **Human in the loop**: nessun declassamento o esclusione automatica.
  L'esito negativo apre un caso, non chiude un profilo (regola già fissata, e
  richiesta anche dall'art. 22 GDPR).

**Nessuna autorizzazione o abilitazione serve a noi** per fare queste verifiche:
non stiamo esercitando un'attività regolamentata, stiamo controllando un dato
pubblico sui nostri utenti. (Diverso sarebbe definirci "mediatori": vedi
`RICERCA_intermediazione_e_1341.md`.)

---

## 5. Cosa implementare, in ordine

1. **Route API server-side** `POST /api/pro/verifica-piva`: checksum → VIES →
   salvataggio esito in `professional_verification` + evento in
   `verification_events`. Con timeout e gestione degli stati ambigui.
2. **UI nel profilo pro** (`/dashboard/profilo`): campo partita IVA, esito
   immediato del checksum, stato della verifica, cosa sblocca il livello.
3. **Coda in admin**: i casi che il VIES non conferma, con azione umana
   (concedi / richiedi documenti / rifiuta con motivazione).
4. **Badge pubblico** sul profilo del professionista: etichetta + **data** +
   tooltip con cosa significa e cosa non significa (già scritto nei ToS).
5. **Telemetria del gradino 2**: contare quanti pro reali il VIES conferma e
   quanti no. È il dato che dirà se il gradino 3 serve davvero o se è marginale
   — e quindi se aprire un contratto con un fornitore.
6. **Ricontrollo periodico** (proposta 6 mesi) con declassamento assistito.

I punti 1-4 li posso fare **subito, senza account e senza spese**, perché il
VIES non richiede nulla. Il punto 5 dà la risposta sul se e quando fare il
gradino 3.

## 5-bis. Stato al 31/07/2026 (fine giornata)

Fatto e in repo:

- **Gradino 1** — `src/lib/vat.ts` (checksum, normalizzazione, confronto nomi).
- **Gradino 2** — `src/lib/vies.ts` (client server-side, tre esiti distinti).
- **Motore** — `POST /api/pro/verifica-piva` (i tre gradini, limite 3/24h,
  registro eventi, nessun rifiuto automatico).
- **Punto 2 — UI nel profilo pro** — `src/components/VatVerification.tsx`,
  innestato in `/dashboard/profilo`: checksum mentre digita, tasto di verifica,
  stato corrente, motivazione visibile al pro, e la riga che dice che il numero
  non è pubblico. Il caso "non nel VIES" è spiegato come non-rifiuto.
- **Punto 4 — Badge pubblico** — `VerificationLevelBadge` in
  `src/components/ui.tsx`: etichetta + **data** + tooltip con cosa attesta e
  cosa **non** attesta (allineato al §3.2 dei ToS professionisti). Vive sul
  profilo pubblico, nelle card di elenco e nei risultati della chat di Bob.
  Sostituisce il vecchio badge "Verificato" su quelle tre superfici: quello
  diceva più di quanto avessimo controllato e non portava la data. Resta in uso
  nella dashboard del pro e in admin, dove indica l'approvazione dello staff.
- **Migration 038** (applicata in produzione il 31/07 col nome provvisorio
  034; rinumerata perché nel frattempo sono arrivate 034/035 di André, e
  perché la 036 e la 037 — anch'esse sul badge — sono state applicate live
  **senza file in repo**: drift da sanare, vedi l'intestazione del file 038)
  — tre cose: (a) livello e data rispecchiati su
  `professionals` da un trigger, così il badge pubblico non passa più da una
  vista `security_invoker = off` (era un ERROR dell'advisor Supabase aperto
  dalla 029, ora chiuso; la P.IVA resta in `professional_verification` con RLS
  stretta); (b) colonne `vat_review_*` per lo stato e la motivazione dell'esame
  umano; (c) eventi `documents_requested` e `vat_rejected` nel registro.
  Applicata in Supabase il 31/07/2026.

- **Punto 3 — coda in admin** — sezione in cima a `/admin/professionals`
  (la voce di menu si chiamava già "Verifiche"), più
  `POST /api/admin/verifiche/[id]`. Tre azioni umane: concedi Pro, chiedi
  documenti, rifiuta — con **motivazione obbligatoria** (minimo 15 caratteri)
  sulle ultime due, perché è quella che il professionista legge nel profilo e
  riceve per email: obbligo di motivazione del Reg. UE 2019/1150. Ogni azione
  scrive in `verification_events` con autore e data; se il registro non
  accetta la scrittura la route risponde errore invece di far finta di niente.
  Nella stessa sezione ci sono anche i **livelli attivi**, così una
  concessione automatica sbagliata si revoca da lì e non via SQL.
  In dashboard admin c'è il contatore dei casi aperti.
- **Email di esito** (`lib/email.ts`): tre eventi nuovi, dormienti finché non
  c'è `RESEND_API_KEY`. Testo di servizio, mai promozionale, con un piè di
  pagina che dice il vero motivo dell'invio.

Correzioni fatte durante la revisione del 01/08 (valgono come nota per il
futuro, erano tutti errori veri):

- Un secondo tentativo **non confermato** da parte di chi era già verificato
  riscriveva `vat_checked_at` lasciando il livello: il badge pubblico avrebbe
  detto "Pro · oggi" sulla base di un controllo fallito. Ora chi è già
  verificato riceve 409 e il cambio di P.IVA passa dallo staff.
- Le `update` della route pro non guardavano l'errore: si poteva rispondere
  "verificata" con il database invariato.
- La data del VIES (`"2026-03-11+01:00"`, senza orario) diventava il giorno
  prima in UTC. Ora è normalizzata alla mezzanotte del suo fuso e tutte le
  date si formattano con `timeZone: "Europe/Rome"`, altrimenti il pro e il
  cliente leggevano due giorni diversi per lo stesso controllo.
- Il pro con richiesta in coda non poteva correggere un numero sbagliato:
  doveva aspettare di essere **respinto**. Ora il campo resta disponibile.
- `revoke ... from anon, authenticated` non toglie il grant implicito a
  `PUBLIC`: la revoca era inefficace (la 032 lo faceva già giusto).
- La policy di INSERT su `professionals` non vincolava le colonne nuove: un
  pro poteva teoricamente nascere `documents_verified`. Ora è nella policy,
  non solo in un effetto collaterale dei trigger.

Non fatto:

- **Punto 5 — telemetria** e **punto 6 — ricontrollo periodico**: invariati.
- Nessun canale per **caricare i documenti**: "chiedi documenti" oggi apre uno
  scambio via email, non un upload. Da valutare quando arriva il livello Pro+.
- **Riga nel registro dei trattamenti** (DATA_COMPLIANCE §4): da aggiungere,
  finalità "verifica dei requisiti dei professionisti", base giuridica
  esecuzione del contratto. Il testo per l'informativa è già quello mostrato
  nella card del profilo pro.
- L'ordinamento degli elenchi **non** è stato toccato: continua a pesare il
  vecchio `verification_status`. Se il livello deve contare nel ranking è una
  decisione da prendere (vedi §6), non un dettaglio tecnico.

## 6. Decisioni che restano tue

- **Quali categorie richiedono almeno "Pro"** per contattare i clienti
  (proposta: le 5 core, dove l'abilitazione è un tema di sicurezza).
- **Durata della verifica** prima del ricontrollo (proposta: 6 mesi).
- **Cosa fa un "Iscritto"**: profilo visibile ma senza contatto? del tutto
  invisibile ai clienti?
- Se aprire ora la **sandbox Openapi** o attendere i dati della telemetria.

## Fonti
- VIES REST API, Commissione europea — test eseguiti il 31/07/2026 su
  `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/{vat}`
- Servizio "Verifica partita IVA" dell'Agenzia delle Entrate (solo web, con
  CAPTCHA, nessuna API pubblica) — agenziaentrate.gov.it
- D.Lgs. 32/2023 (DAC7); Reg. UE 2016/679 (GDPR artt. 6, 22, 28); D.M. 37/2008
- Schema dati: `supabase/migrations/029_professional_verification.sql`
- Validazione: `src/lib/vat.ts` (testata su P.IVA reali il 30/07/2026)
