# Handoff — 29 settembre 2026, André

**Fatto.** Centroidi CAP (101), distanza nel punteggio (102) e centroidi di
Milano da fonte piu' fine (103). `professionals_score` ora pesa la geografia
20 punti in due parti: area 16 (zona 16 / comune 14 / citta' 12 / prov 6 /
reg 3 / macro 2 / it 1) e distanza 4 (<=5 km 4, <=10 km 3, <=25 km 2,
<=50 km 1, oltre 0, ignoto 2), misurata fra centroidi di CAP, non fra
indirizzi. Sesto parametro `p_cap`, call site in `src/lib/data.ts`. Corretto
anche `BobChat.tsx`, che non inoltrava zoneSlug/postalCode a RequestDialog:
`requests.postal_code` restava sempre null su quel percorso.

**A meta'.** Niente. La 103 chiude il filo: 38 CAP milanesi su 38 punti
distinti, verificato in produzione.

**Applicato in produzione che devi sapere.** 101, 102 e 103 sono tutte e tre
applicate. La 103 e' stata applicata alle 10:01 PRIMA del merge, contro la
regola: il file arriva in main con la PR di oggi. Se hai fatto pull fra le
10:01 e il merge, il tuo repo non ricostruiva la produzione. Restano ~110 CAP
civici reali fuori Milano senza centroide (Cagliari, Ravenna, Mestre,
La Spezia e altri): gap noto, da colmare prima della seconda citta',
elencato in `docs/NOTE_E_DECISIONI.md`.
