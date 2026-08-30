# Gruppi aziendali e permessi — piano di costruzione

**Data:** 30 agosto 2026 · **Chiesto da:** Lucio · **Stato:** da approvare, niente
ancora costruito · **Prerequisito letto:** `docs/Bob_Business_Accounts_Design_Spike.md`
(spike #38.0, decisioni concordate il 26/07/2026)

---

## 0. Cosa cambia rispetto a luglio

Lo spike #38.0 aveva già deciso il modello e messo la costruzione **nel 2027**.
Il 30/08 Lucio chiede di portarla avanti, con tre requisiti espliciti:

1. un'azienda in Bob è fatta di **più persone**, non di una sola;
2. **nelle impostazioni** ci sono le impostazioni del gruppo, una per azienda;
3. l'azienda **dà permessi ai sottoposti**, e la cosa è **riservata al piano
   massimo** (Business) — «probabilmente lo sposteremo, per ora va bene così».

Il punto 3 non è una variante del piano di luglio: lo **contraddice**. Lo spike
aveva scelto *workers-as-records* — collaboratori senza account, gestiti dal
titolare (§0.1, §6.1). «Dare permessi ai sottoposti» presuppone che il
sottoposto **entri in Bob**, cioè un account e una sessione. Le due cose non si
mettono insieme da sole e questa è la prima domanda a cui rispondere.

---

## 1. La domanda da chiudere prima di scrivere una riga

> **Il sottoposto entra in Bob con un suo accesso, oppure esiste solo come
> scheda gestita dal titolare?**

| | Scheda senza accesso (spike, luglio) | Account con permessi (richiesta, agosto) |
|---|---|---|
| Chi lavora in Bob | solo titolare e admin | anche i collaboratori |
| Cosa vende il piano Business | «gestisci il calendario dei tuoi» | «i tuoi entrano e lavorano» |
| Dati personali dei dipendenti trattati da Bob | pochi: nome e calendario | account, email, accessi, messaggi |
| Conseguenza legale | Bob resta fornitore di strumenti | **Bob diventa responsabile del trattamento per conto dell'azienda: serve un accordo art. 28 GDPR che oggi non esiste** |
| Costo | giorni | 2–3 settimane |

**Proposta:** costruire il modello dei membri **una volta sola** con
`user_id` nullo per default (è già quello che lo spike prevede), e accendere
l'accesso dei collaboratori come **fase 2 dello stesso schema**, non come
riscrittura. Così la fase 1 è utile da sola (il titolare gestisce chi c'è e chi
fa cosa) e la fase 2 aggiunge solo un invito e un ambito di lettura.

Se invece la fase 2 serve subito perché è *quella* la cosa che si vende, va
detto adesso: cambia l'ordine, non lo schema.

---

## 2. Cosa si costruisce, in ordine

### Fase 1 — l'azienda esiste (migrazione 066)

Nuove tabelle, additive: chi lavora da solo non se ne accorge.

- `organizations` — nome, P.IVA, titolare della fatturazione, stato.
- `organization_members` — organizzazione, `user_id` **nullable**, nome, ruolo
  (`owner | admin | worker`), stato, data.
- `professionals.organization_id` **nullable** — la scheda pubblica resta una,
  e appartiene a una persona *oppure* a un'azienda.
- Helper RLS unico `private.is_org_member(org, ruolo_minimo)`, `security
  definer`, `search_path` vuoto e `revoke execute from anon, authenticated`
  (la lezione della 062/063: se la funzione non è revocata, è chiamabile via
  `/rest/v1/rpc/`).
- Policy: i membri leggono la propria azienda; scrivono solo `owner` e `admin`;
  nessuna policy per `anon`.
- Vincolo: un'organizzazione ha **sempre almeno un `owner`** — trigger, non
  buona volontà dell'interfaccia.

### Fase 1b — le impostazioni del gruppo (`/impostazioni/gruppo`)

Una sezione nuova nel menu delle impostazioni, con:

- l'elenco dei membri, il ruolo di ciascuno, chi è il titolare;
- aggiungi / rimuovi membro, cambia ruolo;
- i dati dell'azienda (nome, P.IVA) — che è anche il posto naturale dove far
  arrivare la verifica di #10 quando sarà a livello di azienda.

**Il cancello del piano sta in tre posti, non uno:**

1. la voce di menu non compare sotto Business — *cortesia*;
2. la pagina rimanda indietro se il piano non è Business — *comodità*;
3. **la policy RLS e la route rifiutano la scrittura se il piano non è
   Business** — *questo* è il cancello. I primi due si aggirano con l'URL e
   con una chiamata REST.

### Fase 2 — i collaboratori entrano (migrazione 067, da decidere)

- Invito via email → il collaboratore si registra → `organization_members.user_id`
  viene collegato.
- `users.role` resta `professional`; l'ambito lo dà l'appartenenza, non il ruolo
  globale.
- RLS a privilegio minimo: un `worker` vede **i propri** appuntamenti e le
  **proprie** conversazioni, mai l'agenda dell'azienda.
- **Dipendenza dura: l'invito è un'email, e le email di autenticazione passano
  dal mailer interno di Supabase, 2 all'ora per tutto il progetto.** Finché non
  c'è l'SMTP personalizzato, un'azienda con cinque collaboratori non riesce a
  invitarli. Non è un dettaglio da scoprire in produzione: è un blocco.

### Fase 3 — il lavoro assegnato (già progettata nello spike, non urgente)

`appointments.worker_member_id`, disponibilità per membro, vincolo di
esclusione `gist` contro le sovrapposizioni. Serve quando le aziende avranno
davvero più calendari; prima è complessità senza utenti.

---

## 3. Quello che va deciso insieme al codice, non dopo

| # | Cosa | Perché non può aspettare |
|---|---|---|
| 1 | **Accordo art. 28 (DPA) nei ToS professionisti** | Dal momento in cui l'azienda mette in Bob i dati dei suoi collaboratori, l'azienda è titolare e **Bob è responsabile del trattamento**. Serve un contratto scritto con oggetto, durata, istruzioni, subresponsabili, cancellazione a fine rapporto. Oggi i ToS professionisti trattano ogni pro come una persona singola: non c'è. Senza, la fase 1 tratta dati di dipendenti senza base contrattuale |
| 2 | **Cosa succede quando il piano scende da Business** | I membri perdono l'accesso: è una **restrizione del servizio**, e il Regolamento P2B (art. 4) vuole motivazione e preavviso. Va scelto adesso se il gruppo si congela (leggibile, non modificabile) o si spegne, e con quanti giorni di avviso. Un declassamento a sorpresa è esattamente il rischio già annotato in `roadmap/findings.csv` per i codici fondatori |
| 3 | **Retention e cancellazione di un membro** | Regola della casa: nessun dato personale orfano o non cancellabile. Rimuovere un collaboratore deve **de-identificare** ciò che resta legato a lui (appuntamenti storici, messaggi attribuiti) — `set null` più un segnaposto, mai una riga che resta lì col suo nome per sempre |
| 4 | **Riga di RoPA** | Nuova finalità: gestione dei collaboratori per conto dell'azienda. Interessati: i dipendenti, che **non sono utenti di Bob** nella fase 1 e non hanno mai visto un'informativa nostra. L'informativa la deve dare il datore di lavoro; noi dobbiamo dirglielo nei ToS |
| 5 | **Verifica (#10) a livello di azienda** | Domanda lasciata aperta dallo spike §8: la P.IVA verificata è quella dell'azienda, non del titolare. Se i gruppi arrivano prima di ottobre, #10 va costruita già così |
| 6 | **Fatturazione a posti (#12)** | Lo spike sceglie il per-seat con `quantity` di Stripe. Se i gruppi arrivano prima di #12, #12 va costruita già con la quantità, altrimenti è un rifacimento |

---

## 4. Ordine consigliato

1. Chiudere la domanda del §1 (una riga di risposta).
2. Scrivere il pezzo di DPA nei ToS professionisti — **prima** della migrazione,
   non dopo: è la base giuridica di tutto il resto.
3. Migrazione 066 + `/impostazioni/gruppo` con il cancello sul piano nei tre
   posti. Advisor Supabase subito dopo l'applicazione.
4. Decidere il declassamento (§3.2) e scriverlo nei ToS insieme al resto.
5. Fase 2 solo dopo l'SMTP personalizzato.

**Costo onesto:** fase 1 + 1b sono 3–4 giorni di lavoro pieno se le risposte
del §3 arrivano prima; la fase 2 è un'altra settimana e oggi è bloccata
dall'email. Non è un lavoro da incastrare in una serata.
