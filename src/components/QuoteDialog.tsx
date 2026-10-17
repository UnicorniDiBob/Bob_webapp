"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { notifyEvent } from "@/lib/notify";
import { CircleCheck } from "lucide-react";
import type { ProfessionalCard, QuoteField } from "@/lib/supabase/types";
import type { Severity } from "@/lib/bob";
import { resolveQuoteModeFromScope, type QuoteLevel } from "@/lib/quoting";
import { rifiutoCollegamento } from "@/lib/collegamento";
import { elencoNomi } from "@/lib/selezioneChat";

interface QuoteContext {
  citySlug?: string;
  cityName?: string;
  serviceSlug?: string;
  serviceName?: string;
  // Nome retto da "di" ("di pulizie"): chi apre il dialog lo ricava dal
  // catalogo, qui non conosciamo il genere grammaticale. Vedi src/lib/italian.ts.
  // (6b) L'intervento preciso, quando lo sappiamo: la ricerca lo riconosce
  // dalla frase digitata, la chat di Bob lo ha nel brief. Senza questo un
  // lavoro chiuso non sa dire QUALE lavoro era — vedi docs/RICERCA.md §6.
  subserviceSlug?: string | null;
  serviceNeedPhrase?: string;
  problem?: string;
  urgency?: Severity;
  // brief di Bob da agganciare alla richiesta (022)
  briefId?: string | null;
  // (41.1) Via e civico. NON entra nel testo del messaggio né in
  // problem_description: va in request_addresses, che il professionista può
  // leggere solo dopo un appuntamento confermato. Vedi migrazione 044.
  address?: string | null;
  // (045) Quartiere scelto dal cliente: volutamente grossolano, è la sola
  // informazione di posizione che i pro invitati vedono prima della scelta.
  zoneSlug?: string | null;
  // (046) ripiego del quartiere: cinque cifre, stessa grana
  postalCode?: string | null;
  // Scheda lavoro (Fase 4, spec §3/§5): le risposte raccolte per chiave,
  // già validate contro quote_fields dal server durante la chat. Viaggia
  // qui invariata fino a requests.scope — nessuna nuova validazione, quella
  // è già avvenuta in /api/bob/chat.
  scope?: Record<string, string | number | boolean> | null;
  redFlags?: string[] | null;
  propertyType?: string | null;
  hasPhoto?: boolean;
  /** Il budget detto in chat (solo in modo «messaggio»). */
  budgetMin?: number | null;
  budgetMax?: number | null;
}

// Il dialog della chat di Bob per scrivere a PIÙ professionisti scelti: una
// sola richiesta, collegata a tutti, e lo stesso messaggio nella chat di
// ciascuno.
//
// DUE MODI (17/10). Dalla chat si arriva qui in tutti e due i casi, che prima
// prendevano strade diverse:
// - «preventivo»: il cliente non ha un budget e chiede preventivi. Richiesta
//   'quote_request', senza budget, collegamenti 'quote_requested'. Era gia'
//   questo dialog.
// - «messaggio»: il cliente ha detto un budget. Richiesta 'sent' col budget,
//   collegamenti 'contacted', il messaggio gia' scritto da Bob. Prima ogni
//   scheda apriva RequestDialog e creava una richiesta NUOVA con un pro solo:
//   il 17/10 in produzione quattro richieste in dieci secondi per la stessa
//   perdita. I dati scritti sono gli stessi di RequestDialog; in piu' c'e'
//   l'indirizzo, che la chat raccoglie e che in quel modo si perdeva.
//
// LA STESSA RICHIESTA, SE C'E' (17/10). Con `richiestaEsistente` non se ne
// crea un'altra: si collegano i pro nuovi e si scrive solo a loro. Serve
// quando il cliente torna nella stessa conversazione con Bob e aggiunge un pro
// (il tetto della 125 conta anche quelli gia' collegati).
export function QuoteDialog({
  professionals,
  context,
  onClose,
  modo = "preventivo",
  prefilledMessage,
  richiestaEsistente = null,
  onInviato,
}: {
  professionals: ProfessionalCard[];
  context: QuoteContext;
  onClose: () => void;
  modo?: "preventivo" | "messaggio";
  /** In modo «messaggio»: il testo che Bob ha gia' scritto. */
  prefilledMessage?: string;
  /** Una richiesta ancora aperta della stessa conversazione con Bob. */
  richiestaEsistente?: string | null;
  /** A invio riuscito: la richiesta e i pro appena collegati. */
  onInviato?: (richiestaId: string, proIds: string[]) => void;
}) {
  const { user, loading } = useAuth();
  const supabase = createClient();
  // Path corrente per il ritorno post-login (il draft chat è in localStorage).
  const pathname = usePathname();

  const defaultMsg = `Ciao, ho bisogno ${
    context.serviceNeedPhrase ??
    (context.serviceName
      ? `di ${context.serviceName.toLowerCase()}`
      : "di un intervento")
  } a ${context.cityName ?? "Milano"}.${
    context.problem ? ` ${context.problem}.` : ""
  } Vorrei un preventivo: puoi farmi sapere prezzo e disponibilità? Grazie.`;

  const [message, setMessage] = useState(
    modo === "messaggio" && prefilledMessage ? prefilledMessage : defaultMsg
  );
  const nomi = elencoNomi(professionals.map((p) => p.displayName));
  // DENTRO document.body, NON DENTRO LA CHAT (17/10). La colonna della chat
  // nell'eroe ha un'animazione d'entrata (animate-fade-up) che le lascia un
  // transform: un antenato col transform diventa il riferimento dei figli
  // «fixed», e il dialog finiva dentro la colonna, col fondo scuro solo li' e
  // il titolo («Scrivi a …») sotto l'intestazione del sito. Misurato: fondo
  // 845x665 partendo da y -127 su uno schermo 1440x900. Col portale il
  // riferimento torna la finestra. Montato solo nel browser (document).
  const [montato, setMontato] = useState(false);
  useEffect(() => setMontato(true), []);
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

  /**
   * (6b) L'intervento vale solo dentro il suo mestiere: se la coppia non
   * torna — il cliente cercava un lavoro di un altro mestiere — resta NULL,
   * che e' meglio di un intervento sbagliato scritto sulla richiesta.
   *
   * Porta anche quote_level e quote_fields: servono al risolutore di
   * quote_mode (src/lib/quoting.ts, spec §2), non solo all'id da scrivere.
   */
  async function resolveSubservice(
    serviceId: string,
    slug?: string | null
  ): Promise<{ id: string; quoteLevel: QuoteLevel; quoteFields: QuoteField[] } | null> {
    if (!slug) return null;
    const { data } = await supabase
      .from("subservices")
      .select("id, quote_level, quote_fields")
      .eq("slug", slug)
      .eq("service_id", serviceId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      quoteLevel: (data.quote_level as QuoteLevel) ?? "survey",
      quoteFields: (data.quote_fields as QuoteField[]) ?? [],
    };
  }

  async function submit() {
    if (!user || professionals.length === 0) return;
    setSubmitting(true);
    setError(null);
    // La richiesta nata QUI: se poi qualcosa va storto si riporta a «draft».
    // Una richiesta che c'era gia' non si tocca.
    let idRichiesta: string | null = null;
    try {
      let requestId: string | null = richiestaEsistente;
      if (!requestId) {
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

        const subservice = await resolveSubservice(
          serviceId,
          context.subserviceSlug
        );
        const scope = context.scope ?? {};
        // Fuori dalla scala se il sotto-servizio non si e' risolto: senza
        // quote_level di default il risolutore non ha niente da abbassare.
        const quoteMode =
          subservice && context.subserviceSlug
            ? resolveQuoteModeFromScope({
                subtaskSlug: context.subserviceSlug,
                defaultQuoteLevel: subservice.quoteLevel,
                quoteFields: subservice.quoteFields.map((f) => ({
                  key: f.key,
                  is_billable_unit: f.is_billable_unit,
                })),
                scope,
                redFlags: context.redFlags,
                urgency: context.urgency,
                propertyType: context.propertyType,
                hasPhoto: context.hasPhoto,
              })
            : null;

        // Una sola richiesta: 'quote_request' senza budget per i preventivi,
        // 'sent' col budget della chat per il messaggio (come RequestDialog).
        const { data: req, error: reqErr } = await supabase
          .from("requests")
          .insert({
            customer_id: user.id,
            city_id: cityId,
            service_id: serviceId,
            subservice_id: subservice?.id ?? null,
            scope,
            quote_mode: quoteMode,
            status: modo === "messaggio" ? "sent" : "quote_request",
            problem_description: context.problem ?? message,
            urgency: context.urgency ?? null,
            budget_min: modo === "messaggio" ? context.budgetMin ?? null : null,
            budget_max: modo === "messaggio" ? context.budgetMax ?? null : null,
            brief_id: context.briefId ?? null,
            zone_slug: context.zoneSlug ?? null,
            postal_code: context.postalCode ?? null,
          })
          .select("id")
          .single();

        if (reqErr || !req) throw reqErr ?? new Error("Richiesta non creata");
        idRichiesta = req.id as string;
        requestId = idRichiesta;

        // (41.1) L'indirizzo viaggia a parte, mai nella prosa. Se l'insert fallisce
        // non si annulla la richiesta: il cliente ha comunque chiesto il preventivo
        // e l'indirizzo si può ridare al momento dell'appuntamento.
        if (context.address) {
          await supabase.from("request_addresses").insert({
            request_id: req.id,
            address_line: context.address.slice(0, 200),
            city_name: context.cityName ?? null,
          });
        }
      }
      const rid: string = requestId;

      // Collega tutti i professionisti selezionati + messaggio iniziale per ciascuno.
      const links = professionals.map((p) => ({
        request_id: rid,
        professional_id: p.id,
        status: modo === "messaggio" ? "contacted" : "quote_requested",
      }));
      // (022) Un thread per professionista: ognuno riceve il messaggio nel
      // proprio thread, senza più il suffisso "(richiesta a X)" condiviso.
      const msgs = professionals.map((p) => ({
        request_id: rid,
        professional_id: p.id,
        sender_type: "customer",
        sender_id: user.id,
        message,
      }));

      // PRIMA I COLLEGAMENTI, POI I MESSAGGI (16/10, 125): come in
      // RequestDialog. Un insert solo per tutti i pro: la 125 li controlla
      // insieme (pronti, non il proprio profilo, al massimo
      // MAX_PRO_PER_RICHIESTA) e li rifiuta insieme, e allora nessun
      // messaggio parte.
      const linkRes = await supabase.from("request_professionals").insert(links);
      if (linkRes.error) throw linkRes.error;
      const msgRes = await supabase.from("request_messages").insert(msgs);
      if (msgRes.error) throw msgRes.error;

      for (const p of professionals) {
        notifyEvent("new_request", {
          requestId: rid,
          professionalId: p.id,
          preview: message,
        });
      }
      onInviato?.(rid, professionals.map((p) => p.id));
      setDone(true);
    } catch (e) {
      // (16/10) Come RequestDialog: una richiesta nata senza pro collegati
      // torna «draft», cosi' non compare fra i lavori in corso.
      if (idRichiesta) {
        await supabase.from("requests").update({ status: "draft" }).eq("id", idRichiesta);
      }
      // (125) Un rifiuto della guardia ha la sua frase: riprovare non serve.
      setError(rifiutoCollegamento(e) ?? "Qualcosa è andato storto nell'invio. Riprova tra poco.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!montato) return null;

  return createPortal(
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CircleCheck className="h-8 w-8 text-emerald-600" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-bob-ink" data-testid="quote-inviato">
              {modo === "messaggio" ? (
                <>Messaggio inviato a {nomi}</>
              ) : (
                <>
                  Preventivi richiesti a {professionals.length}{" "}
                  {professionals.length === 1 ? "professionista" : "professionisti"}
                </>
              )}
            </h3>
            <p className="text-sm text-bob-ink/70">
              {modo === "messaggio"
                ? "Trovi la richiesta nella tua area personale. Ti avviso appena rispondono, così li confronti con calma."
                : "Trovi tutte le risposte nella tua area personale: ti avviso appena arrivano i preventivi, così confronti i prezzi con calma."}
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
                <h3 className="text-lg font-semibold text-bob-ink" data-testid="quote-titolo">
                  {modo === "messaggio" ? <>Scrivi a {nomi}</> : "Chiedi un preventivo"}
                </h3>
                <p className="text-sm text-bob-ink/70">
                  {modo === "messaggio" ? (
                    <>Ho già preparato io il messaggio: puoi modificarlo.</>
                  ) : (
                    <>
                      Invio la stessa richiesta a{" "}
                      {professionals.length === 1
                        ? "questo professionista"
                        : `questi ${professionals.length} professionisti`}
                      . Puoi modificare il messaggio.
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-bob-ink/65 hover:bg-black/5"
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
                  {p.displayName}
                </span>
              ))}
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-bob-ink/65">Carico…</p>
            ) : !user ? (
              <div className="rounded-xl bg-bob-indigo-50 p-4 text-center">
                <p className="text-sm text-bob-ink/70">
                  Accedi per inviare le richieste di preventivo e seguire le
                  risposte.
                </p>
                <Link
                  href={`/login?returnTo=${encodeURIComponent(pathname)}`}
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
                    : modo === "messaggio"
                      ? professionals.length === 1
                        ? "Invia messaggio"
                        : `Invia a ${professionals.length} professionisti`
                      : `Invia richiesta a ${professionals.length} pro`}
                </button>
                <p className="mt-2 text-center text-xs text-bob-ink/65">
                  {modo === "messaggio"
                    ? "Usare Bob è gratis. La fee si applica solo a lavoro concluso."
                    : "Chiedere preventivi è gratis. La fee si applica solo a lavoro concluso."}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
