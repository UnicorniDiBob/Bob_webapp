"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { City, Service, ProfessionalCard } from "@/lib/supabase/types";
import type { BobMessage, BobUnderstanding, Severity } from "@/lib/bob";
import {
  BUDGET_OPTIONS,
  URGENCY_OPTIONS,
  SEVERITY_LABELS,
} from "@/lib/matching";
import { Stars, PriceTag, VerificationBadge } from "./ui";
import { RequestDialog } from "./RequestDialog";
import { QuoteDialog } from "./QuoteDialog";

type Step =
  | "intent"
  | "pro-redirect"
  | "chat" // conversazione intelligente con Bob
  | "city"
  | "urgency"
  | "budget"
  | "results";

interface Msg {
  from: "bob" | "user";
  text: string;
}

interface Collected {
  serviceSlug?: string | null;
  serviceName?: string;
  severity?: Severity | null;
  summary?: string | null;
  citySlug?: string;
  cityName?: string;
  urgency?: Severity;
  // budget opzionale
  budgetLabel?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  maxPrice?: number;
  // true = l'utente vuole preventivi (nessun budget definito)
  wantsQuotes?: boolean;
}

const EMPTY_UNDERSTANDING: BobUnderstanding = {
  serviceSlug: null,
  severity: null,
  summary: null,
};

export function BobChat({
  cities,
  services,
  compact = false,
}: {
  cities: City[];
  services: Service[];
  compact?: boolean;
}) {
  const [step, setStep] = useState<Step>("intent");
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "bob",
      text: "Ciao, sono Bob. Ti aiuto a trovare un servizio o vuoi offrirne uno?",
    },
  ]);
  const [understanding, setUnderstanding] =
    useState<BobUnderstanding>(EMPTY_UNDERSTANDING);
  const [collected, setCollected] = useState<Collected>({});
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [results, setResults] = useState<ProfessionalCard[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [requestFor, setRequestFor] = useState<ProfessionalCard | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, results, step, thinking]);

  function bobSay(text: string) {
    setMessages((m) => [...m, { from: "bob", text }]);
  }
  function userSay(text: string) {
    setMessages((m) => [...m, { from: "user", text }]);
  }

  // Costruisce la cronologia in formato neutro per l'API.
  function historyFor(extraUser?: string): BobMessage[] {
    const base: BobMessage[] = messages.map((m) => ({
      role: m.from,
      content: m.text,
    }));
    if (extraUser) base.push({ role: "user", content: extraUser });
    return base;
  }

  // ----- conversazione intelligente con Bob -----
  async function sendToBob(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    userSay(clean);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/bob/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyFor(clean),
          understanding,
        }),
      });
      const data = await res.json();
      const u: BobUnderstanding = data.understanding ?? understanding;
      setUnderstanding(u);

      const svc = u.serviceSlug
        ? services.find((s) => s.slug === u.serviceSlug)
        : undefined;
      setCollected((c) => ({
        ...c,
        serviceSlug: u.serviceSlug,
        serviceName: svc?.name,
        severity: u.severity,
        summary: u.summary,
      }));

      bobSay(data.reply ?? "Raccontami meglio cosa ti serve.");

      if (data.next === "city") {
        setStep("city");
      } else {
        setStep("chat");
      }
    } catch {
      bobSay(
        "Ho avuto un intoppo nel ragionare. Riprova a scrivermi cosa ti serve."
      );
      setStep("chat");
    } finally {
      setThinking(false);
    }
  }

  function pickIntent(intent: "cliente" | "professionista") {
    if (intent === "professionista") {
      userSay("Voglio offrire un servizio");
      bobSay(
        "Fantastico, ho sempre bisogno di nuovi professionisti. Niente lead pagati a vuoto: la fee si applica solo quando un lavoro si chiude davvero."
      );
      setStep("pro-redirect");
    } else {
      userSay("Sto cercando un servizio");
      bobSay(
        "Perfetto. Raccontami cosa succede con parole tue: più dettagli mi dai, meglio capisco di cosa hai bisogno. Oppure scegli un servizio qui sotto."
      );
      setStep("chat");
    }
  }

  // L'utente sceglie un servizio dai chip: saltiamo direttamente alla città.
  function pickService(slug: string, name: string) {
    userSay(name);
    setUnderstanding((u) => ({ ...u, serviceSlug: slug }));
    setCollected((c) => ({ ...c, serviceSlug: slug, serviceName: name }));
    bobSay(`Ottimo, ${name.toLowerCase()}. In che città ti serve?`);
    setStep("city");
  }

  function pickCity(slug: string, name: string, active: boolean) {
    userSay(name);
    if (!active) {
      bobSay(
        `${name} è in arrivo: non ho ancora professionisti attivi lì. Per ora il pilota è a Milano, ti mostro quelli di Milano. Quando ti servirebbe?`
      );
      setCollected((c) => ({ ...c, citySlug: "milano", cityName: "Milano" }));
    } else {
      setCollected((c) => ({ ...c, citySlug: slug, cityName: name }));
      bobSay("Quando ti servirebbe?");
    }
    setStep("urgency");
  }

  function pickUrgency(label: string, value: Severity) {
    userSay(label);
    setCollected((c) => ({ ...c, urgency: value }));
    bobSay(
      "Hai già un budget in mente? Se ce l'hai dimmelo, così filtro i professionisti adatti. Altrimenti nessun problema: posso chiedere dei preventivi per te."
    );
    setStep("budget");
  }

  async function runSearch(next: Collected) {
    setCollected(next);
    setStep("results");
    setSelected(new Set());
    setLoadingResults(true);

    const params = new URLSearchParams();
    if (next.citySlug) params.set("city", next.citySlug);
    if (next.serviceSlug) params.set("service", next.serviceSlug);
    if (next.maxPrice) params.set("maxPrice", String(next.maxPrice));

    try {
      const res = await fetch(`/api/match?${params.toString()}`);
      const json = await res.json();
      const pros = (json.professionals ?? []) as ProfessionalCard[];
      setResults(pros);
      if (pros.length === 0) {
        bobSay(
          "Non ho ancora un professionista che combaci con questi criteri. Puoi sfogliare tutti i professionisti disponibili qui sotto."
        );
      } else if (next.wantsQuotes) {
        bobSay(
          `Ho trovato ${pros.length} ${
            pros.length === 1 ? "professionista adatto" : "professionisti adatti"
          }. Seleziona quelli che ti interessano e chiedo io un preventivo a ciascuno: confronti i prezzi con calma.`
        );
      } else {
        bobSay(
          `Ecco ${pros.length} ${
            pros.length === 1 ? "professionista" : "professionisti"
          } nel tuo budget. Apri un profilo per i dettagli, oppure invia subito un messaggio: te lo preparo io.`
        );
      }
    } catch {
      bobSay("Ho avuto un problema a recuperare i professionisti. Riprova tra poco.");
    } finally {
      setLoadingResults(false);
    }
  }

  function pickBudget(opt: (typeof BUDGET_OPTIONS)[number]) {
    userSay(opt.label);
    runSearch({
      ...collected,
      budgetLabel: opt.label,
      budgetMin: opt.min,
      budgetMax: opt.max,
      maxPrice: opt.maxPrice,
      wantsQuotes: false,
    });
  }

  function pickNoBudget() {
    userSay("Non ho un budget, chiedi tu dei preventivi");
    runSearch({
      ...collected,
      budgetLabel: undefined,
      budgetMin: null,
      budgetMax: null,
      maxPrice: undefined,
      wantsQuotes: true,
    });
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function restart() {
    setStep("intent");
    setUnderstanding(EMPTY_UNDERSTANDING);
    setCollected({});
    setResults([]);
    setSelected(new Set());
    setMessages([
      {
        from: "bob",
        text: "Ricominciamo. Ti aiuto a trovare un servizio o vuoi offrirne uno?",
      },
    ]);
  }

  const selectedPros = results.filter((p) => selected.has(p.id));

  const bobPrefill = collected.serviceName
    ? `Ciao, ho bisogno di un ${collected.serviceName.toLowerCase()} a ${
        collected.cityName ?? "Milano"
      }.${collected.summary ? ` ${collected.summary}.` : ""}${
        collected.budgetLabel
          ? ` Il mio budget indicativo è ${collected.budgetLabel}.`
          : ""
      } Sei disponibile?`
    : "";

  return (
    <div
      className={`card overflow-hidden ${compact ? "" : "shadow-card-hover"}`}
      data-testid="bob-chat"
    >
      {/* intestazione chat */}
      <div className="flex items-center gap-3 border-b border-black/5 bg-bob-indigo px-5 py-3.5 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg font-black">
          B
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Bob</p>
          <p className="text-xs text-white/70">Il tuo concierge dei servizi</p>
        </div>
        {step !== "intent" && (
          <button
            onClick={restart}
            className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/10"
            data-testid="button-restart"
          >
            Ricomincia
          </button>
        )}
      </div>

      {/* corpo */}
      <div
        ref={scrollRef}
        className="flex max-h-[460px] min-h-[280px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] animate-fade-up whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                m.from === "user"
                  ? "rounded-br-sm bg-bob-indigo text-white"
                  : "rounded-bl-sm bg-bob-indigo-50 text-bob-ink"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-bob-indigo-50 px-4 py-3 text-sm text-bob-ink/60">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bob-indigo/50 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bob-indigo/50 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bob-indigo/50" />
              </span>
            </div>
          </div>
        )}

        {/* riepilogo di cosa Bob ha capito */}
        {step !== "intent" && step !== "chat" && understanding.serviceSlug && (
          <div className="flex flex-wrap gap-1.5">
            {collected.serviceName && (
              <span className="chip bg-bob-indigo-50 text-bob-indigo">
                {collected.serviceName}
              </span>
            )}
            {understanding.severity && (
              <span className="chip bg-bob-indigo-50 text-bob-indigo">
                {SEVERITY_LABELS[understanding.severity]}
              </span>
            )}
            {collected.cityName && (
              <span className="chip bg-bob-indigo-50 text-bob-indigo">
                {collected.cityName}
              </span>
            )}
          </div>
        )}

        {/* risultati professionisti dentro la chat */}
        {step === "results" && results.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            {results.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border bg-white p-3.5 shadow-sm transition-colors ${
                    collected.wantsQuotes && isSelected
                      ? "border-bob-indigo ring-1 ring-bob-indigo"
                      : "border-black/5"
                  }`}
                  data-testid={`chat-result-${p.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {collected.wantsQuotes && (
                        <button
                          onClick={() => toggleSelect(p.id)}
                          aria-label={isSelected ? "Deseleziona" : "Seleziona"}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isSelected
                              ? "border-bob-indigo bg-bob-indigo text-white"
                              : "border-black/20 bg-white"
                          }`}
                          data-testid={`select-pro-${p.id}`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-bob-ink">
                          {p.fullName}
                        </p>
                        <p className="truncate text-xs text-bob-ink/60">
                          {p.headline}
                        </p>
                      </div>
                    </div>
                    <PriceTag min={p.minPrice} max={p.maxPrice} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Stars value={p.avgRating} count={p.nRatings} />
                    <VerificationBadge status={p.verificationStatus} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/professionisti/${p.id}`}
                      className="btn-secondary flex-1 py-2 text-xs"
                    >
                      Vedi profilo
                    </Link>
                    {collected.wantsQuotes ? (
                      <button
                        onClick={() => toggleSelect(p.id)}
                        className={`flex-1 py-2 text-xs ${
                          isSelected ? "btn-secondary" : "btn-primary"
                        }`}
                        data-testid={`button-toggle-${p.id}`}
                      >
                        {isSelected ? "Selezionato ✓" : "Aggiungi al preventivo"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setRequestFor(p)}
                        className="btn-primary flex-1 py-2 text-xs"
                        data-testid={`button-contact-${p.id}`}
                      >
                        Invia messaggio
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === "results" && !loadingResults && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-bob-indigo/30 bg-bob-indigo-50/50 p-4 text-center">
            <p className="text-xs text-bob-ink/60">
              Sfoglia tutti i{" "}
              <Link href="/professionisti" className="underline">
                professionisti disponibili
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {/* area input / scelte rapide */}
      <div className="border-t border-black/5 bg-white px-4 py-3.5 sm:px-5">
        {step === "intent" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => pickIntent("cliente")}
              className="btn-primary flex-1 py-2.5"
              data-testid="button-intent-client"
            >
              Cerco un servizio
            </button>
            <button
              onClick={() => pickIntent("professionista")}
              className="btn-secondary flex-1 py-2.5"
              data-testid="button-intent-pro"
            >
              Offro un servizio
            </button>
          </div>
        )}

        {step === "pro-redirect" && (
          <Link href="/per-i-professionisti" className="btn-primary w-full py-2.5">
            Scopri come iscriverti come professionista
          </Link>
        )}

        {step === "chat" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !thinking && sendToBob(input)
                }
                placeholder="Es. esce acqua dal soffitto del bagno…"
                className="input-bob py-2.5"
                disabled={thinking}
                data-testid="input-problem"
              />
              <button
                onClick={() => sendToBob(input)}
                className="btn-primary py-2.5"
                disabled={thinking || !input.trim()}
                data-testid="button-send"
              >
                Invia
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {services.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickService(s.slug, s.name)}
                  className="chip hover:bg-bob-indigo-100"
                  disabled={thinking}
                  data-testid={`chip-service-${s.slug}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "city" && (
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <button
                key={c.id}
                onClick={() => pickCity(c.slug, c.name, c.status === "active")}
                className="btn-secondary flex-1 py-2.5"
                data-testid={`button-city-${c.slug}`}
              >
                {c.name}
                {c.status !== "active" && (
                  <span className="ml-1 text-[10px] text-bob-ink/40">soon</span>
                )}
              </button>
            ))}
          </div>
        )}

        {step === "urgency" && (
          <div className="grid grid-cols-2 gap-2">
            {URGENCY_OPTIONS.map((u) => (
              <button
                key={u.label}
                onClick={() => pickUrgency(u.label, u.value)}
                className="btn-secondary py-2.5 text-sm"
                data-testid={`button-urgency-${u.label}`}
              >
                {u.label}
              </button>
            ))}
          </div>
        )}

        {step === "budget" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => pickBudget(b)}
                  className="chip hover:bg-bob-indigo-100"
                  data-testid={`button-budget-${b.label}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <button
              onClick={pickNoBudget}
              className="btn-primary w-full py-2.5 text-sm"
              data-testid="button-no-budget"
            >
              Non ho un budget · chiedi preventivi
            </button>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-2">
            {collected.wantsQuotes && results.length > 0 && (
              <button
                onClick={() => setQuoteOpen(true)}
                disabled={selectedPros.length === 0}
                className="btn-primary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="button-request-quotes"
              >
                {selectedPros.length === 0
                  ? "Seleziona almeno un professionista"
                  : `Chiedi un preventivo a ${selectedPros.length} ${
                      selectedPros.length === 1
                        ? "professionista"
                        : "professionisti"
                    }`}
              </button>
            )}
            <Link
              href="/professionisti"
              className="btn-ghost w-full justify-center"
            >
              Vedi tutti i professionisti →
            </Link>
          </div>
        )}
      </div>

      {/* invio messaggio singolo (modalità budget) */}
      {requestFor && (
        <RequestDialog
          professional={requestFor}
          prefilledMessage={bobPrefill}
          context={{
            citySlug: collected.citySlug,
            serviceSlug: collected.serviceSlug ?? undefined,
            problem: collected.summary ?? undefined,
            urgency: collected.urgency,
            budgetMin: collected.budgetMin ?? null,
            budgetMax: collected.budgetMax ?? null,
          }}
          onClose={() => setRequestFor(null)}
        />
      )}

      {/* invio richieste di preventivo multiple (modalità senza budget) */}
      {quoteOpen && (
        <QuoteDialog
          professionals={selectedPros}
          context={{
            citySlug: collected.citySlug,
            cityName: collected.cityName,
            serviceSlug: collected.serviceSlug ?? undefined,
            serviceName: collected.serviceName,
            problem: collected.summary ?? undefined,
            urgency: collected.urgency,
          }}
          onClose={() => setQuoteOpen(false)}
        />
      )}
    </div>
  );
}
