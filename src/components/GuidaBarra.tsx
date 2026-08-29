"use client";

// LA BARRA CHE TIENE IL FILO.
//
// Quando la guida manda il professionista a sistemare una cosa, lui esce dalla
// dashboard e finisce in una pagina di impostazioni. Senza questa barra il giro
// e' semplicemente finito li': nessuno gli dice che stava facendo un percorso,
// e il ritorno e' un atto di memoria suo. Con la barra, la pagina dichiara
// perche' ci e' arrivato e come tornare — ed e' l'unica differenza fra un
// tutorial che spiega e uno che accompagna.
//
// Compare solo se un giro e' davvero in corso (il segnaposto in
// lib/guidaProgresso) e solo ai professionisti. La X lo chiude per sempre: chi
// vuole uscire da una guida deve poterlo fare al primo tentativo.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  EVENTO_GUIDA,
  leggiProgresso,
  scriviProgresso,
} from "@/lib/guidaProgresso";

export function GuidaBarra() {
  const { role } = useAuth();
  const pathname = usePathname();
  const [attiva, setAttiva] = useState(false);
  const [etichetta, setEtichetta] = useState<string | null>(null);

  useEffect(() => {
    const aggiorna = () => {
      const p = leggiProgresso();
      setAttiva(Boolean(p?.attiva));
      setEtichetta(p?.etichetta ?? null);
    };
    aggiorna();
    window.addEventListener(EVENTO_GUIDA, aggiorna);
    // Un'altra scheda puo' aver chiuso la guida: "storage" arriva solo dalle
    // altre schede, ed e' esattamente il caso che l'evento nostro non copre.
    window.addEventListener("storage", aggiorna);
    return () => {
      window.removeEventListener(EVENTO_GUIDA, aggiorna);
      window.removeEventListener("storage", aggiorna);
    };
  }, [pathname]);

  if (role !== "professional" || !attiva) return null;

  return (
    <div
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bob-indigo/20 bg-bob-indigo-50 px-4 py-3"
      data-testid="guida-barra"
    >
      <p className="flex items-start gap-2 text-sm text-bob-ink">
        <Compass className="mt-0.5 h-4 w-4 shrink-0 text-bob-indigo" aria-hidden="true" />
        <span>
          <span className="font-semibold">Guida in corso.</span>{" "}
          {etichetta
            ? `Sei qui per sistemare «${etichetta.toLowerCase()}». Quando hai finito, torna e riprendiamo da lì.`
            : "Quando hai finito qui, torna e riprendiamo da dove eravamo."}
        </span>
      </p>
      <span className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard"
          className="btn-primary px-3 py-1.5 text-sm"
          data-testid="link-torna-alla-guida"
        >
          Torna alla guida
        </Link>
        <button
          type="button"
          onClick={() => scriviProgresso(null)}
          className="rounded-lg p-1.5 text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-ink"
          aria-label="Esci dalla guida"
          data-testid="button-esci-guida"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
