"use client";

// IL PANNELLO DELLA DIAGNOSI DELLA TASTIERA — TEMPORANEO (15/10).
// Compare solo su /messaggi?…&diagnosi=tastiera. Mostra numeri della
// finestra e della chat, nessun dato personale, e non manda niente: serve a
// fotografare cosa fa Safari su un iPhone vero. Va tolto con la correzione.

import { useEffect, useState } from "react";
import {
  accendiDiagnosiTastiera,
  ascoltaTastiera,
  segnaTastiera,
  vociTastiera,
  type VoceTastiera,
} from "@/lib/diagnosiTastiera";

function arrotonda(n: number | undefined | null): string {
  return n === undefined || n === null || Number.isNaN(n) ? "—" : String(Math.round(n));
}

function fotografa(alto: number, eIOS: boolean) {
  const vv = window.visualViewport;
  const cornice = document.querySelector<HTMLElement>('[data-testid="chat-cornice"]');
  const rc = cornice?.getBoundingClientRect();
  const sito = document.querySelector("header")?.getBoundingClientRect();
  const chat = document
    .querySelector('[data-testid="chat-intestazione"]')
    ?.getBoundingClientRect();
  return [
    `isIOS ${eIOS}`,
    `innerH ${arrotonda(window.innerHeight)}  clientH ${arrotonda(document.documentElement.clientHeight)}`,
    `vv.h ${arrotonda(vv?.height)}  vv.top ${arrotonda(vv?.offsetTop)}  vv.pageTop ${arrotonda(vv?.pageTop)}`,
    `scrollY ${arrotonda(window.scrollY)}`,
    `cornice ${cornice?.style.height ?? "—"}`,
    `  rect.top ${arrotonda(rc?.top)}  rect.h ${arrotonda(rc?.height)}  alto ${alto}`,
    `header sito top ${arrotonda(sito?.top)}  header chat top ${arrotonda(chat?.top)}`,
    `focus ${document.activeElement?.tagName.toLowerCase() ?? "—"}`,
  ];
}

export function DiagnosiTastiera({ alto, eIOS }: { alto: number; eIOS: boolean }) {
  const [righe, setRighe] = useState<string[]>([]);
  const [voci, setVoci] = useState<VoceTastiera[]>([]);
  // Su iOS un elemento fixed sta fermo rispetto alla parte di pagina
  // disposta, non a quella che si vede: quando Safari sposta la vista per la
  // tastiera, il pannello in alto finirebbe fuori schermo proprio nelle foto
  // che servono. Lo spostamento della vista lo tiene dentro.
  const [sopra, setSopra] = useState(4);

  useEffect(() => {
    const spegni = accendiDiagnosiTastiera();
    const aggiorna = () => {
      setSopra(Math.max(0, Math.round(window.visualViewport?.offsetTop ?? 0)) + 4);
      setRighe(fotografa(alto, eIOS));
      setVoci(vociTastiera());
    };
    const smetti = ascoltaTastiera(aggiorna);
    // Gli eventi a cui il codice della tastiera non reagisce li segna il
    // pannello. Quelli del visualViewport e il focusout li segna il codice,
    // con la sua decisione — tranne fuori da iOS, dove il codice non ascolta.
    const segna = (evento: string, decisione: string) => () => segnaTastiera(evento, decisione);
    const finestraResize = segna("window resize", "nessuna reazione");
    const finestraScroll = segna("window scroll", "nessuna reazione");
    const dentro = segna("focusin", "nessuna reazione");
    const rotazione = segna("orientationchange", "nessuna reazione");
    window.addEventListener("resize", finestraResize);
    window.addEventListener("scroll", finestraScroll, { passive: true });
    document.addEventListener("focusin", dentro);
    window.addEventListener("orientationchange", rotazione);
    const vv = window.visualViewport;
    const vvResize = segna("vv resize", "ignorato (non iOS)");
    const vvScroll = segna("vv scroll", "ignorato (non iOS)");
    const fuori = segna("focusout", "ignorato (non iOS)");
    if (!eIOS) {
      vv?.addEventListener("resize", vvResize);
      vv?.addEventListener("scroll", vvScroll);
      document.addEventListener("focusout", fuori);
    }
    // Anche senza eventi: certi cambi di Safari non ne mandano nessuno.
    const giro = setInterval(aggiorna, 250);
    aggiorna();
    return () => {
      clearInterval(giro);
      smetti();
      spegni();
      window.removeEventListener("resize", finestraResize);
      window.removeEventListener("scroll", finestraScroll);
      document.removeEventListener("focusin", dentro);
      window.removeEventListener("orientationchange", rotazione);
      vv?.removeEventListener("resize", vvResize);
      vv?.removeEventListener("scroll", vvScroll);
      document.removeEventListener("focusout", fuori);
    };
  }, [alto, eIOS]);

  return (
    <div
      aria-hidden="true"
      style={{ top: sopra }}
      className="pointer-events-none fixed right-1 z-[9999] max-w-[78vw] whitespace-pre-wrap break-words rounded bg-black/70 p-1.5 font-mono text-[9px] leading-tight text-white"
      data-testid="diagnosi-tastiera"
    >
      {righe.join("\n")}
      {"\n— ultimi eventi (ms) —\n"}
      {voci
        .map((v) => `${v.t} ${v.evento}${v.volte > 1 ? ` ×${v.volte}` : ""} → ${v.decisione}`)
        .join("\n")}
    </div>
  );
}
