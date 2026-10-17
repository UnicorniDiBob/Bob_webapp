Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** idraulici demo applicati in produzione (scripts/demo/idraulici_seed.sql della PR #182). Ordine reale uguale alla tabella del README al centesimo, scenari A e B; la ricerca vera (/api/match) dà Demo 1, IdroMilano, Demo 2, 3, 4, 5, e con zone=duomo toglie Demo 5. Ramo `pulizia-pre-pilota`: docs/PULIZIA_PRE_PILOTA.md (idraulici demo, tre note «chiuso» doppie su ddaae033, 22 richieste di PROVA) e tre rilievi da decidere con Lucio in roadmap/findings.csv (is_test_fixture non filtrato, nessun voto batte dieci a 4,5, il prezzo conta solo se c'e').
**A metà:** la PR di `pulizia-pre-pilota` è aperta e NON unita. I tempi di risposta demo reggono fino ai primi di gennaio: il primo messaggio demo esce dalla finestra di 90 giorni l'11/11 (Demo 1, che tiene comunque 15 min di mediana), gli ultimi fra l'8 e il 14/01/2027. Per rinfrescarli: cleanup e seed. Le richieste di PROVA non hanno ancora uno script di pulizia.
**Applicato in produzione:** il seed degli idraulici demo, il 17/10 alle 16:03 (14:03:33 UTC), con execute_sql in una transazione e senza riga in schema_migrations. +6 pro (Demo 6 non pronto), +7 utenti (Demo 3-6 e 3 recensori, senza password), Demo 1 e 2 sugli account creati da André; +45 richieste chiuse, +90 messaggi, +45 recensioni, +45 search_events, +90 eventi di lavoro. La media della piattaforma passa da 4,7368 a 4,7031. Si toglie con scripts/demo/idraulici_cleanup.sql (prima del pilota).

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** chiudi-ruolo-iscrizione, falla CRITICA. `handle_new_user` copiava `raw_user_meta_data->>'role'` in `users.role` senza filtro: chiunque con la chiave pubblica poteva iscriversi admin. E `admin_cs_update_users` lasciava a un cs promuoversi admin. Migrazione 130: `handle_new_user` riscritta dalla definizione viva (dal metadata solo customer/professional, il resto diventa customer); trigger `trg_guard_users_role` (solo un admin o il service role cambiano `users.role`, altrimenti 42501). `/api/admin/staff` e `/api/admin/cs` impostano il ruolo col service role, lo rileggono e, se non torna, cancellano l'utente e rispondono 500. Prova `scripts/prova_ruolo_iscrizione.mjs`, tutti i controlli passati: iscrizione admin→customer, cs→customer, professional→professional; invito dalla route a lucio@unicorni.eu → cs; /api/admin/cs → cs; cs che si mette admin o cambia un altro → 42501; admin che cambia un altro → accettato. Finding critical chiuso in `roadmap/findings.csv`.
**A metà:** PR #198 da unire (la unisce Lucio). DA RIPROVARE CON UN SMTP VERO: le tre iscrizioni sono passate da `auth.admin.createUser` con lo stesso metadata (stesso trigger), NON da `signUp` con la chiave pubblica. Il mailer integrato ha rifiutato `signUp` («Email address … is invalid» per @bobapp.it, poi «email rate limit exceeded»). L'invito invece è partito davvero. Se lucio@unicorni.eu ha ricevuto una mail di invito alle ~17:00 del 17/10, il link non vale più: l'utente è già cancellato. Ancora aperto da cancellazione-brief-completa ed export-pro: privacy/page.tsx di André (due frasi false), export da pro di prova su www → 429, sette rotte GET col service role senza `fetchCache`, `BRIEF_PHOTOS_SECRET` su Vercel.
**Applicato in produzione:** migrazione 130 il 17/10, advisor di sicurezza senza rilievi nuovi. Il codice delle due route arriva su Vercel col merge: fino ad allora `/api/admin/staff` vivo passa il ruolo nel metadata, che la 130 ignora, quindi **un invito staff da www oggi crea un customer**, e `/api/admin/cs` vivo fa già l'update esplicito e funziona. Utenti di prova (5 prova.ruolo.*@bobapp.it e lucio@unicorni.eu) creati e cancellati: zero righe in auth/users/profiles/profile_private, admin solo i 3 di oggi, cs 0, ruoli 14/3/6 come prima.

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
