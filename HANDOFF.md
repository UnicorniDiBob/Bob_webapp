Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** PR #200 (`chat-bob-selezione-multipla`): nella chat di Bob si spuntano fino a 3 pro e si scrive un messaggio solo, una richiesta; il messaggio col budget NON salva l'indirizzo (come prima). Verificandola è uscito un rilievo serio, ora chiuso: un pro collegato poteva ottenere l'indirizzo del cliente creando o confermando da solo un appuntamento (dalla 044; nessun indirizzo di un cliente reale esposto, nessuna notifica art. 33, decisione di André). PR #201 (`indirizzo-solo-con-conferma-cliente`): migrazione **131** (la 126 era già presa), menu Stato del calendario del pro senza «Confermato»/«Completato» sulle proposte con un cliente.
**A metà:** #200 unita da André (17/10, 18:08). #201 pronta, la unisce André. Dopo il merge di #201: deploy Production di Vercel e menu del calendario dal vivo come Idraulico Demo 1, a 1440 e 390. **Lucio: revisione a posteriori di #201** (la 131 è stata applicata senza la sua approvazione, per decisione di André: repo pubblico, buco visibile nel file). Parte C: zero indirizzi copiati da pulire.
**Applicato in produzione:** migrazione 131 il 17/10 alle 18:09 (20261017160944 in schema_migrations): funzione private.conferma_solo_dal_cliente, trigger a_pro_propone_soltanto, y_conferma_solo_dal_cliente e zzz_indirizzo_dopo_conferma (era appointments_fill_location), default di appointments.status 'proposed'. Advisor di sicurezza senza rilievi nuovi. Resta il seed degli idraulici demo del 17/10 (docs/PULIZIA_PRE_PILOTA.md §1).

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** termini-per-app. `GET /api/termini/[versione]?pubblico=customer|professional`, pubblica e senza login, cache 5 min (errori 1 min): `{ versione, pubblico, pubblicataIl, html }`, 404 se la versione non esiste, non è di quel pubblico o non è ancora pubblicata, 400 se `pubblico` manca o è sbagliato. E `GET /api/termini/corrente?pubblico=…` → `{ versione, pubblico, pubblicataIl }`, la versione pubblicata oggi (la stessa di /termini e dell'iscrizione dal sito), stessi 400 e stessa cache. **SONO UN CONTRATTO CON L'APP (Bob_app): la forma delle due risposte non cambia senza cambiare anche l'app.** Il testo esce dagli stessi componenti congelati della pagina (`src/lib/termini/testoPerApp.tsx`): HTML senza layout, senza classi, link interni assoluti su `NEXT_PUBLIC_SITE_URL`. Per farlo girare `next/link` nei due testi congelati è diventato `LinkTesto` (un `<a>`): cambia solo la riga di import, l'HTML delle sei pagine /termini è identico byte per byte a prima (verificato). Prova dal vivo su `next start`: `corrente` = la versione stampata da /termini e /termini/professionisti; il testo della route coincide con quello della pagina per le 4 combinazioni versione × pubblico; con una versione temporanea non committata, 404 fino all'ora di pubblicazione e 200 subito dopo, sia per l'API che per la pagina, e `corrente` per i clienti passa da v2 a quella versione nello stesso istante della pagina mentre per i professionisti resta v2.
**A metà:** `/api/termini/[versione]` è arrivata con la PR #202 (unita il 17/10 alle 18:03, prima che ci entrasse `corrente`); `corrente` arriva con la PR del ramo termini-corrente. L'app deve ancora passare alle due route. Da chiudi-ruolo-iscrizione, ancora da riprovare con un SMTP vero: le iscrizioni con `signUp` e chiave pubblica (provate solo con `auth.admin.createUser`). Ancora aperto da cancellazione-brief-completa ed export-pro: privacy/page.tsx di André (due frasi false), export da pro di prova su www → 429, sette rotte GET col service role senza `fetchCache`, `BRIEF_PHOTOS_SECRET` su Vercel.
**Applicato in produzione:** niente in questa sessione (nessuna migrazione). La route arriva su Vercel col merge.

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
