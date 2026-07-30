"use client";

// Modal dei Termini del servizio mostrato in fase di iscrizione.
//
// Perché un modal e non una nuova finestra: l'utente non perde i dati già
// digitati nel form, funziona bene su mobile e non viene bloccato dai popup
// blocker. Per chi preferisce leggere con calma o stampare c'è comunque il
// link "apri in una nuova scheda".
//
// Usiamo l'elemento nativo <dialog>: gestisce focus trap, ESC e backdrop, e
// showModal() blocca lo scroll della pagina sottostante.
//
// NOTA sul layout: il <dialog> ha display:none quando chiuso, quindi NON gli
// applichiamo classi flex (le varianti condizionali su display sono fragili).
// L'impaginazione a tre fasce (header / corpo scrollabile / footer) vive in un
// div interno con altezza massima propria: soluzione a prova di bomba.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, FileText } from "lucide-react";
import {
  TermsContent,
  TERMS_UPDATED,
  type TermsAudience,
} from "@/components/TermsContent";

export function TermsDialog({
  open,
  audience,
  onClose,
  onAccept,
}: {
  open: boolean;
  /** Quale testo mostrare: cambia in base al ruolo scelto nel form. */
  audience: TermsAudience;
  /** Chiusura senza accettare (ESC, backdrop, "Chiudi", ×). */
  onClose: () => void;
  /** "Ho letto": chiude, sblocca e spunta il consenso. */
  onAccept: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Apriamo sempre dall'inizio del testo, non dove il focus atterra.
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
    if (!open && el.open) el.close();
  }, [open]);

  // ESC e chiusura nativa → normalizziamo su onClose.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  const isPro = audience === "professional";

  return (
    <dialog
      ref={ref}
      aria-labelledby="terms-dialog-title"
      className="m-0 h-full max-h-none w-full max-w-none rounded-none border-0 bg-white p-0 text-bob-ink backdrop:bg-black/50 sm:mx-auto sm:my-[4vh] sm:h-auto sm:max-h-[92vh] sm:w-[min(44rem,92vw)] sm:rounded-2xl"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      data-testid="terms-dialog"
    >
      {/* Tre fasce: header fisso, corpo scrollabile, footer fisso.
          Su mobile occupa tutto lo schermo (100dvh), su desktop max 92vh. */}
      <div className="flex h-[100dvh] flex-col sm:h-auto sm:max-h-[92vh]">
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="terms-dialog-title" className="text-lg font-bold sm:text-xl">
              Termini del servizio
            </h2>
            <p className="mt-1 text-xs text-bob-ink/55 sm:text-sm">
              {isPro ? "Versione per i professionisti" : "Versione per i clienti"}{" "}
              · aggiornati a {TERMS_UPDATED}
            </p>
            <Link
              href={isPro ? "/termini/professionisti" : "/termini"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-bob-indigo underline sm:text-sm"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Apri in una nuova scheda
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-mr-1 shrink-0 rounded-lg p-2 text-bob-ink/40 transition hover:bg-black/5 hover:text-bob-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Corpo scrollabile. Le classi [&_...] alzano la dimensione del testo
            rispetto alle pagine legali: dentro un modal serve più leggibilità. */}
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
          tabIndex={0}
        >
          <div className="space-y-7 [&_h2]:text-[17px] [&_h2]:leading-snug [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-bob-ink/80">
            <TermsContent audience={audience} />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-black/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-bob-ink/70 transition hover:bg-black/[0.04] sm:py-2.5"
          >
            Chiudi
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="btn-primary px-5 py-3 text-sm sm:py-2.5"
            data-testid="terms-dialog-read"
          >
            Ho letto e accetto
          </button>
        </div>
      </div>
    </dialog>
  );
}
