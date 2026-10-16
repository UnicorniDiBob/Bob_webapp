"use client";

// IL MENU DI UNA CONVERSAZIONE (15/10). Le stesse azioni dello scorrimento,
// per chi usa mouse e tastiera: si apre dal «⋯» della riga, dal tasto destro
// e dal «⋯» dell'intestazione della chat. Frecce su e giu', Invio, Esc; alla
// chiusura il fuoco torna a chi l'ha aperto.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface VoceMenu {
  etichetta: string;
  azione: () => void;
  testid?: string;
}

export function MenuConversazione({
  voci,
  punto,
  onChiudi,
  etichetta = "Azioni sulla conversazione",
}: {
  voci: VoceMenu[];
  /** Dove aprirlo, in coordinate dello schermo. */
  punto: { x: number; y: number };
  /** Chiamata alla chiusura: chi l'ha aperto si riprende il fuoco. */
  onChiudi: () => void;
  etichetta?: string;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(punto);

  // Dentro lo schermo, anche aperto vicino al bordo.
  useLayoutEffect(() => {
    const m = menu.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(punto.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(punto.y, window.innerHeight - r.height - 8)),
    });
  }, [punto]);

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fuori = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) onChiudi();
    };
    document.addEventListener("pointerdown", fuori, true);
    return () => document.removeEventListener("pointerdown", fuori, true);
  }, [onChiudi]);

  function tasto(e: React.KeyboardEvent) {
    const voce = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = voce.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onChiudi();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      voce[(i + 1) % voce.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      voce[(i - 1 + voce.length) % voce.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      voce[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      voce[voce.length - 1]?.focus();
    }
  }

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={etichetta}
      onKeyDown={tasto}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 min-w-[14rem] overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-card"
      data-testid="menu-conversazione"
    >
      {voci.map((v) => (
        <button
          key={v.etichetta}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => {
            onChiudi();
            v.azione();
          }}
          className="flex min-h-[44px] w-full items-center px-4 text-left text-sm text-bob-ink hover:bg-bob-indigo-50 focus:bg-bob-indigo-50 focus:outline-none"
          data-testid={v.testid}
        >
          {v.etichetta}
        </button>
      ))}
    </div>
  );
}
