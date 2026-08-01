"use client";

// Azioni sulla coda di verifica P.IVA (blocco 10, §5.3).
//
// Tre decisioni, tutte umane e tutte tracciate. La motivazione è obbligatoria
// per "chiedi documenti" e "rifiuta" perché la legge il professionista: la
// vede nel suo profilo e la riceve per email (Reg. UE 2019/1150, art. 4).
// Il rifiuto chiede una conferma esplicita: azzera il livello, non è un
// bottone da premere per sbaglio mentre si scorre la lista.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "grant" | "request_docs" | "reject";

const MIN_NOTE_LENGTH = 15;

export function VatReviewActions({
  proId,
  proName,
  hasLevel = false,
}: {
  proId: string;
  proName: string;
  /** Il professionista ha già un livello attivo: qui l'azione utile è la revoca. */
  hasLevel?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(action: Action) {
    if (pending) return;
    if (action !== "grant" && note.trim().length < MIN_NOTE_LENGTH) {
      setError(
        `Scrivi la motivazione (almeno ${MIN_NOTE_LENGTH} caratteri): la legge ${proName}.`
      );
      return;
    }
    if (action === "reject") {
      const ok = window.confirm(
        hasLevel
          ? `Revocare il livello di ${proName}? Torna a "Iscritto", il badge sparisce dal profilo pubblico e la motivazione gli viene mostrata.`
          : `Respingere la richiesta di ${proName}? Il livello resta "Iscritto" e la motivazione gli viene mostrata.`
      );
      if (!ok) return;
    }

    setPending(action);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/admin/verifiche/${proId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        emailSent?: boolean;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Non sono riuscito a salvare la decisione.");
        return;
      }
      setDone(
        `${json.message ?? "Fatto."}${
          json.emailSent ? " Email inviata." : " (Email non inviata: Resend non è attivo.)"
        }`
      );
      setNote("");
      router.refresh();
    } catch {
      setError("Non sono riuscito a contattare il server. Riprova.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 border-t border-black/5 pt-3">
      <label className="label-bob" htmlFor={`note-${proId}`}>
        Motivazione (la legge il professionista)
      </label>
      <textarea
        id={`note-${proId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Es. la partita IVA risulta cessata dal 2024: se non è corretto, mandaci la visura camerale aggiornata."
        className="input-bob mt-1 resize-none text-sm"
        data-testid={`vat-review-note-${proId}`}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {!hasLevel && (
          <button
            type="button"
            onClick={() => run("grant")}
            disabled={pending !== null}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
            data-testid={`vat-grant-${proId}`}
          >
            {pending === "grant" ? "…" : "✓ Concedi Pro"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("request_docs")}
          disabled={pending !== null}
          className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
          data-testid={`vat-docs-${proId}`}
        >
          {pending === "request_docs" ? "…" : "Chiedi documenti"}
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={pending !== null}
          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
          data-testid={`vat-reject-${proId}`}
        >
          {pending === "reject" ? "…" : hasLevel ? "✕ Revoca livello" : "✕ Rifiuta"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600" data-testid={`vat-review-error-${proId}`}>
          {error}
        </p>
      )}
      {done && (
        <p className="mt-2 text-xs text-emerald-700" data-testid={`vat-review-done-${proId}`}>
          {done}
        </p>
      )}
    </div>
  );
}
