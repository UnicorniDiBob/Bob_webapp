# Il comune nella chat — cosa manca perché la copertura fuori Milano serva a qualcosa

**Per André.** Scritto da Lucio con Claude, 17 settembre 2026.
Autorevole sull'intento: lo stato vero sta su `origin/main` e su Supabase.

## In una riga

Da oggi un professionista può dichiarare i comuni in cui lavora (mig. 086-087) e
la richiesta sa portarsi dietro il suo comune (mig. 088). Ma **la chat offre tre
città**, quindi chi copre Cologno Monzese continua a non ricevere niente: manca
il passo che chiede al cliente dove si trova, quando non è in una delle tre.
Quel passo è in `BobChat`, che è area tua: questo file dice cosa c'è già pronto
sotto, e cosa cambierebbe.

## Cosa c'è già, e non devi costruirlo

- **`public.comuni`** — 7.904 comuni italiani con codice ISTAT, provincia,
  regione, coordinate e CAP. Lettura pubblica (è geografia, non gente).
- **`/api/geo/comuni`** — ricerca lato server: `?q=sesto` torna al massimo venti
  comuni, `?istat=015209` uno solo con i suoi CAP, `?cap=20099` il contrario,
  `?elenco=regioni` le venti regioni. Il file dei comuni (900 KB) non arriva mai
  al browser.
- **`SceltaComune`** (`src/components/SceltaComune.tsx`) — il campo comune+CAP
  già scritto e già usato nell'iscrizione del professionista: si cerca
  scrivendo, si sceglie da elenco, il CAP si propone. Riusabile così com'è.
- **`requests.comune_istat`** — la colonna esiste, e un trigger la riempie da
  sola dal CAP (046) o dalla città. **Se la chat lo scrive esplicitamente, il
  trigger lo rispetta**: `if new.comune_istat is not null then return new`.
- **Il confronto** — `gettoniRichiesta(città, zona, comuneIstat)` mette il
  gettone `comune:<istat>` fra quelli della richiesta, e la copertura del
  professionista porta lo stesso gettone. Niente altro da collegare.

## Perché il CAP da solo non basta — i numeri

Il trigger ricava il comune dal CAP quando può. Quanto spesso può:

| | |
|---|---|
| CAP italiani nel nostro elenco | 4.678 |
| CAP che stanno su **un solo comune** | 4.120 |
| CAP condivisi fra più comuni | 558 (il peggiore ne tiene **44**) |
| Comuni con almeno un CAP proprio | **3.457 su 7.904** |
| Comuni della provincia di Milano risolvibili dal CAP | **48 su 133** |

Tradotto: il CAP identifica Milano, Sesto San Giovanni, Monza, le città. Nella
cintura no — `20090` sta su Assago, Buccinasco, Cesano Boscone, Segrate,
Vimodrone e altri; `20010` su diciotto comuni. Lì il trigger **lascia vuoto di
proposito**: scrivere «Milano» manderebbe la richiesta a un professionista che
sta dall'altra parte, e nessuno dei due capirebbe perché.

Quindi il CAP è una scorciatoia vera per metà Italia, e per l'altra metà serve
la domanda.

## Cosa cambierebbe in BobChat

Oggi il passo città (`pickCity`, `BobChat.tsx`) offre le città con
`status = 'active'` e manda le altre in lista d'attesa. La proposta è un passo
in più, non una riscrittura:

1. **Le tre città restano il primo bottone.** Chi è a Milano tocca «Milano» e va
   avanti come adesso: zero attrito sul percorso che porta il 100% delle
   richieste di oggi.
2. **Sotto, una via d'uscita**: «Sono fuori Milano» → il campo comune con
   ricerca (`SceltaComune`, o solo la sua parte comune). Da lì si scrive
   `collected.comuneIstat`.
3. **Alla creazione della richiesta**, `comune_istat` va nell'insert accanto a
   `city_id` e `postal_code`. Il resto lo fanno i trigger.
4. **La città di Bob resta obbligatoria** (`requests.city_id` è NOT NULL): per
   un comune fuori dalle tre, si tiene la città più vicina fra quelle attive —
   è quella che decide in quale elenco compare la richiesta — e il comune dice
   dove si lavora davvero.

Il passo zona (quartieri) resta com'è e resta solo per Milano.

## Cosa succede se non si fa

Funziona tutto tranne la cosa che serve: i professionisti possono disegnare
mezza Lombardia, e ricevono soltanto le richieste che arrivano da Milano città
o da un CAP che identifica il loro comune. Per un pilota su Milano va bene. Per
l'apertura alla cintura no, ed è il primo pezzo da fare quando si apre.

## Cosa non è deciso, e va deciso insieme

- **Quante città «attive»** vogliamo davvero: se il comune diventa il dato
  principale, `cities` resta l'elenco dei mercati (le pagine città, la SEO) e
  non più il modo di dire dove sei.
- **La lista d'attesa** (`city_waitlist`) oggi si attiva scegliendo una città
  «coming soon». Con i comuni quella domanda cambia: si aspetta un mercato o si
  aspetta un professionista?
