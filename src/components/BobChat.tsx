"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { City, Service, ProfessionalCard } from "@/lib/supabase/types";
import { guessServiceSlug, BUDGET_OPTIONS, URGENCY_OPTIONS } from "@/lib/matching";
import { Stars, PriceTag, VerificationBadge } from "./ui";
import { RequestDialog } from "./RequestDialog";

type Step =
  | "intent"
  | "pro-redirect"
  | "service"
  | "city"
  | "urgency"
  | "budget"
  | "results";

interface Msg {
  from: "bob" | "user";
  text: string;
}

interface Collected {
  serviceSlug?: string;
  serviceName?: string;
  citySlug?: string;
  cityName?: string;
  urgency?: "bassa" | "media" | "alta";
  budgetLabel?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  problem?: string;
}

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
  const [collected, setCollected] = useState<Collected>({});
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ProfessionalCard[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [requestFor, setRequestFor] = useState<ProfessionalCard | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, results, step]);

  function bobSay(text: string) {
    setMessages((m) => [...m, { from: "bob", text }]);
  }
  function userSay(text: string) {
    setMessages((m) => [...m, { from: "user", text }]);
  }

  // ----- gestione testo libero (problema o servizio) -----
  function handleFreeText() {
    const text = input.trim();
    if (!text) return;
    userSay(text);
    setInput("");

    const slug = guessServiceSlug(text);
    if (slug) {
      const svc = services.find((s) => s.slug === slug);
      setCollected((c) => ({
        ...c,
        problem: text,
        serviceSlug: slug,
        serviceName: svc?.name,
      }));
      bobSay(
        `Ok, sembra un lavoro da ${svc?.name.toLowerCase()}. In che città ti serve?`
      );
      setStep("city");
    } else {
      setCollected((c) => ({ ...c, problem: text }));
      bobSay(
        "Capito. Per essere preciso, quale di questi servizi si avvicina di più?"
      );
      setStep("service");
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
        "Perfetto. Raccontami il problema con parole tue, oppure scegli un servizio qui sotto."
      );
      setStep("service");
    }
  }

  function pickService(slug: string, name: string) {
    userSay(name);
    setCollected((c) => ({ ...c, serviceSlug: slug, serviceName: name }));
    bobSay(`Ottimo, ${name.toLowerCase()}. In che città ti serve?`);
    setStep("city");
  }

  function pickCity(slug: string, name: string, active: boolean) {
    userSay(name);
    setCollected((c) => ({ ...c, citySlug: slug, cityName: name }));
    if (!active) {
      bobSay(
        `${name} è in arrivo: non ho ancora professionisti attivi lì. Per ora il pilota è a Milano. Vuoi vedere i professionisti di Milano?`
      );
      setCollected((c) => ({ ...c, citySlug: "milano", cityName: "Milano" }));
    } else {
      bobSay("Quando ti servirebbe?");
    }
    setStep("urgency");
  }

  function pickUrgency(label: string, value: "bassa" | "media" | "alta") {
    userSay(label);
    setCollected((c) => ({ ...c, urgency: value }));
    bobSay("Ultima cosa: che budget hai in mente? Anche una stima larga va bene.");
    setStep("budget");
  }

  async function pickBudget(opt: (typeof BUDGET_OPTIONS)[number]) {
    userSay(opt.label);
    const next = {
      ...collected,
      budgetLabel: opt.label,
      budgetMin: opt.min,
      budgetMax: opt.max,
    };
    setCollected(next);
    setStep("results");
    setLoadingResults(true);
    bobSay("Perfetto, sto cercando i professionisti più adatti…");

    const params = new URLSearchParams();
    if (next.citySlug) params.set("city", next.citySlug);
    if (next.serviceSlug) params.set("service", next.serviceSlug);
    if (opt.maxPrice) params.set("maxPrice", String(opt.maxPrice));

    try {
      const res = await fetch(`/api/match?${params.toString()}`);
      const json = await res.json();
      const pros = (json.professionals ?? []) as ProfessionalCard[];
      setResults(pros);
      if (pros.length === 0) {
        bobSay(
          "Non ho ancora un professionista che combaci al 100% con questi criteri. Puoi pubblicare la richiesta e ti avviso appena ne arriva uno adatto."
        );
      } else {
        bobSay(
          `Ecco ${pros.length} ${
            pros.length === 1 ? "professionista" : "professionisti"
          } che fanno al caso tuo. Apri un profilo per vedere il costo nel dettaglio, oppure invia subito un messaggio: te lo preparo io.`
        );
      }
    } catch {
      bobSay(
        "Ho avuto un problema a recuperare i professionisti. Riprova tra poco."
      );
    } finally {
      setLoadingResults(false);
    }
  }

  function restart() {
    setStep("intent");
    setCollected({});
    setResults([]);
    setMessages([
      {
        from: "bob",
        text: "Ricominciamo. Ti aiuto a trovare un servizio o vuoi offrirne uno?",
      },
    ]);
  }

  const bobPrefill = collected.serviceName
    ? `Ciao, ho bisogno di un ${collected.serviceName.toLowerCase()} a ${
        collected.cityName ?? "Milano"
      }.${collected.problem ? ` ${collected.problem}.` : ""} Il mio budget indicativo è ${
        collected.budgetLabel ?? "da definire"
      }. Sei disponibile?`
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
        className="flex max-h-[440px] min-h-[280px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] animate-fade-up rounded-2xl px-4 py-2.5 text-sm ${
                m.from === "user"
                  ? "rounded-br-sm bg-bob-indigo text-white"
                  : "rounded-bl-sm bg-bob-indigo-50 text-bob-ink"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* risultati professionisti dentro la chat */}
        {step === "results" && results.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            {results.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm"
                data-testid={`chat-result-${p.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-bob-ink">
                      {p.fullName}
                    </p>
                    <p className="truncate text-xs text-bob-ink/60">
                      {p.headline}
                    </p>
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
                  <button
                    onClick={() => setRequestFor(p)}
                    className="btn-primary flex-1 py-2 text-xs"
                    data-testid={`button-contact-${p.id}`}
                  >
                    Invia messaggio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === "results" && !loadingResults && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-bob-indigo/30 bg-bob-indigo-50/50 p-4 text-center">
            <button
              onClick={() => setRequestFor(null)}
              className="btn-primary w-full py-2 text-xs"
              disabled
              title="Disponibile a breve"
            >
              Pubblica la richiesta (in arrivo)
            </button>
            <p className="mt-2 text-xs text-bob-ink/50">
              Intanto puoi sfogliare tutti i{" "}
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
            <button onClick={() => pickIntent("cliente")} className="btn-primary flex-1 py-2.5" data-testid="button-intent-client">
              Cerco un servizio
            </button>
            <button onClick={() => pickIntent("professionista")} className="btn-secondary flex-1 py-2.5" data-testid="button-intent-pro">
              Offro un servizio
            </button>
          </div>
        )}

        {step === "pro-redirect" && (
          <Link href="/per-i-professionisti" className="btn-primary w-full py-2.5">
            Scopri come iscriverti come professionista
          </Link>
        )}

        {step === "service" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFreeText()}
                placeholder="Es. ho una perdita sotto il lavandino…"
                className="input-bob py-2.5"
                data-testid="input-problem"
              />
              <button onClick={handleFreeText} className="btn-primary py-2.5" data-testid="button-send">
                Invia
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {services.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickService(s.slug, s.name)}
                  className="chip hover:bg-bob-indigo-100"
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
                className="btn-secondary py-2.5"
                data-testid={`button-urgency-${u.label}`}
              >
                {u.label}
              </button>
            ))}
          </div>
        )}

        {step === "budget" && (
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
        )}

        {step === "results" && (
          <Link href="/professionisti" className="btn-ghost w-full justify-center">
            Vedi tutti i professionisti →
          </Link>
        )}
      </div>

      {requestFor && (
        <RequestDialog
          professional={requestFor}
          prefilledMessage={bobPrefill}
          context={{
            citySlug: collected.citySlug,
            serviceSlug: collected.serviceSlug,
            problem: collected.problem,
            urgency: collected.urgency,
            budgetMin: collected.budgetMin ?? null,
            budgetMax: collected.budgetMax ?? null,
          }}
          onClose={() => setRequestFor(null)}
        />
      )}
    </div>
  );
}
