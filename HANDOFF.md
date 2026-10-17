Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** mascotte ape (PR #189, unita e provata dal vivo) e ritocchi di André sul ramo `mascotte-ape-ritocchi`: nella fascia indaco della home l'ape «successo» (medaglione) al posto di «sceglie lo strumento»; nell'eroe di /servizi «benvenuto» (medaglione nel tondo) con l'alt nuovo; il titolo del telefono dice «Professionisti» invece di «Idraulici», su due righe con «Milano» sul desktop (su una non ci stava: misurato). Prima, la #188: intestazione delle email BOB BEE.
**A metà:** restano da generare le pose in docs/MASCOTTE_pose_mancanti.md (ape al telefono, con la bilancia, con la cariola, di schiena sulla scala) e l'animazione, che André farà più avanti.
**Applicato in produzione:** niente nel database. I ritocchi arrivano su Vercel con il merge della PR.

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** export-pro, ramo `export-pro`: `/api/account/esporta` consegna lo ZIP anche al professionista (prima 409, finding serious del 29/09, ora chiuso). Blocco del lavoro in `src/lib/export-pro.ts` sopra quello dell'account; dei clienti esce solo quello che il pro vede nel prodotto (indirizzo solo con appuntamento confermato/completato, brief e foto solo alle condizioni di request-summary e via `fotoConsegnabile`, mai telefono o email, lo staff per ruolo). Bottone «Scarica i miei dati» ora anche per i pro (impostazioni/dati, area di André: la modifica sta in questa PR). Aggiunta `onboarding_answers`, che mancava anche al cliente. Prova `scripts/prova_export_pro.mjs`, 17 controlli verdi; ha trovato che il limite di 24 ore NON funzionava per nessuno (cache di Next 14 sulle GET di supabase-js col Bearer): corretto con `fetchCache = "force-no-store"`. Prima: FOTO1 (PR #193).
**A metà:** PR da aprire e unire; dopo il merge, un export da pro di prova su www.meetonda.com e un secondo entro 24 ore → 429. Finding nuovo (warning): altre sette rotte GET col service role senza `fetchCache` (fra cui i cron cancella-account e verifica-piva) da provare una per una. Da verificare che `BRIEF_PHOTOS_SECRET` sia su Vercel (FOTO1). Restano: non si registra chi esporta; l'export intero passa in una risposta sola, e oltre il limite di risposta di Vercel un pro con molti documenti potrebbe non riceverlo (non provato).
**Applicato in produzione:** niente nello schema (nessuna migrazione). Utenti di prova creati e cancellati sul db di produzione (prova.exportpro.pro@, .c1@, .c2@, .c3@bobapp.it, più i giri precedenti della stessa prova e un prova.upsert.tmp@ per isolare il difetto della cache): zero utenti, righe e file rimasti, verificato dallo script.

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
