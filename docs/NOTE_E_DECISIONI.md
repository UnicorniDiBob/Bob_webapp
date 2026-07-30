# BOB — Note e decisioni di lavoro

Annotazioni permanenti che accompagnano la roadmap (artifact "Bob Roadmap" /
`roadmap.csv`). L'artifact si rigenera da CSV e non conserva note: questo file
nel repo è la casa stabile. Aggiungere in cima, non cancellare.

---

## 2026-07-19 · 10.0 — Ricerca verifica P.IVA (esito)

**Come si verifica una P.IVA italiana, in pratica:**

1. **Checksum** (gratis, offline): la P.IVA è 11 cifre con cifra di controllo
   (algoritmo tipo Luhn). Primo filtro nel form — scarta subito refusi.
2. **VIES** (API gratuita UE, SOAP/REST): ⚠️ **NON basta come verifica
   principale.** Contiene solo le P.IVA iscritte all'archivio VIES per
   operazioni intra-UE (opt-in sul mod. AA9/12 o in area riservata AdE).
   L'artigiano locale tipico NON è iscritto → assenza dal VIES ≠ P.IVA
   invalida. Utilizzabile solo come segnale positivo aggiuntivo.
3. **Agenzia delle Entrate "Verifica P.IVA"** (gratis, ufficiale): restituisce
   stato (attiva/sospesa/cessata), denominazione o nome del titolare, data
   inizio attività. MA: solo web, protetto da CAPTCHA, nessuna API pubblica →
   niente integrazione diretta (e niente scraping).
4. **Provider commerciali** (Openapi "Company", InfoCamere/Registro Imprese,
   Cerved): API REST a consumo su fonte ufficiale AdE/InfoCamere, restituiscono
   stato + denominazione + ATECO ecc. → **questa è la via programmatica.**
   Costo dell'ordine dei centesimi per chiamata; volumi bassi (verifiche
   una-tantum per pro iscritto).

**DAC7 (D.Lgs. 32/2023, dir. UE 2021/514):** i gestori di piattaforme che
facilitano servizi personali con corrispettivo noto devono raccogliere,
**verificare** e comunicare annualmente all'AdE (scad. 31/1) i dati fiscali dei
venditori (CF/P.IVA inclusi). Oggi Bob è fuori perimetro (nessun pagamento
transita), ma dal flusso protetto (blocco 19, 2027) ci rientra: la raccolta e
verifica della P.IVA diventa un obbligo di legge, non una scelta.

**Questione lavoratori occasionali senza P.IVA:** la prestazione occasionale
esiste (lavoro autonomo non abituale, ritenuta 20%, soglia contributiva INPS
5.000 €/anno) ma per Bob è problematica: (a) chi si iscrive a un marketplace
per trovare clienti in modo continuativo difficilmente è "non abituale";
(b) le 5 categorie core (idraulico, elettricista, ecc.) richiedono impresa
abilitata DM 37/2008 — il lavoro occasionale non qualificato lì è illegale e
un rischio di responsabilità.
*(Aggiornamento 20/07/2026: il terzo argomento originario — coerenza col
posizionamento "emersione del lavoro nero" — è stato rimosso per decisione di
Lucio: quel posizionamento è abbandonato, vedi
`docs/DECISIONE_posizionamento_2026-07-20.md`.)*
**Proposta in attesa di decisione:** P.IVA obbligatoria per tutti i pro al
lancio; eventuale tier "occasionale" solo se in futuro si aprono categorie
soft (ripetizioni, dog sitting…), con autodichiarazione, limiti e senza badge
"Verificato".

**Come si comportano i competitor (verificato 2026-07-19):**

| Piattaforma | P.IVA all'iscrizione | Verifica | Note |
| --- | --- | --- | --- |
| Instapro | **Obbligatoria** ("valida e attiva", requisito T&C anche per persone fisiche) | Sì, all'ingresso | Ne fa un claim di fiducia: "tutti i nostri professionisti hanno P.IVA" |
| ProntoPro | Non richiesta all'ingresso (iscrizione libera e gratuita) | No fiscale; badge "Top Pro" = solo recensioni (12+ con media ≥4.8) | Conseguenza nota: qualità percepita bassa, contatti contestati (v. Competitor Gap xlsx) |
| Cronoshare | Non richiesta | No | Pubblica perfino guide "fatturare senza P.IVA" (prestazione occasionale) |
| StarOfService | Non richiesta | No | Modello lead-gen aperto, nessun presidio fiscale |

Pattern: il mercato si divide tra piattaforme aperte (massima offerta, rischio
qualità scaricato sul cliente) e Instapro che usa la P.IVA obbligatoria come
argomento di vendita. Nessuno fa la via di mezzo: ingresso aperto + verifica
come gate di visibilità. È lo spazio per Bob (v. decisione 10.x).

**Cosa chiedono esattamente all'iscrizione (verificato 2026-07-19):**
- *Instapro* (fonte: support + T&C): nome azienda, nome titolare/contatto,
  indirizzo aziendale, telefono, email, **P.IVA valida e attiva**, **metodo di
  pagamento** (i lead si pagano). Il funnel più pesante del mercato.
- *ProntoPro* (funnel /prosignup percorso dal vivo): servizio offerto →
  "azienda o libero professionista?" → nome e cognome → zona/contatti.
  **Niente P.IVA, niente documenti, niente metodo di pagamento** — nemmeno
  per categorie DM 37 (test fatto con "Idraulico"). I crediti si comprano dopo.
- *Cronoshare / StarOfService*: categoria + zona + contatti. Nessun controllo
  fiscale o documentale.
- **Nessun competitor chiede documenti d'identità all'iscrizione.** La verifica
  documentale nel mercato esiste solo come programma di fiducia premium
  (benchmark: Google Guaranteed), mai come gate d'ingresso.

**Decisione proposta — livelli di verifica (in attesa di ratifica):**
- L0 Iscritto: nome, email, categoria, città. Frizione identica a ProntoPro.
  Profilo creabile, domanda visibile in forma anonima. Nessun documento.
- L1 P.IVA verificata (automatica, un campo, zero upload): sblocca matching e
  contatto clienti nelle categorie regolamentate. Checksum + API stato attiva
  + confronto denominazione.
- L2 Badge "Verificato Bob" (facoltativo): documento + visura (e DM 37 per
  impiantisti). Non è un gate: è un boost di ranking/conversione, se lo
  guadagna chi vuole. Risponde all'obiezione "documenti = frizione inutile".
- Categorie soft future: L0 basta, con etichetta "occasionale dichiarato".

**Architettura proposta 10.1:** checksum nel form → chiamata server-side al
provider commerciale alla registrazione pro (stato attiva + confronto
denominazione/nome) → esito e snapshot salvati in tabella dedicata (audit,
RLS staff) → badge "Verificato" pieno solo dopo step manuale 10.2 (documento
+ visura). Privacy: la P.IVA di una ditta individuale è dato personale →
riga nel registro trattamenti, base giuridica contratto (poi obbligo legale
con DAC7), retention allineata alla policy (DATA_COMPLIANCE).

## 2026-07-18 · 25b — Fix privacy + follow-up aperto

Data di nascita e consenso termini spostati in `profile_private` (mig 027):
la policy 003 esponeva l'intera riga `profiles` dei professionisti ad anon
(verificato con `set role anon`). **Follow-up aperto:** `profiles.phone` dei
pro resta pubblicamente leggibile per la stessa policy (oggi vuoto per tutti)
→ spostarlo in `profile_private` prima del go-live.

## 2026-07-18 · 9.x — Analisi (debito tecnico e limiti noti)

- Aggregazioni calcolate in pagina: ok a volumi demo, da rifattorizzare in
  viste/aggregazioni DB nel launch hardening (blocco 15).
- Storico cambi abbonamento (mig 025) parte dal 18/07/2026: churn/disdette
  attendibili solo da quella data.
- Ricerche per categoria (mig 026): eventi anonimi by design (mai user_id né
  testo libero). Conta solo brief completati; chat abbandonate non tracciate —
  decisione aperta se loggarle.
- Export Excel: dipendenza `xlsx` (SheetJS).

## 2026-07-18 · repo — Nota migrazioni

La migration applicata live col nome `021_profile_age_terms_and_city_geo` nel
repo si chiama `024_…` (rinumerata per collisione con il lavoro parallelo
021–023 di André). Schema identico, solo il nome nella history diverge.
