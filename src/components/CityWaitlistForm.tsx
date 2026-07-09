"use client";

import { useState } from "react";
import Link from "next/link";

// Form "lascia il tuo interesse" per le città non ancora attive.
// Una sola domanda (l'email), risposta inline, zero attrito.
export function CityWaitlistForm({
  citySlug,
  cityName,
}: {
  citySlug: string;
  cityName: string;
}) {
  const [email, setEmail] = useState("");
  // Honeypot anti-bot: campo invisibile agli umani; se compilato,
  // l'API scarta l'iscrizione senza salvarla.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, citySlug, website }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Qualcosa è andato storto. Riprova.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Qualcosa è andato storto. Riprova.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center"
        data-testid="waitlist-success"
      >
        <p className="text-sm font-semibold text-emerald-700">
          Fatto! Ti avviso appena arrivo a {cityName}.
        </p>
        <p className="mt-1 text-xs text-bob-ink/55">
          Nel frattempo, se il problema non aspetta, i professionisti di
          Milano sono già attivi.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2" data-testid="waitlist-form">
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label className="label-bob text-left" htmlFor={`waitlist-${citySlug}`}>
        Lascia la tua email: ti avviso io quando apro a {cityName}.
      </label>
      <div className="flex gap-2">
        <input
          id={`waitlist-${citySlug}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@email.it"
          autoComplete="email"
          className="input-bob py-2.5"
          disabled={state === "sending"}
          data-testid="input-waitlist-email"
        />
        <button
          type="submit"
          className="btn-primary shrink-0 py-2.5"
          disabled={state === "sending" || !email.trim()}
          data-testid="button-waitlist-submit"
        >
          {state === "sending" ? "Un attimo…" : "Avvisami"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600" data-testid="waitlist-error">
          {error}
        </p>
      )}
      <p className="text-left text-[11px] leading-snug text-bob-ink/45">
        Userò la tua email solo per avvisarti del lancio a {cityName}. Niente
        spam. Dettagli nell&apos;
        <Link href="/privacy" className="underline hover:text-bob-indigo">
          informativa privacy
        </Link>
        .
      </p>
    </form>
  );
}
