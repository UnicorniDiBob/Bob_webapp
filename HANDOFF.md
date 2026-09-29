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

**Fatto.** L'SLA della coda si misura anche a caso chiuso (ramo
`feat/sla-coda-misurarlo`, voce m2t4s8). `misuraSlaStorica()` in `vat.ts`
ricostruisce dai `verification_events` i tratti con la palla nostra, con le
regole della 080, e dà due numeri: `sforatoSecondoIToS` sull'ultimo tratto (va
nel riquadro «SLA misurato» di `/admin/professionals`) e `attesaTotale`, la
somma. Le chiusure automatiche sono contate a parte. Il giro notturno scrive
`sla_palla_nostra`/`sla_sforati` in `system_job_runs` e un `console.error`
«SLA sforato» quando serve. Nessuna migrazione: la 104 è libera.

**A metà.** Niente è provato su dati veri: la coda è vuota, e la prova sono
38 test (anche in UTC). Il riquadro admin non l'ho visto disegnato, perché
richiede il login staff. Rimandati di proposito, scritti in
`NOTE_E_DECISIONI.md` (29/09): i ricontrolli «scadenza» sulle verifiche
manuali, dove il lavoro è nostro ma la palla risulta sua. **Per André:**
`AvanzamentoVerifica.tsx:39` promette «se sforiamo ti scriviamo», e non è
vero; il `level_granted` automatico in `api/pro/verifica-piva` è firmato
`actor_role 'professional'` (rilievo in `roadmap/findings.csv`).

**Applicato in produzione che devi sapere.** Oggi niente. Ieri sera la 100
(`terms_acceptances`) è stata applicata alle 19:04Z, **sei minuti dopo** il
merge della PR #100 che la usa: nel mezzo nessuna iscrizione e nessun export
registrati. Advisor puliti sugli oggetti nuovi.
