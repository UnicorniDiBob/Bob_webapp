"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { UserRole } from "@/lib/supabase/types";

type Mode = "login" | "signup";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
          Carico…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();

  // Ritorno post-login: /login?returnTo=/percorso rimanda dove l'utente
  // stava lavorando (es. la chat di Bob con il brief ripristinato dal
  // draft locale) invece di forzare /dashboard. Accettiamo solo path
  // interni ("/..." ma non "//...") per evitare open redirect.
  const returnToParam = params.get("returnTo");
  const returnTo =
    returnToParam && returnToParam.startsWith("/") && !returnToParam.startsWith("//")
      ? returnToParam
      : "/dashboard";

  // Deep link dal funnel pro: /login?mode=signup&role=professional
  // apre direttamente la registrazione con il ruolo giusto preselezionato.
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "login"
  );
  const [role, setRole] = useState<Extract<UserRole, "customer" | "professional">>(
    params.get("role") === "professional" ? "professional" : "customer"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Calcola l'età da una data 'YYYY-MM-DD' senza dipendenze esterne.
  function calcAge(isoDate: string): number {
    const dob = new Date(isoDate);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  // Reset password: Supabase invia una mail con un link a /auth/reimposta-password.
  async function handleForgotPassword() {
    setError(null);
    setInfo(null);
    const target = email.trim();
    if (!target) {
      setError("Scrivi la tua email qui sopra, poi ripremi il link.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        target,
        {
          redirectTo: `${window.location.origin}/auth/reimposta-password`,
        }
      );
      if (resetErr) throw resetErr;
      setInfo(
        "Se l'email è registrata, ti ho inviato un link per reimpostare la password. Controlla la posta."
      );
    } catch (err) {
      // Distinguo il rate limit (429) dagli errori generici, così l'utente
      // capisce che la funzione non è rotta: deve solo riprovare più tardi.
      const status = (err as { status?: number } | null)?.status;
      const msg = err instanceof Error ? err.message : "";
      if (status === 429 || /rate limit|security purposes/i.test(msg)) {
        setError(
          "Troppe richieste in poco tempo: riprova tra qualche minuto."
        );
      } else {
        setError(
          "Non sono riuscito a inviare la mail di reset. Riprova tra poco."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "signup") {
        if (fullName.trim().length < 2) {
          setError("Inserisci il tuo nome.");
          setSubmitting(false);
          return;
        }
        if (!dateOfBirth) {
          setError("Inserisci la tua data di nascita.");
          setSubmitting(false);
          return;
        }
        if (calcAge(dateOfBirth) < 18) {
          setError("Devi avere almeno 18 anni per registrarti su BOB.");
          setSubmitting(false);
          return;
        }
        if (!termsAccepted) {
          setError("Devi accettare i termini del servizio e l'informativa privacy per continuare.");
          setSubmitting(false);
          return;
        }
        // Il trigger handle_new_user legge role, full_name, date_of_birth e
        // terms_accepted_at da raw_user_meta_data.
        const { data, error: signErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              full_name: fullName.trim(),
              date_of_birth: dateOfBirth,
              terms_accepted_at: new Date().toISOString(),
            },
          },
        });
        if (signErr) throw signErr;

        // Se la conferma email è richiesta, non c'è ancora sessione.
        if (!data.session) {
          setInfo(
            "Ti ho inviato una mail per confermare l'indirizzo. Confermala e poi accedi."
          );
          setMode("login");
          setSubmitting(false);
          return;
        }
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginErr) throw loginErr;
      }

      await refresh();
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore imprevisto";
      // Messaggi Supabase comuni tradotti in italiano amichevole.
      if (/invalid login credentials/i.test(msg)) {
        setError("Email o password non corretti.");
      } else if (/already registered/i.test(msg)) {
        setError("Questa email è già registrata. Prova ad accedere.");
      } else if (/password should be at least/i.test(msg)) {
        setError("La password deve avere almeno 6 caratteri.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="card p-7">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-bob-indigo text-xl font-bold text-white">
              B
            </div>
            <h1 className="text-xl font-bold text-bob-ink">
              {mode === "login" ? "Bentornato" : "Crea il tuo account"}
            </h1>
            <p className="mt-1 text-sm text-bob-ink/60">
              {mode === "login"
                ? "Accedi per seguire le tue richieste."
                : "Bastano pochi secondi per iniziare."}
            </p>
          </div>

          {/* Toggle ruolo solo in registrazione */}
          {mode === "signup" && (
            <div className="mb-4">
              <span className="label-bob">Voglio usare BOB come</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    role === "customer"
                      ? "border-bob-indigo bg-bob-indigo-50 text-bob-indigo"
                      : "border-black/10 text-bob-ink/65 hover:border-black/20"
                  }`}
                  data-testid="role-customer"
                >
                  🙋 Cliente
                  <span className="mt-0.5 block text-xs font-normal text-bob-ink/50">
                    Cerco un servizio
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("professional")}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    role === "professional"
                      ? "border-bob-indigo bg-bob-indigo-50 text-bob-indigo"
                      : "border-black/10 text-bob-ink/65 hover:border-black/20"
                  }`}
                  data-testid="role-professional"
                >
                  🛠️ Professionista
                  <span className="mt-0.5 block text-xs font-normal text-bob-ink/50">
                    Offro un servizio
                  </span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <div>
                <label className="label-bob" htmlFor="fullName">
                  Nome e cognome
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-bob"
                  placeholder="Mario Rossi"
                  autoComplete="name"
                  data-testid="input-fullname"
                  required
                />
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="label-bob" htmlFor="dateOfBirth">
                  Data di nascita
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="input-bob"
                  autoComplete="bday"
                  max={new Date().toISOString().slice(0, 10)}
                  data-testid="input-date-of-birth"
                  required
                />
                <p className="mt-1 text-xs text-bob-ink/50">
                  Devi avere almeno 18 anni per usare BOB.
                </p>
              </div>
            )}

            <div>
              <label className="label-bob" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-bob"
                placeholder="nome@email.it"
                autoComplete="email"
                data-testid="input-email"
                required
              />
            </div>

            <div>
              <label className="label-bob" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-bob"
                placeholder="Almeno 6 caratteri"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                data-testid="input-password"
                required
                minLength={6}
              />
              {mode === "login" && (
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={submitting}
                    className="text-xs font-medium text-bob-indigo hover:underline"
                    data-testid="button-forgot-password"
                  >
                    Password dimenticata?
                  </button>
                </div>
              )}
            </div>

            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-bob-ink/65">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20"
                  data-testid="checkbox-terms"
                  required
                />
                <span>
                  Confermo di avere almeno 18 anni e accetto i{" "}
                  <Link href="/termini" className="underline hover:text-bob-indigo" target="_blank">
                    termini del servizio
                  </Link>{" "}
                  e l&apos;
                  <Link href="/privacy" className="underline hover:text-bob-indigo" target="_blank">
                    informativa privacy
                  </Link>
                  .
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600" data-testid="text-auth-error">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-1 w-full py-3"
              data-testid="button-auth-submit"
            >
              {submitting
                ? "Attendere…"
                : mode === "login"
                ? "Accedi"
                : "Crea account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-bob-ink/60">
            {mode === "login" ? "Non hai un account? " : "Hai già un account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setInfo(null);
              }}
              className="font-semibold text-bob-indigo hover:underline"
              data-testid="button-toggle-mode"
            >
              {mode === "login" ? "Registrati" : "Accedi"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-bob-ink/45">
          Continuando accetti i{" "}
          <Link href="/termini" className="underline hover:text-bob-indigo">
            termini del servizio
          </Link>{" "}
          e l&apos;
          <Link href="/privacy" className="underline hover:text-bob-indigo">
            informativa privacy
          </Link>
          .{" "}
          <Link href="/" className="underline hover:text-bob-indigo">
            Torna alla home
          </Link>
        </p>
      </div>
    </div>
  );
}
