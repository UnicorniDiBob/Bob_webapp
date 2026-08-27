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

## Cosa è a metà

- **L'elenco dei professionisti non filtra ancora per copertura**: i gettoni
  esistono e sono pubblici, ma `getProfessionals()` in `src/lib/data.ts` non li
  legge ancora. È il prossimo passo, ed è quello che rende utile tutto il resto.
- Il percorso guidato a sette tappe del primo ingresso non è iniziato: esiste
  solo la tappa «dove lavori», raggiungibile dalle impostazioni.
- Il poligono a mano libera: la colonna c'è (`area_geojson`), la UI no.
- **Il worker di maplibre non viene emesso nel bundle di produzione di Next.**
  Conseguenza: una sorgente geojson resta «non caricata» per sempre, senza
  errore. Per questo il cerchio è un alone nel DOM e non un layer. Va sistemato
  prima di aggiungere una mappa stradale (PMTiles), non prima.
- Le etichette dei quartieri si sovrappongono al centro della mappa: funziona,
  ma va diradato (pallino, ed etichetta solo al passaggio del dito).

## Cosa ho applicato in produzione che l'altro deve sapere

- **Migrazioni 057, 058, 059 applicate** (file in repo prima dell'applicazione,
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
