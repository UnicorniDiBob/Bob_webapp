Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** ramo `chat-bob-selezione-multipla`. Nella chat di Bob il cliente spunta fino a 3 pro fra i suggeriti e scrive UN messaggio: una richiesta, un collegamento e un messaggio per pro (prima ogni scheda apriva una richiesta nuova: le 4 del 17/10 in produzione). Se torna nella stessa chat, i pro gia' scritti sono «✓ Contattato» e le scelte nuove si aggiungono alla stessa richiesta fino a 3; una richiesta chiusa ne apre una nuova. Si riusa QuoteDialog con un `modo` («messaggio» / «preventivo»), ora in un portale su document.body (la colonna animata dell'eroe lo chiudeva dentro la chat). Nessuna migrazione: il tetto e i rifiuti sono quelli della 125. Provato in locale con Supabase locale, 539 test, lint e build.
**A metà:** la PR è aperta e NON unita (la unisce André). Dopo il merge: collaudo dal vivo come cliente.demo (Demo 1 + IdroMilano + Demo 2 → una richiesta, 3 collegamenti, 3 messaggi). Le 4 richieste doppie del 17/10 (dbaff089, 99cb6d30, a675249a, 2c9c5bfb) restano dove sono, vanno nella pulizia pre-pilota. `pulizia-pre-pilota` è unita (#197).
**Applicato in produzione:** niente in questa sessione. Resta in produzione dal 17/10 il seed degli idraulici demo (dettagli e pulizia in docs/PULIZIA_PRE_PILOTA.md §1).

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
