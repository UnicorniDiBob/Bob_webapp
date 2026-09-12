"use client";

import { useEffect, useState } from "react";
import { Bob } from "./Bob";

/**
 * Bob che saluta mentre la pagina scorre.
 *
 * Il braccio non fa un'animazione a ciclo fisso: oscilla in funzione di QUANTO
 * hai scorso. Se stai fermo, lui sta fermo con la mano alzata; appena scorri,
 * saluta. È la differenza fra un pupazzo che si agita da solo e un personaggio
 * che reagisce a te — e costa uguale.
 *
 * PERCHE' requestAnimationFrame. L'evento di scorrimento arriva decine di volte
 * al secondo e ridisegnare a ogni evento fa perdere fotogrammi. Con rAF si
 * aggiorna una volta per fotogramma disegnato, che è il massimo che serve.
 *
 * CHI HA CHIESTO MENO MOVIMENTO non riceve niente: il braccio resta alzato e
 * fermo. Il controllo è qui e non solo nel CSS perché qui l'animazione è un
 * calcolo in JavaScript, e il CSS non potrebbe spegnerlo.
 */
export function BobCheSaluta({ className = "" }: { className?: string }) {
  const [gradi, setGradi] = useState(-135);

  useEffect(() => {
    const menoMovimento =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (menoMovimento) return;

    let inCoda = false;

    function aggiorna() {
      inCoda = false;
      // 70px di scorrimento per un quarto di oscillazione: a 40 il braccio
      // sbatteva. Alzare il divisore rallenta il saluto senza toccare
      // l'ampiezza, che resta 18 gradi — visibile ma non un tergicristallo.
      const oscillazione = Math.sin(window.scrollY / 70) * 18;
      setGradi(-135 + oscillazione);
    }

    function alloScorrimento() {
      if (inCoda) return;
      inCoda = true;
      requestAnimationFrame(aggiorna);
    }

    window.addEventListener("scroll", alloScorrimento, { passive: true });
    return () => window.removeEventListener("scroll", alloScorrimento);
  }, []);

  return (
    <Bob
      posa="saluta"
      gradiBraccioDestro={gradi}
      alt="Bob, il concierge dei servizi, ti saluta"
      className={className}
    />
  );
}
