Ognuno scrive nella propria sezione e sovrascrive solo quella: tre righe, fatto / a metà / applicato in produzione.
Le righe dell'altro non si toccano, nemmeno per correggerle: se sono superate, lo si dice nella propria.

## André

**Fatto (17 ottobre 2026, André con Claude):** PR #200 (`chat-bob-selezione-multipla`): nella chat di Bob si spuntano fino a 3 pro e si scrive un messaggio solo, una richiesta; il messaggio col budget NON salva l'indirizzo (come prima). Verificandola è uscito un rilievo serio, ora chiuso: un pro collegato poteva ottenere l'indirizzo del cliente creando o confermando da solo un appuntamento (dalla 044; nessun indirizzo di un cliente reale esposto, nessuna notifica art. 33, decisione di André). PR #201 (`indirizzo-solo-con-conferma-cliente`): migrazione **131** (la 126 era già presa), menu Stato del calendario del pro senza «Confermato»/«Completato» sulle proposte con un cliente.
**A metà:** #200 unita da André (17/10, 18:08). #201 pronta, la unisce André. Dopo il merge di #201: deploy Production di Vercel e menu del calendario dal vivo come Idraulico Demo 1, a 1440 e 390. **Lucio: revisione a posteriori di #201** (la 131 è stata applicata senza la sua approvazione, per decisione di André: repo pubblico, buco visibile nel file). Parte C: zero indirizzi copiati da pulire.
**Applicato in produzione:** migrazione 131 il 17/10 alle 18:09 (20261017160944 in schema_migrations): funzione private.conferma_solo_dal_cliente, trigger a_pro_propone_soltanto, y_conferma_solo_dal_cliente e zzz_indirizzo_dopo_conferma (era appointments_fill_location), default di appointments.status 'proposed'. Advisor di sicurezza senza rilievi nuovi. Resta il seed degli idraulici demo del 17/10 (docs/PULIZIA_PRE_PILOTA.md §1).

## Lucio

Proposta per André (17/10): dividere anche la sua sezione in Webapp e App, con le stesse tre righe. Ne parliamo noi due.

### Webapp

**Fatto (17 ottobre 2026, Lucio con Claude):** appuntamento-una-strada, PR 1. `POST /api/appointments/[id]/conferma` e `/rifiuta`, con `chiamante()` (cookie e Bearer): stato, messaggio in chat e notifica, nello stesso ordine e con gli stessi testi del browser di oggi (`src/lib/rispostaProposta.ts`; la notifica di `/api/notify` ora sta in `src/lib/notificaEvento.ts`, la route la richiama). Gira con la sessione del cliente, così lo storico scrive autore `customer`. Risposte: 401 senza login; 404 se non la vedi; 403 `non_cliente` (es. il pro); 409 `non_proposta` / `proposta_tua` / `scaduta`; 200 `giaFatto: true` e niente scritto se la ripeti. **È UN CONTRATTO CON L'APP.** Prova dal vivo `TZ=Europe/Rome node scripts/prova_risposta_proposta.mjs`, 20/20: riga, messaggio, storico e analisi della route uguali a quelli del sito, due conferme insieme → un messaggio solo.
**A metà:** PR 2 (area di André): i pulsanti Conferma/Rifiuta del sito (home cliente, pagina richiesta, biglietto in chat) passano dalle route, e la home del cliente smette di dire «Nessuna richiesta ancora» quando la lettura fallisce. Parte da main dopo il merge della PR 1. Da decidere: RPC per stato + messaggio in una transazione (oggi, come prima, se il messaggio fallisce l'appuntamento resta confermato senza traccia in chat). Ancora aperto: l'app deve passare a `/api/termini/[versione]` e `/api/termini/corrente` (#202, #203); da chiudi-ruolo-iscrizione, riprovare con un SMTP vero le iscrizioni con `signUp` e chiave pubblica; da cancellazione-brief-completa ed export-pro: privacy/page.tsx di André (due frasi false), export da pro di prova su www → 429, sette rotte GET col service role senza `fetchCache`, `BRIEF_PHOTOS_SECRET` su Vercel.
**Applicato in produzione:** nessuna migrazione. La prova ha scritto e poi cancellato le sue righe sulla proposta PROVA-APP `ede92c0b…`; la sua riga di analisi `proposta_inviata` è stata ricreata identica tranne l'id (l'ha cancellata un primo giro dello script, poi corretto).

### App (Bob_app)

**Fatto:** niente.
**A metà:** niente.
**Applicato in produzione:** niente.
