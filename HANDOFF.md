# Handoff — 4 ottobre 2026, Lucio (con Claude)

**Fatto:** il calendario del pro non cambia più larghezza da solo. `ProWorkspace` tiene sempre le due colonne (`lg:grid-cols-[1fr_320px]`) e la colonna di fianco (giro del giorno + prossimi appuntamenti) c'è in tutte e quattro le viste; `onViewChange` e lo stato `calView` sono stati tolti perché servivano solo a quello. Il tasto a tutto schermo ora si chiama «Ingrandisci» / «Riduci» (da 640px in su; sotto resta l'icona) e si colora di indaco su mese e anno; a tutto schermo l'anno si stende su sei colonne da xl. `altezzaGriglia` non è toccata. Misurato in locale su una pagina di prova con la stessa griglia: a 390, 1024 e 1440 riquadro, blocco sotto e colonna di fianco hanno le stesse coordinate nelle quattro viste.
**A metà:** la verifica dal vivo su www.meetonda.com col pro di prova (desktop e 390px, giro fra le quattro viste) va fatta dopo il deploy: nel browser di Claude non c'era una sessione aperta e la password non la può inserire lui.
**Applicato in produzione:** niente oltre al codice che Vercel manda fuori con il merge. Nessuna migrazione, nessuna variabile.

---

# Handoff — 3 ottobre 2026, André (con Claude)

**Fatto:** audit dal vivo del percorso di prenotazione diretta (pro di prova Milano Clean Squad, cliente demo Gianpiero). Aggiunti 9 rilievi a `roadmap/findings.csv` — nessun avviso al pro per una prenotazione diretta, barra di avanzamento che non arriva ad «Appuntamento», prenotazione disdetta che resta in «Lavori in corso», uno spostamento del pro che duplica la proposta in chat, titolo del dialog di prenotazione coperto dall'header a 1512x794, una disdetta con tre biglietti «Appuntamento annullato», nome del cliente mancante in chat lato pro, quattro righe «Recensisci» indistinguibili con l'orario originale perso dopo uno spostamento, e `subscription_tier_events` senza l'autore del cambio — ognuno con l'evidenza file:riga in `src/` o `supabase/migrations/` (il rilievo sul dialog dice onestamente che la causa nel codice non è stata trovata, invece di indovinarla). `roadmap.md` e `roadmap.html` rigenerati di conseguenza. PR #129 aperta verso main, non ancora unita.
**A metà:** il percorso B dell'audit e il giro a 390px non sono ancora fatti — restano da provare dal vivo, ed eventuali altri rilievi vanno aggiunti a `findings.csv` quando emergono.
**Applicato in produzione:** niente. Solo `roadmap/findings.csv`, `roadmap.md` e `roadmap.html` sono cambiati — nessun codice applicativo, nessuna migrazione, nessuna variabile toccata.
