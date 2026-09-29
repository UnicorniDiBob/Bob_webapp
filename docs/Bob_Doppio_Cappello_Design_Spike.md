# Bob — Design spike: il doppio cappello (cliente e professionista nello stesso account)

> **DECISO il 29/09/2026 da Lucio — due account separati, uno per mestiere.** La strada (b), un account solo con due cappelli, è scartata. L'analisi qui sotto resta com'era, marcata: serve a chi fra sei mesi chiederà perché. Le voci che restano sono al §9; la voce nuova, le sessioni multiple, al §10.

**Stato:** DECISO il 29/09/2026 da Lucio — strada (a), due account separati; niente costruito · **Data:** 29 settembre 2026 · **Autore:** Lucio, con Claude
**Proprietari:** la scelta l'ha presa Lucio il 29/09/2026; la casetta nell'area in alto è di André, Registro, termini e sessioni multiple di Lucio (vedi §9).
**Perché adesso:** un professionista che ha bisogno di un idraulico oggi deve aprire un secondo account con un'altra email. Prima del pilota di gennaio conviene sapere se si risolve in interfaccia o in schema, perché le due strade toccano cose diverse, e una delle due tocca l'autenticazione.

> **Come si legge questo documento.** Ogni affermazione è marcata:
> **FATTO** = verificato il 29/09/2026 sul codice di `main` (`1e0325e`) o sul database di produzione, con il punto esatto;
> **DECISO** = regola già scritta del progetto (CLAUDE.md, DATA_COMPLIANCE.md), che la proposta deve rispettare;
> **PROPOSTO** = opinione di questa spike, da approvare. Una proposta scritta come decisione è il modo in cui questo
> progetto si è già ritrovato con note che descrivono uno stato che non esiste: qui non succede.
> **SCELTO / SCARTATO** = esito della decisione del 29/09/2026 (Lucio). Una proposta scartata resta scritta com'era,
> con la marcatura: il materiale serve, la conclusione no.

---

## 0. Foglio delle decisioni (decisione presa il 29/09/2026 da Lucio)

| # | Domanda | Esito |
|---|---|---|
| 1 | Due account legati, o un account solo? | **DECISO il 29/09 da Lucio: due account separati, uno per mestiere (strada a).** La proposta della spike, un account solo (strada b), è **SCARTATA** |
| 2 | Cosa diventa `users.role`? | **Non si applica:** resta com'è, un ruolo per account |
| 3 | Disposizione dell'area in alto | **Superata:** A, B e C nascevano dal doppio cappello. Con un ruolo per account la casetta porta alla casa di quell'account (§9, voce 2) |
| 4 | Il cappello nell'indirizzo o in uno stato? | **Non si applica:** un mestiere per account |
| 5 | Abbinarsi a sé stessi | **Resta, ma non qui:** è un rilievo *serious* in `roadmap/findings.csv` (29/09), vivo adesso e indipendente dalla scelta |
| 6 | Chiudere l'attività senza cancellare l'account | **Non si applica:** ogni account si cancella da sé |

**Voce nuova, che prima non c'era:** restare connessi a tutti e due gli account e passare dall'uno all'altro senza rifare il login (§10). **Dipendenza:** l'SMTP personalizzato di Supabase (§10.4).

---

## 1. Dove siamo oggi (FATTO, 29/09/2026)

### 1.1 Il ruolo sta in `users`, non in `profiles`

- **FATTO.** L'unica colonna `role` di un utente è `public.users.role`, con vincolo `customer | professional | admin | cs`. `profiles` non ha nessun ruolo (query su `information_schema.columns`: le altre due colonne `role` sono di `account_deletion_reasons` e `onboarding_answers`).
- **FATTO.** Il browser lo legge in `src/components/AuthProvider.tsx:40` e, se la lettura fallisce, ripiega su `"customer"` (`:47`): un errore trasforma chiunque in cliente senza dirlo.
- **FATTO.** Un'email corrisponde a un solo utente di Supabase Auth: il secondo cappello oggi è un secondo account con un'altra email.

### 1.2 L'area in alto

- **FATTO.** `src/components/Header.tsx:119-123` (e `:212-213` sul telefono): la voce è **una sola** e punta **sempre** a `/dashboard`; cambia l'etichetta — «Il mio lavoro» se `role === "professional"`, «I miei lavori» per tutti gli altri. Non sono due posti: è **un indirizzo che mostra due pagine diverse**. `src/app/dashboard/page.tsx:205` sceglie `ProWorkspace` o l'area cliente dal ruolo; admin e cs vengono mandati via (`:72`).
- **FATTO.** Il resto dell'intestazione dipende dal ruolo in quattro punti: link Admin (`:70`), «Parla con Bob» nascosto ai pro (`:81`), l'etichetta di verifica mostrata al pro (`:92`), campanella nascosta allo staff (`:117`).

### 1.3 Chi legge il ruolo — e chi no

**Nel database (FATTO, policy e funzioni di produzione):**

- La RLS del lato **cliente** passa da `requests.customer_id = auth.uid()` (richieste, messaggi, professionisti della richiesta, indirizzi, appuntamenti, recensioni). **Non guarda il ruolo.**
- La RLS del lato **professionista** passa da `professionals.user_id = auth.uid()` o `private.my_professional_ids()`. **Non guarda il ruolo.**
- **Solo due oggetti leggono `users.role` per decidere:** la policy «Pro creates own profile» su `professionals` (serve `role = 'professional'` per creare il profilo pro) e il trigger `termini_accettati_all_iscrizione` della mig 100 (sceglie il pubblico dei termini). Più le policy dello staff (`admin`/`cs`), che qui non cambiano.

**Conseguenza, ed è il fatto che orienta tutta la spike:** per il database un utente può già essere cliente di una richiesta e professionista di un'altra. La separazione fra i due mestieri oggi la fa **l'interfaccia**.

**Nel codice (FATTO):** una cinquantina di file leggono il ruolo. Quelli che cambiano significato con due cappelli:

| Dove | Cosa fa col ruolo oggi |
|---|---|
| `src/app/dashboard/page.tsx:78,205` | sceglie l'area pro o l'area cliente |
| `src/app/messaggi/page.tsx:136` | decide da che parte scrivi (`sender_type`) **dal ruolo**, non dalla richiesta |
| `src/components/BobChat.tsx:229,284,649` | la chat di Bob parte solo per `role === "customer"`: è l'unico blocco che impedisce a un pro di chiedere un servizio |
| `src/app/impostazioni/{azienda,lavori,zone,orari,piano,verifica}` | se non sei pro, rimandano a `/dashboard` |
| `src/app/impostazioni/indirizzi/page.tsx:62` | se sei pro, rimanda ad `azienda`: un pro non può salvare indirizzi da cliente |
| `src/app/api/account/esporta/route.ts:74` | **l'export dei dati è bloccato per chi non è cliente** (409, «scrivici») |
| `src/app/api/account/cancellazione/route.ts:136` | per un pro disattiva il profilo, poi cancella **tutto** l'account |
| `src/app/api/termini/accetta/route.ts` + `pubblicoPerRuolo()` in `src/lib/termini/registro.ts:172` | un utente ha **un** pubblico dei termini |
| `src/app/login/page.tsx:88` | all'iscrizione si sceglie **un** ruolo |

---

## 2. Cosa il modello deve rispettare (DECISO — regole già scritte)

1. **Il matching resta «scelto dal cliente»**, mai assegnato (CLAUDE.md, AI/matching): niente che somigli a un'allocazione automatica.
2. **Divulgazione progressiva:** richiesta pseudonimizzata prima, contatti completi solo dopo l'accettazione (CLAUDE.md; mig 044-046; `private.can_see_request_address()`).
3. **Recensioni «verificate» solo se legate a una transazione realmente conclusa**; autore de-identificato alla cancellazione (CLAUDE.md).
4. **I termini dei professionisti presuppongono un utente business** (Reg. UE 2019/1150); quelli dei clienti un consumatore. Il registro dei termini distingue già per **pubblico** (`src/lib/termini/registro.ts`, `terms_acceptances.audience`, mig 100).
5. **Ogni dato personale** ha base giuridica, riga nel Registro, conservazione e percorso di cancellazione (DATA_COMPLIANCE.md §0).
6. **Le email di autenticazione** passano dal mailer di Supabase, 2 all'ora per tutto il progetto (CLAUDE.md): ogni account in più consuma quel tetto.

---

## 3. L'area in alto: tre disposizioni (analisi per la strada b — SUPERATA il 29/09/2026)

La casetta sostituisce «I miei lavori» / «Il mio lavoro». Il problema non è l'icona: oggi quella voce è **un indirizzo con due significati**, e un simbolo muto non può portarne due. Per chi ha due cappelli, «casa» deve voler dire una cosa sola.

Legenda: 🏠 casa · 🧰 lavoro · 🔔 campanella · 👤 profilo · 💬 Parla con Bob

### Disposizione A — «La casa è dove lavori, se lavori»

```
Cliente:          [Bob]  ……  💬 Parla con Bob   🔔  🏠  👤
Professionista:   [Bob]  ……                     🔔  🏠  👤      🏠 = area di lavoro
Entrambi:         [Bob]  ……  💬 Parla con Bob   🔔  🏠  👤      🏠 = area di lavoro, con una scheda «Le mie richieste»
```

Pro: una sola icona, nessuna decisione. Contro: **per il pro-cliente «casa» vuol dire lavoro**, e le sue richieste private diventano una scheda dentro il lavoro — la stessa confusione di oggi, con meno testo per spiegarla.

### Disposizione B — «Casa è la tua vita privata, la valigetta è il lavoro» (era la proposta della spike, superata)

```
Cliente:          [Bob]  ……  💬 Parla con Bob   🔔  🏠        👤    🏠 → /casa  (richieste, preventivi, appuntamenti da cliente)
Professionista:   [Bob]  ……  💬 Parla con Bob   🔔  🏠  🧰    👤    🧰 → /lavoro (richieste ricevute, calendario, giornata)
Entrambi:         uguale al professionista                            🏠 è piena, 🧰 è piena: due posti, due significati
Staff:            [Bob]  ……                     Admin   👤          nessuna casa: lo staff non ha un'area cliente
```

- 🏠 significa **la stessa cosa per tutti**: le cose che hai chiesto tu. Un pro che non ha mai chiesto niente la trova vuota, con «Ti serve un servizio? Chiedi a Bob».
- 🧰 compare solo a chi ha un profilo professionale.
- «Parla con Bob» torna visibile anche ai pro: oggi è nascosto (`Header.tsx:81`), ed è esattamente il motivo per cui un pro non può chiedere un servizio.
- Costo: due indirizzi al posto di `/dashboard`. Attenzione a `next.config.mjs`, che reindirizza `/dashboard/:sezione+` verso `/impostazioni/:sezione+`, e a `ROTTE_PRIVATE` in `middleware.ts`: le rotte nuove vanno aggiunte lì, se no nascono pubbliche.

### Disposizione C — «Una casa e un selettore di cappello»

```
Entrambi:         [Bob]  ……  🔔  🏠  [ Cliente ▾ | Professionista ]  👤     🏠 porta alla casa del cappello scelto
```

Pro: una sola casetta. Contro: **uno stato nascosto**. Lo stesso clic porta in due posti a seconda di un interruttore che si dimentica; un link incollato a qualcuno si apre nel cappello sbagliato; le notifiche vanno smistate fra i due. È il selettore della strada (a), senza i suoi costi ma con il suo difetto.

**Era la proposta: B. Superata dalla decisione del 29/09:** con due account separati ogni account ha un ruolo solo, e la casetta ha già un significato solo per ciascuno.

---

## 4. Il doppio cappello: le due strade

### 4.1 Strada (a) — Due account legati, con un selettore — **SCELTA il 29/09/2026 da Lucio**

> Decisione: **due account separati, uno per mestiere.** Il passaggio dall'uno all'altro senza rifare il login è la voce nuova del §10, che progetta anche la parte «Sessione» qui sotto.

**Schema.** Due utenti Auth distinti (due email, per il vincolo di Supabase), ognuno col suo `users.role` di oggi. Una tabella nuova di legame (`account_links`: utente A, utente B, confermato il), con RLS.

**RLS e policy.** Invariate — ed è il suo pregio apparente: ogni utente resta di un tipo solo. Ma ogni controllo «è la stessa persona?» (§5) deve passare dalla tabella dei legami.

**Sessione.** Passare da un account all'altro vuol dire **cambiare sessione**: o si rifà il login (e allora il selettore è un tasto «esci ed entra»), o il server conia una sessione per l'altro utente, cioè una forma di impersonazione con l'API di amministrazione di Supabase. È la parte più delicata dell'intero progetto da farsi in casa.

**Costi.**
- Due email per una persona, o alias: attrito vero, e ogni iscrizione consuma il tetto di 2 email/ora (DECISO §2.6).
- **Due interessati nel Registro per una persona sola:** export, cancellazione e rettifica vanno fatti su due righe, e la seconda si dimentica.
- Il divieto di abbinarsi a sé stessi e di recensirsi (§5.1, §5.2) diventa un controllo **attraverso** la tabella dei legami: più facile da sbagliare, e aggirabile da chi non lega i due account.
- Due campanelle, due caselle messaggi.

### 4.2 Strada (b) — Un account solo, che cambia vista — **SCARTATA il 29/09/2026 da Lucio**

> Era la proposta della spike. Resta scritta com'era, per chi chiederà perché; le frasi «Proponeva» sono al passato di proposito.

**Schema.**
- `users.role` si restringe a dire se sei **staff** (`admin`, `cs`) o no. Per tutti gli altri, «cliente» è la condizione di base; «professionista» = **esiste una riga in `professionals`** con il tuo `user_id` — che è già il criterio di `private.my_professional_ids()` e di tutte le policy lato pro.
- Per non rompere niente, **Proponeva:** si lascia la colonna com'è (`customer`/`professional`) durante il passaggio e si smette di leggerla, lettore per lettore; si toglie alla fine.

**RLS e policy.**
- Le policy del lato cliente e del lato pro **restano come sono** (§1.3).
- «Pro creates own profile»: invece di `users.role = 'professional'`, **Proponeva:** richiedere che l'utente abbia **accettato i termini professionisti** (una riga in `terms_acceptances` con `audience = 'professional'`). È una condizione più vera del ruolo: dice che ha firmato il contratto business.
- Il trigger `termini_accettati_all_iscrizione` (mig 100) resta per l'iscrizione; il passaggio «divento anche professionista» registra la seconda accettazione dalla route, con il suo pubblico.

**Sessione.** Una sola. Il cappello non è uno stato della sessione: è **dove sei** (`/casa` o `/lavoro`, disposizione B). Niente impersonazione, niente selettore.

**Costi.** Quasi tutti nell'interfaccia (§1.3, tabella): dashboard divisa in due aree, chat che decide il lato **dalla richiesta** e non dal ruolo, impostazioni che guardano «hai un profilo pro?» invece del ruolo, Bob che accetta anche i pro. Nel database: una policy riscritta e due vincoli nuovi (§5). Una migrazione, non un'architettura.

### 4.3 Il confronto

| | (a) Due account legati | (b) Un account solo |
|---|---|---|
| `users.role` | invariato | solo staff / non staff; «pro» = ha un profilo |
| RLS esistente | invariata | invariata tranne «Pro creates own profile» |
| Sessione | cambia a ogni passaggio (login o impersonazione) | una sola |
| Email e Auth | due email, due iscrizioni sul tetto di 2/ora | una |
| Interessati GDPR | due righe per una persona | una |
| Abbinarsi / recensirsi | controllo attraverso i legami, aggirabile | vincolo diretto su `auth.uid()` |
| Dove sta il costo | autenticazione (la parte più rischiosa) | interfaccia (la parte più visibile) |

**La spike proponeva la strada (b) — SCARTATA il 29/09/2026 da Lucio, che ha scelto la (a).** L'argomento era questo: il database è già un modello a cappello doppio (§1.3); la strada (a) costruirebbe un secondo account per aggirare un limite che esiste solo nell'interfaccia, e sposterebbe il rischio proprio dove Bob è più fragile: l'autenticazione e il tetto delle email.

---

## 5. Le code, guardate prima di consigliare

> Le analisi restano: sono fatti accertati. Le proposte legate alla strada (b) sono superate e sono al passato. Quello che è vivo adesso, qualunque strada, sta in `roadmap/findings.csv`.

### 5.1 Il matcher non deve propormi a me stesso

- **FATTO: oggi non c'è nessuna esclusione.** `/api/match` e `getProfessionals()` in `src/lib/data.ts` non escludono il profilo di chi chiede; `request_professionals` la scrive il browser (`RequestDialog.tsx:222`, `QuoteDialog.tsx:228`) con qualunque `professional_id`, e la policy «User inserts own request_professionals» controlla solo che la richiesta sia tua. L'unico ostacolo è `BobChat`, che parte solo per i clienti: **un pro può già abbinarsi a sé stesso chiamando l'API.**
- **PROPOSTO, in entrambe le strade — e ora rilievo *serious* in `roadmap/findings.csv` (29/09):** (1) il matcher esclude i profili con `user_id = auth.uid()`; (2) **nel database**, un vincolo (trigger su `request_professionals`) che rifiuta un professionista il cui `user_id` coincide con il `customer_id` della richiesta. Sullo stesso account è un confronto diretto. **Con la strada scelta (a)**, i due account di una persona hanno due `user_id` diversi: il vincolo non li vede, a meno che il server sappia che sono della stessa persona (§10.1).
- Resta «scelto dal cliente» (DECISO §2.1): si toglie una scelta impossibile, non se ne aggiunge una automatica.

### 5.2 Un professionista che recensisce un professionista

- **FATTO.** La policy «Customer inserts review for closed request» richiede: autore = cliente della richiesta, richiesta con `status = 'closed'`, professionista collegato alla richiesta in `request_professionals`. Non richiede un appuntamento `completed` né un pagamento.
- **Un pro che recensisce un altro pro come cliente regge**: è un cliente vero di una richiesta vera, e la recensione vale come quella di chiunque altro.
- **Recensirsi da soli non regge**, e oggi il database non lo impedisce: basta abbinarsi a sé stessi (§5.1) e chiudere la richiesta. **PROPOSTO:** un vincolo che rifiuta una recensione il cui `professional_id` appartiene al `customer_id` (con (b) diretto, con (a) attraverso i legami).
- **FATTO, fuori dal doppio cappello ma da sapere:** «verificata» oggi vuol dire «legata a una richiesta chiusa», non «a una transazione conclusa» come dice la regola (DECISO §2.3). Una richiesta chiusa senza lavoro fatto dà comunque diritto a recensire. Rilievo a parte (§9).

### 5.3 Quale testo dei termini ha accettato, e quando

- **FATTO.** Il registro distingue già per **pubblico** (`customer` / `professional`), ogni pubblico ha la sua sequenza di versioni, e `terms_acceptances` ha la colonna `audience` (mig 100). Un utente può avere righe per tutti e due i pubblici: lo schema lo regge già.
- **FATTO: il codice no.** `pubblicoPerRuolo()` dà **un** pubblico per utente; la route `/api/termini/accetta` accetta solo quello; il trigger d'iscrizione ne deriva uno dal ruolo.
- **Proponeva, per la strada (b):** la route riceve il pubblico come parametro e lo controlla contro la condizione vera (per `professional`: sta creando o ha un profilo pro); il passaggio «divento anche professionista» è **il momento dell'accettazione dei termini business**, con la sua riga. Così la risposta a «quale testo ha accettato e quando» è: due righe, una per pubblico, ognuna con la sua versione e la sua ora.
- **Da far guardare al legale:** i termini clienti presuppongono un consumatore. Un idraulico che chiede un elettricista per un cantiere suo compra da professionista, non da consumatore. Il testo clienti va riletto per questo caso prima di aprirlo ai pro.

### 5.4 Divulgazione progressiva: un pro che è anche cliente

- **FATTO.** La regola vive per richiesta, non per ruolo: l'indirizzo completo lo vede il professionista solo con un appuntamento `confirmed` o `completed` (`private.can_see_request_address()`), e il cliente vede sempre il proprio.
- **Non cambia niente** in nessuna delle due strade: quando il pro lavora vede i dati degli altri clienti con le stesse regole di oggi; quando è cliente, gli altri pro vedono i suoi con le stesse regole.
- **Il rischio vero è d'interfaccia, non di policy:** con un account solo, un'area che mescolasse «le mie richieste» e «le richieste che ricevo» renderebbe facile scambiare un cliente per un altro. La disposizione B li tiene in due posti.

### 5.5 Cancellazione: cosa si cancella se i cappelli sono due

- **FATTO.** Oggi per un pro la cancellazione disattiva il profilo e poi cancella **l'intero account** (`cancellazione/route.ts:136`); le cascate portano via `professionals` e, con lui, le recensioni **ricevute** (`ratings.professional_id` è `ON DELETE CASCADE`).
- **FATTO.** L'export dei dati è bloccato per i pro (`esporta/route.ts:74`): un pro-cliente non potrebbe scaricare nemmeno i suoi dati da cliente.
- **Proponeva, per la strada (b):** due operazioni distinte.
  1. **Chiudi l'attività:** disattiva il profilo pro (`deactivated_at`, esiste già) e lo cancella dopo il periodo dichiarato, lasciando vivo l'account cliente. Resta da decidere cosa succede alle recensioni ricevute (oggi spariscono con la cascata) e alle fatture (10 anni, DATA_COMPLIANCE §5).
  2. **Cancella l'account:** entrambi i cappelli, come oggi.
  E l'export copre tutti e due i cappelli.
- **Con la strada scelta (a):** ogni account si cancella da sé, con il percorso di oggi. Una persona che chiede di cancellare «tutto» va servita su tutti gli account che indica: è una questione di processo (§9, voce 3), non di codice.

---

## 6. Dati personali (DATA_COMPLIANCE §0)

- **Con la strada scelta (a):** nessuna finalità nuova. Una persona può avere due account, e i diritti (export, cancellazione, rettifica) si esercitano per account: la riga A1 del Registro lo deve dire (§9, voce 3). A25 non cambia: ogni account ha un pubblico solo.
- **Se le sessioni multiple (§10) registrano lato server che due account sono della stessa persona**, quel legame è un dato nuovo, con base giuridica, riga nel Registro, conservazione e cancellazione. Se restano solo nel browser, no.
- **DPIA:** nessun innesco nuovo in nessuna delle due.

---

## 7. Stima grossolana

Scritta per la strada (b), superata. **Con la strada scelta (a)** il costo sta tutto in una voce: le sessioni multiple (§10), che toccano l'autenticazione — la parte in cui Bob è più fragile — e che dipendono dall'SMTP (§10.4). Le voci d'interfaccia della strada (b) non si fanno (§9).

---

## 8. Stato delle domande

| Domanda | Stato |
|---|---|
| Strada (a) o (b) | **DECISA il 29/09/2026 da Lucio: (a), due account separati** |
| Disposizione A, B o C | **Superata** dalla decisione |
| Cappello nell'indirizzo o in uno stato | **Non si applica** |
| Recensioni ricevute alla chiusura dell'attività | **Non si applica**: con account separati si cancella l'account pro, come oggi |
| Termini clienti per un professionista che compra per lavoro | **Aperta**, da legale (§9, voce 4) |
| Abbinarsi a sé stessi via API | **Fatto accertato**, rilievo in `findings.csv` |
| Dove vivono le due sessioni, come si evita quella sbagliata, cosa succede alla scadenza | **Aperta**, da progettare (§10) |

---

## 9. Voci per il Piano (stato dopo la decisione del 29/09/2026)

Le undici voci diventano cinque: una è fatta, tre restano, una nasce adesso. Sette sono chiuse come **NON DA FARE**.

**Le cinque voci**

1. **Scegliere la strada** — *Lucio e André* — **FATTA il 29/09/2026 (Lucio): due account separati, uno per mestiere.**
2. **Area in alto: la casetta** — *André* — Al posto di «I miei lavori» / «Il mio lavoro». Con un ruolo per account porta alla `/dashboard` di quell'account, senza valigetta. Desktop e 390px.
3. **Registro dei trattamenti, riga A1** — *Lucio* — Una persona può avere due account; export, cancellazione e rettifica si esercitano per account, e una richiesta «su tutto» va servita su tutti gli account che la persona indica.
4. **Legale: termini clienti per un professionista che compra per lavoro** — *Lucio* — I termini clienti presuppongono un consumatore; va riletto il caso dell'account cliente di un professionista che compra per la sua attività.
5. **Sessioni multiple: passare da un account all'altro senza rifare il login** — *Lucio* — Voce nuova. Prima di costruire va progettato quanto scritto al §10. **Dipende dall'SMTP personalizzato di Supabase (§10.4).**

**Chiuse come NON DA FARE (29/09/2026)**

Tutte e sette nascevano dal mescolare i due mestieri in un account solo. Con account separati non esistono.

| Voce di prima | Perché non si fa |
|---|---|
| `/dashboard` diviso in area cliente e area di lavoro (André) | Un account ha un'area sola |
| Messaggi: il lato si decide dalla richiesta (André) | In un account il lato è uno solo, e il ruolo lo dice già |
| Bob e impostazioni per capacità, non per ruolo (André) | Il ruolo resta il criterio giusto: un mestiere per account |
| Flussi «diventa anche professionista» e «chiudi l'attività» (André) | Si apre un secondo account; si chiude cancellando quello |
| Migrazione: il profilo pro si crea con i termini business accettati (Lucio) | `users.role` resta; la policy «Pro creates own profile» è corretta così |
| Route dei termini con il pubblico esplicito (Lucio) | Un account ha un pubblico solo: `pubblicoPerRuolo()` basta |
| Cancellazione in due (Lucio) | Ogni account si cancella da sé, con il percorso di oggi |

**Non sono voci ma rilievi**, vivi adesso e indipendenti dalla scelta, in `roadmap/findings.csv` dal 29/09: l'inserimento in `request_professionals` che non vincola `professional_id` (*serious*), l'export che risponde 409 ai professionisti (*serious*), il ripiego silenzioso di `AuthProvider` su `"customer"` (*warning*). Resta da aprire: «verificata» vuol dire «richiesta chiusa», non «transazione conclusa» (§5.2).

---

## 10. Sessioni multiple: cosa progettare prima di costruire (voce 5, Lucio)

Restare connessi a tutti e due gli account e passare dall'uno all'altro senza rifare il login, come fa Gmail. **Qui non si costruisce niente**: queste sono le domande a cui la progettazione deve rispondere per iscritto prima della prima riga.

### 10.1 Dove vivono le due sessioni

- **FATTO, oggi.** Una sessione sola per browser. Browser (`src/lib/supabase/client.ts`), server (`src/lib/supabase/server.ts`) e middleware (`src/middleware.ts`) usano `@supabase/ssr` 0.5 e leggono **lo stesso cookie** di sessione di Supabase: nessun `storageKey` né nome di cookie personalizzato. Un secondo login sostituisce il primo.
- **Da decidere:**
  - quanti posti per sessione (due, o *n*) e come si chiamano i cookie (per posizione o per id utente);
  - dove sta l'indicazione dell'account attivo: per scheda, nell'indirizzo, come `/u/0/` e `/u/1/` di Gmail, oppure per browser, in un cookie. Per scheda, due schede possono stare su due account insieme; per browser, un cambio vale ovunque;
  - chi rinnova i token dell'account **non attivo**. Supabase ruota il refresh token a ogni rinnovo: se nessuno lo rinnova, quella sessione scade in silenzio; se lo rinnovano due schede insieme, una delle due perde;
  - che cosa del secondo account resta leggibile da JavaScript. I cookie di `@supabase/ssr` servono anche al browser, quindi non sono HttpOnly.
- **Da decidere, e non è tecnica:** se il server registra che i due account sono della stessa persona. Serve a tre cose: impedire che una persona abbini la propria richiesta al proprio account pro (il rilievo *serious* del 29/09 copre lo stesso account, non due); servire una richiesta GDPR «su tutto»; leggere le recensioni. Se il legame si registra, è un dato nuovo (§6); se resta solo nel browser, il server non lo sa.

### 10.2 Come si evita di leggere quella sbagliata

- **Un solo punto d'ingresso lato server.** Ogni componente server, ogni route e il middleware devono leggere l'account **attivo** attraverso un'unica funzione, mai «il cookie di Supabase». Una sola route che lo legge per conto suo agisce sull'account sbagliato con un JWT valido: la RLS non lo ferma, perché per lei quell'utente è legittimo.
- **Al cambio, niente stato del vecchio account nel browser.** Lo stato di `AuthProvider`, i canali realtime su `request_messages`, le notifiche, le pagine già caricate vanno chiusi e ricaricati. Un messaggio arrivato all'account A non deve comparire mentre si è su B.
- **FATTO, oggi:** cinque chiavi in `localStorage` **non contengono l'utente**, quindi due account nello stesso browser le condividerebbero:
  - `bob-chat-draft-v1` (`BobChat.tsx:110`), la bozza della chat di Bob, che contiene il testo di una richiesta;
  - `bob.notifiche.viste.v1` (`notifiche.ts:473`);
  - `bob.guida.pro.v1` (`guidaProgresso.ts:19`);
  - `bob.promemoria.profilo.v1` (`PromemoriaProfilo.tsx:34`);
  - `bob:manutenzione-chiusa` (`ManutenzioneBanner.tsx:37`).

  Vanno separate per account prima che due account convivano.
- **Un cambio fallito non ripiega su niente.** Oggi `AuthProvider` ripiega su `"customer"` se non legge il ruolo (rilievo *warning*, 29/09). Con due account, un ripiego silenzioso vorrebbe dire trovarsi sull'account sbagliato credendo di essere su quello giusto.

### 10.3 Cosa succede quando una sessione scade

- **Scade quella non attiva:** nel selettore compare come «da riconnettere». Non viene mai sostituita dall'altra, e non sparisce in silenzio.
- **Scade quella attiva, a metà di un'azione:** si va al login **di quell'account**, con il ritorno alla pagina di partenza, senza passare all'altro account. Da decidere se e come si conserva quello che si stava scrivendo.
- **Uscire:** «esci da questo account» ed «esci da tutti» sono due gesti diversi. Da decidere quale fa il pulsante di oggi.
- **Cancellare uno dei due account:** il suo posto si libera, e l'altro resta connesso.
- **Dispositivo condiviso:** con più sessioni aperte, chi usa lo stesso browser dopo di te entra in più di un account. Va detto nel momento in cui si aggiunge il secondo.

### 10.4 Dipendenza: l'SMTP personalizzato di Supabase

- **DECISO (CLAUDE.md):** le email di autenticazione (conferma, reset, magic link) le manda il mailer di Supabase, con un tetto di **2 email all'ora per tutto il progetto**; impostare `RESEND_API_KEY` non cambia niente, serve un SMTP personalizzato configurato in Supabase.
- **Due account vogliono due email distinte**, e ognuno va confermato. Finché l'SMTP non c'è:
  - **la creazione del secondo account non è collaudabile**: ogni prova consuma metà del tetto orario **di tutto il progetto**, compresi i reset password dei clienti veri;
  - una persona che apre il secondo account nell'ora sbagliata non riceve la conferma.
- **Quindi è una dipendenza, non un dettaglio: la voce 5 non si collauda, e non si spedisce, prima che l'SMTP sia configurato.**
