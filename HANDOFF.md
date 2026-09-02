# Passaggio di consegne — 2 settembre 2026

## Cosa ho fatto

**La ricerca per parole chiave, i primi due pezzi, in produzione.** Prima
esistevano due strade per trovare un servizio: chiedere a Bob, o scorrere
l'elenco con due tendine. Ora esiste il ponte fra come parla il cliente e come
si chiama la voce di catalogo.

- **067 — il vocabolario** (`search_terms`, 491 righe): 15 nomi di servizio e
  105 nomi di intervento **generati dal catalogo stesso**, così non c'è una
  lista da tenere allineata a mano; sopra, 64 sinonimi di mestiere travasati da
  `SERVICE_KEYWORDS` di `matching.ts` (da radici a parole intere) e 307 sinonimi
  di intervento, che non esistevano da nessuna parte. Tutti e 105 gli interventi
  non-«Altro» ne hanno almeno uno. Nessun dato personale: è catalogo, lettura
  pubblica, scrittura al solo admin.
- **068 — il risolutore** (`search_resolve`): stacca il DOVE dalla frase (zona,
  città, «vicino a me») e confronta il resto in quattro modi — esatto 1.00,
  termine contenuto 0.85, prefisso 0.80, somiglianza 0.40-0.99 per trigrammi o
  per sovrapposizione di parole piene. `src/lib/search.ts` la chiama e non
  lancia mai: se il database non risponde l'elenco resta sfogliabile.
- **069 — pronta, NON applicata**: l'ordinamento a bande (fra due risposte
  quasi pari vince l'intervento sul mestiere) e i token al sicuro da una
  ri-semina. Va aperto il PR prima di applicarla.

## Cosa è a metà

- **L'interfaccia non esiste.** Su `/professionisti` non c'è nessuna casella di
  ricerca: il risolutore è pronto e nessuna pagina lo chiama. Deciso che la
  ricerca vive lì dentro (query vuota = sfoglia tutto), non su una rotta nuova.
- **Il ranking dei professionisti è quello di prima.** `getProfessionals` in
  `src/lib/data.ts` carica ancora TUTTI i professionisti e filtra in
  JavaScript. Va portato in SQL prima che siano qualche centinaio. I pesi sono
  decisi (intervento esatto 40 / mestiere 20, area 25-18-10-6-3, verifica
  15-10-2, rating con smorzamento 12, prezzo 5, prenotazione immediata 5, più
  un sorteggio giornaliero a parità) e vanno pubblicati in pagina come già si
  fa su servizio×città, per l'art. 5 P2B.
- **Due verità sullo stesso fatto**: `professional_services` (che ha il prezzo)
  e `professionals.subservice_slugs` (un array). Va scelta una. E soprattutto:
  **4 professionisti su 6 non dichiarano nessun intervento**, quindi la ricerca
  per intervento oggi trova poco non perché non funzioni, ma perché il dato non
  c'è. Va riempito a mano per i sei, e poi serve la schermata che lo chiede.
- **Gli slot sponsorizzati** (deciso: fino a uno nei primi tre e uno a metà
  elenco, marcati «Sponsorizzato», elenco organico puro merito) non sono
  costruiti. La disclosure è obbligatoria, non facoltativa.
- **Il registro delle ricerche a vuoto** non c'è. È il modo in cui il
  vocabolario impara quali sinonimi mancano: senza, i buchi non si vedono. Da
  fare su `search_events`, senza `user_id`, cifre tolte dalla stringa, 12 mesi.
- **Le bande di fiducia vanno rispettate dall'interfaccia**: sopra 0.80 è una
  risposta, fra 0.40 e 0.80 è un «forse cercavi» e va detto. Esempio vero: «ho
  bisogno di un preventivo per il bagno» dà due candidati a 0.45 e fra i due
  decide l'alfabeto. A quel livello si propone, non si afferma.

## Cosa ho applicato in produzione che l'altro deve sapere

- **067 e 068 applicate** (file in repo prima dell'applicazione, come da
  regola). **069 NON applicata**: prima il PR.
- **`unaccent` e `pg_trgm` ora installate**, nello schema `extensions` e non in
  `public`, per non lasciare un rilievo fisso agli advisor.
- **Advisor di sicurezza: nessun rilievo nuovo.** Resta solo
  `auth_leaked_password_protection`, che vuole il piano Pro.
- La 067 dava all'admin una policy `for all`, che comprende SELECT: ogni
  lettura pubblica valutava due policy. **Corretto dalla 068** in tre policy
  separate, con `is_admin()` dentro un select.
- **Numerazione**: il README delle migrazioni diceva «next free number: 050»
  quando in produzione si era già alla 061, e la mia prima correzione l'ha
  messo su 063, che era preso e applicato. Ora dice 068 e va portato a **070**
  quando la 069 entra. Il vocabolario è nato numerato 062 e collideva con
  `062_ready_at`: rinominato in 067 dal PR #21, prima di essere applicato.
- **Trappola disarmata dalla 069, da conoscere comunque**: rigiocare la 067
  dopo la 068 — cosa che la 067 stessa invita a fare per ri-seminare il
  catalogo — riportava indietro il trigger e lasciava ogni termine nuovo senza
  parole piene. Silenzioso: la riga si trova ancora per prefisso e per
  trigrammi, e sparisce solo dal confronto per parole. Mai scattata in
  produzione (491 termini, 0 senza token).
- **Il replay dai soli file del repo, 001 → 069, dà 0 errori** su un Postgres
  16 vuoto con `pg_cron` e i due shim. Il README delle migrazioni dice ancora
  «last verified: 001 → 049»: quella riga si può aggiornare.
