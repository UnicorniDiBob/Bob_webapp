Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** mascotte ape (PR #189, unita e provata dal vivo) e ritocchi di André sul ramo `mascotte-ape-ritocchi`: nella fascia indaco della home l'ape «successo» (medaglione) al posto di «sceglie lo strumento»; nell'eroe di /servizi «benvenuto» (medaglione nel tondo) con l'alt nuovo; il titolo del telefono dice «Professionisti» invece di «Idraulici», su due righe con «Milano» sul desktop (su una non ci stava: misurato). Prima, la #188: intestazione delle email BOB BEE.
**A metà:** restano da generare le pose in docs/MASCOTTE_pose_mancanti.md (ape al telefono, con la bilancia, con la cariola, di schiena sulla scala) e l'animazione, che André farà più avanti.
**Applicato in produzione:** niente nel database. I ritocchi arrivano su Vercel con il merge della PR.

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** FOTO1, ramo `foto1-foto-altrui`: un cliente non si fa più dare la foto di un altro. /api/bob/chat restituisce ogni foto con un'attestazione HMAC (percorso + id del chiamante, segreto `BRIEF_PHOTOS_SECRET`); /api/bob/brief salva solo le foto attestate per chi salva (cookie e Bearer uguali). Per i brief vecchi, export e /api/pro/request-summary non consegnano un percorso che un brief di un altro citava già prima (`fotoConsegnabile` in src/lib/fileUtente.ts); request-summary non mostra più un brief di un altro collegato a una richiesta (requests.brief_id lo scrive il browser). Prova dal vivo su server locale, `scripts/prova_foto1.mjs`, 10 controlli verdi: B col percorso di A (con e senza l'attestazione di A) → brief salvato senza foto; brief di B «di prima» → export di B senza la foto, request-summary della richiesta di B 0 foto contro 1 della richiesta di A allo stesso pro; export di A con la foto, byte per byte. Claude era FINTO nella prova (ANTHROPIC_API_KEY vuota in `.env.local`): ha sostituito solo la risposta del modello. Finding chiuso; FOTO1 in roadmap resta In progress fino al merge. Prima: CANC2 chiusa (PR #192, migrazione 129), PR #191 `chiamante-ovunque` unita.
**A metà:** PRIMA DEL MERGE va messa `BRIEF_PHOTOS_SECRET` su Vercel (Production e Preview, valore casuale lungo): senza, il codice nuovo chiude, e nessuna foto della chat entra più in un brief. Dopo il merge: una chat con foto su www.meetonda.com e un'occhiata al brief in job_briefs, poi FOTO1 in ARCHIVE. Una chat iniziata da anonimi e salvata dopo l'accesso perderebbe la foto (attestazione «anonimo» ≠ utente): oggi il brief si salva prima dell'accesso, quindi non dovrebbe capitare. Restano: non si registra chi esporta quali file; ramo `brief-contatti-sospeso` da decidere insieme; advisor con i due rilievi vecchi (rate_limit_counters senza policy, protezione password compromesse spenta).
**Applicato in produzione:** niente nello schema (nessuna migrazione). Tre utenti di prova creati e cancellati sul db di produzione (prova.foto1.a@, .b@, .pro@bobapp.it, più un primo giro fallito con gli stessi indirizzi), con 4 brief, 3 richieste, un professionista is_test_fixture e la foto: zero righe e zero file rimasti, verificato dal database.

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
