# ToS Bob — cosa manca e cosa dobbiamo decidere

Checklist di lavoro per il blocco 23. Nasce dal confronto tra le bozze
`BOZZA_ToS_Clienti.md` / `BOZZA_ToS_Professionisti.md` (19/07/2026) e i contratti
di ProntoPro (25 art.), Instapro (20+13 art.), Cronoshare, StarOfService, letti
integralmente il 19/07/2026.

**Stato bozze:** struttura difensiva corretta (ruolo, livelli di verifica,
esclusioni, P2B), ma **incompleta**. Sotto: prima le decisioni di business
(bloccanti), poi le clausole tecniche mancanti.

---

## PARTE A — Decisioni di business/prodotto (bloccanti: senza queste il testo non si chiude)

### A1. Perimetro dei livelli di verifica
- [ ] **Naming**: "Pro"/"Pro+" collide con gli abbonamenti Bob Pro/Business già in
      DB (`subscription_tier`). Decidere se rinominare i livelli o gli abbonamenti.
- [ ] **Cosa può fare esattamente un "Iscritto"**: vede le richieste? in forma
      anonima? può rispondere? può essere trovato in ricerca? (oggi la bozza dice
      solo che l'accesso "può essere condizionato").
- [ ] **Quali categorie richiedono quale livello**: elenco esplicito. Le 5 core
      (idraulico, elettricista, ecc.) → Pro obbligatorio? Pro+ per gli impianti
      DM 37/2008?
- [x] **Validità temporale della verifica** — DECISO 12/09, SCRITTO NEI ToS 20/09
      (sezione 9 del testo pro, «Durata e rinnovo»): 12 mesi dal controllo,
      preavviso 30 giorni, ricontrollo d'ufficio, rinnovo automatico all'esito
      positivo. Cifre in `src/lib/vat.ts`, migrazioni 078/079/080.
- [x] **Cosa accade se la P.IVA cessa** — DECISO 13/09, COMPLETATO 20/09, SCRITTO
      NEI ToS (sezione 9, «Cessazione della partita IVA»): nessun declassamento
      automatico — il LIVELLO lo toglie una persona con motivazione scritta —
      ma l'etichetta cessa di essere visibile dopo 7 giorni senza riscontro e,
      con la 094, comunque dopo 14 giorni dall'apertura del caso anche se la
      pratica è ancora da noi. Misura reversibile, di sola rappresentazione.
- [x] **SLA di verifica** — DECISO 12/09 (5 giorni lavorativi, non 48h), MISURATO
      dalla 080, SCRITTO NEI ToS 20/09 (sezione 9, «Termine di esame»): decorre
      da quando l'esame compete a noi, si sospende quando aspettiamo il
      professionista, ha natura ordinatoria. È un impegno contrattuale: la cifra
      vive in `SLA_VERIFICA_GIORNI_LAVORATIVI` e non può divergere dal testo.
      NON esiste una regola di escalation allo sforamento, ed è una scelta
      (20/09): il costo dello sforamento lo paga il tetto sulle cessazioni.
- [ ] **Lavoratori occasionali senza P.IVA**: dentro come "Iscritto" per sempre,
      o fuori? (decisione già proposta in `NOTE_E_DECISIONI.md`, mai ratificata).

### A2. Responsabilità e garanzie
- [ ] **Massimale di responsabilità** (`[IMPORTO MASSIMALE]`): i competitor stanno
      a 100–150 €. Con una garanzia a marchio in arrivo serve un numero più
      credibile. Proposta: differenziato (X € generico, Y € se coinvolta la
      Garanzia Bob).
- [ ] **Assicurazione RC dei professionisti**: obbligatoria o solo raccomandata?
      Se obbligatoria, la verifichiamo (→ nuovo livello di verifica) o resta
      autodichiarata? StarOfService la impone a parole senza verificarla.
- [ ] **Garanzia Bob**: perimetro, esclusioni, importi, chi decide, tempi. Oggi
      del tutto assente dalle bozze. Va scritta prima di menzionarla in
      marketing (blocco 28, ma il claim potrebbe partire prima).
- [ ] **Responsabilità sul brief generato dall'AI**: se Bob interpreta male la
      richiesta del cliente e il pro fa un preventivo sbagliato, di chi è il
      problema? Serve una clausola esplicita (nessun competitor ce l'ha: sono
      form, non AI).
- [ ] **No-show e appuntamenti**: la piattaforma gestisce calendario e conferme.
      Chi risponde di un appuntamento mancato? Penali? Effetti sul ranking?

### A3. Modello economico e disintermediazione
- [ ] **Vietiamo lo scambio di contatti fuori piattaforma?** ProntoPro e
      Cronoshare lo vietano espressamente (Cronoshare fa perfino mystery
      shopping) perché vivono di lead. Noi viviamo di abbonamento + success fee:
      il divieto serve solo per la success fee. Decidere ora, perché cambia il
      tono verso i pro (vietarlo è impopolare e difficile da far rispettare).
- [ ] **Prezzi**: importi, IVA, periodicità, prova gratuita, coupon founding pro.
      Regole di modifica prezzo (preavviso).
- [ ] **Rinnovo automatico**: sì/no, come si disdice, cosa succede ai dati.
- [ ] **Recesso 14 giorni per il pro persona fisica**: i pro sono business →
      nessun recesso consumeristico (StarOfService lo esclude espressamente).
      Confermare con l'avvocato e scriverlo.
- [ ] **Fatturazione elettronica / SDI**: come emettiamo, dove recuperano le
      fatture.
- [ ] **Fair use**: limiti a numero di richieste per cliente e di risposte per
      pro (Instapro e StarOfService li hanno: 100 interazioni/mese). Serve
      antiabuso.

### A4. Identità e adempimenti societari
- [ ] Tutti i `[PLACEHOLDER]` di `company.ts` (ragione sociale, P.IVA, sede,
      email, foro) → dipendono dalla costituzione SRL (blocco 26).
- [ ] **Foro competente**: quale città.
- [ ] **Organismo di mediazione** da indicare (P2B lo richiede).
- [ ] **Fase demo**: come qualifichiamo legalmente il periodo attuale
      (pre-lancio, dati dimostrativi, nessun pagamento)? Serve un disclaimer
      temporaneo o rimandiamo i ToS al lancio?

---

## PARTE B — Clausole mancanti nelle bozze (tecniche, non bloccanti ma necessarie)

### B1. Struttura contrattuale di base (tutti i competitor le hanno, noi no)
- [ ] **Definizioni**: sezione dedicata. ProntoPro e Instapro aprono con
      glossari lunghi; senza definizioni l'interpretazione è ambigua e
      l'ambiguità va contro chi ha redatto (art. 1370 c.c.).
- [ ] **Conclusione e durata del contratto** con la piattaforma: quando si
      perfeziona, quanto dura, come cessa.
- [ ] **Nullità parziale (severability)**: se una clausola cade, il resto resta.
      Manca del tutto — è standard in tutti e quattro.
- [ ] **Non rinuncia (waiver)**: la tolleranza non implica rinuncia.
- [ ] **Interezza dell'accordo** e gerarchia tra documenti (ToS, privacy, policy
      recensioni, condizioni economiche).
- [ ] **Cessione del contratto**: Bob può cedere a terzi (utile in caso di M&A),
      l'utente no.
- [ ] **Forza maggiore**: assente. (StarOfService la usa in modo aggressivo:
      epidemie e malattia non liberano dal pagamento. Noi useremo una formula
      standard.)
- [ ] **Comunicazioni**: dove e come si notificano le parti; validità dell'email.
- [ ] **Lingua**: italiano prevalente in caso di traduzioni.

### B2. Obblighi DSA (Reg. UE 2022/2065) — Bob è una "piattaforma online"
- [ ] **Notice & action** (art. 16): meccanismo strutturato per segnalare
      contenuti illeciti. Nelle bozze c'è solo un'email generica: serve la
      procedura (cosa deve contenere la segnalazione, tempi, esito).
- [ ] **Motivazione delle decisioni / statement of reasons** (art. 17): quando
      rimuoviamo un contenuto o limitiamo un account dobbiamo dare una
      motivazione con contenuti minimi prescritti.
- [ ] **Punto di contatto** per utenti e autorità (artt. 11-12).
- [ ] **Termini chiari sulle restrizioni** (art. 14): descrivere le policy di
      moderazione, anche automatizzata.
- [ ] **Misure contro l'uso abusivo** (art. 23) e **reclami interni** (art. 20):
      da verificare l'esenzione per micro/piccole imprese (art. 19 DSA) — se
      applicabile ora, va comunque previsto il percorso a crescita.
- [ ] *(nota: verificare con l'avvocato quali obblighi scattano subito e quali
      sono esentati finché siamo micro impresa; l'esenzione non è permanente.)*

### B3. AI e trasparenza
- [ ] **Disclosure AI (AI Act art. 50, in vigore 2/8/2026)**: dobbiamo dichiarare
      che il cliente sta interagendo con un sistema di IA. Nelle bozze manca del
      tutto. Nessun competitor ha questo problema (non usano AI conversazionale).
- [ ] **Limiti e disclaimer dell'assistente Bob**: non è consulenza tecnica, può
      sbagliare, non sostituisce il sopralluogo.
- [ ] **Contenuti generati dall'utente e AI**: uso dei dati per migliorare il
      servizio (attenzione: da coordinare con il vincolo "no training su dati
      Bob" già stabilito nelle regole privacy).

### B4. Condotte vietate e presidi
- [ ] **Elenco dettagliato delle condotte vietate**: ProntoPro ne elenca oltre 30
      in un unico articolo. Le mie bozze ne hanno ~8 sintetiche. Un elenco
      analitico è ciò che rende azionabile una sospensione senza contestazioni.
- [ ] **Antifrode**: account multipli, profili falsi, recensioni pilotate,
      scraping, automazioni.
- [ ] **Policy recensioni** come documento separato e richiamato (Instapro fa
      così): criteri di rimozione, diritto di replica, tempi.
- [ ] **Contenuti del portfolio**: divieti (foto non proprie, dati di terzi,
      loghi altrui), diritti concessi a Bob.

### B5. Dati, sicurezza, continuità
- [ ] **Sicurezza dell'account**: obblighi utente, 2FA quando disponibile.
- [ ] **Sorte dei dati alla cessazione**: cosa cancelliamo, cosa conserviamo e per
      quanto (allineare con le retention già decise: fatture 10 anni, chat
      non-transazionali ~90 giorni, ecc.).
- [ ] **Portabilità/estrazione dati** del pro (P2B art. 9 richiede trasparenza
      sull'accesso ai dati).
- [ ] **Backup e nessuna garanzia di conservazione illimitata** delle
      conversazioni.

---

## Priorità suggerita

1. **Ora (prima del codice del blocco 10):** A1 completo — senza il perimetro dei
   livelli non si scrive né il DB né la UI del badge.
2. **Prossime settimane:** A3 (disintermediazione e prezzi) e B1 (struttura
   contrattuale), che sono decisioni nostre a costo zero.
3. **Con l'avvocato (blocco 23.3):** A2 (massimali, garanzia), B2 (DSA), B3
   (AI Act), recesso pro.
4. **Alla costituzione SRL (blocco 26):** A4.

---

*Redatto il 19/07/2026. Non è un parere legale.*
