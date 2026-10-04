# Handoff — 4 ottobre 2026 (ricavi esterni), Lucio (con Claude)

**Fatto:** #138 (Analisi avanzate) è unita, la 110 applicata con l'hash che coincide. PR `ricavi-esterni`:
- la migrazione 111: tabella `ricavi_esterni` con RLS del solo proprietario; scrittura per Plus e Business; tetto di 5.000 righe l'anno; condensazione dopo 25 mesi; `cancella_tutti_i_ricavi_esterni()`; `analisi_avanzata()` con `p_con_esterni`, riscritta dal corpo vivo della 110;
- la pagina `/numeri/esterni`: a mano con il codice cliente suggerito, CSV con anteprima, annulla import, Excel, cancella tutto, avviso prima della condensazione;
- l'interruttore «Solo Bob / Tutto il mio lavoro» nelle avanzate;
- il test di separazione;
- ROPA A27.

La 111 è provata in produzione in una transazione annullata: solo Bob 0 € e tutto 500 €; tetto 54000; Free e scrittura per un altro pro rifiutati; **admin vede 0 righe**; la condensazione conserva i totali.
**A metà:** la 111 si applica al merge. Manca la clausola art. 28 nei ToS del Professionista (ROPA A27). «Copia immagine/numeri» e l'import CSV vanno provati a mano da un pro di prova.
**Applicato in produzione:** 108, 109, 110; la 111 al merge.

---

# Handoff — 4 ottobre 2026 (Analisi avanzate), Lucio (con Claude)

**Fatto:** PR `analisi-avanzata`, che contiene:
- la migrazione 110 `analisi_avanzata()`: il piano si controlla dentro la funzione, e un Free riceve 42501;
- la pagina `/numeri/avanzate`: periodo e confronto nell'URL; andamento, imbuto, prima risposta, richieste senza risposta, servizi, zone, clienti che tornano, agenda; ogni riquadro con «copia numeri» e i grafici anche con «copia immagine»;
- le schede «Il conto del mese» / «Analisi avanzate» in testa alle due pagine;
- il listino con «Analisi avanzate» `SI` su Plus e Business;
- `src/lib/analisi.ts` con 9 test.

La 110 è provata in produzione in una transazione annullata: Business 005 in 82 ms, Free 004 rifiutato con 42501, anonimo rifiutato. La pagina è controllata in locale, con dati finti, a desktop e a 375px: nessuno sborda.
**A metà:** la 110 si applica al merge. «Copia immagine» e «Copia numeri» vanno provati a mano: il browser di Claude non concede gli appunti. Poi i ricavi esterni.
**Applicato in produzione:** 108 e 109; la 110 al merge.

---

# Handoff — 4 ottobre 2026 (notte, dopo il deploy), Lucio (con Claude)

**Fatto:** #134 è unita e la 109 è applicata: gli hash coincidono, `anon` non può eseguire le funzioni, l'advisor non segnala niente di nuovo. La prova dal vivo ha trovato che `/dashboard/numeri` risponde 307 verso `/impostazioni/numeri`, perché il jolly `/dashboard/:sezione+` di next.config scatta prima del routing. La pagina si sposta su `/numeri`, aggiunta alle rotte private del middleware (PR `fix-numeri-percorso`). Aperta anche #135: via la colonna laterale nelle impostazioni.
**A metà:** dopo il merge del fix, `/numeri` va provata da un pro di prova a desktop e a 390px. Lo stesso vale per #135, come cliente, pro e staff. Nel browser di Claude non c'è una sessione.
**Applicato in produzione:** migrazioni 108 e 109.

---

# Handoff — 4 ottobre 2026 (notte), Lucio (con Claude)

**Fatto:** migrazione 108 applicata in produzione dopo il merge di #133: i 7 corpi di funzione coincidono con il file (md5), il recupero dà 7 lavori conclusi per 1.620 €, il cron `condensa-analisi` è attivo e l'advisor non segnala niente di nuovo. Fase 1 nella PR `analisi-base`: la migrazione 109 (`analisi_base`, `analisi_base_storico`, uguali per tutti i piani), la pagina `/dashboard/numeri` con il mese, i conteggi, i lavori e tre strade verso Excel, il link dalla dashboard, il listino con «Analisi base» `SI` sui tre piani, e il dialogo dell'appuntamento con comune e servizio. La 109 è provata in produzione in una transazione annullata, impersonando i pro di prova: 003 a giugno 5 lavori per 800 €, 006 vede solo i suoi, un anonimo viene rifiutato.
**A metà:** la 109 si applica al merge, e solo dopo la pagina funziona: prima di quel momento `/dashboard/numeri` va in errore. Dopo il merge va verificata dal vivo da un pro di prova, a desktop e a 390px. Poi la barra laterale nelle impostazioni.
**Applicato in produzione:** la migrazione 108.

---

# Handoff — 4 ottobre 2026 (sera), Lucio (con Claude)

**Fatto:** Fase 0 delle Analisi: `supabase/migrations/108_registro_lavoro_pro.sql`. Contiene il registro `professional_work_events`, scritto solo da trigger e senza dati del cliente; i mesi condensati `analisi_mesi` e la vista `analisi_mesi_vive` per confrontare i periodi; `condensa_analisi()` in cron il 2 del mese; `completed_at`, comune e CAP sugli appuntamenti; il recupero di quello che c'è. Provata in produzione dentro una transazione annullata: recupero = 7 lavori conclusi per 1.620 €, come le caselle di oggi; concluso, riaperto, disdetto ed eliminato tornano giusti; prima risposta 30 minuti su 30; la condensazione non perde un'unità. Dopo, verificato che non è rimasto niente. ROPA A26 e riga in DATA_COMPLIANCE §5.
**A metà:** la migrazione NON è applicata: si applica al merge, con l'advisor subito dopo. Manca il dialogo dell'appuntamento (comune con `SceltaComune`, servizio da tendina): la lettura di `types.ts` e `messages.ts` è stata bloccata dai permessi della sessione. Poi la Fase 1, l'Analisi base.
**Applicato in produzione:** niente. Solo letture, e la prova in una transazione annullata.

# Handoff — 4 ottobre 2026 (pomeriggio), Lucio (con Claude)

**Fatto:** scritta la specifica delle Analisi per il professionista, `docs/SPEC_analisi_professionista.md`, con le due decisioni di Lucio: «Analisi base» resta sui tre piani, e per ora niente confronto con la categoria. Tre cose lette sullo schema vivo cambiano il piano. Gli stati non hanno storia. Le richieste spariscono a cascata quando il cliente cancella l'account, quindi l'imbuto del pro si accorcia all'indietro. E 27 appuntamenti su 34 non hanno né servizio né cliente, 28 nessuna città. Da qui la Fase 0: un registro degli eventi senza dati del cliente, più `completed_at`, comune e servizio sugli appuntamenti. Nessuna riga di codice di prodotto.
**A metà:** la PR della specifica aspetta l'approvazione di Lucio e le tre risposte del §1.3: conteggi al Free, una riga «Analisi dei ricavi» solo Business, un codice cliente al posto del nome nei ricavi esterni. Il codice parte dopo.
**Applicato in produzione:** niente. Solo letture sullo schema vivo.

---

# Handoff — 4 ottobre 2026, Lucio (con Claude)

**Fatto:** unita #130: il calendario del pro non cambia più larghezza con la vista (due colonne sempre, colonna di fianco in tutte le viste, tasto «Ingrandisci» con nome e colorato su mese e anno; `altezzaGriglia` intatta). Nella PR delle impostazioni il ritorno è uno solo, in cima alla pagina, a ogni larghezza e per tutti (lo staff torna a /admin): tolti il filetto e il link in fondo alla colonna, il blocco in fondo sotto lg e `mostraRitorno`. Misurato in locale a 390, 800 e 1440: un solo link di ritorno visibile e nessun filetto.
**A metà:** nessuna delle due è stata verificata dal vivo su www.meetonda.com: nel browser di Claude non c'era una sessione aperta. Da fare con il pro di prova (calendario: le quattro viste, desktop e 390) e con cliente, pro e staff (/impostazioni e una sezione interna, desktop e 390).
**Applicato in produzione:** solo codice, tramite Vercel al merge. Nessuna migrazione, nessuna variabile.

---

# Handoff — 3 ottobre 2026, André (con Claude)

**Fatto:** audit dal vivo del percorso di prenotazione diretta (pro di prova Milano Clean Squad, cliente demo Gianpiero). Aggiunti 9 rilievi a `roadmap/findings.csv` — nessun avviso al pro per una prenotazione diretta, barra di avanzamento che non arriva ad «Appuntamento», prenotazione disdetta che resta in «Lavori in corso», uno spostamento del pro che duplica la proposta in chat, titolo del dialog di prenotazione coperto dall'header a 1512x794, una disdetta con tre biglietti «Appuntamento annullato», nome del cliente mancante in chat lato pro, quattro righe «Recensisci» indistinguibili con l'orario originale perso dopo uno spostamento, e `subscription_tier_events` senza l'autore del cambio — ognuno con l'evidenza file:riga in `src/` o `supabase/migrations/` (il rilievo sul dialog dice onestamente che la causa nel codice non è stata trovata, invece di indovinarla). `roadmap.md` e `roadmap.html` rigenerati di conseguenza. PR #129 aperta verso main, non ancora unita.
**A metà:** il percorso B dell'audit e il giro a 390px non sono ancora fatti — restano da provare dal vivo, ed eventuali altri rilievi vanno aggiunti a `findings.csv` quando emergono.
**Applicato in produzione:** niente. Solo `roadmap/findings.csv`, `roadmap.md` e `roadmap.html` sono cambiati — nessun codice applicativo, nessuna migrazione, nessuna variabile toccata.
