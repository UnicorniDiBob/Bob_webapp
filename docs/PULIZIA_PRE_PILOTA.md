# Pulizia prima del pilota

Creato il 17/10/2026 (André con Claude). È l'unico elenco di quello che va tolto da produzione **prima del pilota di Milano (gennaio 2027)**: dati di prova, demo, tracce dei test dal vivo. Ogni voce dice cos'è, dove sta e come si toglie. Quando una voce è fatta, si scrive la data e la prova (commit, riga di `system_job_runs`, conteggio prima/dopo), mai a memoria.

I numeri qui sotto sono letti in sola lettura dalla produzione il 17/10/2026.

## 1. Gli idraulici demo

- **Cos'è:** sei «Idraulico Demo 1…6» a Milano (pro `b1000000-…-0008` … `000d`) e tre «Recensore Demo», con 45 richieste chiuse, 90 messaggi e 45 recensioni. Servono a provare il tetto di 3 pro (125), il confronto, Scegli/archivia e l'ordinamento.
- **Dove:** `scripts/demo/idraulici_seed.sql` li crea; id, ingressi e ordine atteso in `scripts/demo/README.md`.
- **Come si toglie:** `scripts/demo/idraulici_cleanup.sql`, una transazione, idempotente. Toglie esattamente quello che crea il seed, `search_events` compresi. Provato in locale: torna identico all'inizio in 22 tabelle.
- **Resta a mano:** gli account `idraulico1.demo@bobapp.it` e `idraulico2.demo@bobapp.it` li ha creati André. La pulizia toglie il loro profilo da pro, non l'account: si eliminano da Supabase → Authentication → Users.
- **Da sapere:** i 45 voti demo spostano la media della piattaforma, e quindi di qualche centesimo la valutazione di tutti i pro; con la pulizia torna com'era.

## 2. Le note «chiuso» doppie di PROVA su ddaae033

- **Cos'è:** nella chat fra cliente.demo e Colori & Pareti, sulla richiesta di PROVA `ddaae033-9285-4e18-ab65-8fa1f5b650a7`, quattro note di Bob «Il cliente ha chiuso questa richiesta.» di fila. Le hanno scritte le prove di archivia/riapri del 16/10, prima della 124 (applicata alle 07:32 UTC del 16/10): da lì una seconda nota senza niente in mezzo non si scrive più. Il pro le vede tutte, e nella campanella sono quattro voci uguali.
- **Le tre doppie** (la prima, del 16/10 05:37 UTC, è legittima):

  | id | scritta (UTC) |
  |---|---|
  | `26d5f00f-e47e-4052-ab4e-dacbcae39463` | 16/10 06:39:15 |
  | `154ebd8b-f392-46a6-991b-2c1f5df89d89` | 16/10 06:39:48 |
  | `6e3f7b49-0921-4c52-b913-aedc5ada7932` | 16/10 07:31:11 |

- **Come si toglie:** `delete from public.request_messages where id in (…i tre id…) and sender_type = 'bob' and message = 'Il cliente ha chiuso questa richiesta.'`, una transazione, prima contando che siano 3. Se si cancella tutta la richiesta ddaae033 (voce 3), se ne vanno con lei.

## 3. Le richieste di PROVA

- **Cos'è:** **22 richieste** di prova, 20 di cliente.demo e 2 di cliente.prova, dal 03/06 al 16/10/2026. Sono 22 delle 25 richieste in produzione; le altre 3 vanno guardate una per una prima di decidere. Contengono 14 messaggi marcati «[prova …]».
- **Elenco** (id · cliente · stato · creata · servizio · pro):

  | richiesta | cliente | stato | creata | servizio | pro |
  |---|---|---|---|---|---|
  | `78c72208-b851-4a3c-a582-ab983b42a025` | cliente.demo | closed | 03/06 | idraulico | IdroMilano Express |
  | `8b313807-d71f-4389-b7f1-adcdbfc8af40` | cliente.demo | closed | 28/06 | pulizie | Milano Clean Squad |
  | `ed53ca28-4577-411a-ae4c-39ce7390c1f0` | cliente.demo | closed | 16/07 | elettricista | LuceChiara Impianti |
  | `ddaae033-9285-4e18-ab65-8fa1f5b650a7` | cliente.demo | matched | 17/07 | imbianchino | Mano Amica Milano, Colori & Pareti |
  | `bd63c40f-e641-4b26-bbc0-7a3d85705fa2` | cliente.demo | closed | 20/07 | pulizie | Milano Clean Squad |
  | `5ce77cc9-127d-4ad9-809c-4660b5fb2b37` | cliente.demo | closed | 20/07 | pulizie | Milano Clean Squad |
  | `3e1e213a-3f5d-4277-810d-ea7c7f90d919` | cliente.demo | closed | 23/07 | pulizie | Milano Clean Squad |
  | `1ed9f1af-231a-4f68-bd17-e57325c1a27f` | cliente.demo | closed | 28/07 | pulizie | Milano Clean Squad |
  | `fa6b13cf-0cff-404b-a181-28835e5deaf1` | cliente.demo | sent | 29/07 | elettricista | LuceChiara Impianti |
  | `ade54225-8d77-4ace-b124-055ac1a6dad9` | cliente.demo | closed | 29/07 | pulizie | Milano Clean Squad |
  | `7f7f5bf0-8f81-41c3-934c-e88a5d1f0116` | cliente.demo | closed | 30/07 | pulizie | Milano Clean Squad |
  | `b2f637d6-9d73-43f1-b165-8c6e902d7628` | cliente.demo | closed | 19/08 | pulizie | Milano Clean Squad |
  | `46dce43d-c658-4d2e-8235-19ab66b54dec` | cliente.prova | closed | 10/09 | fotografo | FOTOPRO-MILANO |
  | `525d3b74-b659-40ce-a67e-f5c49ebe67e8` | cliente.demo | quote_request | 20/09 | idraulico | IdroMilano Express |
  | `5a431a74-7e44-4f27-9572-38aca2232ecd` | cliente.demo | matched | 22/09 | idraulico | IdroMilano Express |
  | `c3e331b5-cf4d-427d-8cf9-db05b0e84106` | cliente.demo | closed | 29/09 | idraulico | IdroMilano Express |
  | `302b5e12-f2bf-4d24-b5af-1a54cd43d4e6` | cliente.demo | closed | 03/10 | pulizie | Milano Clean Squad |
  | `e274d290-be5f-423a-b759-7b257a2744c6` | cliente.demo | matched | 05/10 | pulizie | Milano Clean Squad |
  | `83e3b578-dd09-405a-9545-91c77a86d34e` | cliente.prova | matched | 06/10 | idraulico | IdroMilano Express |
  | `da0eed04-161f-4cc8-a95e-a73fcfdac5a8` | cliente.demo | closed | 08/10 | pulizie | Milano Clean Squad |
  | `22818d7e-0ff0-4281-956d-3c5e91b5251f` | cliente.demo | closed | 09/10 | pulizie | Milano Clean Squad |
  | `9058ca20-e4eb-49e4-a38d-854c19385a98` | cliente.demo | sent | 16/10 | idraulico | IdroMilano Express |

- **Cosa c'è attaccato:**
  - **va via in cascata** con la richiesta: 128 messaggi, 23 collegamenti `request_professionals`, 1 indirizzo `request_addresses`;
  - **NON va via** (la chiave diventa NULL, la riga resta): 33 appuntamenti e 6 recensioni. Vanno tolti prima, a mano;
  - 34 eventi `appointment_events` (cascata sulla richiesta);
  - `search_events` e `professional_work_events` delle richieste demo: i primi si ritrovano solo per ora di creazione (come fa la pulizia degli idraulici demo), i secondi per `rif`.
- **Come si toglie:** non c'è ancora uno script. Va scritto sul modello di `scripts/demo/idraulici_cleanup.sql`: una transazione, conti prima e dopo, idempotente. Prima di scriverlo si rilegge lo stato vivo, perché fino al pilota le prove continuano.

## Da decidere

- Gli account demo di giugno (cliente.demo, admin.demo, IdroMilano Express, LuceChiara Impianti, Milano Clean Squad, Colori & Pareti, Mano Amica Milano) e cliente.prova: restano per le prove fino al pilota o si tolgono con il resto? Se restano visibili, al pilota sono professionisti finti negli elenchi pubblici.
