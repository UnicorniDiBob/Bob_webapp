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
Corretta anche l'intestazione dello stesso blocco: diceva che il piano a
pagamento pesa nel punteggio "attraverso la verifica", come se fosse l'unico
canale. Non lo è — `punti_disponibilita` dà 10 con disponibilità *e*
`instant_book_enabled`, 7 con la sola disponibilità, 5 senza niente;
`instant_book_enabled` è bloccato a `tier === "pro" || "business"`, quindi il
piano a pagamento vale +3 lì, non i 10 pieni che la voce precedente di
questo file diceva (errore mio, corretto qui — i 7 punti dell'availability restano
raggiungibili da chiunque sul piano Free che imposta gli orari). Totale
raggiungibile solo a pagamento: 7 dalla verifica + 3 dalla prenotazione
immediata, 10 su 100. La pagina ora nomina entrambi i canali (verifica e
prenotazione immediata) senza pubblicare i punteggi.

**A metà.** La revisione legale di Lucio sul blocco trasparenza — il testo è
già live, come da istruzione, ma non è stato scritto da un legale e tocca
art. 23 Codice del Consumo.

**Applicato in produzione che devi sapere.** 101, 102, 103 e i due fix del
blocco trasparenza sono tutti applicati/mergiati. La 103 e' stata applicata
alle 10:01 PRIMA del merge, contro la regola: il file arriva in main con la
PR di quel giorno. Se hai fatto pull fra le 10:01 e il merge, il tuo repo non
ricostruiva la produzione. Restano ~110 CAP civici reali fuori Milano senza
centroide (Cagliari, Ravenna, Mestre, La Spezia e altri): gap noto, da
colmare prima della seconda città, elencato in `docs/NOTE_E_DECISIONI.md`.

---

# Handoff — 29 settembre 2026, Lucio (fine giornata)

**Fatto e in produzione** (`main` = `ce7820f`, deploy di produzione READY):
- **la misura dell'SLA** sui casi chiusi e `sla_sforati` nel giro notturno (#106);
- **la promessa tolta**, «se sforiamo ti scriviamo», e le scuse quando sforiamo (#108);
- **la riscrittura di `/admin/professionals`**: una coda sola, le viste `?vista=`, l'archivio in fondo, il controllo degli errori (#109);
- **le sessioni multiple**: due account nello stesso browser, scambio con un click, uscire vale solo per questo browser (#114);
- **la spike portata allo stato deciso**: due account separati, uno per mestiere (#111).

**Fermo e pronto: la #115, NON mergiata** — «aggiungi un altro account» e «riconnetti» (`POST /api/sessioni/aggiungi`), la migrazione **104** e l'etichetta «Esci da tutti gli account». Nel dettaglio:
- il tetto di tentativi è per IP e per HMAC dell'email, e il login fallito non tocca niente; l'errore è identico per email e password, e nessuna delle due finisce in un log;
- la **104** (`supabase/migrations/104_limite_accesso.sql`) allarga il vincolo di `rate_limit_counters` ad `accesso`, con la riga **A24** del Registro dei trattamenti;
- «Esci» diventa «Esci da tutti gli account» quando in questo browser ci sono due account.

Aspetta tre mosse di Lucio, **in quest'ordine**:
1. `ACCESSO_HMAC_SEGRETO` su Vercel, produzione, sensitive, almeno 32 caratteri (`openssl rand -hex 32`); senza, la route risponde 503;
2. applicare la migrazione **104**;
3. advisor di sicurezza di Supabase, e rilievi sistemati.

Solo dopo, il merge.

**Non verificato:** le **13 prove manuali della #114**, che è già in produzione e che nessuno ha ancora guardato dal vivo. Sono nella descrizione della #114.

**Per André:** nella #115 ho toccato `src/components/Header.tsx`, dieci righe, solo l'etichetta del pulsante «Esci» (desktop e mobile). Lo dichiaro qui perché è area tua. Nella #114, già su `main`, `BobChat.tsx` e `PromemoriaProfilo.tsx` sono cambiati solo nel nome delle chiavi di `localStorage`.
