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
