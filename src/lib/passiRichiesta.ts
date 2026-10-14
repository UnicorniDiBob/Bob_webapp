// I PASSI DELLA BARRA DI STATO DI UNA RICHIESTA, SENZA REACT (15/10).
//
// Escono da StatusTimeline per poterli provare. Per le richieste aperte la
// regola e' quella di sempre, ed e' la sola che la dashboard vede (mostra
// solo richieste aperte). Cambia la richiesta CHIUSA, che dal 15/10 si apre
// nella sua pagina: prima la barra fermava il passo corrente su «Conclusa»,
// disegnato come «adesso» e non come fatto, e a chi aveva appena chiuso il
// lavoro sembrava che mancasse ancora un passo. Ora chiusa vuol dire tutto
// fatto, «Conclusa» compresa. E una prenotazione disdetta (113) non e' un
// lavoro concluso: l'ultimo passo dice «Disdetta», in grigio, ne' verde (non
// e' un traguardo) ne' rosso (non e' un errore di nessuno).

export type StatoAppuntamento = "confermato" | "da-confermare" | null;

export type StatoPasso = "fatto" | "adesso" | "da-fare" | "neutro";

export interface Passo {
  etichetta: string;
  stato: StatoPasso;
}

export function passiRichiesta(r: {
  status: string;
  closedReason?: string | null;
  appuntamento: StatoAppuntamento;
  quoteCount: number;
}): Passo[] {
  const isQuote = r.status === "quote_request";
  const passoAppuntamento =
    r.appuntamento === "da-confermare" ? "Appuntamento da confermare" : "Appuntamento";
  const disdetta = r.status === "closed" && r.closedReason === "disdetto";
  const steps = [
    "Inviata",
    ...(isQuote ? [r.quoteCount > 1 ? `${r.quoteCount} pro contattati` : "Preventivo chiesto"] : []),
    "In contatto",
    passoAppuntamento,
    disdetta ? "Disdetta" : "Conclusa",
  ];
  const currentIdx =
    r.status === "closed"
      ? steps.length
      : r.appuntamento
        ? steps.indexOf(passoAppuntamento)
        : r.status === "matched"
          ? steps.indexOf("In contatto")
          : isQuote
            ? 1
            : 0;

  return steps.map((etichetta, i) => ({
    etichetta,
    stato:
      disdetta && i === steps.length - 1
        ? "neutro"
        : i < currentIdx
          ? "fatto"
          : i === currentIdx
            ? "adesso"
            : "da-fare",
  }));
}
