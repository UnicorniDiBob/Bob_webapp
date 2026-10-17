Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** mascotte ape (PR #189, unita e provata dal vivo) e ritocchi di André sul ramo `mascotte-ape-ritocchi`: nella fascia indaco della home l'ape «successo» (medaglione) al posto di «sceglie lo strumento»; nell'eroe di /servizi «benvenuto» (medaglione nel tondo) con l'alt nuovo; il titolo del telefono dice «Professionisti» invece di «Idraulici», su due righe con «Milano» sul desktop (su una non ci stava: misurato). Prima, la #188: intestazione delle email BOB BEE.
**A metà:** restano da generare le pose in docs/MASCOTTE_pose_mancanti.md (ape al telefono, con la bilancia, con la cariola, di schiena sulla scala) e l'animazione, che André farà più avanti.
**Applicato in produzione:** niente nel database. I ritocchi arrivano su Vercel con il merge della PR.

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** PR #191 unita (`chiamante-ovunque`): le 13 route che ricavavano l'utente dai soli cookie (account/cancellazione ed esporta, appointments disdici e sposta, appuntamenti ics, conversazioni/da-leggere, richieste archivia/riapri/scegli via sceltaServer.ts, termini/accetta, supporto, memory, onboarding/promo) passano da chiamante(): dall'app con un Bearer non rispondono più 401, per il sito non cambia niente. Rete: src/lib/supabase/chiamante-ovunque.test.ts (sul codice di prima trova esattamente le 13). Provata dal vivo sulla build della #191 (esporta / disdici con id inesistente): cookie 200 / 404, Bearer valido 200 / 404, niente 401 / 401, Bearer revocato 401 / 401, Bearer revocato + cookie valido 401 / 401 (il cookie non si legge), Bearer falso 401 / 401; poi be9396e9 cancellato via route (Bearer) e cron (cancellati 1, falliti 0) e cercato in 543 colonne di public e auth e nello storage: zero. Il Bearer SCADUTO vero non è stato provato: il Mac è andato in sospensione e il timer di un'ora non è mai scattato; al suo posto il revocato, che Supabase rifiuta (403 session_not_found) e chiamante() tratta con lo stesso ramo. Il 16/10: PR #185 unita (127: nei bucket immagini scrive solo il service role). Ramo `cron-cancella-foto`, PR #186: alla chiusura dell'account il cron toglie i file di verifica-documenti, portfolio e brief-photos e le foto di chat citate nei brief del cliente (src/lib/fileUtente.ts), senza toccare una foto citata da un altro brief. La prova dal vivo ha trovato che DAL 28/09 NESSUN ACCOUNT SI POTEVA CANCELLARE (trigger termini_account_chiuso SECURITY INVOKER, «permission denied for table terms_acceptances»): corretto con la 128. Stesso DELETE dello stesso utente: 500 alle 14:17Z, 200 alle 14:25Z; poi la prova completa da capo, 9 controlli verdi (cancellati 1, falliti 0, file_rimossi 4). CLAUDE.md: il rito del giovedì guarda i giri falliti e quelli fermi a zero.
**A metà:** CANC2 sul ramo `canc2-prova-cancellazione`, non ancora spinto. Letti dal vivo i 14 trigger SECURITY INVOKER: tutti BEFORE, girano come proprietario della tabella e senza JWT, e la cascata ne fa partire solo 3 (proteggi_appuntamento_cliente, valida_scelta_professionista, request_messages_appointment_guard), che con auth.uid() null lasciano passare: previsione, nessuno fallisce — la prova (scripts/prova_cancellazione.mjs esteso a un cliente e a un pro di prova) non è ancora girata. Nello stesso ramo il cron svuota access_notes e timing_availability dei brief prima di deleteUser (summary, zona e budget restano), da provare. FOTO1 entro il 21/10, invariato: un cliente può farsi dare la foto di un altro, perché /api/bob/brief salva i percorsi delle foto come li manda il browser.
**Applicato in produzione:** niente nello schema. Utenti di prova prova.cancellazione@bobapp.it creati e cancellati: be9396e9 (via route e cron, verificato dal database) e 39402c00 (cancellato dalla pulizia dello script, verificato). Il 16/10: migrazione 127 (20261016140436) e 128 (`128_termini_account_chiuso_definer`, 20261016142258, SHA-256 d135e955…0d77, uguale al file). Due utenti di prova `prova.cancellazione@bobapp.it` creati e cancellati, con i loro file e brief: niente rimasto, verificato dal database. Password del demo coloriepareti@bobapp.it reimpostata (è in `.env.local` di Lucio).

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
