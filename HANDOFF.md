# Passaggio di consegne — 27 agosto 2026 (sera)

## Cosa ho fatto

**Migrazione 057 applicata in produzione** e verificata: 28 zone di Milano in
`city_zones`, copertura del professionista in due tabelle (geometria privata,
gettoni pubblici), unità di misura nuove, costi accessori, `ready_at`.

**058**: chiude i sei rilievi che la 057 aveva aperto sugli advisor. Le due
funzioni di trigger non sono più chiamabili via RPC (come la 034b), e
`request_coverage_keys` — che per leggere `private.slugify` doveva essere
SECURITY DEFINER aperta a `anon` — è stata sostituita da
`cities.coverage_keys`, una colonna mantenuta da un trigger. Advisor di
sicurezza: **zero rilievi**, tranne la leaked-password protection che richiede
il piano Pro.

**059**: `services.max_coverage_scope` per i 15 mestieri. Un fotografo copre
l'Italia, un idraulico la provincia: la domanda «quanto ti allontani» ha una
risposta che dipende dal lavoro, non dalla persona. Valori di partenza, si
cambiano con un update.

**Pagina «Dove lavori»** (`/impostazioni/zone`): mappa e zone sullo stesso
schermo. Cerchio con centro trascinabile e slider del raggio, oppure quartieri
scelti a mano; per le aree larghe (città, provincia, regione, tutta Italia)
nessun disegno. **Nessun fornitore di mappe**: nessuna tile, nessun glyph,
niente Google né Mapbox né MapTiler. Lo sfondo è un colore e sopra ci sono i
dati nostri.

**Il filtro per copertura è collegato** (`src/lib/data.ts`): una richiesta
genera i propri gettoni dalla città (e dalla zona, se il cliente l'ha detta) e
l'elenco tiene chi ha un gettone in comune. L'ordinamento mette per primo il
gettone più preciso che ha fatto match: chi copre tutta Italia compare per una
richiesta di Milano, ma dietro all'idraulico del quartiere. `/api/match` accetta
`?zone=`. Due regole che tengono in piedi il resto:
- chi **non ha dichiarato** nessuna area vale come «tutta la città in cui è
  iscritto»: senza, i cinque professionisti in produzione sparivano da ogni
  elenco il giorno del deploy;
- se il cliente **non dice la zona**, chi ha dichiarato dei quartieri di quella
  città rientra comunque: altrimenti la precisione si punirebbe, e oggi
  `requests.zone_slug` è NULL su tutte le richieste.

**060**: `promo_codes.used_count` diventa il conteggio delle righe di
`promo_redemptions`, mantenuto da un trigger su insert e delete. Diceva 2 con
zero riscatti; ora è 0 e non può più divergere.

**Nella pagina c'è un blocco «Provalo»**: scegli una zona e dice se una
richiesta da lì ti trova, usando gli stessi gettoni pubblicati che usa la
ricerca — non una simulazione scritta a parte.

## Cosa è a metà

- Il percorso guidato a sette tappe del primo ingresso non è iniziato: esiste
  solo la tappa «dove lavori», raggiungibile dalle impostazioni.
- **La chat non passa ancora la zona** a `/api/match`: il parametro c'è e
  funziona, ma `BobChat.tsx` è area di André e va cambiato in un suo PR.
  Finché non lo fa, il filtro lavora a livello di città.
- **Non ho potuto provare la query dal vivo**: l'host di Supabase non è
  nell'allowlist di rete della sessione, e nemmeno la shell del Mac ci arriva.
  Le regole del filtro sono provate nel browser una per una, la RLS in SQL con i
  ruoli veri, ma il giro completo va confermato con un comando (sotto).
- Il poligono a mano libera: la colonna c'è (`area_geojson`), la UI no.
- **Il worker di maplibre non viene emesso nel bundle di produzione di Next.**
  Conseguenza: una sorgente geojson resta «non caricata» per sempre, senza
  errore. Per questo il cerchio è un alone nel DOM e non un layer. Va sistemato
  prima di aggiungere una mappa stradale (PMTiles), non prima.
- Le etichette dei quartieri: diradate (pallino fuori area, nome corto dentro).
  Al centro, con un cerchio piccolo, i nomi delle zone scelte possono ancora
  toccarsi: è il limite di 28 etichette in tre chilometri.

## Cosa ho applicato in produzione che l'altro deve sapere

- **Migrazioni 057, 058, 059, 060 applicate** (file in repo prima dell'applicazione,
  come da regola). `list_migrations` le riporta.
- Una **copertura di prova** sul professionista demo `idromilano`: cerchio di
  5 km dal Duomo, 18 zone. Cancellabile senza conseguenze.
- **Da fare a mano su Supabase, ancora aperto**: aggiungere
  `https://www.meetonda.com/auth/conferma` e
  `http://localhost:3000/auth/conferma` ai Redirect URLs
  (Authentication → URL Configuration). Senza, `emailRedirectTo` viene
  ignorato e il link della mail torna sulla home.
- Account di prova `sig.mozzato@gmail.com` cancellato due volte con DELETE su
  `auth.users`: cancellazione dura, non il percorso della 056, che resta da
  provare.

## Come confermare il giro completo, dal tuo Mac

```
cd ~/BOB
npm run dev
curl -s "http://localhost:3000/api/match?service=idraulico&city=milano&zone=isola" | python3 -m json.tool | grep fullName
curl -s "http://localhost:3000/api/match?service=idraulico&city=milano&zone=baggio" | python3 -m json.tool | grep fullName
```

`idromilano` ha un cerchio di 5 km dal Duomo (18 zone, Isola dentro, Baggio
fuori): deve comparire nella prima e **non** nella seconda. Gli altri quattro
professionisti, che non hanno dichiarato niente, compaiono in entrambe per la
regola di compatibilità.
