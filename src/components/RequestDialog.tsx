"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { notifyEvent } from "@/lib/notify";
import { CircleCheck } from "lucide-react";
import type { ProfessionalCard } from "@/lib/supabase/types";

interface RequestContext {
  citySlug?: string;
  serviceSlug?: string;
  problem?: string;
  urgency?: "bassa" | "media" | "alta";
  budgetMin?: number | null;
  budgetMax?: number | null;
  // brief di Bob da agganciare alla richiesta (022)
  briefId?: string | null;
}

export function RequestDialog({
  professional,
  prefilledMessage,
  context,
  onClose,
}: {
  professional: ProfessionalCard;
  prefilledMessage: string;
  context: RequestContext;
  onClose: () => void;
}) {
  const { user, loading } = useAuth();
  const supabase = createClient();
  // Path corrente per il ritorno post-login (il draft chat è in localStorage).
  const pathname = usePathname();
  const [message, setMessage] = useState(
    prefilledMessage ||
      `Ciao ${professional.fullName}, ho bisogno ${
        professional.serviceNeedPhrase ?? "di un intervento"
      } a ${professional.city.name}. Sei disponibile?`
  );
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
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      // Risolvi gli ID di città e servizio (obbligatori nella tabella requests).
      const [cityId, serviceId] = await Promise.all([
        resolveId("cities", context.citySlug ?? professional.city.slug),
        resolveId("services", context.serviceSlug ?? professional.serviceSlug ?? undefined),
      ]);

      if (!cityId || !serviceId) {
        setError(
          "Mi mancano città o servizio per registrare la richiesta. Riprova dalla chat di Bob."
        );
        setSubmitting(false);
        return;
      }

      const { data: req, error: reqErr } = await supabase
        .from("requests")
        .insert({
          customer_id: user.id,
          city_id: cityId,
          service_id: serviceId,
          status: "sent",
          problem_description: context.problem ?? message,
          urgency: context.urgency ?? null,
          budget_min: context.budgetMin ?? null,
          budget_max: context.budgetMax ?? null,
          brief_id: context.briefId ?? null,
        })
        .select("id")
        .single();

      if (reqErr || !req) throw reqErr ?? new Error("Richiesta non creata");

      // Collega il professionista e salva il messaggio iniziale.
      await Promise.all([
        supabase.from("request_professionals").insert({
          request_id: req.id,
          professional_id: professional.id,
          status: "contacted",
        }),
        supabase.from("request_messages").insert({
          request_id: req.id,
          professional_id: professional.id,
          sender_type: "customer",
          sender_id: user.id,
          message,
        }),
      ]);

      notifyEvent("new_request", {
        requestId: req.id,
        professionalId: professional.id,
        preview: message,
      });
      setDone(true);
    } catch {
      setError(
        "Qualcosa è andato storto nell'invio. Riprova tra poco."
      );
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
        data-testid="request-dialog"
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CircleCheck className="h-8 w-8 text-emerald-600" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-bob-ink">
              Messaggio inviato a {professional.fullName}
            </h3>
            <p className="text-sm text-bob-ink/60">
              Trovi la richiesta nella tua area personale. Ti avviso appena
              risponde.
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
                  Scrivi a {professional.fullName}
                </h3>
                <p className="text-sm text-bob-ink/60">
                  Ho già preparato io il messaggio: puoi modificarlo.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-bob-ink/50 hover:bg-black/5"
                aria-label="Chiudi"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-bob-ink/50">Carico…</p>
            ) : !user ? (
              <div className="rounded-xl bg-bob-indigo-50 p-4 text-center">
                <p className="text-sm text-bob-ink/70">
                  Accedi per inviare il messaggio e seguire la conversazione con{" "}
                  {professional.fullName}.
                </p>
                <Link
                  href={`/login?returnTo=${encodeURIComponent(pathname)}`}
                  className="btn-primary mt-3 w-full py-2.5"
                  data-testid="link-login-dialog"
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
                  data-testid="textarea-message"
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600" data-testid="text-error">
                    {error}
                  </p>
                )}
                <button
                  onClick={submit}
                  disabled={submitting || message.trim().length < 5}
                  className="btn-primary mt-3 w-full py-3"
                  data-testid="button-submit-request"
                >
                  {submitting ? "Invio…" : "Invia messaggio"}
                </button>
                <p className="mt-2 text-center text-xs text-bob-ink/45">
                  Usare Bob è gratis. La fee si applica solo a lavoro concluso.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
