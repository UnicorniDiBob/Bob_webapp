"use client";

// UNA DOMANDA PRIMA DI UN PASSO CHE TOCCA ALTRI (15/10, PR 7). «Scegli» e
// «Riapri» mandano un messaggio di Bob a un professionista: prima si chiede.
// Le finestre che c'erano (ReviewDialog, AppointmentDetail) chiudono con Esc
// ma lasciano scappare il Tab dietro la finestra: qui il fuoco resta dentro
// (Tab e Maiuscolo+Tab girano sui tasti), parte da «Annulla» — il tasto che
// non fa niente — e alla chiusura torna a chi l'ha aperta.

import { useEffect, useRef, type ReactNode } from "react";

export function FinestraConferma({
  titolo,
  children,
  conferma,
  inCorso = false,
  errore = null,
  onConferma,
  onAnnulla,
  testid,
}: {
  titolo: string;
  children: ReactNode;
  /** Il testo del tasto che fa: «Scegli», «Riapri». */
  conferma: string;
  inCorso?: boolean;
  errore?: string | null;
  onConferma: () => void;
  onAnnulla: () => void;
  testid?: string;
}) {
  const finestra = useRef<HTMLDivElement>(null);
  const annulla = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null;
    annulla.current?.focus();
    return () => prima?.focus?.();
  }, []);

  function tasto(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (!inCorso) onAnnulla();
      return;
    }
    if (e.key !== "Tab" || !finestra.current) return;
    const tasti = Array.from(
      finestra.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")
    );
    if (tasti.length === 0) return;
    const primo = tasti[0];
    const ultimo = tasti[tasti.length - 1];
    if (e.shiftKey && document.activeElement === primo) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primo.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !inCorso && onAnnulla()}
    >
      <div
        ref={finestra}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finestra-conferma-titolo"
        className="card w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={tasto}
        data-testid={testid}
      >
        <h3 id="finestra-conferma-titolo" className="text-lg font-bold text-bob-ink">
          {titolo}
        </h3>
        <div className="mt-2 text-sm text-bob-ink/70">{children}</div>
        {errore && (
          <p className="mt-3 text-sm text-red-700" role="alert" data-testid="finestra-errore">
            {errore}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            ref={annulla}
            type="button"
            onClick={onAnnulla}
            disabled={inCorso}
            className="btn-secondary min-h-[44px] flex-1 py-2.5"
            data-testid="finestra-annulla"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConferma}
            disabled={inCorso}
            className="btn-primary min-h-[44px] flex-1 py-2.5"
            data-testid="finestra-conferma"
          >
            {inCorso ? "Un momento…" : conferma}
          </button>
        </div>
      </div>
    </div>
  );
}
