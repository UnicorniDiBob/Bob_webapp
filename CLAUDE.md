# CLAUDE.md — Bob_webapp

Regole di progetto. Valgono per chiunque lavori qui, persona o agente.

## Il progetto

Bob_webapp (meetonda.com) — Next.js 14, TypeScript, Tailwind, Supabase, deploy su
Vercel. Repo: github.com/UnicorniDiBob/Bob_webapp (ramo main). Supabase project ref
bijgitnulucdzluqjxrx (regione EU). Lo costruiamo in due: André (interfacce cliente e
professionista — traccia Client/Pro) e Lucio (infrastruttura, admin, CS, legale —
traccia Internal). Obiettivo: pilota Milano, gennaio 2027.

## Fonti di verità, in ordine

1. `origin/main`, lo schema Supabase live e le risposte HTTP di produzione. Questa è
   la verità, ed è verificabile. Va letta prima di fidarsi di qualunque altra cosa.
2. L'artifact "Piano di lavoro Bob" — il piano: ambito, proprietario, settimana.
   Risponde a "cosa facciamo la settimana prossima e chi", mai a "cosa esiste".
3. `roadmap/*.csv` — il registro versionato di cosa è stato chiuso e con che prova.
4. I documenti nel progetto Claude — istantanee, vere alla loro data.

Un documento è autorevole sull'INTENTO, mai sullo STATO. `docs/DATA_COMPLIANCE.md`
decide cosa significa "fatto"; nessun documento può dire se una funzione esiste. Se
il repo e una lavagna non concordano, ha ragione il repo. Una casella si spunta solo
se dietro c'è un commit, una migrazione o una verifica dal vivo — mai a memoria.

NIENTE DI IRRIPETIBILE FUORI DA GIT. Se un file è l'unica copia di qualcosa che gira
in produzione, va committato. Il 19 agosto 2026 996 righe di codice provato sono
vissute solo in un file .patch per sei giorni, mentre la migrazione 056 era già in
produzione.

## Prova col risultato reale, non con la schermata

Tre volte in due giorni una superficie ha detto "fatto" mentre la cosa non era
avvenuta: la lavagna diceva "in attesa di deploy", la pagina Git di Vercel mostrava
il repo giusto su un collegamento mai ricostruito, e un `git push --force` di prova
rispondeva "Everything up-to-date" senza esercitare nessuna regola. Ogni volta la
soluzione è stata cercare l'output che solo l'evento reale può produrre: un rifiuto
`GH013`, un deployment creato da `vercel[bot]`, una riga in `system_job_runs`.
Progetta le verifiche perché possano FALLIRE.

## Due persone, un ramo

- Inizio sessione: `git pull origin main`.
- Un ramo per attività, nome uguale all'attività nel Piano. PR verso main; la unisce
  chi l'ha aperta, senza aspettare l'altro. La CI gira su `pull_request`.
- `main` è protetto: niente force-push, niente cancellazioni, PR obbligatoria, il
  check `build` deve passare. La bypass list è vuota di proposito: non è esente
  nessuno, nemmeno gli owner.
- NIENTE È FATTO FINCHÉ NON È SPINTO. Se una sessione finisce con lavoro incompiuto,
  si spinge un ramo; non si lascia nel clone locale. La frase "in attesa di deploy"
  è vietata sulle lavagne: descrive allo stesso modo "pronto" e "perso".
- Vercel fa il deploy da main. Le migrazioni no: passano da Supabase e vanno SEMPRE
  rispecchiate nel repo.
- Un'attività che costringe a modificare file dell'area dell'altro: quella modifica
  va nella sua PR.
- Fine sessione: tre righe in `HANDOFF.md` alla radice, sovrascritte ogni volta —
  cosa ho fatto, cosa è a metà, cosa ho applicato in produzione che l'altro deve
  sapere.

## Codice e schema

- Ogni cambio di schema arriva con il suo file `supabase/migrations/NNN_nome.sql`,
  nel commit che introduce il codice che ne dipende, e il file entra nella PR PRIMA
  che la migrazione venga applicata. SQL idempotente (`if not exists`,
  drop-then-recreate per policy/trigger/funzioni). È già la regola e si è rotta due
  volte: 015/016, e la 056 (viva in produzione dal 19 al 25 agosto senza file nel
  repo). Nessuna delle due volte se n'è accorto qualcosa, perché niente controlla.
- Il controllo di deriva esiste: `scripts/schema_check.sh` ricostruisce lo schema dai
  soli file del repo. L'ultimo passo è ancora umano — eseguire
  `scripts/schema_fingerprint.sql` sulla produzione e confrontare le otto righe.
  Va fatto ogni settimana, non a memoria.
- Dopo ogni cambio di schema: advisor di sicurezza Supabase, e risolvere i rilievi
  RLS mancante / SECURITY DEFINER / search_path mutabile / bucket pubblico prima di
  considerare il lavoro finito.
- Dopo aver modificato un `roadmap/*.csv`: eseguire `python3 roadmap/build_roadmap.py`
  e committare anche i file generati. La CI verifica la corrispondenza e fallisce se
  manca.
- Le entità nel testo JSX vanno escapate — `react/no-unescaped-entities` è attivo.
- I campi `[PLACEHOLDER]` in `src/lib/company.ts` sono voluti, differiti a gennaio
  2027. Non sono bug.
- Dimostra il comportamento con le richieste, non leggendo il file. L'ordine delle
  rotte, i redirect e il middleware hanno sorpreso questo progetto due volte: il
  jolly `:sezione*` che combaciava con zero segmenti, e i redirect di next.config
  che scattano PRIMA del middleware. Avvia un server e prova.
- Dopo un cambio di interfaccia, verifica dal vivo su www.meetonda.com, desktop e
  390px.

## Come lavorare con me

- Spiega sempre il perché prima di fare una modifica, e dai i comandi esatti per
  pull, build, commit e push. Nessun commento in linea sui comandi eseguibili: un
  `# nota` finale finisce come argomento del comando e lo rompe.
- La settimana di lavoro va da giovedì a mercoledì. "Settimana scorsa" significa
  sempre quell'intervallo, non lunedì-domenica.
- Rito del giovedì, 20 minuti — sta sul confine fra la settimana che si chiude e
  quella che comincia: (1) generare da git e Supabase cosa è uscito nella
  settimana chiusa il giorno prima — commit, file, migrazioni applicate, advisor,
  giri del cron; (2) spuntare il Piano solo da quell'elenco; (3) scegliere le
  attività della settimana entrante, ognuna con proprietario e settimana; (4)
  quello che slitta cambia settimana con una riga sul perché; (5) chi ha lavorato
  aggiorna HANDOFF.md.

## Account

Ognuno ha il proprio account GitHub e Supabase. Mai condividere credenziali: rendono
impossibile sapere chi ha applicato una migrazione o cambiato una variabile
d'ambiente, e violano la regola di progetto sull'accesso a privilegio minimo ai dati
personali.

## Privacy e protezione dei dati (la guida completa è docs/DATA_COMPLIANCE.md)

- Ogni funzione che tocca dati personali, prima di uscire: base giuridica (contratto
  / legittimo interesse + LIA scritta / consenso / obbligo legale), riga nel registro
  dei trattamenti, informativa aggiornata se la finalità è nuova, regola di
  conservazione, controllo degli inneschi DPIA. Fa parte di "fatto", come la regola
  sulle migrazioni.
- Email e marketing: si invia solo con un consenso registrato per finalità. Per Bob
  NON esiste soft opt-in — registrazione, richiesta di preventivo e iscrizione alla
  waitlist non sono vendite (è esattamente ciò che è costato 400k a Verisure). Le
  email di lancio della waitlist richiedono una spunta esplicita. Le email
  transazionali restano rigorosamente non promozionali.
- Le email di autenticazione (conferma, reset password, magic link) NON passano da
  Resend: le manda il mailer integrato di Supabase, con un tetto di 2 email all'ora
  per tutto il progetto. Impostare RESEND_API_KEY non cambia niente: serve un SMTP
  personalizzato configurato in Supabase. Qualunque funzione che dipenda dalle email
  di autenticazione non è spedibile prima di quello.
- Analytics: strumento EU esente da consenso (Plausible / Matomo secondo Garante
  §7.2), così non serve nessun banner. GA4, pixel pubblicitari, session replay o
  qualunque tracciamento a livello utente richiedono prima un banner conforme.
- AI, matching e LLM: minimizzare e pseudonimizzare i dati inviati ai fornitori; DPA
  firmato con regione EU o zero retention e nessun addestramento sui dati di Bob;
  etichettare le interazioni AI (AI Act art. 50, in vigore dal 2 agosto 2026); tenere
  una persona nel ciclo per ogni decisione che sospende, esclude o deprioritizza un
  professionista (art. 22); scrivere la DPIA PRIMA del lancio. Il matching resta
  "scelto dal cliente", non assegnato, per restare fuori dall'Annex III e dalla
  Platform Work Directive.
- Condivisione dei dati del cliente con i pro: consegna progressiva — richiesta
  pseudonimizzata prima, contatti completi solo dopo che il cliente ha accettato. I
  ToS del pro devono vietare il riuso dei contatti per il marketing del pro.
- Recensioni: l'etichetta "verificate" solo se legate a una transazione realmente
  conclusa; de-identificare l'autore ("Utente eliminato") alla cancellazione
  dell'account; la logica del punteggio aggregato resta spiegabile.
- Ogni tabella nuova: RLS attiva, una regola di conservazione e un percorso di
  cancellazione o anonimizzazione. L'accesso dello staff ai dati personali è a
  privilegio minimo (admin vs cs) e tracciato.
- Conservazione (doc §5): fatture 10 anni; chat legate a una transazione fino al
  termine di prescrizione; chat non legate a transazioni cancellate ~90 giorni dopo
  la cancellazione dell'account; dati di prospect e waitlist ≤12 mesi.
