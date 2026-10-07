"use client";

// «SI SOVRAPPONE A...» (116, Lucio 07/10).
//
// Al pro la sovrapposizione e' permessa: un ritardo che invade
// l'appuntamento dopo, due lavori vicini che sa di poter tenere. Ma deve
// saperlo prima di salvare, e deve sapere CON COSA. Questo e' l'avviso, uno
// solo per tutte le strade del pro (dialog del calendario, proposta in chat,
// spostamento): non un divieto.
//
// «Non mostrarmelo piu'» e' una scelta del pro che lo segue su ogni
// dispositivo: sta su professionals.avviso_sovrapposizione, non nel
// browser. Si riaccende da Impostazioni → Orari.

import { useEffect, useState } from "react";
import {
  leggiAvvisoSovrapposizione,
  salvaAvvisoSovrapposizione,
} from "@/lib/messages";
import { oraRoma } from "@/lib/ritardo";

export interface Sovrapposto {
  id: string;
  starts_at: string;
  duration_minutes: number;
  customer_name: string | null;
}

/**
 * La preferenza del pro: true = mostra l'avviso. null finche' non si e'
 * letta (nel frattempo l'avviso si mostra: meglio uno in piu').
 */
export function useAvvisoSovrapposizione(professionalId: string | null) {
  const [attivo, setAttivo] = useState<boolean | null>(null);
  useEffect(() => {
    if (!professionalId) return;
    let vivo = true;
    leggiAvvisoSovrapposizione(professionalId).then((v) => {
      if (vivo) setAttivo(v);
    });
    return () => {
      vivo = false;
    };
  }, [professionalId]);
  return {
    mostra: attivo !== false,
    spegni: async () => {
      if (!professionalId) return;
      setAttivo(false);
      await salvaAvvisoSovrapposizione(professionalId, false);
    },
  };
}

function fascia(a: Sovrapposto): string {
  const fine = new Date(new Date(a.starts_at).getTime() + a.duration_minutes * 60000);
  return `${oraRoma(a.starts_at)}–${oraRoma(fine)}`;
}

export function AvvisoSovrapposizione({
  conflitti,
  onSpegni,
  testo,
}: {
  conflitti: Sovrapposto[];
  /** «Non mostrarmelo piu'»: salva la preferenza del pro. */
  onSpegni: () => void;
  /** Una riga in piu' sotto l'elenco, se la strada ha qualcosa da dire. */
  testo?: React.ReactNode;
}) {
  const [spunta, setSpunta] = useState(false);
  if (conflitti.length === 0) return null;
  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      role="status"
      data-testid="avviso-sovrapposizione"
    >
      <p className="font-semibold">Si sovrappone a:</p>
      <ul className="mt-0.5 space-y-0.5">
        {conflitti.map((c) => (
          <li key={c.id} className="break-words">
            {c.customer_name || "un appuntamento"} · {fascia(c)}
          </li>
        ))}
      </ul>
      {testo && <p className="mt-1">{testo}</p>}
      <label className="mt-1.5 flex min-h-[44px] items-center gap-2 text-amber-900/80">
        <input
          type="checkbox"
          checked={spunta}
          onChange={(e) => {
            setSpunta(e.target.checked);
            if (e.target.checked) onSpegni();
          }}
          data-testid="avviso-sovrapposizione-spegni"
        />
        Non mostrarmelo più
      </label>
    </div>
  );
}
