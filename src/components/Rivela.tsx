"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Rivela un blocco quando entra nello schermo.
 *
 * IL CONTENUTO NASCE VISIBILE, ed e' la cosa importante. Lo stato iniziale non
 * mette nessuna classe: il server manda HTML leggibile, e se il JavaScript non
 * parte — o se l'osservatore non arriva mai perche' il browser e' vecchio — la
 * pagina si legge lo stesso. L'alternativa comune (opacity:0 nel CSS e una
 * classe aggiunta dal JS) lascia la pagina bianca quando qualcosa va storto.
 *
 * NIENTE LAMPEGGIO. Al primo passaggio dell'effetto, chi e' gia' nella prima
 * schermata passa dritto a "visibile" e non viene mai nascosto. Chi sta sotto
 * la piega viene messo in posizione di partenza mentre e' fuori vista, quindi
 * nessuno lo vede sparire.
 *
 * L'ANIMAZIONE VERA sta in globals.css, e chi ha chiesto meno movimento nelle
 * impostazioni del sistema non la riceve affatto.
 */
export function Rivela({
  children,
  ritardo = 0,
  className = "",
}: {
  children: ReactNode;
  /** Millisecondi di ritardo, per far entrare in fila gli elementi di una riga. */
  ritardo?: number;
  className?: string;
}) {
  const rif = useRef<HTMLDivElement>(null);
  const [stato, setStato] = useState<"iniziale" | "nascosto" | "visibile">(
    "iniziale",
  );

  useEffect(() => {
    const elemento = rif.current;
    if (!elemento || typeof IntersectionObserver === "undefined") {
      setStato("visibile");
      return;
    }

    // Gia' in vista: si mostra subito, senza aspettare uno scorrimento che
    // potrebbe non arrivare mai (chi apre la home e legge senza scorrere).
    if (elemento.getBoundingClientRect().top < window.innerHeight * 0.9) {
      setStato("visibile");
      return;
    }

    setStato("nascosto");
    const osservatore = new IntersectionObserver(
      (voci) => {
        for (const voce of voci) {
          if (voce.isIntersecting) {
            setStato("visibile");
            osservatore.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    osservatore.observe(elemento);
    return () => osservatore.disconnect();
  }, []);

  const classeStato =
    stato === "nascosto"
      ? "rivela-nascosto"
      : stato === "visibile"
        ? "rivela-visibile"
        : "";

  return (
    <div
      ref={rif}
      className={`${classeStato} ${className}`.trim()}
      style={ritardo ? { transitionDelay: `${ritardo}ms` } : undefined}
    >
      {children}
    </div>
  );
}
