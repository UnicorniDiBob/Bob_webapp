# Bob — Design spike: il doppio cappello (cliente e professionista nello stesso account)

**Stato:** PROPOSTA — niente è deciso, niente è costruito · **Data:** 29 settembre 2026 · **Autore:** Lucio, con Claude
**Proprietari:** la scelta è di Lucio e André insieme; la navigazione e l'area cliente sono di André, schema, RLS, termini e cancellazione di Lucio (vedi §9).
**Perché adesso:** un professionista che ha bisogno di un idraulico oggi deve aprire un secondo account con un'altra email. Prima del pilota di gennaio conviene sapere se si risolve in interfaccia o in schema, perché le due strade toccano cose diverse, e una delle due tocca l'autenticazione.

> **Come si legge questo documento.** Ogni affermazione è marcata:
> **FATTO** = verificato il 29/09/2026 sul codice di `main` (`1e0325e`) o sul database di produzione, con il punto esatto;
> **DECISO** = regola già scritta del progetto (CLAUDE.md, DATA_COMPLIANCE.md), che la proposta deve rispettare;
> **PROPOSTO** = opinione di questa spike, da approvare. Una proposta scritta come decisione è il modo in cui questo
> progetto si è già ritrovato con note che descrivono uno stato che non esiste: qui non succede.

---

## 0. Foglio delle decisioni (da prendere — nessuna presa)

| # | Domanda | Proposta | Perché, in una riga |
|---|---|---|---|
| 1 | Due account legati, o un account solo? | **PROPOSTO: un account solo (strada b)** | Il database ragiona già così: la RLS non guarda il ruolo tranne che in un punto (§1.3) |
| 2 | Cosa diventa `users.role`? | **PROPOSTO: resta solo per lo staff**; «è professionista» = ha una riga in `professionals` | È già il criterio di tutte le policy lato pro |
| 3 | Disposizione dell'area in alto | **PROPOSTO: disposizione B** (casa = la tua vita privata, valigetta = il lavoro) | Un simbolo che significa una cosa sola, per tutti (§3) |
| 4 | Il cappello si sceglie con uno stato nascosto o con l'indirizzo? | **PROPOSTO: con l'indirizzo** (due aree, due URL) | Un link si incolla e si riapre uguale; niente «ero nel cappello sbagliato» |
| 5 | Abbinarsi a sé stessi | **PROPOSTO: vietato nel database**, non solo nel matcher | Oggi è già possibile via API (§5.1) |
| 6 | Chiudere l'attività senza cancellare l'account | **PROPOSTO: sì, operazione separata** | Oggi non esiste: chi smette di fare il pro perde anche il cliente (§5.5) |

**Da fare prima di costruire (niente codice):** Lucio e André scelgono 1, 3 e 4; poi le voci del §9 partono ognuna nella PR del suo proprietario.

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

## 3. L'area in alto: tre disposizioni (PROPOSTO)

La casetta sostituisce «I miei lavori» / «Il mio lavoro». Il problema non è l'icona: oggi quella voce è **un indirizzo con due significati**, e un simbolo muto non può portarne due. Per chi ha due cappelli, «casa» deve voler dire una cosa sola.

Legenda: 🏠 casa · 🧰 lavoro · 🔔 campanella · 👤 profilo · 💬 Parla con Bob

### Disposizione A — «La casa è dove lavori, se lavori»

```
Cliente:          [Bob]  ……  💬 Parla con Bob   🔔  🏠  👤
Professionista:   [Bob]  ……                     🔔  🏠  👤      🏠 = area di lavoro
Entrambi:         [Bob]  ……  💬 Parla con Bob   🔔  🏠  👤      🏠 = area di lavoro, con una scheda «Le mie richieste»
```

Pro: una sola icona, nessuna decisione. Contro: **per il pro-cliente «casa» vuol dire lavoro**, e le sue richieste private diventano una scheda dentro il lavoro — la stessa confusione di oggi, con meno testo per spiegarla.

### Disposizione B — «Casa è la tua vita privata, la valigetta è il lavoro» (**PROPOSTA**)

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

**Proposta: B.** È l'unica in cui il simbolo ha un significato solo, e il cappello sta nell'indirizzo (decisione 4).

---

## 4. Il doppio cappello: le due strade

### 4.1 Strada (a) — Due account legati, con un selettore

**Schema.** Due utenti Auth distinti (due email, per il vincolo di Supabase), ognuno col suo `users.role` di oggi. Una tabella nuova di legame (`account_links`: utente A, utente B, confermato il), con RLS.

**RLS e policy.** Invariate — ed è il suo pregio apparente: ogni utente resta di un tipo solo. Ma ogni controllo «è la stessa persona?» (§5) deve passare dalla tabella dei legami.

**Sessione.** Passare da un account all'altro vuol dire **cambiare sessione**: o si rifà il login (e allora il selettore è un tasto «esci ed entra»), o il server conia una sessione per l'altro utente, cioè una forma di impersonazione con l'API di amministrazione di Supabase. È la parte più delicata dell'intero progetto da farsi in casa.

**Costi.**
- Due email per una persona, o alias: attrito vero, e ogni iscrizione consuma il tetto di 2 email/ora (DECISO §2.6).
- **Due interessati nel Registro per una persona sola:** export, cancellazione e rettifica vanno fatti su due righe, e la seconda si dimentica.
- Il divieto di abbinarsi a sé stessi e di recensirsi (§5.1, §5.2) diventa un controllo **attraverso** la tabella dei legami: più facile da sbagliare, e aggirabile da chi non lega i due account.
- Due campanelle, due caselle messaggi.

### 4.2 Strada (b) — Un account solo, che cambia vista (**PROPOSTA**)

**Schema.**
- `users.role` si restringe a dire se sei **staff** (`admin`, `cs`) o no. Per tutti gli altri, «cliente» è la condizione di base; «professionista» = **esiste una riga in `professionals`** con il tuo `user_id` — che è già il criterio di `private.my_professional_ids()` e di tutte le policy lato pro.
- Per non rompere niente, **PROPOSTO:** si lascia la colonna com'è (`customer`/`professional`) durante il passaggio e si smette di leggerla, lettore per lettore; si toglie alla fine.

**RLS e policy.**
- Le policy del lato cliente e del lato pro **restano come sono** (§1.3).
- «Pro creates own profile»: invece di `users.role = 'professional'`, **PROPOSTO:** richiedere che l'utente abbia **accettato i termini professionisti** (una riga in `terms_acceptances` con `audience = 'professional'`). È una condizione più vera del ruolo: dice che ha firmato il contratto business.
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

**PROPOSTO: strada (b).** Il database è già un modello a cappello doppio (§1.3); la strada (a) costruirebbe un secondo account per aggirare un limite che esiste solo nell'interfaccia, e sposterebbe il rischio proprio dove Bob è più fragile: l'autenticazione e il tetto delle email.

---

## 5. Le code, guardate prima di consigliare

### 5.1 Il matcher non deve propormi a me stesso

- **FATTO: oggi non c'è nessuna esclusione.** `/api/match` e `getProfessionals()` in `src/lib/data.ts` non escludono il profilo di chi chiede; `request_professionals` la scrive il browser (`RequestDialog.tsx:222`, `QuoteDialog.tsx:228`) con qualunque `professional_id`, e la policy «User inserts own request_professionals» controlla solo che la richiesta sia tua. L'unico ostacolo è `BobChat`, che parte solo per i clienti: **un pro può già abbinarsi a sé stesso chiamando l'API.**
- **PROPOSTO, in entrambe le strade:** (1) il matcher esclude i profili con `user_id = auth.uid()`; (2) **nel database**, un vincolo (trigger su `request_professionals`) che rifiuta un professionista il cui `user_id` coincide con il `customer_id` della richiesta. Con (b) è un confronto diretto; con (a) va esteso agli account legati.
- Resta «scelto dal cliente» (DECISO §2.1): si toglie una scelta impossibile, non se ne aggiunge una automatica.

### 5.2 Un professionista che recensisce un professionista

- **FATTO.** La policy «Customer inserts review for closed request» richiede: autore = cliente della richiesta, richiesta con `status = 'closed'`, professionista collegato alla richiesta in `request_professionals`. Non richiede un appuntamento `completed` né un pagamento.
- **Un pro che recensisce un altro pro come cliente regge**: è un cliente vero di una richiesta vera, e la recensione vale come quella di chiunque altro.
- **Recensirsi da soli non regge**, e oggi il database non lo impedisce: basta abbinarsi a sé stessi (§5.1) e chiudere la richiesta. **PROPOSTO:** un vincolo che rifiuta una recensione il cui `professional_id` appartiene al `customer_id` (con (b) diretto, con (a) attraverso i legami).
- **FATTO, fuori dal doppio cappello ma da sapere:** «verificata» oggi vuol dire «legata a una richiesta chiusa», non «a una transazione conclusa» come dice la regola (DECISO §2.3). Una richiesta chiusa senza lavoro fatto dà comunque diritto a recensire. Rilievo a parte (§9).

### 5.3 Quale testo dei termini ha accettato, e quando

- **FATTO.** Il registro distingue già per **pubblico** (`customer` / `professional`), ogni pubblico ha la sua sequenza di versioni, e `terms_acceptances` ha la colonna `audience` (mig 100). Un utente può avere righe per tutti e due i pubblici: lo schema lo regge già.
- **FATTO: il codice no.** `pubblicoPerRuolo()` dà **un** pubblico per utente; la route `/api/termini/accetta` accetta solo quello; il trigger d'iscrizione ne deriva uno dal ruolo.
- **PROPOSTO:** la route riceve il pubblico come parametro e lo controlla contro la condizione vera (per `professional`: sta creando o ha un profilo pro); il passaggio «divento anche professionista» è **il momento dell'accettazione dei termini business**, con la sua riga. Così la risposta a «quale testo ha accettato e quando» è: due righe, una per pubblico, ognuna con la sua versione e la sua ora.
- **Da far guardare al legale:** i termini clienti presuppongono un consumatore. Un idraulico che chiede un elettricista per un cantiere suo compra da professionista, non da consumatore. Il testo clienti va riletto per questo caso prima di aprirlo ai pro.

### 5.4 Divulgazione progressiva: un pro che è anche cliente

- **FATTO.** La regola vive per richiesta, non per ruolo: l'indirizzo completo lo vede il professionista solo con un appuntamento `confirmed` o `completed` (`private.can_see_request_address()`), e il cliente vede sempre il proprio.
- **Non cambia niente** in nessuna delle due strade: quando il pro lavora vede i dati degli altri clienti con le stesse regole di oggi; quando è cliente, gli altri pro vedono i suoi con le stesse regole.
- **Il rischio vero è d'interfaccia, non di policy:** con un account solo, un'area che mescolasse «le mie richieste» e «le richieste che ricevo» renderebbe facile scambiare un cliente per un altro. La disposizione B li tiene in due posti.

### 5.5 Cancellazione: cosa si cancella se i cappelli sono due

- **FATTO.** Oggi per un pro la cancellazione disattiva il profilo e poi cancella **l'intero account** (`cancellazione/route.ts:136`); le cascate portano via `professionals` e, con lui, le recensioni **ricevute** (`ratings.professional_id` è `ON DELETE CASCADE`).
- **FATTO.** L'export dei dati è bloccato per i pro (`esporta/route.ts:74`): un pro-cliente non potrebbe scaricare nemmeno i suoi dati da cliente.
- **PROPOSTO, strada (b):** due operazioni distinte.
  1. **Chiudi l'attività:** disattiva il profilo pro (`deactivated_at`, esiste già) e lo cancella dopo il periodo dichiarato, lasciando vivo l'account cliente. Resta da decidere cosa succede alle recensioni ricevute (oggi spariscono con la cascata) e alle fatture (10 anni, DATA_COMPLIANCE §5).
  2. **Cancella l'account:** entrambi i cappelli, come oggi.
  E l'export copre tutti e due i cappelli.
- Con la strada (a) le cancellazioni sono due, su due account, e tenerle coerenti è lasciato a chi le fa.

---

## 6. Dati personali (DATA_COMPLIANCE §0)

- **PROPOSTO:** nessuna finalità nuova con la strada (b): gli stessi dati, per gli stessi scopi, con due contratti (clienti e professionisti) accettati dalla stessa persona. Da aggiornare le righe A1 (account: il ruolo cambia significato) e A25 (accettazioni: due pubblici per utente) del Registro.
- La strada (a) raddoppia l'interessato: due righe per ogni finalità di A1, e una tabella nuova (i legami) con la sua base giuridica, conservazione e cancellazione.
- **DPIA:** nessun innesco nuovo in nessuna delle due.

---

## 7. Stima grossolana

- **(b):** la maggior parte in interfaccia (André): due aree al posto di `/dashboard`, lato della chat dalla richiesta, impostazioni per capacità, Bob per tutti, flusso «diventa anche professionista». Nello schema (Lucio): una migrazione con la policy riscritta e due vincoli, la route dei termini, export e cancellazione. Ordine di grandezza: settimane, non mesi.
- **(a):** tutto quello che serve a (b) per i controlli (§5), più la tabella dei legami, il cambio di sessione o l'impersonazione, e il doppio percorso GDPR.

---

## 8. Stato delle domande

| Domanda | Stato |
|---|---|
| Strada (a) o (b) | **Aperta** — proposta (b) |
| Disposizione A, B o C | **Aperta** — proposta B |
| Cappello nell'indirizzo o in uno stato | **Aperta** — proposto nell'indirizzo |
| Cosa succede alle recensioni ricevute quando si chiude l'attività | **Aperta**, non proposta: è una scelta di prodotto e di conservazione |
| Termini clienti per un professionista che compra per lavoro | **Aperta**, da legale |
| Abbinarsi a sé stessi via API | **Fatto accertato**, da chiudere indipendentemente dalla scelta |

---

## 9. Voci per il Piano (PROPOSTE, con proprietario)

**Da decidere insieme, prima di tutto il resto**
1. Scegliere strada (a)/(b), disposizione dell'area in alto, cappello nell'indirizzo o nello stato — *Lucio e André*.

**André — navigazione e area cliente**
2. Area in alto: casetta (e valigetta) secondo la disposizione scelta, desktop e 390px — `Header.tsx`.
3. `/dashboard` diviso in area cliente e area di lavoro, con `middleware.ts` e `next.config.mjs` aggiornati.
4. `messaggi`: il lato da cui si scrive si decide dalla richiesta (`customer_id` = io?), non dal ruolo.
5. `BobChat` e le impostazioni: «puoi chiedere un servizio» per tutti, «impostazioni da pro» per chi ha un profilo pro, non per ruolo.
6. Flusso «diventa anche professionista» da un account cliente, e «chiudi l'attività» nell'area account.

**Lucio — schema, RLS, termini, dati**
7. Migrazione: «Pro creates own profile» condizionata ai termini professionisti accettati invece che al ruolo; `users.role` smette di essere letto per cliente/pro.
8. Vincoli nel database: niente professionista abbinato a una richiesta del suo stesso utente; niente recensione del proprio profilo. **Indipendente dalla scelta: il buco c'è già oggi via API.**
9. `/api/termini/accetta` con il pubblico esplicito; `pubblicoPerRuolo()` sostituita.
10. Cancellazione in due: «chiudi l'attività» e «cancella l'account»; decidere conservazione delle recensioni ricevute e delle fatture.
11. Export dei dati anche per i professionisti (oggi 409): vale già adesso, non solo col doppio cappello.
12. Registro dei trattamenti: A1 e A25 aggiornate.
13. Legale: termini clienti per un professionista che compra per il suo lavoro.

**Rilievi da aprire in `roadmap/findings.csv`, indipendenti dalla scelta (Lucio)**
- Abbinarsi a sé stessi e recensirsi sono possibili via API (§5.1, §5.2).
- «Verificata» vuol dire «richiesta chiusa», non «transazione conclusa» (§5.2).
- `AuthProvider` ripiega su `"customer"` se la lettura del ruolo fallisce (§1.1).
