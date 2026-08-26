# Passaggio di consegne — 25-26 agosto 2026

## Cosa ho fatto

Ripristinata la cancellazione account del 19/08 (la migrazione 056 era già in
produzione, il codice no — non stava in nessun commit). Aggiunta guardia
server-side su `/dashboard`, `/messaggi`, `/impostazioni`. Repo trasferito da
`andreatonda` a `UnicorniDiBob`. `main` ora è protetto: niente push diretti,
niente force-push, PR obbligatoria, check `build` richiesto, bypass list
vuota.

## Cosa è a metà

Allineare la versione di Node fra `ci.yml` (20) e Vercel (24). Definire la
retention dei deployment di produzione su Vercel. Prova end-to-end della
cancellazione account — serve un account di test, decisione di André.

## Cosa ho applicato in produzione che l'altro deve sapere

ATTENZIONE: il trasferimento del repo ha rotto il collegamento
Vercel→GitHub. La pagina Git del progetto mostrava il repo giusto pur essendo
scollegata — nessun errore visibile lì. Sintomo: il push va a buon fine e non
parte nessun deploy. Rimedio: `vercel git disconnect` seguito da
`vercel git connect`.
