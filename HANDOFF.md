# Handoff — 29 settembre 2026, André

**Fatto.** Centroidi CAP (101), distanza nel punteggio (102) e centroidi di
Milano da fonte piu' fine (103). `professionals_score` ora pesa la geografia
20 punti in due parti: area 16 (zona 16 / comune 14 / citta' 12 / prov 6 /
reg 3 / macro 2 / it 1) e distanza 4 (<=5 km 4, <=10 km 3, <=25 km 2,
<=50 km 1, oltre 0, ignoto 2), misurata fra centroidi di CAP, non fra
indirizzi. Sesto parametro `p_cap`, call site in `src/lib/data.ts`. Corretto
anche `BobChat.tsx`, che non inoltrava zoneSlug/postalCode a RequestDialog:
`requests.postal_code` restava sempre null su quel percorso.
Corretto anche il blocco trasparenza di `/come-funziona`: diceva "nessun
professionista può pagare per stare più in alto" ed elencava "qualunque
pagamento" fra le cose che non contano mai. Falso — `punti_verifica` premia
`vat_verified`/`documents_verified` (5/7 punti su 100) e la verifica della
partita IVA è dietro un piano a pagamento (gating in
`src/app/impostazioni/verifica/page.tsx`, `tier === "free"`). Già segnalato
il 18 agosto (P4.1) come esattamente il caso dell'art. 23 c.1 lett. m-bis
Codice del Consumo. La pagina ora dice che la verifica è compresa nei piani a
pagamento, che pesa nel punteggio, e cosa significa davvero l'assenza del
badge (non "non l'abbiamo controllato", ma "non ha un piano che la include").
Tolta anche la promessa "non cambieranno l'ordine degli altri" sul futuro
Sponsorizzato — vincolava un Boost non ancora disegnato — senza sostituirla
con promesse nuove. Trimmata la sezione per l'art. 5(6) P2B (parametri
principali sì, meccanica no): via le soglie del tempo di risposta, l'esempio
di shrinkage delle recensioni, il sorteggio giornaliero a parità di punti, il
dettaglio oltre alla frase sulla privacy del centro-CAP. Restano sette
elementi, "la zona e il tempo di risposta pesano uguale" resta vera.

**A metà.** La revisione legale di Lucio sul blocco trasparenza — il testo è
già live, come da istruzione, ma non è stato scritto da un legale e tocca
art. 23 Codice del Consumo.

**Applicato in produzione che devi sapere.** 101, 102, 103 e il fix del
blocco trasparenza sono tutti applicati/mergiati. **Trovato lavorando su
questo, non ancora corretto**: la disponibilità (`punti_disponibilita`, fino
a 10 punti — più della verifica) premia con 10 punti solo chi ha
`instant_book_enabled`, e quel campo è bloccato a `tier === "pro" ||
tier === "business"` (`InstantBookingConfig.tsx`, `InstantBookingEntry.tsx`)
— stessa categoria di problema appena corretta per la verifica, stessa norma
probabilmente coinvolta, ma non era nello scopo di questo fix e non l'ho
toccato. Da valutare con Lucio insieme alla revisione legale sopra.
Restano ~110 CAP civici reali fuori Milano senza centroide (Cagliari,
Ravenna, Mestre, La Spezia e altri): gap noto, da colmare prima della
seconda città, elencato in `docs/NOTE_E_DECISIONI.md`.
