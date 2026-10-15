"use client";

// «COM'È ANDATA?» NELLA PAGINA DELLA RICHIESTA (15/10).
//
// Chiudere il lavoro e recensirlo sono la stessa conversazione, e qui
// succedono nello stesso posto: «Sì, è concluso» e le stelle compaiono dove
// c'era la domanda, senza una finestra sopra la pagina. Cosa si vede lo
// decide cosaMostraComEAndata (lib/richiestaCliente.ts). L'ancora
// #com-e-andata la usano le righe «Com'è andato il lavoro…?» ed «È andato
// tutto bene?» di «Da fare ora» (PR 6, 15/10).

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ModuloRecensione } from "@/components/ModuloRecensione";
import { cosaMostraComEAndata } from "@/lib/richiestaCliente";

export function ComEAndata({
  richiesta,
  pros,
  recensioni,
  haAppuntamento,
  onCambiato,
}: {
  richiesta: { id: string; status: string; closed_reason: string | null };
  pros: { id: string; nome: string }[];
  /** Le stelle che il cliente ha gia' dato, per pro. */
  recensioni: Map<string, number>;
  /** C'e' o c'e' stato un appuntamento non annullato. */
  haAppuntamento: boolean;
  /** Dopo la chiusura o una recensione: ricarica i dati della pagina. */
  onCambiato: () => Promise<void>;
}) {
  const [chiudo, setChiudo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const cosa = cosaMostraComEAndata({
    status: richiesta.status,
    closed_reason: richiesta.closed_reason,
    proIds: pros.map((p) => p.id),
    recensiti: new Set(recensioni.keys()),
    haAppuntamento,
  });
  if (!cosa) return null;

  // La stessa scrittura di markClosed in CustomerHome: lo stato della
  // richiesta, che la policy lascia cambiare solo al suo cliente.
  async function concludi() {
    setChiudo(true);
    setErrore(null);
    const { error } = await createClient()
      .from("requests")
      .update({ status: "closed" })
      .eq("id", richiesta.id);
    if (error) {
      setErrore("Non sono riuscito a segnarlo come concluso. Riprova.");
      setChiudo(false);
      return;
    }
    await onCambiato();
    setChiudo(false);
  }

  const daRecensire = pros.filter((p) => !recensioni.has(p.id));

  return (
    // scroll-mt-24 (15/10): l'intestazione e' alta 81px a 390px, e con
    // scroll-mt-20 il bordo della scheda finiva sotto di un pixel.
    <section id="com-e-andata" className="card scroll-mt-24 p-5" data-testid="com-e-andata">
      {/* tabIndex -1: chi arriva da «Da fare ora» atterra qui col fuoco
          (RichiestaCliente, 15/10). */}
      <h2
        tabIndex={-1}
        className="text-sm font-semibold uppercase tracking-wide text-bob-ink/70 focus:outline-none"
      >
        Com&apos;è andata?
      </h2>

      {cosa === "chiudi" && (
        <div className="mt-3">
          <p className="text-sm text-bob-ink">Il lavoro è concluso?</p>
          <p className="mt-0.5 text-sm text-bob-ink/70">
            Quando lo segni come concluso puoi lasciare una recensione, qui sotto.
          </p>
          <button
            type="button"
            onClick={concludi}
            disabled={chiudo}
            className="btn-primary mt-3 min-h-[44px] px-5 py-2.5 disabled:opacity-50"
            data-testid="richiesta-concludi"
          >
            {chiudo ? "Salvo…" : "Sì, è concluso"}
          </button>
          {errore && <p className="mt-2 text-xs text-red-600">{errore}</p>}
        </div>
      )}

      {cosa === "recensisci" && (
        <div className="mt-3">
          {/* La key cambia a ogni recensione: con piu' pro, il modulo
              riparte pulito per il prossimo. */}
          <ModuloRecensione
            key={daRecensire.map((p) => p.id).join(",")}
            requestId={richiesta.id}
            professionals={daRecensire.map((p) => ({ id: p.id, name: p.nome }))}
            onSubmitted={() => {
              void onCambiato();
            }}
            inPagina
          />
        </div>
      )}

      {cosa === "grazie" && (
        <div className="mt-3" data-testid="richiesta-recensita">
          <p className="text-sm text-bob-ink">Grazie, hai già lasciato la recensione.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {pros.map((p) => {
              const stelle = recensioni.get(p.id) ?? 0;
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="text-bob-ink/80">{p.nome}</span>
                  <span
                    className="tracking-tight"
                    role="img"
                    aria-label={`${stelle} stell${stelle === 1 ? "a" : "e"} su 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={n <= stelle ? "text-bob-yellow" : "text-black/15"}>
                        ★
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
