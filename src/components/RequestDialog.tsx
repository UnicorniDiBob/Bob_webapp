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
  // (41.1) Via e civico: fuori dal testo libero, dentro request_addresses.
  // Il professionista lo legge solo dopo un appuntamento confermato (mig 044).
  address?: string | null;
  cityName?: string | null;
  // (045) Quartiere scelto dal cliente: volutamente grossolano, è la sola
  // informazione di posizione che i pro invitati vedono prima della scelta.
  zoneSlug?: string | null;
  // (046) ripiego del quartiere: cinque cifre, stessa grana
  postalCode?: string | null;
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
      `Ciao ${professional.displayName}, ho bisogno ${
        professional.serviceNeedPhrase ?? "di un intervento"
      } a ${professional.city.name}. Sei disponibile?`
  );
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Inviato, ma l'indirizzo non e' arrivato: va detto, non nascosto. */
  const [indirizzoPerso, setIndirizzoPerso] = useState(false);

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
    // Se la richiesta nasce ma il collegamento al professionista no, questa
    // riga resta senza destinatario: serve saperlo nel catch per declassarla.
    let idRichiesta: string | null = null;
    // L'indirizzo non blocca l'invio, ma se non e' stato salvato la conferma
    // deve dirlo, invece di lasciar credere che il pro ce l'abbia.
    let indirizzoNonSalvato = false;
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
          zone_slug: context.zoneSlug ?? null,
          postal_code: context.postalCode ?? null,
        })
        .select("id")
        .single();

      if (reqErr || !req) throw reqErr ?? new Error("Richiesta non creata");
      idRichiesta = req.id as string;

      // (41.1) L'indirizzo viaggia a parte, mai nella prosa. Se questo insert
      // fallisce la richiesta NON si annulla — il cliente ha comunque scritto
      // al professionista — ma non si tace: lo dice la schermata di conferma,
      // cosi' l'indirizzo si puo' ridare in chat.
      if (context.address) {
        const { error: addrErr } = await supabase
          .from("request_addresses")
          .insert({
            request_id: req.id,
            address_line: context.address.slice(0, 200),
            city_name: context.cityName ?? professional.city.name ?? null,
          });
        indirizzoNonSalvato = Boolean(addrErr);
      }

      // COLLEGAMENTO E MESSAGGIO: QUI L'ERRORE NON SI PUO' IGNORARE (05/09).
      // Il client di Supabase NON lancia quando una scrittura fallisce:
      // restituisce { error } e prosegue. Questi due insert non venivano
      // controllati, e subito dopo la finestra mostrava la spunta verde e «ti
      // avviso appena risponde». Risultato possibile: la riga in requests
      // c'era, nessun professionista collegato, nessun messaggio salvato, e il
      // pro non riceveva niente — mentre il cliente aspettava una risposta che
      // non poteva arrivare. Il gemello QuoteDialog controllava gia' entrambi:
      // due file che fanno la stessa cosa, uno giusto e uno no.
      const [linkRes, msgRes] = await Promise.all([
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
      if (linkRes.error) throw linkRes.error;
      if (msgRes.error) throw msgRes.error;

      notifyEvent("new_request", {
        requestId: req.id,
        professionalId: professional.id,
        preview: message,
      });
      setDone(true);
      setIndirizzoPerso(indirizzoNonSalvato);
    } catch {
      // La richiesta puo' essere nata e restare senza destinatario. Non c'e'
      // una policy di delete su requests per il cliente, ma c'e' quella di
      // update: la si riporta a "draft", cioe' allo stato di chi non ha ancora
      // inviato niente. Cosi' non compare fra i lavori in corso e non entra
      // nei conteggi delle interazioni. Se anche questo fallisce, pazienza:
      // l'importante e' non aver detto al cliente che era andata bene.
      if (idRichiesta) {
        await supabase
          .from("requests")
          .update({ status: "draft" })
          .eq("id", idRichiesta);
      }
      setError(
        "Non sono riuscito a consegnare il messaggio: non è stato inviato niente. Riprova tra poco."
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
              Messaggio inviato a {professional.displayName}
            </h3>
            <p className="text-sm text-bob-ink/60">
              Trovi la richiesta nella tua area personale. Ti avviso appena
              risponde.
            </p>
            {indirizzoPerso && (
              <p
                className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"
                data-testid="request-indirizzo-perso"
              >
                Il messaggio è partito, ma il tuo indirizzo non si è salvato:
                scrivilo in chat quando fissate l&apos;appuntamento.
              </p>
            )}
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
                  Scrivi a {professional.displayName}
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
                  {professional.displayName}.
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
