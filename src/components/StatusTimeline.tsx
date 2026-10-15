// LA BARRA DI STATO DI UNA RICHIESTA (15/10: esce da CustomerHome). La usa
// la pagina della richiesta; dal 15/10 la dashboard del cliente mostra solo i
// puntini (BoxLavoro), dagli stessi passi e con gli stessi ingressi: lo
// stato della richiesta, quello del suo appuntamento, quanti pro.

import {
  passiRichiesta,
  type StatoAppuntamento,
  type StatoPasso,
} from "@/lib/passiRichiesta";

// Timeline di stato: mostra al cliente a che punto è il lavoro.
// L'APPUNTAMENTO CONTA ANCHE QUANDO E' DA CONFERMARE (113, 05/10). Prima la
// barra guardava solo i «confirmed»: quando il pro spostava un orario gia'
// accettato, il database lo riportava a «proposed» (107) e la barra tornava
// a «In contatto» proprio mentre al cliente toccava rispondere. Adesso resta
// su «Appuntamento» e dice «da confermare».
// I passi li decide passiRichiesta (lib/passiRichiesta.ts, 15/10).
export type { StatoAppuntamento };

const STILE: Record<StatoPasso, string> = {
  fatto: "text-emerald-700",
  adesso: "rounded-full bg-bob-indigo-50 px-2 py-0.5 font-semibold text-bob-indigo",
  "da-fare": "text-bob-ink/35",
  neutro: "rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-bob-ink/70",
};

export function StatusTimeline({
  status,
  appuntamento,
  quoteCount,
  closedReason = null,
}: {
  status: string;
  appuntamento: StatoAppuntamento;
  quoteCount: number;
  /** «disdetto» = prenotazione annullata: l'ultimo passo dice «Disdetta». */
  closedReason?: string | null;
}) {
  const passi = passiRichiesta({ status, closedReason, appuntamento, quoteCount });

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2xs">
      {passi.map((p, i) => (
        <span key={p.etichetta} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-bob-ink/20">—</span>}
          <span className={STILE[p.stato]}>
            {p.stato === "fatto" ? "✓ " : ""}
            {p.etichetta}
          </span>
        </span>
      ))}
    </div>
  );
}
