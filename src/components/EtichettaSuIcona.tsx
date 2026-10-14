"use client";

// L'ETICHETTA SOPRA UN TASTO FATTO SOLO DI ICONA (14/10).
//
// Avvolge un bottone o un LinkChat senza toccarlo: il nome per i lettori di
// schermo resta il suo aria-label, questa e' solo la scritta per chi guarda.
// Compare:
//   - col mouse, se il puntatore resta fermo sull'icona mezzo secondo;
//   - col dito (o la penna), tenendo premuto mezzo secondo. Quel tocco NON
//     fa partire l'azione: chi tiene premuto vuole sapere cosa fa il tasto,
//     non farlo. Il clic si ferma qui, in cattura, prima del figlio. Sparisce
//     un secondo e mezzo dopo che si alza il dito;
//   - da tastiera, quando il fuoco arriva col Tab (:focus-visible). Il clic
//     del mouse da' il fuoco anche lui, e li' l'etichetta non deve saltare
//     fuori subito.

import { useEffect, useRef, useState } from "react";

/** Il tasto rotondo di 44px: l'area di tocco minima, anche a 390px. */
export const TASTO_ICONA =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40";

const ATTESA_MS = 500;
const DOPO_IL_DITO_MS = 1500;

export function EtichettaSuIcona({
  etichetta,
  children,
}: {
  /** La stessa scritta dell'aria-label del tasto. */
  etichetta: string;
  children: React.ReactNode;
}) {
  const [visibile, setVisibile] = useState(false);
  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chiusura = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Il tocco lungo e' diventato etichetta: il clic che segue va ingoiato.
  const tenuto = useRef(false);
  // L'ultimo puntatore: il menu del tasto destro col mouse resta del browser.
  const dito = useRef(false);

  function ferma() {
    if (attesa.current) clearTimeout(attesa.current);
    if (chiusura.current) clearTimeout(chiusura.current);
    attesa.current = null;
    chiusura.current = null;
  }

  useEffect(() => ferma, []);

  function mostraTra(ms: number, poi?: () => void) {
    ferma();
    attesa.current = setTimeout(() => {
      setVisibile(true);
      poi?.();
    }, ms);
  }

  function nascondi() {
    ferma();
    setVisibile(false);
  }

  /** Dopo un tocco lungo: l'etichetta resta un attimo, poi tutto si azzera. */
  function chiudiDopoIlDito() {
    ferma();
    chiusura.current = setTimeout(() => {
      setVisibile(false);
      tenuto.current = false;
    }, DOPO_IL_DITO_MS);
  }

  return (
    <span
      className="relative inline-flex select-none [-webkit-touch-callout:none]"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") mostraTra(ATTESA_MS);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") nascondi();
      }}
      onPointerDown={(e) => {
        dito.current = e.pointerType !== "mouse";
        tenuto.current = false;
        if (dito.current) {
          mostraTra(ATTESA_MS, () => {
            tenuto.current = true;
          });
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "mouse") return;
        if (attesa.current) clearTimeout(attesa.current);
        attesa.current = null;
        if (tenuto.current) chiudiDopoIlDito();
      }}
      onPointerCancel={(e) => {
        if (e.pointerType === "mouse") return;
        // Il dito e' diventato uno scorrimento della pagina. Se l'etichetta
        // era gia' fuori (14/10), pointerup non arriva piu': senza questa
        // chiusura restava appesa, e tenuto restava vero.
        if (tenuto.current) chiudiDopoIlDito();
        else nascondi();
      }}
      onClickCapture={(e) => {
        if (!tenuto.current) return;
        e.preventDefault();
        e.stopPropagation();
        tenuto.current = false;
      }}
      onContextMenu={(e) => {
        // Android apre il suo menu sul tocco lungo: qui il tocco lungo e'
        // l'etichetta.
        if (dito.current) e.preventDefault();
      }}
      onFocus={(e) => {
        let daTastiera = false;
        try {
          daTastiera = e.target.matches(":focus-visible");
        } catch {
          // Browser senza :focus-visible: niente etichetta, il nome c'e' gia'.
        }
        if (daTastiera) {
          ferma();
          setVisibile(true);
        }
      }}
      onBlur={nascondi}
      onKeyDown={(e) => {
        tenuto.current = false;
        if (e.key === "Escape") nascondi();
      }}
    >
      {children}
      {visibile && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-bob-ink px-2 py-1 text-2xs font-medium text-white shadow-md"
        >
          {etichetta}
        </span>
      )}
    </span>
  );
}
