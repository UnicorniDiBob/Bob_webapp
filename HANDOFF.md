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
