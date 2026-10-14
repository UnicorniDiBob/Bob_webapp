"use client";

// IL MODULO DELLA RECENSIONE, DENTRO IL DIALOG O DENTRO LA PAGINA (15/10).
//
// Era tutto in ReviewDialog. La pagina della richiesta lo mostra in linea,
// sotto «Com'è andata?», senza aprire niente: chi ha appena detto «sì, e'
// concluso» trova le stelle allo stesso posto. Il modulo e' uno solo, cosi'
// l'inserimento e le sue regole restano una: la policy RLS lato DB garantisce
// che solo il cliente della richiesta (con stato "closed") possa recensire un
// professionista contattato, una sola volta per richiesta.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export interface ProRecensibile {
  id: string;
  name: string;
}

export function ModuloRecensione({
  requestId,
  professionals,
  onSubmitted,
  onAnnulla,
  inPagina = false,
}: {
  requestId: string;
  professionals: ProRecensibile[];
  onSubmitted: (professionalId: string) => void;
  /** Il tasto «Annulla» c'e' solo se c'e' qualcosa da chiudere (il dialog). */
  onAnnulla?: () => void;
  /** In pagina: niente titolo proprio (lo da' la sezione) e tocchi da 44px. */
  inPagina?: boolean;
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

    setSaving(false);
    onSubmitted(proId);
  }

  const proName =
    professionals.find((p) => p.id === proId)?.name ?? "il professionista";

  return (
    <>
      {!inPagina && (
        <>
          <h2 className="text-lg font-bold text-bob-ink">
            Com&apos;è andato il lavoro?
          </h2>
          <p className="mt-0.5 text-sm text-bob-ink/70">
            La recensione sarà pubblica sul profilo del professionista.
          </p>
        </>
      )}
      {inPagina && (
        <p className="text-sm text-bob-ink/70">
          La recensione sarà pubblica sul profilo del professionista.
        </p>
      )}

      {professionals.length > 1 && (
        <div className="mt-4">
          <span className="label-bob">Chi vuoi recensire?</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {professionals.map((p) => (
              <button
                key={p.id}
                onClick={() => setProId(p.id)}
                className={`chip ${inPagina ? "min-h-[44px]" : ""} ${
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
              className={`p-0.5 text-3xl leading-none transition-transform hover:scale-110 ${
                inPagina ? "flex h-11 w-11 items-center justify-center" : ""
              }`}
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
        {onAnnulla && (
          <button
            onClick={onAnnulla}
            className="btn-secondary flex-1 py-2.5"
            data-testid="button-review-cancel"
          >
            Annulla
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving || !proId || score < 1}
          className={`btn-primary py-2.5 disabled:cursor-not-allowed disabled:opacity-50 ${
            inPagina ? "min-h-[44px] w-full sm:w-auto sm:px-6" : "flex-1"
          }`}
          data-testid="button-review-submit"
        >
          {saving ? "Invio…" : "Pubblica recensione"}
        </button>
      </div>
    </>
  );
}
