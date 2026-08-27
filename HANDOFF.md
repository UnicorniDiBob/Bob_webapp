# Passaggio di consegne — 27 agosto 2026

## Cosa ho fatto

Specifica del primo ingresso del professionista (`docs/CHECKIN_PRIMO_INGRESSO.md`):
il questionario smette di essere un cancello fra iscrizione e dashboard e diventa
un percorso che spiega mentre chiede. Migrazione **057**: zone delle città in
tabella (le 28 NIL di Milano, generate da `src/lib/zones.ts`), copertura del
professionista — zone, cerchio, poligono, città, provincia, regione, tutta
Italia, a distanza — con una sola chiave di match a gettoni; geometria privata e
solo i gettoni pubblici, perché il centro del cerchio può essere casa sua. Unità
di misura nuove (evento, giornata, mq, ml, punto, pezzo…), costi accessori
(uscita, sopralluogo, minimo fatturabile, materiali, regime IVA), stato
«pronto a ricevere richieste». Il questionario ora crea la riga
`professional_services`: prima si completava l'iscrizione e si restava invisibili
in ogni ricerca (provato in produzione il 27/08 con un account vero). Nuova
pagina `/auth/conferma`: il link della mail di conferma atterrava sulla home.

## Cosa è a metà

La 057 **non è applicata** a Supabase: va applicata dopo il merge, prima di
scrivere la UI della copertura. La mappa (MapLibre + PMTiles nostre) non è
iniziata. `computeFreeSlots` ignora ancora `professional_availability`. Allineare
Node fra `ci.yml` (20) e Vercel (24). SMTP personalizzato: con 2 email/ora dal
mailer interno di Supabase il terzo iscritto della stessa ora non entra mai, e
l'outreach parte a ottobre.

## Cosa ho applicato in produzione che l'altro deve sapere

Sullo schema niente. **Da fare a mano su Supabase**: aggiungere
`https://www.meetonda.com/auth/conferma` (e `http://localhost:3000/auth/conferma`)
ai Redirect URLs in Authentication → URL Configuration, altrimenti
`emailRedirectTo` viene ignorato e la pagina nuova non viene mai raggiunta.
Cancellato due volte l'account di prova `sig.mozzato@gmail.com`, con DELETE su
`auth.users`: è una cancellazione dura, non il percorso della 056, che resta da
provare. `promo_codes.used_count` di BOB-FOUNDER-2026 dice 2 con zero riscatti
registrati: il contatore non torna indietro quando l'account sparisce.
