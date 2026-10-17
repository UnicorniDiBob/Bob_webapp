Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** logo BOB BEE (PR #187, unita e provata dal vivo il 16/10, schermate approvate da André). Ramo `logo-email-bob-bee`: l'intestazione delle email (src/lib/email.ts) passa da «BOB.» col punto arancione al wordmark BOB BEE, con le stesse proporzioni del sito ma in px e stili in linea, adatti alla posta. Nome del sito, metadati e avatar della chat restano come sono, per decisione di André.
**A metà:** PR 2 del brief (mascotte ape, ramo `mascotte-ape`) da fare dopo questa.
**Applicato in produzione:** niente nel database. La posta transazionale è spenta (POSTA_TRANSAZIONALE = "spenta"): la nuova intestazione si vedrà alla prima email, quando la si accende.

## Lucio

**Fatto (16 ottobre 2026, Lucio con Claude):** PR #185 unita (127: nei bucket immagini scrive solo il service role). Ramo `cron-cancella-foto`, PR #186: alla chiusura dell'account il cron toglie i file di verifica-documenti, portfolio e brief-photos e le foto di chat citate nei brief del cliente (src/lib/fileUtente.ts), senza toccare una foto citata da un altro brief. La prova dal vivo ha trovato che DAL 28/09 NESSUN ACCOUNT SI POTEVA CANCELLARE (trigger termini_account_chiuso SECURITY INVOKER, «permission denied for table terms_acceptances»): corretto con la 128. Stesso DELETE dello stesso utente: 500 alle 14:17Z, 200 alle 14:25Z; poi la prova completa da capo, 9 controlli verdi (cancellati 1, falliti 0, file_rimossi 4). CLAUDE.md: il rito del giovedì guarda i giri falliti e quelli fermi a zero.
**A metà:** PROVATO SOLO IL CASO SEMPLICE (cliente con profilo e brief). 14 trigger SECURITY INVOKER su appuntamenti, richieste, servizi e verifica non sono provati e sono vivi: CANC2 entro il 21/10. FOTO1 entro il 21/10 (serious): un cliente può farsi dare la foto di un altro, perché /api/bob/brief salva i percorsi delle foto come li manda il browser.
**Applicato in produzione:** migrazione 127 (20261016140436) e 128 (`128_termini_account_chiuso_definer`, 20261016142258, SHA-256 d135e955…0d77, uguale al file). Due utenti di prova `prova.cancellazione@bobapp.it` creati e cancellati, con i loro file e brief: niente rimasto, verificato dal database. Password del demo coloriepareti@bobapp.it reimpostata (è in `.env.local` di Lucio).
