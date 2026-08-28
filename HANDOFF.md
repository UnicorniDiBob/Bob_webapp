# Passaggio di consegne — 28 agosto 2026

## Cosa ho fatto

**Il primo ingresso del professionista, completo e in produzione.** L'iscrizione
finisce nell'area di lavoro (prima atterrava su un form di impostazioni) e apre
una **guida di cinque tappe** che spiega dove arrivano le richieste, dove si dice
l'area di lavoro, il calendario, i messaggi, e chiude con una checklist
interrogata al database. Ogni tappa ha il suo riquadro e nessun link che porta
via a metà. Vista una volta si segna su `professionals.onboarding_completed_at`;
resta il link «Rivedi la guida».

**La pagina «Dove lavori»** (`/impostazioni/zone`): cerchio con centro
trascinabile e raggio fino a 20 km, oppure quartieri a mano, oppure ampiezze
larghe fino a tutta Italia e «anche a distanza». Fin dove si può arrivare lo
decide il catalogo (`services.max_coverage_scope`, migrazione 059): un fotografo
copre l'Italia, un idraulico la provincia.

**Sotto la mappa c'è Milano davvero**: i perimetri dei NIL del Comune (CC-BY) in
`public/geo/milano-nil.geojson`, generati da `scripts/build_milano_nil_geojson.py`,
disegnati in SVG sopra la tela. **Nessun fornitore di mappe**: niente tile,
niente glyph, niente Google né Mapbox né MapTiler — l'IP del professionista e la
porzione di città che guarda non escono da Bob.

**Il filtro per copertura è collegato** (`src/lib/data.ts`): la richiesta genera i
propri gettoni e l'elenco tiene chi ne ha uno in comune, ordinando per
precisione. Due regole da ricordare: chi non ha dichiarato un'area vale come
«tutta la città in cui è iscritto», e una richiesta senza zona non penalizza chi
ha dichiarato i quartieri.

**Migrazioni 057-060 applicate**, advisor di sicurezza a zero rilievi (resta solo
la leaked-password protection, che vuole il piano Pro).

## Cosa è a metà

- **La chat non passa ancora `zone`** a `/api/match`: il parametro esiste e
  funziona, ma `BobChat.tsx` e il percorso del preventivo sono di André. Finché
  non li tocca, il filtro lavora a livello di città e `requests.zone_slug` resta
  NULL su tutte le richieste.
- **Il nostro elenco è di 28 zone, i nuclei ufficiali sono 88.** Sulla mappa si
  vedono le zone bianche: chi lavora, per esempio, a Chiaravalle non ha una
  casella. Decisione di prodotto aperta: allargare l'elenco o tenerlo corto.
- `ready_at` esiste come colonna e **nessuno la scrive**: la checklist calcola,
  ma il prodotto non dichiara lo stato «pronto a ricevere richieste».
- Le domande dell'iscrizione: fatte 2 su 10 della specifica. Mancano soprattutto
  **tariffa nell'unità del mestiere** (la pagina azienda dice ancora «€/h» fisso,
  e un fotografo lavora a evento) e i **costi accessori** (colonne in database,
  nessuna interfaccia).
- Poligono a mano libera: colonna `area_geojson` pronta, interfaccia no. Da
  valutare se serve davvero.
- Il worker di maplibre non viene emesso nel bundle di Next: una sorgente geojson
  resta «non caricata» senza errore. Per questo cerchio e quartieri sono in DOM e
  SVG. Va sistemato **prima** di aggiungere una mappa stradale, non prima.
- Zone di Roma e Torino: c'è il generatore, mancano i dati. Un comando quando
  quelle città si aprono.

## Cosa ho applicato in produzione che l'altro deve sapere

- **Migrazioni 057, 058, 059, 060 applicate** (file in repo prima
  dell'applicazione, come da regola). Dopo il merge non c'è altro da fare sul
  database.
- **Da fare a mano su Supabase, ancora aperto**: aggiungere
  `https://www.meetonda.com/auth/conferma` e `http://localhost:3000/auth/conferma`
  ai Redirect URLs (Authentication → URL Configuration). Senza,
  `emailRedirectTo` viene ignorato e il link della mail di conferma torna sulla
  home.
- **Decisione da prendere a settembre: SMTP personalizzato.** Il mailer interno
  di Supabase manda 2 email all'ora per tutto il progetto: il terzo
  professionista che si iscrive nella stessa ora non entra mai. Quindici minuti
  di lavoro più 8-10 giorni fra propagazione e warm-up, e l'outreach parte a
  ottobre.
- La guida è segnata come già vista per i cinque professionisti demo
  `@bobapp.it`, così non si apre una finestra in mezzo a una dimostrazione.
  Reversibile con un update.
- `promo_codes.used_count` di BOB-FOUNDER-2026 ora è il conteggio delle righe di
  `promo_redemptions` (trigger della 060): diceva 2 con zero riscatti.
- Il ramo **`feat/mappa-copertura` su GitHub non va mergiato mai**: è la versione
  vecchia con la guida difettosa. Da cancellare.
- La **revisione 2 della specifica** (`docs/CHECKIN_PRIMO_INGRESSO.md`) vive solo
  sul ramo locale `docs/checkin-primo-ingresso`: in `main` c'è la revisione 1,
  che non parla né di mappa né di coperture ampie.
