"use client";

// AGGIUNGERE O RICONNETTERE UN ACCOUNT — traccia Client/Pro, di André.
//
// PROVVISORIO (30/09). Il resto di «Account in questo browser» e' diventato la
// tendina degli account (AccountTendina): chi e' dentro, il passaggio
// all'altro, «Esci». Qui resta solo il modulo con email e password, e ci si
// arriva dalla tendina. Sparisce con feat/aggiungi-account-dal-login (R6):
// l'aggiunta passera' dal pannello di accesso, perche' con la 2FA, il link
// magico o Google la seconda prova qui non avrebbe dove avvenire.

import { useState } from "react";
import { annuncia } from "@/lib/sessioni/client";

export function AggiungiAccount({ emailDaRiconnettere }: { emailDaRiconnettere: string | null }) {
  const [email, setEmail] = useState(emailDaRiconnettere ?? "");
  const [password, setPassword] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Login solo per lui, sul server: l'account attivo non si tocca.
  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    setInCorso(true);
    setErrore(null);
    let r: Response | null = null;
    try {
      r = await fetch("/api/sessioni/aggiungi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      r = null;
    }
    setPassword("");
    if (r?.ok) {
      annuncia("fatto");
      window.location.replace("/impostazioni/accesso");
      return;
    }
    const corpo = r ? ((await r.json().catch(() => ({}))) as { error?: string }) : {};
    setErrore(corpo.error ?? "Non sono riuscito ad aggiungere l'account. Riprova.");
    setInCorso(false);
  }

  return (
    <form
      id="aggiungi-account"
      onSubmit={aggiungi}
      className="card scroll-mt-28 p-5 sm:p-6"
      data-testid="form-aggiungi-account"
    >
      <h3 className="text-sm font-semibold text-bob-ink">
        {emailDaRiconnettere ? `Riconnetti ${emailDaRiconnettere}` : "Aggiungi un altro account"}
      </h3>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          readOnly={!!emailDaRiconnettere}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="Email"
          aria-label="Email"
          className="input-bob flex-1 py-2"
          data-testid="input-aggiungi-email"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          placeholder="Password"
          aria-label="Password"
          className="input-bob flex-1 py-2"
          data-testid="input-aggiungi-password"
        />
        <button type="submit" disabled={inCorso} className="btn-secondary py-2 text-sm" data-testid="button-aggiungi-account">
          {emailDaRiconnettere ? "Riconnetti" : "Aggiungi"}
        </button>
      </div>
      {errore && (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {errore}
        </p>
      )}
    </form>
  );
}
