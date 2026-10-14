"use client";

import { useEffect, useState } from "react";
import { ModuloRecensione, type ProRecensibile } from "@/components/ModuloRecensione";

// Dialog per lasciare una recensione su un lavoro concluso. Il modulo vive in
// ModuloRecensione (15/10), lo stesso che la pagina della richiesta mostra in
// linea.
// La policy RLS lato DB garantisce che solo il cliente della richiesta
// (con stato "closed") possa recensire un professionista contattato,
// una sola volta per richiesta.
export function ReviewDialog({
  requestId,
  professionals,
  onClose,
  onSubmitted,
}: {
  requestId: string;
  professionals: ProRecensibile[];
  onClose: () => void;
  onSubmitted: (professionalId: string) => void;
}) {
  const [done, setDone] = useState(false);

  // Esc per chiudere + blocco dello scroll di pagina (stesso pattern degli altri dialog)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Lascia una recensione"
      >
        {done ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
              ✓
            </div>
            <h2 className="text-lg font-bold text-bob-ink">
              Grazie per la recensione!
            </h2>
            <p className="mt-1 text-sm text-bob-ink/70">
              La tua valutazione aiuta gli altri clienti a scegliere e premia il
              lavoro ben fatto.
            </p>
            <button
              onClick={onClose}
              className="btn-primary mt-5 w-full py-2.5"
              data-testid="button-review-close"
            >
              Chiudi
            </button>
          </div>
        ) : (
          <ModuloRecensione
            requestId={requestId}
            professionals={professionals}
            onAnnulla={onClose}
            onSubmitted={(proId) => {
              setDone(true);
              onSubmitted(proId);
            }}
          />
        )}
      </div>
    </div>
  );
}
