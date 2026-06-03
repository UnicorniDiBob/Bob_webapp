"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import type { ProfessionalCard } from "@/lib/supabase/types";
import type { Severity } from "@/lib/bob";

interface QuoteContext {
  citySlug?: string;
  cityName?: string;
  serviceSlug?: string;
  serviceName?: string;
  problem?: string;
  urgency?: Severity;
}

// Dialog per chiedere un preventivo a PIÙ professionisti selezionati.
// Crea una sola richiesta e la collega a tutti i pro scelti.
export function QuoteDialog({
  professionals,
  context,
  onClose,
}: {
  professionals: ProfessionalCard[];
  context: QuoteContext;
  onClose: () => void;
}) {
  const { user, loading } = useAuth();
  const supabase = createClient();

  const defaultMsg = `Ciao, ho bisogno di un ${
    context.serviceName?.toLowerCase() ?? "intervento"
  } a ${context.cityName ?? "Milano"}.${
    context.problem ? ` ${context.problem}.` : ""
  } Vorrei un preventivo: puoi farmi sapere prezzo e disponibilità? Grazie.`;

  const [message, setMessage] = useState(defaultMsg);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function resolveId(
    table: "cities" | "services",
    slug?: string
  ): Promise<string | null> {
    if (!slug) return null;
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    return (data?.id as string) ?? null;
  }

  async function submit() {
    if (!user || professionals.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const [cityId, serviceId] = await Promise.all([
        resolveId("cities", context.citySlug ?? professionals[0].city.slug),
        resolveId(
          "services",
          context.serviceSlug ?? professionals[0].serviceSlug ?? undefined
        ),
      ]);

      if (!cityId || !serviceId) {
        setError(
          "Mi mancano città o servizio per registrare la richiesta. Riprova dalla chat di Bob."
        );
        setSubmitting(false);
        return;
      }

      // Una sola richiesta di preventivo (status 'quote_request'), nessun budget.
      const { data: req, error: reqErr } = await supabase
        .from("requests")
        .insert({
          customer_id: user.id,
          city_id: cityId,
          service_id: serviceId,
          status: "quote_request",
          problem_description: context.problem ?? message,
          urgency: context.urgency ?? null,
          budget_min: null,
          budget_max: null,
        })
        .select("id")
        .single();

      if (reqErr || !req) throw reqErr ?? new Error("Richiesta non creata");

      // Collega tutti i professionisti selezionati + messaggio iniziale per ciascuno.
      const links = professionals.map((p) => ({
        request_id: req.id,
        professional_id: p.id,
        status: "quote_requested",
      }));
      const msgs = professionals.map((p) => ({
        request_id: req.id,
        sender_type: "customer",
        sender_id: user.id,
        message: `${message} (richiesta a ${p.fullName})`,
      }));

      const [linkRes, msgRes] = await Promise.all([
        supabase.from("request_professionals").insert(links),
        supabase.from("request_messages").insert(msgs),
      ]);
      if (linkRes.error) throw linkRes.error;
      if (msgRes.error) throw msgRes.error;

      setDone(true);
    } catch {
      setError("Qualcosa è andato storto nell'invio. Riprova tra poco.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bob-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-t-2xl bg-white p-5 shadow-card-hover sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="quote-dialog"
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
              ✅
            </div>
            <h3 className="text-lg font-semibold text-bob-ink">
              Preventivi richiesti a {professionals.length}{" "}
              {professionals.length === 1
                ? "professionista"
                : "professionisti"}
            </h3>
            <p className="text-sm text-bob-ink/60">
              Trovi tutte le risposte nella tua area personale: ti avviso appena
              arrivano i preventivi, così confronti i prezzi con calma.
            </p>
            <div className="mt-2 flex w-full gap-2">
              <Link href="/dashboard" className="btn-secondary flex-1 py-2.5">
                Vai all&apos;area personale
              </Link>
              <button onClick={onClose} className="btn-primary flex-1 py-2.5">
                Chiudi
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-bob-ink">
                  Chiedi un preventivo
                </h3>
                <p className="text-sm text-bob-ink/60">
                  Invio la stessa richiesta a{" "}
                  {professionals.length === 1
                    ? "questo professionista"
                    : `questi ${professionals.length} professionisti`}
                  . Puoi modificare il messaggio.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-bob-ink/50 hover:bg-black/5"
                aria-label="Chiudi"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* elenco professionisti destinatari */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {professionals.map((p) => (
                <span
                  key={p.id}
                  className="chip bg-bob-indigo-50 text-bob-indigo"
                >
                  {p.fullName}
                </span>
              ))}
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-bob-ink/50">Carico…</p>
            ) : !user ? (
              <div className="rounded-xl bg-bob-indigo-50 p-4 text-center">
                <p className="text-sm text-bob-ink/70">
                  Accedi per inviare le richieste di preventivo e seguire le
                  risposte.
                </p>
                <Link
                  href="/login"
                  className="btn-primary mt-3 w-full py-2.5"
                  data-testid="link-login-quote"
                >
                  Accedi o registrati
                </Link>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="input-bob resize-none"
                  data-testid="textarea-quote-message"
                />
                {error && (
                  <p
                    className="mt-2 text-sm text-red-600"
                    data-testid="text-quote-error"
                  >
                    {error}
                  </p>
                )}
                <button
                  onClick={submit}
                  disabled={submitting || message.trim().length < 5}
                  className="btn-primary mt-3 w-full py-3"
                  data-testid="button-submit-quotes"
                >
                  {submitting
                    ? "Invio…"
                    : `Invia richiesta a ${professionals.length} ${
                        professionals.length === 1 ? "pro" : "pro"
                      }`}
                </button>
                <p className="mt-2 text-center text-xs text-bob-ink/45">
                  Chiedere preventivi è gratis. La fee si applica solo a lavoro
                  concluso.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
