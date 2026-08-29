# Passaggio di consegne — 29 agosto 2026

## Cosa ho fatto

**La guida del primo accesso non spiega piu': accompagna.** I finti riquadri
grigi sono spariti — ogni passo illumina l'elemento vero della pagina
(`data-tour="..."`, il buco nell'ombra e' la pagina stessa) tramite
`TourAncorato.tsx`, riusabile. Ma soprattutto il giro non finisce con le
schermate: dopo la spiegazione legge cosa manca davvero, e per ogni cosa manda
nella pagina giusta, si segna il punto (`lib/guidaProgresso.ts`, localStorage) e
riprende al ritorno con una spunta verde in piu'. Sulle impostazioni compare una
barra («Guida in corso… Torna alla guida», `GuidaBarra.tsx`) che tiene il filo.
Chiude quando lo stato dice «compari nelle ricerche». «Piu' tardi» sempre
accanto: accompagnare non e' costringere.

**`professionals.ready_at` adesso qualcuno la scrive — migrazione 062.** Due
trigger: uno su `professional_services`, uno sullo spegnimento del profilo.
Definizione: pronto = almeno un servizio dichiarato e profilo non disattivato,
cioe' esattamente la condizione con cui `getProfessionals()` restituisce il
profilo. Zone e orari restano consigli; il telefono non entra finche' le chiamate
non esistono. La protezione della 057 e' stata riscritta per intero: distingue le
UPDATE dei propri trigger da quelle di un client con `pg_trigger_depth()`, cosi'
il pro continua a non potersi dichiarare pronto da solo.

**La checklist di cosa manca e' un riquadro fisso** dell'area di lavoro
(`StatoProfiloCard`, in cima alla colonna destra), non piu' l'ultimo passo di una
guida che si vede una volta. Mostra lo stato dal server (con la data) e le
quattro righe controllate sul momento, ognuna con la conseguenza vera e il link.

**Impostazioni, un bottone solo per schermo:** il link nell'intestazione della
dashboard e la rotella dell'header erano identici, a due centimetri e **con lo
stesso `data-testid`**. Il link resta solo sotto `md`, dove la rotella e'
nascosta dal `hidden md:flex`.

## Cosa e' a meta'

- **La 062 non e' applicata**: il file e' in PR, l'applicazione su Supabase e' il
  passo successivo al merge (regola: prima il file nella PR, poi la migrazione).
  Finche' non e' applicata, `ready_at` resta NULL e il riquadro usa il calcolo
  locale come rete — dichiarandolo.
- **`npm run build` non e' stato portato a termine da qui** (gira contro la
  stessa cartella `.next` del dev server e si impalla): `tsc --noEmit` e
  `next lint` sono verdi, il build lo fa la CI sulla PR.
- **Advisor Supabase da rilanciare dopo l'applicazione della 062** (funzioni
  nuove: `private.pro_e_pronto`, `private.applica_ready_at`, i due
  `sync_ready_at_*`; tutte SECURITY DEFINER con `search_path` vuoto, come da
  regola).
- Restano aperti dal 28/08: la chat non passa ancora `zone` a `/api/match`
  (codice di Andre'); 28 zone nostre contro 88 nuclei ufficiali; tariffa
  nell'unita' del mestiere e costi accessori senza interfaccia; il worker
  maplibre non emesso nel bundle.

## Cosa ho applicato in produzione che l'altro deve sapere

- **Niente.** Nessuna migrazione applicata, nessuna scrittura: solo letture su
  `professionals` e `auth.users` per contare `ready_at` e verificare un account
  di prova.
- Resta da fare a mano su Supabase (dal 28/08): aggiungere
  `https://www.meetonda.com/auth/conferma` e `http://localhost:3000/auth/conferma`
  ai Redirect URLs, e decidere l'SMTP personalizzato (il mailer interno manda 2
  email/ora per tutto il progetto).
- Il ramo `feat/mappa-copertura` su GitHub non va mergiato mai: versione vecchia
  con la guida difettosa. Da cancellare.
