Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** idraulici demo applicati in produzione (scripts/demo/idraulici_seed.sql della PR #182). Ordine reale uguale alla tabella del README al centesimo, scenari A e B; la ricerca vera (/api/match) dà Demo 1, IdroMilano, Demo 2, 3, 4, 5, e con zone=duomo toglie Demo 5. Ramo `pulizia-pre-pilota`: docs/PULIZIA_PRE_PILOTA.md (idraulici demo, tre note «chiuso» doppie su ddaae033, 22 richieste di PROVA) e tre rilievi da decidere con Lucio in roadmap/findings.csv (is_test_fixture non filtrato, nessun voto batte dieci a 4,5, il prezzo conta solo se c'e').
**A metà:** la PR di `pulizia-pre-pilota` è aperta e NON unita. I tempi di risposta demo reggono fino ai primi di gennaio: il primo messaggio demo esce dalla finestra di 90 giorni l'11/11 (Demo 1, che tiene comunque 15 min di mediana), gli ultimi fra l'8 e il 14/01/2027. Per rinfrescarli: cleanup e seed. Le richieste di PROVA non hanno ancora uno script di pulizia.
**Applicato in produzione:** il seed degli idraulici demo, il 17/10 alle 16:03 (14:03:33 UTC), con execute_sql in una transazione e senza riga in schema_migrations. +6 pro (Demo 6 non pronto), +7 utenti (Demo 3-6 e 3 recensori, senza password), Demo 1 e 2 sugli account creati da André; +45 richieste chiuse, +90 messaggi, +45 recensioni, +45 search_events, +90 eventi di lavoro. La media della piattaforma passa da 4,7368 a 4,7031. Si toglie con scripts/demo/idraulici_cleanup.sql (prima del pilota).

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
