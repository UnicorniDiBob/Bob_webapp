# Idraulici demo a Milano

> **DA RIMUOVERE PRIMA DEL PILOTA** (gennaio 2027): `scripts/demo/idraulici_cleanup.sql`.

Sei idraulici finti a Milano, per provare dal vivo:
- il tetto di 3 pro per richiesta (migrazione 125);
- il confronto nella pagina della richiesta;
- «Scegli» e «Archivia», visti anche dal lato del pro;
- l'ordinamento (`professionals_score`).

Solo **dati**: niente schema, niente migrazione, nessun cambio al codice dell'app. Decisioni di André del 16/10.

| file | cosa fa |
|---|---|
| `idraulici_seed.sql` | crea tutto; idempotente (rieseguito non cambia niente); una transazione |
| `idraulici_cleanup.sql` | toglie esattamente quello che crea il seed, e niente altro; idempotente; una transazione |

## Chi sono

| | pro | utente | email | accesso | pronto |
|---|---|---|---|---|---|
| Idraulico Demo 1 | `b1000000-0000-0000-0000-000000000008` | quello creato da André (se manca: `a1000000-…-0008`) | `idraulico1.demo@bobapp.it` | **sì** | sì |
| Idraulico Demo 2 | `b1000000-0000-0000-0000-000000000009` | quello creato da André (se manca: `a1000000-…-0009`) | `idraulico2.demo@bobapp.it` | **sì** | sì |
| Idraulico Demo 3 | `b1000000-0000-0000-0000-00000000000a` | `a1000000-…-000a` | `idraulico3.demo@bobapp.it` | no | sì |
| Idraulico Demo 4 | `b1000000-0000-0000-0000-00000000000b` | `a1000000-…-000b` | `idraulico4.demo@bobapp.it` | no | sì |
| Idraulico Demo 5 | `b1000000-0000-0000-0000-00000000000c` | `a1000000-…-000c` | `idraulico5.demo@bobapp.it` | no | sì |
| Idraulico Demo 6 | `b1000000-0000-0000-0000-00000000000d` | `a1000000-…-000d` | `idraulico6.demo@bobapp.it` | no | **no** (nessun servizio) |
| Recensore Demo 1-3 | — | `a1000000-…-000e`, `-000f`, `-0010` | `recensore1/2/3.demo@bobapp.it` | no | clienti finti |

Gli utenti senza accesso hanno `encrypted_password` vuota: non si entra. Demo 1 e 2 entrano con gli account che **André crea a mano** in Supabase (Authentication → Add user → email + password, conferma automatica). Il seed li trova **per email** e ci attacca il profilo da pro. Le password non passano mai dal repo, dalla PR o da un log. Se il seed parte prima che esistano, Demo 1 e 2 nascono senza accesso e un NOTICE lo dice. Per averli con l'accesso in seguito: cleanup, creare gli account, seed.

**Altre righe che il seed crea, con id fissi:**
- servizi `b2000000-…`, copertura `b3000000-…`, disponibilità `b4000000-…`, traccia di verifica `b5000000-…`;
- 45 richieste chiuse `d1000000-0000-0000-…`, 90 messaggi `e1000000-…`, 45 recensioni `f1000000-…`.

Tutte le richieste sono dei Recensori Demo: **mai** di cliente.demo né di utenti veri.

**Righe che scrivono i trigger vivi**, tutte comprese nella pulizia:
- la riga di `professional_verification` di ogni pro;
- `professional_coverage_public`;
- `professional_signals`;
- `professional_work_events` (90);
- `search_events`: 45, una per richiesta, che la pulizia ritrova per ora di creazione.

Nessuna riga in `terms_acceptances`.

## Gli ingressi del punteggio

Letto dal vivo il 16/10: `professionals_score` (md5 def `f74c24162b52b993ef4de7d6155c10e5`), da 0 a 100.

| addendo | massimo | da dove viene |
|---|---|---|
| area | 16 | gettoni di copertura contro quelli della richiesta: zona 16, comune 14, città 12. Una richiesta **senza zona** dà 12 anche a chi copre solo dei quartieri |
| valutazione | 25 | media bayesiana con 5 voti «fantasma» alla media della piattaforma |
| risposta | 20 | `professional_signals.risposta_minuti`: ≤30′ 20, ≤2h 16, ≤8h 12, ≤24h 8, ≤72h 4, oltre 0, **nessun dato 10** |
| prezzo | 15 | **solo se c'è un prezzo**: 15 sull'intervento cercato, 10 altrove, 0 senza. Caro o economico non cambia niente |
| disponibilità | 10 | orari + prenotazione diretta 10, solo orari 7, niente 5 |
| verifica | 7 | documenti 7, P.IVA 5, nessuna 0 (0 anche a badge scaduto) |
| completezza | 3 | bio, nome dell'attività, un servizio con intervento |
| distanza | 4 | CAP del pro contro CAP/zona/comune della richiesta: ≤5 km 4, ≤10 3, ≤25 2, ≤50 1 |

Il piano (free/business) **non** conta. Prima del punteggio, l'app mette in testa chi offre l'intervento cercato. A parità si sorteggia con un seme del giorno.

| | voti | risposta | verifica | prezzi (perdita rubinetto) | disponibilità | copertura | CAP | bio |
|---|---|---|---|---|---|---|---|---|
| Demo 1 | 30, media 4,90 | 15′ | documenti | 60–90 € | lun-ven 8-18 | tutta Milano | 20121 (Brera) | sì |
| Demo 2 | 10, media 4,50 | 3 h | P.IVA | 45–70 € | — | tutta Milano | 20135 (P.ta Romana) | sì |
| Demo 3 | 3, media 4,33 | 48 h | — | 90–130 € | lun-ven 8-18 | 6 zone centro/ovest (duomo, brera, magenta, porta-genova, de-angeli, san-siro) | 20146 | sì |
| Demo 4 | nessuno | nessun dato | — | **senza prezzo** | — | tutta Milano | 20161 (Niguarda) | **no** |
| Demo 5 | 2, media 3,00 | 6 giorni | — | 50–80 € | — | **solo** Quarto Oggiaro, Gallaratese, Trenno | 20157 | sì |
| Demo 6 | — | — | — | **nessun servizio** | — | tutta Milano | 20122 | sì |

## L'ordine atteso in produzione

Media della piattaforma dopo il seed: (90 + 211) / (19 + 45) = **4,7031**. Prima del seed era 4,7368, su 19 voti: i 45 voti demo la spostano, e con lei di pochi centesimi anche la valutazione di tutti gli altri pro. Il calcolo riproduce al centesimo i punteggi ottenuti in locale con `professionals_score`, dove la media era 4,6889.

**Scenario A — quello che fanno oggi la chat di Bob e la ricerca:** città + servizio; nessun CAP, nessuna zona, nessun intervento. Il punto della richiesta è il centro del comune di Milano.

| rango | pro | TOT | area | val | risp | prezzo | disp | ver | compl | dist |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Idraulico Demo 1 | **86,40** | 12 | 23,40 | 20 | 10 | 7 | 7 | 3 | 4 |
| 2 | IdroMilano Express (già in produzione) | **81,64** | 12 | 20,64 | 20 | 10 | 7 | 5 | 3 | 4 |
| 3 | Idraulico Demo 2 | **70,60** | 12 | 19,60 | 12 | 10 | 5 | 5 | 3 | 4 |
| 4 | Idraulico Demo 3 | **59,56** | 12 | 19,56 | 4 | 10 | 7 | 0 | 3 | 4 |
| 5 | Idraulico Demo 4 | **53,29** | 12 | 21,29 | 10 | 0 | 5 | 0 | 2 | 3 |
| 6 | Idraulico Demo 5 | **48,21** | 12 | 15,21 | 0 | 10 | 5 | 0 | 3 | 3 |
| — | Idraulico Demo 6 | non compare | | | | | | | | |

Perché quest'ordine:
- **Demo 1** è il migliore su ogni addendo.
- **IdroMilano** lo segue: risponde in 1,6′ ma ha 5 voti a 4,6 e la sola P.IVA.
- **Demo 2** perde sulla risposta (3 h → 12) e sulla disponibilità.
- **Demo 3** risponde in 48 h (4) e non è verificato.
- **Demo 4** non ha prezzo (0) né bio, ma il suo «nessun dato» sulla risposta vale 10, e «nessun voto» vale la media della piattaforma.
- **Demo 5** è ultimo: due voti da 3 e risposta in 6 giorni.
- **Demo 6** non compare: non offre nessun servizio, e la ricerca per servizio lo esclude. Il suo profilo si apre e dice «Idraulico Demo 6 non sta ancora ricevendo richieste.».

**Scenario B — zona duomo + CAP 20121 + intervento «perdita rubinetto / sifone».** Nessuna pagina oggi passa CAP o zona al punteggio: si prova chiamando `professionals_score` direttamente.

| rango | pro | TOT | area | val | risp | prezzo | disp | ver | compl | dist |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Idraulico Demo 1 | **91,40** | 12 | 23,40 | 20 | 15 | 7 | 7 | 3 | 4 |
| 2 | IdroMilano Express | **90,64** | 16 | 20,64 | 20 | 15 | 7 | 5 | 3 | 4 |
| 3 | Idraulico Demo 2 | **75,60** | 12 | 19,60 | 12 | 15 | 5 | 5 | 3 | 4 |
| 4 | Idraulico Demo 3 | **68,56** | 16 | 19,56 | 4 | 15 | 7 | 0 | 3 | 4 |
| 5 | Idraulico Demo 4 | **53,29** | 12 | 21,29 | 10 | 0 | 5 | 0 | 2 | 3 |
| 6 | Idraulico Demo 5 | **41,21** | 0 | 15,21 | 0 | 15 | 5 | 0 | 3 | 3 |

- Demo 3 e IdroMilano coprono la zona duomo: area 16.
- Demo 5 copre solo quartieri lontani: area 0. In più, **la ricerca lo toglie**: con una zona nella richiesta, chi non la copre esce (`trovaPerRichiesta`). Provato in locale con `/api/match?city=milano&service=idraulico&zone=duomo`: Demo 1-4, senza Demo 5.

```sql
-- Scenario A
select p.business_name, s.* from public.professionals_score(
  (select array_agg(id) from public.professionals where business_name like 'Idraulico Demo %' or business_name = 'IdroMilano Express'),
  'milano', null, null, null, null) s join public.professionals p on p.id = s.professional_id order by s.punti desc;
-- Scenario B
select p.business_name, s.* from public.professionals_score(
  (select array_agg(id) from public.professionals where business_name like 'Idraulico Demo %' or business_name = 'IdroMilano Express'),
  'milano', 'duomo', 'perdita-rubinetto-sifone', '015146', '20121') s join public.professionals p on p.id = s.professional_id order by s.punti desc;
```

**In queste due query compare anche Demo 6**, con **54,29** in entrambi gli scenari (in locale 54,11), fra Demo 3 e Demo 4. La funzione del punteggio guarda solo `deactivated_at`, non se il pro è pronto. A toglierlo dagli elenchi è la ricerca: niente servizio, quindi niente risultato per «idraulico». Non è un errore del seed.

## Da sapere

- **Il tempo di risposta scade.** Il cron delle 04:10 (`aggiorna_tutti_i_segnali`) lo ricalcola ogni notte dai messaggi degli **ultimi 90 giorni**. I messaggi demo sono fra 5 e 70 giorni prima del seed: già ~20 giorni dopo cominciano a uscire dalla finestra, e i tempi di risposta (e l'ordine) si spostano. Per rinfrescarli: cleanup + seed.
- **«Nessun voto» batte «10 voti a 4,5».** Con la formula viva, Demo 4 (nessun voto) prende 21,29 punti di valutazione, più di Demo 2 (10 voti a 4,5: 19,60). Zero voti valgono la media della piattaforma. È la regola, non un errore del seed: da guardare quando si ritocca il punteggio.
- **Il prezzo conta solo se c'è.** La differenza fra Demo 2 (45–70 €) e Demo 3 (90–130 €) non sposta il punteggio, solo l'ordinamento «prezzo» della pagina.
- **«0 lavori conclusi»** sulla dashboard di Demo 1 e 2: il contatore conta gli appuntamenti completati, e il seed non ne crea. Le 30 (o 10) richieste chiuse si vedono in /messaggi.
- I voti demo cambiano la media della piattaforma, quindi il punteggio di valutazione di tutti i pro. Con la pulizia torna com'era.

## Applicarlo (solo col via di André)

1. André crea in Supabase gli account `idraulico1.demo@bobapp.it` e `idraulico2.demo@bobapp.it` (Authentication → Add user, conferma automatica).
2. Prima, in sola lettura:
   - i due account esistono;
   - nessuno degli id del seed esiste ancora: pro `b1000000-…-0008…000d`, utenti `a1000000-…-0008…0010`, richieste `d1000000-0000-0000-…`.
3. Si esegue `idraulici_seed.sql` col connettore Supabase (`execute_sql`, una transazione). **Non** come migrazione: sono dati, non schema, e non devono comparire in `schema_migrations`.
4. Si contano le righe per tabella e si confronta l'ordine reale (le due query qui sopra, più la chat di Bob) con le tabelle di questo file.
5. Si registra l'applicazione in un commento alla PR e in HANDOFF.md.

## Toglierlo

`idraulici_cleanup.sql`, con lo stesso connettore. Toglie in quest'ordine:
1. i `search_events` delle richieste demo;
2. i 6 pro, solo se si chiamano ancora «Idraulico Demo N» (in cascata tutto il resto);
3. le richieste demo;
4. gli utenti creati dal seed (id fissi, email `*.demo@bobapp.it`).

**Restano** gli account di accesso di Demo 1 e 2, perché li ha creati André: la pulizia toglie il loro profilo da pro, non l'account. Il NOTICE finale lo ricorda; si eliminano da Supabase → Authentication → Users.

Provato in locale il 16/10, sullo stack Supabase con utenti finti:
- seed → pulizia: 22 tabelle **identiche** all'inizio, righe e contenuto;
- seed rieseguito: nessuna differenza;
- pulizia rieseguita: non toglie niente;
- con gli accessi: restano solo i due account.
