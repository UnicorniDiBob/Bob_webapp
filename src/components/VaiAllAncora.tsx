"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * VaiAllAncora — fa funzionare i link con l'ancora anche a freddo.
 *
 * IL PROBLEMA, misurato dal vivo il 10/09/2026 su www.meetonda.com: aprire
 * `/come-funziona#ordine` da un link incollato, da un segnalibro o da un
 * risultato di ricerca lascia la pagina in cima — `scrollY` a 0, con la
 * sezione 904px sotto la piega. Cliccare lo stesso link DENTRO il sito invece
 * funziona. La ragione e' l'App Router: quando il browser cerca l'elemento
 * dell'hash, il contenuto non e' ancora nel DOM, e il browser non riprova.
 *
 * Riguarda 13 link su 7 file, non uno: gli undici «Parla con Bob» che puntano
 * a `/#bob`, `/come-funziona#ordine` (la sezione sull'ordinamento, che l'art.
 * 22 co. 4-bis vuole «facilmente accessibile») e `#come-funziona` sulla pagina
 * dei professionisti.
 *
 * COME: al montaggio, e a ogni cambio di percorso, se c'e' un hash e il suo
 * bersaglio esiste, lo si porta in vista. Due dettagli che non sono dettagli:
 *
 * - si prova piu' volte a distanza di poco. Il bersaglio puo' comparire dopo,
 *   perche' sopra di lui c'e' roba che si monta da sola (la fascia del fermo,
 *   la finestra degli avvisi) e che sposta il punto giusto mentre scorriamo.
 * - si smette al primo tocco dell'utente. Se ha gia' iniziato a scorrere lui,
 *   portarlo altrove e' peggio del difetto che stiamo sistemando.
 *
 * `scroll-mt-*` sui bersagli continua a decidere l'offset: `scrollIntoView`
 * lo rispetta, quindi la sezione resta sotto l'header come col clic.
 */
export function VaiAllAncora() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length < 2) return;

    // L'hash arriva dalla URL: e' testo di chi apre la pagina, non nostro.
    // `CSS.escape` evita che un hash strano diventi un selettore invalido.
    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;

    let annullato = false;
    const smetti = () => {
      annullato = true;
    };
    // Se l'utente scorre o tocca, ha vinto lui.
    window.addEventListener("wheel", smetti, { passive: true, once: true });
    window.addEventListener("touchstart", smetti, { passive: true, once: true });
    window.addEventListener("keydown", smetti, { once: true });

    const tentativi = [0, 120, 360, 800];
    const timer = tentativi.map((ritardo) =>
      window.setTimeout(() => {
        if (annullato) return;
        const bersaglio =
          document.getElementById(id) ??
          document.querySelector(`[name="${CSS.escape(id)}"]`);
        if (!bersaglio) return;
        bersaglio.scrollIntoView({ block: "start" });
      }, ritardo)
    );

    return () => {
      timer.forEach(window.clearTimeout);
      window.removeEventListener("wheel", smetti);
      window.removeEventListener("touchstart", smetti);
      window.removeEventListener("keydown", smetti);
    };
  }, [pathname]);

  return null;
}
