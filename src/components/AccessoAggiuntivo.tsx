"use client";

// /login IN MODALITA' «AGGIUNGI» (30/09, R6) — traccia Client/Pro, di André.
//
// Ci si arriva da «Aggiungi un altro account» e da un account «da riconnettere»
// nella tendina degli account (percorsoAggiungiAccount). Alla fine si torna da
// dove si era partiti, con due account nel browser, e l'account attivo non
// cambia mai durante il giro.
//
// LA TRAPPOLA. Il resto di /login accede con createClient() di
// lib/supabase/client, che scrive i cookie sb- della sessione ATTIVA: accedere
// di li' sostituirebbe l'account invece di aggiungerlo. Qui l'accesso avviene
// su un client supabase-js che vive solo in memoria (persistSession: false): la
// sessione che nasce non tocca nessun cookie e sparisce con la pagina. Il suo
// refresh token va a /api/sessioni/adotta, che lo rinnova e mette il token
// nuovo in bob-attesa. La password va solo a Supabase, mai alle nostre route.
//
// PRONTO PER LA 2FA, NON COSTRUITA. Con la 2FA la seconda prova (mfa.challenge
// e mfa.verify) avviene su questo stesso client, dopo signInWithPassword e
// prima di adotta. Link magico e Google sono giri con un rimando: il rientro
// dovra' passare da una pagina dedicata che scambia il codice con un client
// isolato, mai da /auth/conferma, che scrive i cookie dell'attivo.
//
// Niente «password dimenticata» qui, per la stessa ragione: quel giro passa
// dalla mail e rientra con i cookie dell'account attivo.

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { LogoMark } from "@/components/Logo";
import { ERRORE_CREDENZIALI } from "@/lib/sessioni/aggiungi";

export function AccessoAggiuntivo({
  emailAttiva,
  emailDaRiconnettere,
  ritorno,
}: {
  emailAttiva: string;
  emailDaRiconnettere: string | null;
  ritorno: string;
}) {
  // Un client per questa pagina, senza storage: non legge e non scrive i
  // cookie sb-, e storageKey diverso da quello di sempre per non litigare con
  // il client del resto dell'app nella stessa scheda.
  const isolato = useMemo(
    () =>
      createSupabaseJs(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "bob-accesso-aggiuntivo",
        },
      }),
    []
  );
  const [email, setEmail] = useState(emailDaRiconnettere ?? "");
  const [password, setPassword] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function accedi(e: React.FormEvent) {
    e.preventDefault();
    setInCorso(true);
    setErrore(null);

    const { data, error } = await isolato.auth.signInWithPassword({ email: email.trim(), password });
    setPassword("");
    if (error || !data.session) {
      setErrore(
        error && /email not confirmed/i.test(error.message)
          ? "Quell'account non ha ancora confermato l'email: cerca la mail di BOB nella posta (anche nello spam)."
          : ERRORE_CREDENZIALI
      );
      setInCorso(false);
      return;
    }

    let r: Response | null = null;
    try {
      r = await fetch("/api/sessioni/adotta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: data.session.refresh_token }),
      });
    } catch {
      r = null;
    }
    if (r?.ok) {
      // Ricarica vera, non router.push: AuthProvider deve rileggere dal server
      // che adesso in questo browser gli account sono due.
      window.location.replace(ritorno);
      return;
    }
    const corpo = r ? ((await r.json().catch(() => ({}))) as { error?: string }) : {};
    setErrore(corpo.error ?? "Non sono riuscito ad aggiungere l'account. Riprova.");
    setInCorso(false);
  }

  return (
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="card p-7" data-testid="accesso-aggiuntivo">
          <div className="mb-5 text-center">
            <LogoMark className="mx-auto mb-3" />
            <h1 className="text-xl font-bold text-bob-ink">
              {emailDaRiconnettere ? "Riconnetti l'account" : "Aggiungi un altro account"}
            </h1>
            <p className="mt-1 text-sm text-bob-ink/70" data-testid="accesso-aggiuntivo-resta">
              {`Resti dentro anche come ${emailAttiva}.`}
            </p>
          </div>

          <form onSubmit={accedi} className="flex flex-col gap-3">
            <div>
              <label className="label-bob" htmlFor="agg-email">
                Email
              </label>
              <input
                id="agg-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                readOnly={!!emailDaRiconnettere}
                className="input-bob"
                autoComplete="username"
                required
                data-testid="input-aggiuntivo-email"
              />
            </div>
            <div>
              <label className="label-bob" htmlFor="agg-password">
                Password
              </label>
              <input
                id="agg-password"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="input-bob"
                autoComplete="current-password"
                required
                data-testid="input-aggiuntivo-password"
              />
            </div>

            {errore && (
              <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                {errore}
              </p>
            )}

            <button type="submit" disabled={inCorso} className="btn-primary mt-1" data-testid="button-aggiuntivo-accedi">
              {inCorso ? "Accedo…" : emailDaRiconnettere ? "Riconnetti" : "Aggiungi"}
            </button>
            <Link href={ritorno} className="btn-ghost" data-testid="link-aggiuntivo-annulla">
              Annulla
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
