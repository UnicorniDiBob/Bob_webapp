Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** mascotte ape (PR #189, unita e provata dal vivo) e ritocchi di André sul ramo `mascotte-ape-ritocchi`: nella fascia indaco della home l'ape «successo» (medaglione) al posto di «sceglie lo strumento»; nell'eroe di /servizi «benvenuto» (medaglione nel tondo) con l'alt nuovo; il titolo del telefono dice «Professionisti» invece di «Idraulici», su due righe con «Milano» sul desktop (su una non ci stava: misurato). Prima, la #188: intestazione delle email BOB BEE.
**A metà:** restano da generare le pose in docs/MASCOTTE_pose_mancanti.md (ape al telefono, con la bilancia, con la cariola, di schiena sulla scala) e l'animazione, che André farà più avanti.
**Applicato in produzione:** niente nel database. I ritocchi arrivano su Vercel con il merge della PR.

## Lucio

**Fatto (16 ottobre 2026, Lucio con Claude):** PR #185 unita (127: nei bucket immagini scrive solo il service role). Ramo `cron-cancella-foto`, PR #186: alla chiusura dell'account il cron toglie i file di verifica-documenti, portfolio e brief-photos e le foto di chat citate nei brief del cliente (src/lib/fileUtente.ts), senza toccare una foto citata da un altro brief. La prova dal vivo ha trovato che DAL 28/09 NESSUN ACCOUNT SI POTEVA CANCELLARE (trigger termini_account_chiuso SECURITY INVOKER, «permission denied for table terms_acceptances»): corretto con la 128. Stesso DELETE dello stesso utente: 500 alle 14:17Z, 200 alle 14:25Z; poi la prova completa da capo, 9 controlli verdi (cancellati 1, falliti 0, file_rimossi 4). CLAUDE.md: il rito del giovedì guarda i giri falliti e quelli fermi a zero.
**A metà:** PROVATO SOLO IL CASO SEMPLICE (cliente con profilo e brief). 14 trigger SECURITY INVOKER su appuntamenti, richieste, servizi e verifica non sono provati e sono vivi: CANC2 entro il 21/10. FOTO1 entro il 21/10 (serious): un cliente può farsi dare la foto di un altro, perché /api/bob/brief salva i percorsi delle foto come li manda il browser.
**Applicato in produzione:** migrazione 127 (20261016140436) e 128 (`128_termini_account_chiuso_definer`, 20261016142258, SHA-256 d135e955…0d77, uguale al file). Due utenti di prova `prova.cancellazione@bobapp.it` creati e cancellati, con i loro file e brief: niente rimasto, verificato dal database. Password del demo coloriepareti@bobapp.it reimpostata (è in `.env.local` di Lucio).
