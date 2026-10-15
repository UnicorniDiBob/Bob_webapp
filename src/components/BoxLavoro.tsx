// IL BOX DI UN LAVORO IN CORSO (15/10). Nella dashboard del cliente ogni
// richiesta aperta era una scheda con la barra di stato intera, l'elenco dei
// pro con i loro «Apri →» e «Segna come concluso»: a 390px «Lavori in corso»
// era alto 1377px con cinque richieste. Quelle decisioni adesso vivono nella
// pagina della richiesta (/dashboard/richieste/<id>), quindi il box e' UN
// link solo, senza altri bersagli dentro: dice a che punto e' il lavoro, se
// c'e' qualcosa di nuovo, e porta li' in un tocco.

import Link from "next/link";
import type { Passo, StatoPasso } from "@/lib/passiRichiesta";
import { passoCorrente } from "@/lib/boxLavoro";

const PUNTO: Record<StatoPasso, string> = {
  fatto: "bg-emerald-600",
  adesso: "bg-white ring-2 ring-bob-indigo",
  "da-fare": "border border-bob-ink/25 bg-white",
  neutro: "bg-bob-ink/40",
};

/** I passi di passiRichiesta come puntini legati da una linea, senza etichette. */
function BarraPassi({ passi }: { passi: Passo[] }) {
  const c = passoCorrente(passi);
  return (
    <span
      role="img"
      aria-label={`Passo ${c.numero} di ${c.di}: ${c.etichetta}`}
      className="flex min-w-0 max-w-[180px] flex-1 items-center"
      data-testid="box-passi"
    >
      {passi.map((p, i) => (
        <span key={p.etichetta} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
          {i > 0 && (
            <span
              className={`h-px flex-1 ${
                p.stato === "fatto" || p.stato === "adesso" ? "bg-emerald-600" : "bg-bob-ink/15"
              }`}
            />
          )}
          <span className={`h-2 w-2 shrink-0 rounded-full ${PUNTO[p.stato]}`} />
        </span>
      ))}
    </span>
  );
}

export function BoxLavoro({
  id,
  servizio,
  citta,
  nonLetti,
  stato,
  passi,
}: {
  id: string;
  servizio: string;
  citta: string | null;
  /** Messaggi dei pro non letti su questa richiesta. */
  nonLetti: number;
  /** La frase di rigaStatoLavoro (lib/boxLavoro.ts). */
  stato: string;
  passi: Passo[];
}) {
  return (
    <Link
      href={`/dashboard/richieste/${id}`}
      className="flex h-full min-h-[44px] flex-col gap-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 transition hover:-translate-y-0.5 hover:border-bob-indigo/30 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40"
      data-testid={`request-${id}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-bob-ink">
          {servizio}
          {citta ? <span className="font-normal text-bob-ink/65"> · {citta}</span> : null}
        </span>
        {nonLetti > 0 && (
          <span className="shrink-0 rounded-full bg-bob-indigo px-2 py-0.5 text-2xs font-bold text-white">
            {nonLetti > 9 ? "9+" : nonLetti} nuov{nonLetti === 1 ? "o" : "i"}
          </span>
        )}
      </span>
      <span className="text-sm text-bob-ink/80" data-testid="box-stato">
        {stato}
      </span>
      <span className="mt-auto flex items-center justify-between gap-3">
        <BarraPassi passi={passi} />
        <span className="shrink-0 text-xs font-semibold text-bob-indigo">
          Apri →
        </span>
      </span>
    </Link>
  );
}
