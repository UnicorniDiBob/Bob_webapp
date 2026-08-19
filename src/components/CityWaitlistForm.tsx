"use client";

// Form "avvisami al lancio" per le citta' non ancora attive.
//
// PERCHE' C'E' UNA SPUNTA, DAL 19/08
// Prima il form chiedeva solo l'email e mostrava una frase rassicurante
// ("Userò la tua email solo per avvisarti"). Non era un consenso: era una
// nostra dichiarazione di intenti. E la migrazione 015 dichiarava
// `consent_at ... default now()`, quindi ogni iscrizione nasceva con la prova
// di un atto affermativo che non era mai avvenuto — la forma peggiore, perche'
// il registro sembrava in ordine.
//
// Adesso la spunta e' l'atto, ed e' obbligatoria. Puo' esserlo senza violare
// l'art. 7(4) GDPR: l'avviso al lancio non e' un extra agganciato a un altro
// servizio, e' l'UNICO servizio che questo form offre. Il consenso alle
// comunicazioni promozionali invece e' una spunta separata, facoltativa e
// spenta — perche' quello sarebbe un extra, e legarlo all'iscrizione lo
// renderebbe nullo.
//
// Registriamo anche il testo esatto accettato: fra sei mesi la frase qui sotto
// sara' cambiata, e "ha acconsentito" senza sapere a cosa non dimostra niente.

import { useState } from "react";
import Link from "next/link";

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
  const [consenso, setConsenso] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  // Il testo che l'utente ha davanti quando spunta: viene salvato con il
  // consenso. Vive in una costante proprio per non divergere dall'etichetta.
  const TESTO_CONSENSO = `Avvisami via email quando BOB apre a ${cityName}.`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    if (!consenso) {
      setError("Spunta la casella: senza il tuo ok non posso scriverti.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          citySlug,
          website,
          consent: true,
          consentText: TESTO_CONSENSO,
          marketing,
        }),
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
          Nel frattempo, se il problema non aspetta, i professionisti di Milano
          sono già attivi.
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

      {/* L'atto affermativo. Mai pre-spuntata: una casella già segnata non è
          un consenso, è una nostra decisione con l'aspetto di una sua. */}
      <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-left">
        <input
          type="checkbox"
          checked={consenso}
          onChange={(e) => {
            setConsenso(e.target.checked);
            if (e.target.checked) setError(null);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 text-bob-indigo focus:ring-bob-indigo/40"
          data-testid="waitlist-consent"
        />
        <span className="text-xs leading-snug text-bob-ink/70">
          {TESTO_CONSENSO}
        </span>
      </label>

      {/* Facoltativa e separata: se la lasci spenta, ricevi solo l'avviso del
          lancio e nient'altro. */}
      <label className="flex cursor-pointer items-start gap-2.5 text-left">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 text-bob-indigo focus:ring-bob-indigo/40"
          data-testid="waitlist-marketing"
        />
        <span className="text-xs leading-snug text-bob-ink/55">
          Facoltativo: mandami anche le novità di BOB. Puoi disdire con un clic
          in ogni email.
        </span>
      </label>

      <button
        type="submit"
        className="btn-primary w-full py-2.5"
        disabled={state === "sending" || !email.trim() || !consenso}
        data-testid="button-waitlist-submit"
      >
        {state === "sending" ? "Un attimo…" : "Avvisami"}
      </button>

      {error && (
        <p className="text-xs text-red-600" data-testid="waitlist-error">
          {error}
        </p>
      )}
      <p className="text-left text-[11px] leading-snug text-bob-ink/45">
        Uso la tua email solo per quello che hai spuntato qui sopra, e la
        conservo al massimo dodici mesi. Dettagli nell&apos;
        <Link href="/privacy" className="underline hover:text-bob-indigo">
          informativa privacy
        </Link>
        .
      </p>
    </form>
  );
}
