# Handoff — 4 ottobre 2026, Lucio (con Claude)

**Fatto:** unita #130: il calendario del pro non cambia più larghezza con la vista (due colonne sempre, colonna di fianco in tutte le viste, tasto «Ingrandisci» con nome e colorato su mese e anno; `altezzaGriglia` intatta). Nella PR delle impostazioni il ritorno è uno solo, in cima alla pagina, a ogni larghezza e per tutti (lo staff torna a /admin): tolti il filetto e il link in fondo alla colonna, il blocco in fondo sotto lg e `mostraRitorno`. Misurato in locale a 390, 800 e 1440: un solo link di ritorno visibile e nessun filetto.
**A metà:** nessuna delle due è stata verificata dal vivo su www.meetonda.com: nel browser di Claude non c'era una sessione aperta. Da fare con il pro di prova (calendario: le quattro viste, desktop e 390) e con cliente, pro e staff (/impostazioni e una sezione interna, desktop e 390).
**Applicato in produzione:** solo codice, tramite Vercel al merge. Nessuna migrazione, nessuna variabile.

---

# Handoff — 3 ottobre 2026, André (con Claude)

**Fatto:** audit dal vivo del percorso di prenotazione diretta (pro di prova Milano Clean Squad, cliente demo Gianpiero). Aggiunti 9 rilievi a `roadmap/findings.csv` — nessun avviso al pro per una prenotazione diretta, barra di avanzamento che non arriva ad «Appuntamento», prenotazione disdetta che resta in «Lavori in corso», uno spostamento del pro che duplica la proposta in chat, titolo del dialog di prenotazione coperto dall'header a 1512x794, una disdetta con tre biglietti «Appuntamento annullato», nome del cliente mancante in chat lato pro, quattro righe «Recensisci» indistinguibili con l'orario originale perso dopo uno spostamento, e `subscription_tier_events` senza l'autore del cambio — ognuno con l'evidenza file:riga in `src/` o `supabase/migrations/` (il rilievo sul dialog dice onestamente che la causa nel codice non è stata trovata, invece di indovinarla). `roadmap.md` e `roadmap.html` rigenerati di conseguenza. PR #129 aperta verso main, non ancora unita.
**A metà:** il percorso B dell'audit e il giro a 390px non sono ancora fatti — restano da provare dal vivo, ed eventuali altri rilievi vanno aggiunti a `findings.csv` quando emergono.
**Applicato in produzione:** niente. Solo `roadmap/findings.csv`, `roadmap.md` e `roadmap.html` sono cambiati — nessun codice applicativo, nessuna migrazione, nessuna variabile toccata.
