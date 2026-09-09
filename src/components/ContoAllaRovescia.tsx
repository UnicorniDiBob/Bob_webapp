"use client";

// L'orologio della riapertura, in un componente solo.
//
// Tre posti mostrano quanto manca — la fascia rossa dello staff, l'avviso
// sulla pagina di accesso, il pannello admin — e devono dire lo stesso numero
// nello stesso formato. Il testo lo calcola `restante` in lib/manutenzione,
// qui c'e' solo il battito: un secondo alla volta, fermato quando la finestra
// e' scaduta cosi' non resta un timer acceso a vuoto.

import { useEffect, useState } from "react";
import { restante } from "@/lib/manutenzione";

export function ContoAllaRovescia({
  fine,
  finito = "sta riaprendo",
}: {
  fine: string;
  /** Cosa scrivere quando il tempo e' finito ma la pagina e' ancora aperta. */
  finito?: string;
}) {
  const [testo, setTesto] = useState(() => restante(fine));

  useEffect(() => {
    setTesto(restante(fine));
    const t = setInterval(() => {
      const r = restante(fine);
      setTesto(r);
      if (!r) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [fine]);

  if (!testo) return <span>{finito}</span>;
  return (
    <span className="tabular-nums" aria-live="off">
      fra {testo}
    </span>
  );
}
