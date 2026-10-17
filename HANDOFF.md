Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** PR #200 (`chat-bob-selezione-multipla`): nella chat di Bob si spuntano fino a 3 pro e si scrive un messaggio solo, una richiesta; il messaggio col budget NON salva l'indirizzo (come prima). Verificandola è uscito un rilievo serio, ora chiuso: un pro collegato poteva ottenere l'indirizzo del cliente creando o confermando da solo un appuntamento (dalla 044; nessun indirizzo di un cliente reale esposto, nessuna notifica art. 33, decisione di André). PR #201 (`indirizzo-solo-con-conferma-cliente`): migrazione **131** (la 126 era già presa), menu Stato del calendario del pro senza «Confermato»/«Completato» sulle proposte con un cliente.
**A metà:** #200 e #201 pronte, le unisce André. Dopo il merge di #201: deploy Production di Vercel e menu del calendario dal vivo come Idraulico Demo 1, a 1440 e 390. **Lucio: revisione a posteriori di #201** (la 131 è stata applicata senza la sua approvazione, per decisione di André: repo pubblico, buco visibile nel file). Parte C: zero indirizzi copiati da pulire.
**Applicato in produzione:** migrazione 131 il 17/10 alle 18:09 (20261017160944 in schema_migrations): funzione private.conferma_solo_dal_cliente, trigger a_pro_propone_soltanto, y_conferma_solo_dal_cliente e zzz_indirizzo_dopo_conferma (era appointments_fill_location), default di appointments.status 'proposed'. Advisor di sicurezza senza rilievi nuovi. Resta il seed degli idraulici demo del 17/10 (docs/PULIZIA_PRE_PILOTA.md §1).

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
