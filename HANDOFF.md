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

**Fatto.** Sessioni multiple (ramo `feat/sessioni-multiple`, PR da mergiare), in quattro fette:
- **due sessioni nello stesso browser** e lo scambio con un click; l'account in attesa sta in `bob-attesa` (httpOnly, solo refresh token, id ed email) e l'attivo non si rinnova mai durante lo scambio;
- **il punto unico lato server** (`createClient` di `lib/supabase/server`, costruito da `fabbrica.ts`) con un test che prova che, con A attivo e B presente, niente va a B;
- **le chiavi del browser per account** (bozza della chat di Bob compresa), e la ricarica completa allo scambio con l'avviso fra schede;
- «esci da questo» ed «esci da tutti», in questo browser.

Selettore minimo in `/impostazioni/accesso`. Nessuna migrazione: la 104 è libera.

**A metà.** **La route «aggiungi account» non c'è**: il tetto di tentativi vuole allargare il vincolo `route in ('chat','brief')` di `rate_limit_counters`, cioè una migrazione, e aspetta la decisione di Lucio. Senza, un secondo account entra nel browser solo a mano (passi nella PR). Il collaudo dal vivo lo fa Lucio con account suoi. **Per André:** il selettore nell'intestazione; `BobChat.tsx` e `PromemoriaProfilo.tsx` sono cambiati solo nel nome delle chiavi di `localStorage`.

**Applicato in produzione che devi sapere.** Niente su Supabase. **Al merge cambia il logout per tutti:** «Esci» vale solo per questo browser, non più per tutti i dispositivi (`NOTE_E_DECISIONI.md`, 29/09).
