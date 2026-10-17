# Mascotte: le pose che mancano

Creato il 17/10/2026 con la PR 2 del brief `docs/BRIEF_logo_mascotte_bee.md` (approccio B).

Il sito usa oggi le pose del pacchetto `BOB-mascot-asset-pack-v2.0` (cartella `web/`, copiate in `public/mascotte/`). Alcune scene avevano un oggetto che aveva senso solo con il vecchio Bob disegnato, e il pacchetto non ha ancora l'ape che fa la stessa cosa. Qui c'è l'elenco delle pose da generare, e di dove andrebbero.

**Come si generano.** Si allega al generatore `reference/bob-reference-canonica-v2.png` del pacchetto e si seguono `reference/BOB-character-reference.md` e `reference/bob-character-spec.json`. Le regole anatomiche contano: **4 braccia e 4 guanti** sempre visibili, ali uguali per attacco e sagoma, la cintura senza doppioni degli attrezzi impugnati. Ogni posa nuova si esporta come le altre: carta quadrata 960×960 su fondo caldo uniforme (AVIF, WebP, PNG a 480 e 960), oppure trasparente se deve stare su un fondo colorato senza cerchio.

| # | Posa da generare | Dove andrebbe | Oggi al suo posto |
|---|---|---|---|
| 1 | **Ape al telefono** (lo tiene e lo guarda; meglio se il telefono si vede di fronte) | Righe 4 e 5 del brief: home e /come-funziona passo 3 (`ScenaMessaggio` in `src/components/SceneBob.tsx`); home, fascia indaco (`ApeConElenco` in `src/components/ApeConElenco.tsx`) | Passo 3: «successo» con la nuvoletta del messaggio e la spunta accanto. Fascia indaco: «successo» in un medaglione, con il telefono dell'elenco di fianco, non in mano (ritocco del 17/10) |
| 2 | **Ape con la bilancia / che confronta** due cose | Riga 3: passo 2 (`ScenaConfronto`) | «Sceglie lo strumento», con le tre schede dei profili accanto |
| 3 | **Ape che spinge una cariola** | Riga 7: eroe di /per-i-professionisti | «Successo» in un medaglione tondo; cariola e banconote tolte. Se torna la cariola, serve trasparente (la fascia è indaco) |
| 4 | **Api di schiena al lavoro**, su una scala, ognuna con un attrezzo diverso (chiave, pennello, scatolone, cacciavite) | Riga 8: /come-funziona, «Come ordiniamo i risultati», colonna accanto al testo (solo da 1024px in su) | Tre carte ferme, una accanto all'altra: elettricista, pulizie, giardinaggio |

## L'animazione, più avanti

André vuole animare la mascotte più avanti: **non si costruisce adesso.** Per la riga 4 l'idea c'è già. La vecchia scala (`ScalaDeiMestieri`, nella storia di git fino al 17/10) muoveva il **braccio con l'attrezzo** di ogni Bob in funzione di quanto si scorreva la pagina (`Math.sin(scrollY / passo + fase)`), con passo, ampiezza e fase diversi per mestiere: il cacciavite svelto e corto, la pennellata lenta e larga, lo scatolone quasi fermo. Chi aveva chiesto meno movimento (`prefers-reduced-motion`) li vedeva fermi. Con le api servirà un'immagine per pezzo (corpo e braccio separati), non una carta unica.

Anche il saluto dell'eroe della home seguiva lo scorrimento (`BobCheSaluta`): è un altro candidato quando si anima l'ape.
