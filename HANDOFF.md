# Handoff — 30 settembre 2026, Lucio

**Fatto** (ramo `feat/doppio-cappello-chiusura`): la casetta nell'area in alto al posto di «Il mio lavoro» / «I miei lavori», nascosta allo staff (`src/components/Header.tsx`, area di André: per lui, cambiano solo quelle due voci); riga A1 del Registro sui più account; `bob:manutenzione-chiusa` resta condivisa, con il perché in `NOTE_E_DECISIONI.md`; proprietari della spike portati a Lucio. La #115 era già mergiata e verificata (104 applicata, advisor attesi, segreto HMAC attivo, deploy READY).
**A metà:** la casetta non è ancora provata dal vivo da loggati, desktop e 390px; le 13 prove manuali della #114 non sono state eseguite (servono due account veri, un browser e un telefono).
**Applicato in produzione:** niente. Restano fuori dal codice l'SMTP personalizzato su Supabase e la rilettura legale dei termini clienti.
