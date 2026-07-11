"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

interface ReviewablePro {
  id: string;
  name: string;
}

// Dialog per lasciare una recensione su un lavoro concluso.
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
  professionals: ReviewablePro[];
  onClose: () => void;
  onSubmitted: (professionalId: string) => void;
}) {
  const supabase = createClient();
  const { user } = useAuth();

  const [proId, setProId] = useState<string>(
    professionals.length === 1 ? professionals[0].id : ""
  );
  const [score, setScore] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleSubmit() {
    if (!user || !proId || score < 1 || saving) return;
    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from("ratings").insert({
      professional_id: proId,
      customer_id: user.id,
      request_id: requestId,
      score,
      comment: comment.trim() || null,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        setError("Hai già recensito questo professionista per questa richiesta.");
      } else {
        setError(
          "Non sono riuscito a salvare la recensione. Riprova tra poco."
        );
      }
      setSaving(false);
      return;
    }

    setDone(true);
    setSaving(false);
    onSubmitted(proId);
  }

  const proName =
    professionals.find((p) => p.id === proId)?.name ?? "il professionista";

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
            <p className="mt-1 text-sm text-bob-ink/60">
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
          <>
            <h2 className="text-lg font-bold text-bob-ink">
              Com&apos;è andato il lavoro?
            </h2>
            <p className="mt-0.5 text-sm text-bob-ink/60">
              La recensione sarà pubblica sul profilo del professionista.
            </p>

            {professionals.length > 1 && (
              <div className="mt-4">
                <span className="label-bob">Chi vuoi recensire?</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {professionals.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProId(p.id)}
                      className={`chip ${
                        proId === p.id
                          ? "bg-bob-indigo text-white"
                          : "hover:bg-bob-indigo-100"
                      }`}
                      data-testid={`review-pro-${p.id}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <span className="label-bob">La tua valutazione</span>
              <div
                className="mt-1 flex gap-1"
                role="radiogroup"
                aria-label="Valutazione da 1 a 5 stelle"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    role="radio"
                    aria-checked={score === n}
                    aria-label={`${n} stell${n === 1 ? "a" : "e"}`}
                    className="p-0.5 text-3xl leading-none transition-transform hover:scale-110"
                    data-testid={`review-star-${n}`}
                  >
                    <span
                      className={
                        n <= (hover || score)
                          ? "text-bob-yellow"
                          : "text-black/15"
                      }
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="label-bob" htmlFor="review-comment">
                Racconta com&apos;è andata (facoltativo)
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={`Es. ${proName} è arrivato puntuale e ha risolto in un'ora…`}
                className="input-bob mt-1 resize-none"
                data-testid="review-comment"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                className="btn-secondary flex-1 py-2.5"
                data-testid="button-review-cancel"
              >
                Annulla
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !proId || score < 1}
                className="btn-primary flex-1 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="button-review-submit"
              >
                {saving ? "Invio…" : "Pubblica recensione"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
