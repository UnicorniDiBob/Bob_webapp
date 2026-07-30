"use client";

// Modal dei Termini del servizio mostrato in fase di iscrizione.
//
// Perché un modal e non una nuova finestra: l'utente non perde i dati già
// digitati nel form, funziona bene su mobile (dove una nuova tab è scomoda) e
// non viene bloccato dai popup blocker. Per chi preferisce leggere con calma o
// stampare c'è comunque il link "apri in una nuova scheda".
//
// Usiamo l'elemento nativo <dialog>: gestisce da sé il focus trap, la chiusura
// con ESC e il backdrop, quindi è più accessibile e più robusto di un div
// custom. showModal() blocca anche lo scroll della pagina sottostante.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { TermsContent, TERMS_UPDATED } from "@/components/TermsContent";

export function TermsDialog({
  open,
  onClose,
  onAccept,
}: {
  open: boolean;
  /** Chiusura senza accettare (ESC, backdrop, "Chiudi"). */
  onClose: () => void;
  /** L'utente ha premuto "Ho letto": chiudiamo e sblocchiamo il consenso. */
  onAccept: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // ESC e click sul backdrop emettono "cancel"/"close": li normalizziamo su onClose.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="terms-dialog-title"
      className="w-[min(46rem,92vw)] max-w-none rounded-2xl p-0 backdrop:bg-black/40 open:flex open:max-h-[85vh] open:flex-col"
      onClick={(e) => {
        // Click sul backdrop (fuori dal contenuto) → chiudi.
        if (e.target === ref.current) onClose();
      }}
      data-testid="terms-dialog"
    >
      <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-4">
        <div>
          <h2
            id="terms-dialog-title"
            className="text-lg font-bold text-bob-ink"
          >
            Termini del servizio
          </h2>
          <p className="mt-0.5 text-xs text-bob-ink/50">
            Ultimo aggiornamento: {TERMS_UPDATED} ·{" "}
            <Link
              href="/termini"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-bob-indigo"
            >
              apri in una nuova scheda
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-ink"
        >
          ×
        </button>
      </div>

      {/* Corpo scrollabile: il testo completo, identico alla pagina /termini. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-6">
          <TermsContent />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-black/10 px-6 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-bob-ink/70 transition hover:bg-black/[0.04]"
        >
          Chiudi
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="btn-primary px-5 py-2.5 text-sm"
          data-testid="terms-dialog-read"
        >
          Ho letto i termini
        </button>
      </div>
    </dialog>
  );
}
