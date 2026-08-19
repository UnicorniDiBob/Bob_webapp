"use client";

// Form di assistenza. Il ticket e la risposta vivono su Bob: vedi la
// migrazione 055 per il perche' (email spente, indirizzi [PLACEHOLDER]).

import { useState } from "react";
import Link from "next/link";

const CATEGORIE: { id: string; label: string }[] = [
  { id: "problema_tecnico", label: "Qualcosa non funziona" },
  { id: "account", label: "Il mio account" },
  { id: "professionista", label: "Un professionista" },
  { id: "pagamenti", label: "Piano e pagamenti" },
  { id: "privacy", label: "Privacy e dati personali" },
  { id: "altro", label: "Altro" },
];

export function SupportoForm({
  emailUtente,
}: {
  /** Email della sessione, se c'e'. Il server la usa comunque: qui serve solo
      a non chiedere una cosa che sappiamo gia'. */
  emailUtente: string | null;
}) {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [stato, setStato] = useState<"idle" | "invio" | "fatto">("idle");
  const [ref, setRef] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (stato === "invio") return;
    setStato("invio");
    setErrore(null);
    try {
      const res = await fetch("/api/supporto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, category, subject, message, website }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrore(json.error ?? "Qualcosa è andato storto. Riprova.");
        setStato("idle");
        return;
      }
      setRef(json.ref ?? null);
      setStato("fatto");
    } catch {
      setErrore("Qualcosa è andato storto. Riprova.");
      setStato("idle");
    }
  }

  if (stato === "fatto") {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
        data-testid="supporto-ok"
      >
        <p className="font-semibold text-emerald-800">Richiesta registrata.</p>
        {ref && (
          <p className="mt-2 text-sm text-bob-ink/70">
            Il codice è <span className="font-mono font-semibold">{ref}</span>.
            {emailUtente
              ? " Lo ritrovi, con la nostra risposta, in Impostazioni → Assistenza."
              : " Annotalo: senza un account è il solo riferimento che hai, e serve se ci riscrivi."}
          </p>
        )}
        <p className="mt-2 text-sm text-bob-ink/60">
          Rispondiamo entro un giorno lavorativo. La risposta la scriviamo qui
          dentro Bob{emailUtente ? "" : " e ti avvisiamo appena possibile"}.
        </p>
        {emailUtente && (
          <Link
            href="/impostazioni/assistenza"
            className="btn-secondary mt-4 py-2.5"
          >
            Vedi le tue richieste
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={invia} className="card space-y-5 p-5 sm:p-6" data-testid="supporto-form">
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

      {!emailUtente && (
        <div>
          <label className="label-bob" htmlFor="sp-email">
            La tua email
          </label>
          <input
            id="sp-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-bob"
            placeholder="nome@email.it"
            autoComplete="email"
            data-testid="supporto-email"
          />
          <p className="mt-1.5 text-xs text-bob-ink/50">
            Serve solo a risponderti su questa richiesta. Non ti iscrive a
            niente.
          </p>
        </div>
      )}

      <div>
        <label className="label-bob" htmlFor="sp-cat">
          Di cosa si tratta
        </label>
        <select
          id="sp-cat"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-bob"
          data-testid="supporto-categoria"
        >
          <option value="">Scegli…</option>
          {CATEGORIE.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-bob" htmlFor="sp-subject">
          In una riga
        </label>
        <input
          id="sp-subject"
          required
          maxLength={140}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input-bob"
          placeholder="Es. Non riesco a confermare un appuntamento"
          data-testid="supporto-titolo"
        />
      </div>

      <div>
        <label className="label-bob" htmlFor="sp-msg">
          Cosa è successo
        </label>
        <textarea
          id="sp-msg"
          required
          rows={6}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input-bob resize-none"
          placeholder="Raccontacelo come lo racconteresti a voce: cosa stavi facendo, cosa ti aspettavi, cosa è successo invece."
          data-testid="supporto-messaggio"
        />
        <p className="mt-1.5 text-xs text-bob-ink/50">
          {message.length < 20
            ? "Almeno una ventina di caratteri: con due parole non riusciamo ad aiutarti."
            : `${message.length} caratteri.`}
        </p>
      </div>

      {errore && (
        <p className="text-sm text-red-600" data-testid="supporto-errore">
          {errore}
        </p>
      )}

      <button
        type="submit"
        disabled={stato === "invio"}
        className="btn-primary w-full py-3 sm:w-auto"
        data-testid="supporto-invia"
      >
        {stato === "invio" ? "Invio…" : "Invia la richiesta"}
      </button>

      <p className="text-xs leading-relaxed text-bob-ink/45">
        Usiamo quello che scrivi solo per rispondere a questa richiesta. Se hai
        un account, la richiesta viene cancellata insieme a esso. Dettagli
        nell&apos;
        <Link href="/privacy" className="underline hover:text-bob-indigo">
          informativa privacy
        </Link>
        .
      </p>
    </form>
  );
}
