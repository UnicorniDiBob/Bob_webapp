Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** idraulici demo applicati in produzione (scripts/demo/idraulici_seed.sql della PR #182). Ordine reale uguale alla tabella del README al centesimo, scenari A e B; la ricerca vera (/api/match) dà Demo 1, IdroMilano, Demo 2, 3, 4, 5, e con zone=duomo toglie Demo 5. Ramo `pulizia-pre-pilota`: docs/PULIZIA_PRE_PILOTA.md (idraulici demo, tre note «chiuso» doppie su ddaae033, 22 richieste di PROVA) e tre rilievi da decidere con Lucio in roadmap/findings.csv (is_test_fixture non filtrato, nessun voto batte dieci a 4,5, il prezzo conta solo se c'e').
**A metà:** la PR di `pulizia-pre-pilota` è aperta e NON unita. Il tempo di risposta demo esce dalla finestra di 90 giorni verso il 6 novembre: per rinfrescarlo, cleanup e seed. Le richieste di PROVA non hanno ancora uno script di pulizia.
**Applicato in produzione:** il seed degli idraulici demo, il 17/10 alle 16:03 (14:03:33 UTC), con execute_sql in una transazione e senza riga in schema_migrations. +6 pro (Demo 6 non pronto), +7 utenti (Demo 3-6 e 3 recensori, senza password), Demo 1 e 2 sugli account creati da André; +45 richieste chiuse, +90 messaggi, +45 recensioni, +45 search_events, +90 eventi di lavoro. La media della piattaforma passa da 4,7368 a 4,7031. Si toglie con scripts/demo/idraulici_cleanup.sql (prima del pilota).

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** cancellazione-brief-completa. DECISIONE DI LUCIO E ANDRÉ DEL 17/10 (`docs/legal/DECISIONE_conservazione_garanzia.md`): alla chiusura dell'account si cancella tutto del cliente, brief compresi, senza copia de-identificata (restano solo gli obblighi di legge e le recensioni de-identificate della 056); i lavori con Garanzia Bob (oggi nessuno) resteranno identificati in un archivio ristretto fino a `job_completed_at` + 2 anni (10 strutturali), art. 17(3)(e), da costruire prima della prima garanzia venduta; al pro non si manda niente del cliente alla chiusura. Il cron `cancella-account` non svuota più due campi (PR #194, quella scelta è superata): cancella tutti i `job_briefs` del cliente dopo i file e prima di `deleteUser`. Unica FK verso `job_briefs` è `requests.brief_id` SET NULL, e i trigger di `requests` la lasciano passare: nessuna migrazione. Se le foto della chat non si tolgono, brief e account restano e si riprova la notte dopo (falliti +1, motivo `foto-chat:<id>`). Prova `scripts/prova_cancellazione.mjs` 34/34: cancellati 2, falliti 0, zero brief del cliente; con lo storage guasto (`scripts/prova_cancellazione_guasto.cjs`, solo nel server di prova) falliti 1 con brief, foto e account intatti, e la notte dopo cancellati 1; nessun id della prova in public/auth/storage. Allineati DATA_COMPLIANCE §5, ROPA A2/A20/A28, finding nuovo in `roadmap/findings.csv`. Prima: export-pro (PR #195).
**A metà:** PR da unire (la unisce Lucio). PER ANDRÉ: `src/app/privacy/page.tsx` è tua e non l'ho toccata. Oggi non nomina la garanzia né i 2 anni (serve solo prima della prima garanzia), ma due frasi sono già false: «Dati di account… fino a 12 mesi dalla cancellazione» (il cron cancella dopo 7 giorni) e «se hai un account professionista la copia te la mandiamo noi» (dalla #195 la scarica da solo). Da export-pro restano: export da pro di prova su www.meetonda.com più un secondo entro 24 ore → 429; le sette rotte GET col service role senza `fetchCache`; `BRIEF_PHOTOS_SECRET` su Vercel.
**Applicato in produzione:** niente nello schema (nessuna migrazione). Il codice arriva su Vercel col merge. Utenti di prova prova.cancellazione.pro@, .cliente@ e .guasto@bobapp.it creati e cancellati sul db di produzione: zero righe e file rimasti, verificato.

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
