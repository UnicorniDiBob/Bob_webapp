"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { User, Wrench, FileText, Check } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { TermsDialog } from "@/components/TermsDialog";
import { TERMS_VERSION } from "@/components/TermsContent";
import type { UserRole } from "@/lib/supabase/types";

type Mode = "login" | "signup";

// Deve restare allineata a Supabase > Authentication > Providers > Email:
// alzata a 8 il 9 agosto come mitigazione al posto della leaked password
// protection, che sul piano Free non e' attivabile. Il form validava ancora a
// 6, quindi accettava password che il server rifiutava.
const PASSWORD_MIN = 8;

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
  // Nome e cognome separati (052): dati puliti da subito, full_name resta
  // per compatibilità e viene composto dal trigger handle_new_user.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Conferma della password: compare solo in iscrizione (vedi il campo nel form).
  const [password2, setPassword2] = useState("");
  // Data di nascita a tre tendine (gg/mm/aaaa): su mobile il type="date"
  // apre un calendario che parte da oggi e costringe a sfogliare decenni.
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  // Attesa della conferma email: quando è valorizzato, il form lascia il
  // posto alla schermata "controlla la posta" che riprova il login da sola.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Il consenso si sblocca solo dopo che i termini sono stati aperti: non si
  // può accettare qualcosa che non si è nemmeno visto.
  const [termsOpened, setTermsOpened] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Cambiando ruolo cambia il testo dei termini applicabile: azzeriamo lettura
  // e consenso, altrimenti l'utente risulterebbe aver accettato l'altro testo.
  function changeRole(next: Extract<UserRole, "customer" | "professional">) {
    if (next === role) return;
    setRole(next);
    setTermsOpened(false);
    setTermsAccepted(false);
  }

  // Compone la data ISO dalle tre tendine; null se incompleta o inesistente
  // (es. 31 febbraio: il Date la "corregge" e noi la rifiutiamo).
  function composeDob(): string | null {
    if (!dobDay || !dobMonth || !dobYear) return null;
    const iso = `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`;
    const d = new Date(iso + "T00:00:00");
    if (
      d.getFullYear() !== Number(dobYear) ||
      d.getMonth() + 1 !== Number(dobMonth) ||
      d.getDate() !== Number(dobDay)
    ) {
      return null;
    }
    return iso;
  }

  // Dopo la conferma email l'utente va instradato dove serve: il pro inizia
  // l'onboarding (piano → questionario), il cliente torna dov'era.
  async function routeAfterConfirm() {
    await refresh();
    const { data: authData } = await supabase.auth.getUser();
    let dest = role === "professional" ? "/onboarding/piano" : returnTo;
    if (authData.user) {
      const { data: roleRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (roleRow?.role === "professional") dest = "/onboarding/piano";
    }
    router.push(dest);
    router.refresh();
  }

  // Polling della conferma: riprova il login in silenzio. Con l'email non
  // ancora confermata Supabase risponde "Email not confirmed" e si riprova;
  // appena il link è stato cliccato il login riesce e si va avanti. Ogni 15s
  // per non urtare il rate limit del token endpoint; c'è anche il bottone
  // manuale per chi ha appena confermato e non vuole aspettare.
  useEffect(() => {
    if (!awaitingConfirm) return;
    let cancelled = false;
    async function attempt() {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!cancelled && !err && data.session) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        await routeAfterConfirm();
      }
    }
    pollTimer.current = setInterval(attempt, 15000);
    return () => {
      cancelled = true;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingConfirm]);

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
        if (firstName.trim().length < 2) {
          setError("Inserisci il tuo nome.");
          setSubmitting(false);
          return;
        }
        if (lastName.trim().length < 2) {
          setError("Inserisci il tuo cognome.");
          setSubmitting(false);
          return;
        }
        // La soglia deve restare allineata a Supabase > Authentication >
        // Providers > Email, alzata a 8 il 9 agosto. Controllarla qui serve a
        // dare un messaggio che spiega, invece dell'errore generico del server.
        if (password.length < PASSWORD_MIN) {
          setError(`La password deve avere almeno ${PASSWORD_MIN} caratteri.`);
          setSubmitting(false);
          return;
        }
        if (password !== password2) {
          setError(
            "Le due password non coincidono: ricontrolla, così non rischi di registrarti con una password che non conosci."
          );
          setSubmitting(false);
          return;
        }
        const dateOfBirth = composeDob();
        if (!dateOfBirth) {
          setError("Completa la data di nascita: giorno, mese e anno.");
          setSubmitting(false);
          return;
        }
        if (calcAge(dateOfBirth) < 18) {
          setError("Devi avere almeno 18 anni per registrarti su BOB.");
          setSubmitting(false);
          return;
        }
        if (!termsOpened) {
          setError(
            "Per continuare apri e leggi i termini del servizio: trovi il link qui sotto."
          );
          setTermsDialogOpen(true);
          setSubmitting(false);
          return;
        }
        if (!termsAccepted) {
          setError(
            "Spunta la casella per confermare che accetti i termini del servizio e l'informativa privacy."
          );
          setSubmitting(false);
          return;
        }
        // Il trigger handle_new_user legge role, first/last name (052),
        // date_of_birth e terms_accepted_at da raw_user_meta_data.
        const { data, error: signErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`,
              date_of_birth: dateOfBirth,
              terms_accepted_at: new Date().toISOString(),
              // Registriamo QUALE versione dei termini è stata accettata
              // (migration 028): serve come prova di cosa l'utente ha letto.
              terms_version: TERMS_VERSION,
            },
          },
        });
        if (signErr) throw signErr;

        // Email già registrata: Supabase per non rivelare gli iscritti
        // risponde "ok" con un utente fittizio senza identità e NON invia
        // nessuna mail. Se non lo intercettiamo qui, l'utente resta ad
        // aspettare una mail che non arriverà mai (successo il 14/08).
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setError(
            "Questa email è già registrata. Prova ad accedere, o usa «Password dimenticata?» se non la ricordi."
          );
          setMode("login");
          setSubmitting(false);
          return;
        }

        // Conferma email richiesta: schermata di attesa che riprova da sola.
        if (!data.session) {
          setAwaitingConfirm(true);
          setSubmitting(false);
          return;
        }
        // Conferma non richiesta (config dev): avanti subito.
        if (role === "professional") {
          await refresh();
          router.push("/onboarding/piano");
          router.refresh();
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

      // Gli account staff (admin/CS) non hanno un'area personale: se la
      // destinazione è quella di default, vanno dritti al pannello admin.
      let dest = returnTo;
      if (returnTo === "/dashboard") {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data: roleRow } = await supabase
            .from("users")
            .select("role")
            .eq("id", authData.user.id)
            .maybeSingle();
          if (roleRow?.role === "admin" || roleRow?.role === "cs") {
            dest = "/admin";
          }
        }
      }

      router.push(dest);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore imprevisto";
      // Messaggi Supabase comuni tradotti in italiano amichevole.
      if (/invalid login credentials/i.test(msg)) {
        setError("Email o password non corretti.");
      } else if (/already registered/i.test(msg)) {
        setError("Questa email è già registrata. Prova ad accedere.");
      } else if (/email address .* is invalid/i.test(msg)) {
        // Supabase valida il dominio alla registrazione: un indirizzo su un
        // dominio inesistente viene rifiutato prima ancora dell'invio.
        setError(
          "Questo indirizzo email non sembra valido: controlla di averlo scritto giusto (anche il dominio dopo la @)."
        );
      } else if (/email not confirmed/i.test(msg)) {
        setError(
          "Devi prima confermare l'email: cerca la mail di BOB nella posta (anche nello spam)."
        );
      } else if (/password should be at least/i.test(msg)) {
        setError("La password deve avere almeno 8 caratteri.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Schermata di attesa post-iscrizione: si aggiorna da sola appena l'email
  // risulta confermata (polling silenzioso), senza chiedere di ri-loggarsi.
  if (awaitingConfirm) {
    return (
      <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="card p-7 text-center">
            <LogoMark className="mx-auto mb-3" />
            <h1 className="text-xl font-bold text-bob-ink">
              Controlla la posta
            </h1>
            <p className="mt-2 text-sm text-bob-ink/65">
              Ti abbiamo inviato una mail a{" "}
              <span className="font-medium text-bob-ink">{email}</span> per
              confermare l&apos;indirizzo. Apri il link, poi torna qui: questa
              pagina si aggiorna da sola.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-bob-ink/50">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bob-indigo" />
              In attesa della conferma…
            </div>
            <button
              type="button"
              onClick={async () => {
                const { data } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                if (data.session) {
                  await routeAfterConfirm();
                } else {
                  setInfo(
                    "Non risulta ancora confermata: controlla anche lo spam."
                  );
                }
              }}
              className="btn-primary mt-5 w-full"
              data-testid="button-ho-confermato"
            >
              Ho confermato
            </button>
            {info && (
              <p className="mt-3 text-xs text-bob-ink/55">{info}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setAwaitingConfirm(false);
                setInfo(null);
                setMode("login");
              }}
              className="mt-3 text-xs font-medium text-bob-indigo hover:underline"
            >
              Torna all&apos;accesso
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      {/* Modal dei termini: aprirlo sblocca la casella di consenso. */}
      <TermsDialog
        open={termsDialogOpen}
        audience={role}
        onClose={() => {
          setTermsDialogOpen(false);
          // Anche la semplice apertura conta come "visualizzato": sbloccarlo
          // solo con il pulsante renderebbe il flusso inutilmente rigido.
          setTermsOpened(true);
        }}
        onAccept={() => {
          setTermsDialogOpen(false);
          setTermsOpened(true);
          setTermsAccepted(true);
          setError(null);
        }}
      />
      <div className="w-full max-w-md">
        <div className="card p-7">
          <div className="mb-5 text-center">
            <LogoMark className="mx-auto mb-3" />
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
                  onClick={() => changeRole("customer")}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    role === "customer"
                      ? "border-bob-indigo bg-bob-indigo-50 text-bob-indigo"
                      : "border-black/10 text-bob-ink/65 hover:border-black/20"
                  }`}
                  data-testid="role-customer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4" aria-hidden="true" />
                    Cliente
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-bob-ink/50">
                    Cerco un servizio
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => changeRole("professional")}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    role === "professional"
                      ? "border-bob-indigo bg-bob-indigo-50 text-bob-indigo"
                      : "border-black/10 text-bob-ink/65 hover:border-black/20"
                  }`}
                  data-testid="role-professional"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Wrench className="h-4 w-4" aria-hidden="true" />
                    Professionista
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-bob-ink/50">
                    Offro un servizio
                  </span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-bob" htmlFor="firstName">
                    Nome
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-bob"
                    placeholder="Mario"
                    autoComplete="given-name"
                    data-testid="input-firstname"
                    required
                  />
                </div>
                <div>
                  <label className="label-bob" htmlFor="lastName">
                    Cognome
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-bob"
                    placeholder="Rossi"
                    autoComplete="family-name"
                    data-testid="input-lastname"
                    required
                  />
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <span className="label-bob">Data di nascita</span>
                {/* Tre tendine (gg/mm/aaaa): più dirette del calendario del
                    type="date", che parte da oggi e fa sfogliare decenni. */}
                <div className="grid grid-cols-3 gap-2">
                  <select
                    aria-label="Giorno di nascita"
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    className="input-bob"
                    data-testid="input-dob-day"
                    required
                  >
                    <option value="">Giorno</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Mese di nascita"
                    value={dobMonth}
                    onChange={(e) => setDobMonth(e.target.value)}
                    className="input-bob"
                    data-testid="input-dob-month"
                    required
                  >
                    <option value="">Mese</option>
                    {[
                      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio",
                      "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre",
                      "Novembre", "Dicembre",
                    ].map((m, i) => (
                      <option key={m} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Anno di nascita"
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    className="input-bob"
                    data-testid="input-dob-year"
                    required
                  >
                    <option value="">Anno</option>
                    {Array.from(
                      { length: 83 },
                      (_, i) => new Date().getFullYear() - 18 - i
                    ).map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
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
                placeholder={
                  mode === "signup"
                    ? `Almeno ${PASSWORD_MIN} caratteri`
                    : undefined
                }
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                data-testid="input-password"
                required
                minLength={mode === "signup" ? PASSWORD_MIN : undefined}
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

            {/* SECONDO CAMPO PASSWORD, SOLO ALL'ISCRIZIONE (19/08).
                Prima ce n'era uno solo e nessun controllo di lunghezza lato
                client: chi sbagliava a digitare si registrava con una password
                che non conosceva, e l'unica uscita era "password dimenticata".
                Funziona — quella mail la manda Supabase, non Resend — ma e' un
                giro che non deve servire, e a ottobre lo farebbe un
                professionista appena reclutato al telefono. */}
            {mode === "signup" && (
              <div>
                <label className="label-bob" htmlFor="password2">
                  Ripeti la password
                </label>
                <input
                  id="password2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="input-bob"
                  autoComplete="new-password"
                  data-testid="input-password-2"
                  required
                  minLength={PASSWORD_MIN}
                />
                {password2.length > 0 && password !== password2 && (
                  <p
                    className="mt-1.5 text-xs text-red-600"
                    data-testid="password-mismatch"
                  >
                    Le due password non coincidono.
                  </p>
                )}
              </div>
            )}

            {mode === "signup" && (
              <div
                className={`rounded-xl border p-3 transition ${
                  termsOpened
                    ? "border-black/10 bg-transparent"
                    : "border-bob-indigo/25 bg-bob-indigo-50/60"
                }`}
              >
                {/* Gate: finché i termini non sono stati aperti, il consenso
                    resta bloccato. Cliccare la casella apre il testo invece di
                    mostrare un errore: più utile che punitivo. */}
                <label
                  className="flex items-start gap-2 text-xs text-bob-ink/65"
                  onClick={(e) => {
                    if (!termsOpened) {
                      e.preventDefault();
                      setTermsDialogOpen(true);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={!termsOpened}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 disabled:cursor-pointer disabled:opacity-50"
                    data-testid="checkbox-terms"
                    aria-describedby="terms-gate-hint"
                  />
                  <span>
                    Confermo di avere almeno 18 anni, di aver letto e di
                    accettare i{" "}
                    <Link
                      href={
                        role === "professional"
                          ? "/termini/professionisti"
                          : "/termini"
                      }
                      className="underline hover:text-bob-indigo"
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      termini del servizio
                      {role === "professional" ? " per i professionisti" : ""}
                    </Link>{" "}
                    e l&apos;
                    <Link
                      href="/privacy"
                      className="underline hover:text-bob-indigo"
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      informativa privacy
                    </Link>
                    .
                  </span>
                </label>

                <div id="terms-gate-hint" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => setTermsDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-bob-indigo shadow-sm ring-1 ring-bob-indigo/20 transition hover:bg-bob-indigo-50"
                    data-testid="button-open-terms"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    {termsOpened ? "Rileggi i termini" : "Leggi i termini del servizio"}
                  </button>
                  {termsOpened ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Termini visualizzati
                    </span>
                  ) : (
                    <span className="text-xs text-bob-ink/50">
                      Aprili per poter spuntare la casella
                    </span>
                  )}
                </div>
              </div>
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
