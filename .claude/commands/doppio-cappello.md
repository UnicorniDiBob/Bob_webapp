# /doppio-cappello — chiudere il doppio cappello

## Manopole (cambia queste righe: il resto e' metodo, non scelte)

- **MODO_RAMO:** `ramo unico` — un solo ramo `feat/doppio-cappello-chiusura` per tutte le voci.
  Alternativa: `un ramo per voce`, che e' quello che chiede CLAUDE.md. Con il ramo unico
  la CI da' un semaforo solo per cose scollegate: se una voce rompe il build, si fermano tutte.
- **VOCI_DA_FARE:** tutte (V1..V6)
- **PROPRIETARIO:** Lucio — tutte le voci, comprese quelle che la spike assegnava ad Andre'.
- **VERIFICA_LIVE:** si' — www.meetonda.com, desktop e 390px.

## Prima riga di lavoro: non fidarti di questo file

Questo file dice cosa fare, mai cosa esiste. Prima di toccare qualunque cosa:

1. `git pull origin main`
2. leggi `CLAUDE.md`, poi `docs/Bob_Doppio_Cappello_Design_Spike.md` §9 e §10, poi `roadmap/findings.csv`
3. controlla lo stato vero: `git log origin/main`, le migrazioni applicate su Supabase,
   le variabili d'ambiente su Vercel
4. se quello che trovi non coincide con l'elenco qui sotto, **fermati e dimmelo**:
   e' l'elenco a essere vecchio, non la produzione.

## Le voci

### V1 — Mergiare la #115 (sessioni: aggiungi un altro account)

Ramo `feat/sessioni-aggiungi-account`. I tre prerequisiti erano: `ACCESSO_HMAC_SEGRETO`
su Vercel (produzione, sensitive), la migrazione 104 applicata, gli advisor di sicurezza puliti.
**Ricontrollali tutti e tre prima del merge, non darli per fatti.**
Advisor attesi e accettabili, non da sistemare: `rate_limit_counters` con RLS e nessuna policy
(voluto, lo dichiara la 097 — la tocca solo il service role via SECURITY DEFINER) e
`leaked_password_protection` spenta (richiede il piano Pro, gia' accettata in findings.csv).
**Fatto quando:** CI verde sulla PR, merge in `main`, deploy di produzione READY.

### V2 — La casetta nell'area in alto

`src/components/Header.tsx`: oggi c'e' una voce sola verso `/dashboard` che cambia solo
l'etichetta, «Il mio lavoro» / «I miei lavori» (desktop intorno a :123-127, telefono a :216-217).
Con un ruolo per account la casetta porta alla `/dashboard` di quell'account, senza valigetta:
la decisione del 29/09 ha superato le disposizioni A/B/C della spike §3.
Vincoli veri: lo staff (`admin`, `cs`) non ha casa — `/dashboard` li rimanda via
(`src/app/dashboard/page.tsx:72`). `next.config.mjs` reindirizza `/dashboard/:sezione+` verso
`/impostazioni/:sezione+`, e un indirizzo nuovo va aggiunto a `ROTTE_PRIVATE` in
`src/middleware.ts`, se no nasce pubblico.
**Fatto quando:** provata dal vivo, desktop e 390px, con richieste vere — non leggendo il file.

### V3 — La chiave `bob:manutenzione-chiusa`

`src/components/ManutenzioneBanner.tsx:37`. E' l'unica delle cinque chiavi di `localStorage`
elencate nella spike §10.2 rimasta non separata per account: le altre quattro passano da
`chiaveConUtente()` in `src/lib/sessioni/chiavi.ts`.
Decidi, e soprattutto **scrivi la decisione**: o la separi come le altre, o resta condivisa e
il perche' va in `docs/NOTE_E_DECISIONI.md` (l'avviso di manutenzione e' del progetto, non
dell'utente). Una scelta giusta ma non scritta qui torna come dubbio fra sei mesi.

### V4 — Le 13 prove manuali della #114

Sono nella descrizione della PR #114, gia' in produzione dal 29/09 e mai guardate dal vivo.
Eseguile sulla produzione e scrivi l'esito, una riga per prova.
Quelle che falliscono diventano righe in `roadmap/findings.csv`, non correzioni al volo.

### V5 — Riga A1 del Registro dei trattamenti

`docs/legal/ROPA.md`, sezione «A1 — Account e autenticazione». Oggi non dice da nessuna parte
che una persona puo' avere piu' di un account.
Va detto: che i diritti (accesso, export, rettifica, cancellazione) si esercitano **per account**,
e che una richiesta «su tutto» va servita su tutti gli account che la persona indica.
A24 e A25 sono gia' aggiornate, A1 no.

### V6 — La proprieta' nella spike

`docs/Bob_Doppio_Cappello_Design_Spike.md`: al §9 la voce 2 risulta di Andre', e l'intestazione
«Proprietari» in cima dice lo stesso. Sono di Lucio dal 30/09/2026. Correggi tutti e due i punti.

## Cosa NON fare — riportalo e basta

Non si chiudono col codice. Non tentarle; elencale a fine lavoro:

- **SMTP personalizzato su Supabase.** E' il cancello della voce 5 (spike §10.4): senza,
  creare il secondo account non e' collaudabile, perche' le email di autenticazione passano dal
  mailer di Supabase con un tetto di 2 all'ora **per tutto il progetto**, reset password dei
  clienti veri compresi. Si configura a mano nella console di Supabase. Finche' non c'e', il
  doppio cappello e' finito nel codice e inutilizzabile da un utente vero.
- **Rilettura legale dei termini clienti** per un professionista che compra per la sua attivita'
  (spike §5.3). La fa un legale, non questo comando.

## Chiusura

- Nessuna di queste voci dovrebbe volere una migrazione. Se te ne serve una, **fermati e dimmelo**:
  il file `supabase/migrations/NNN_nome.sql` entra nella PR **prima** che la migrazione sia applicata.
- Prova il comportamento con richieste, non leggendo i file: rotte, redirect e middleware hanno
  gia' sorpreso questo progetto due volte.
- `HANDOFF.md` alla radice, tre righe, sovrascritto: cosa ho fatto, cosa e' a meta',
  cosa ho applicato in produzione che l'altro deve sapere.
- Mai `git push --force` su `main`.
- Se il proxy git di sessione non ha credenziali in scrittura, scrivi le modifiche in locale e
  dammi i comandi esatti da lanciare. Dillo una volta sola, non a ogni messaggio.
