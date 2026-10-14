// LA BARRA DI STATO DI UNA RICHIESTA (17/10: esce da CustomerHome). La usano
// la dashboard del cliente e la pagina della richiesta, con gli stessi
// ingressi: lo stato della richiesta, quello del suo appuntamento, quanti pro.

// Timeline di stato: mostra al cliente a che punto è il lavoro.
// L'APPUNTAMENTO CONTA ANCHE QUANDO E' DA CONFERMARE (113, 05/10). Prima la
// barra guardava solo i «confirmed»: quando il pro spostava un orario gia'
// accettato, il database lo riportava a «proposed» (107) e la barra tornava
// a «In contatto» proprio mentre al cliente toccava rispondere. Adesso resta
// su «Appuntamento» e dice «da confermare».
export type StatoAppuntamento = "confermato" | "da-confermare" | null;

export function StatusTimeline({
  status,
  appuntamento,
  quoteCount,
}: {
  status: string;
  appuntamento: StatoAppuntamento;
  quoteCount: number;
}) {
  const isQuote = status === "quote_request";
  const passoAppuntamento =
    appuntamento === "da-confermare" ? "Appuntamento da confermare" : "Appuntamento";
  const steps = [
    "Inviata",
    ...(isQuote ? [quoteCount > 1 ? `${quoteCount} pro contattati` : "Preventivo chiesto"] : []),
    "In contatto",
    passoAppuntamento,
    "Conclusa",
  ];
  const currentIdx =
    status === "closed"
      ? steps.length - 1
      : appuntamento
      ? steps.indexOf(passoAppuntamento)
      : status === "matched"
      ? steps.indexOf("In contatto")
      : isQuote
      ? 1
      : 0;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2xs">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-bob-ink/20">—</span>}
          <span
            className={
              i < currentIdx
                ? "text-emerald-700"
                : i === currentIdx
                ? "rounded-full bg-bob-indigo-50 px-2 py-0.5 font-semibold text-bob-indigo"
                : "text-bob-ink/35"
            }
          >
            {i < currentIdx ? "✓ " : ""}
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}
