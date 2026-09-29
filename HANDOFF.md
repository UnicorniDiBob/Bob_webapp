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
blocco trasparenza sono tutti applicati/mergiati. La 103 e' stata applicata
alle 10:01 PRIMA del merge, contro la regola: il file arriva in main con la
PR di quel giorno. Se hai fatto pull fra le 10:01 e il merge, il tuo repo non
ricostruiva la produzione. **Trovato lavorando sul blocco trasparenza, non
ancora corretto**: la disponibilità (`punti_disponibilita`, fino a 10 punti —
più della verifica) premia con 10 punti solo chi ha `instant_book_enabled`,
e quel campo è bloccato a `tier === "pro" || tier === "business"`
(`InstantBookingConfig.tsx`, `InstantBookingEntry.tsx`) — stessa categoria di
problema appena corretta per la verifica, stessa norma probabilmente
coinvolta, ma non era nello scopo di questo fix e non l'ho toccato. Da
valutare con Lucio insieme alla revisione legale sopra. Restano ~110 CAP
civici reali fuori Milano senza centroide (Cagliari, Ravenna, Mestre, La
Spezia e altri): gap noto, da colmare prima della seconda città, elencato in
`docs/NOTE_E_DECISIONI.md`.

---

# Handoff — 29 settembre 2026, Lucio

**Fatto.** Tre PR su `main`:
- #106: l'SLA misurato sui casi chiusi e `sla_sforati` nel giro notturno;
- #107: fuori da `next.csv` la voce `registraGiro()`, chiusa dal 12/09;
- #108: via «se sforiamo ti scriviamo», l'avviso di scuse quando sforiamo, e le Emergenze che vedono i ricontrolli con documento.

Poi la riscrittura di `/admin/professionals` (ramo `feat/admin-verifiche-coda-unica`, PR da mergiare):
- una coda sola, dal più urgente, con le regole di `vat.ts`;
- le viste per stato come filtro `?vista=`;
- in fondo un archivio con le sole leve piano e approvazione staff;
- ogni lettura controlla il suo errore;
- link firmati e telefono solo per i casi mostrati.

Tolta la frase «visibili ai clienti», falsa dalla 080. Nel Piano la voce m2t4s9 è spuntata citando la 094, verificata viva dopo la 102.

**A metà.** Niente è verificato da loggati: la pagina chiede il login dello staff e la coda in produzione è vuota. Il redirect di `/admin` verso `/login` perde `?vista=`: chi apre un link a una vista senza essere dentro, dopo il login non ci torna. Aperti in `findings.csv`: il declassamento Pro+ → Pro senza motivazione né registro, e il cs che può cambiare il piano. **Per André:** la 101, la 102 e la 103 sono registrate in `schema_migrations` senza numero (`centroidi_cap`, `distanza_nel_punteggio`, `centroidi_cap_milano`); il `level_granted` automatico firmato `actor_role 'professional'` resta aperto.

**Applicato in produzione che devi sapere.** Oggi niente su Supabase. Il Piano è stato ripubblicato (versione 53) dallo strumento di Claude, che l'ha avvolto in uno scheletro HTML in più: il contenuto è intatto, ma se vedi qualcosa di strano è quello.
