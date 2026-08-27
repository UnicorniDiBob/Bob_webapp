// Pagina di atterraggio della conferma email.
//
// PERCHÉ ESISTE
// signUp() non passava emailRedirectTo, quindi il link nella mail portava alla
// Site URL del progetto: si atterrava sulla home, senza una parola che dicesse
// com'era andata. Chi si iscrive e apre la mail sul telefono resta senza
// risposta, e non sa se può accedere.
//
// COSA SA, E COSA NON PUÒ SAPERE
// Quando il browser arriva qui la verifica È GIÀ AVVENUTA: l'ha fatta Supabase
// sul suo endpoint, prima di reindirizzare. Quindi qui non si verifica niente,
// e non si deve MAI dire che è fallita. L'unica cosa che può mancare è la
// SESSIONE: il codice PKCE si scambia solo nel browser che ha iniziato
// l'iscrizione, perché il code_verifier sta nel suo storage. Mail aperta sul
// telefono e iscrizione dal computer: lo scambio non riesce, l'indirizzo è
// confermato lo stesso, e si chiede di accedere.
//
// CONFIGURAZIONE NECESSARIA (non è codice)
// L'URL di questa pagina deve stare fra i Redirect URLs del progetto Supabase,
// altrimenti emailRedirectTo viene ignorato e si torna alla home:
// Authentication → URL Configuration → Redirect URLs.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";

type Stato = "verifica" | "con-sessione" | "senza-sessione" | "link-scaduto";

export default function ConfermaEmailPage() {
  const supabase = createClient();
  const router = useRouter();

  const [stato, setStato] = useState<Stato>("verifica");
  const [ruolo, setRuolo] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;

    async function init() {
      const url = new URL(window.location.href);
      // Un link già usato o scaduto torna con l'errore in query o nell'hash.
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errore = url.searchParams.get("error") ?? hash.get("error");
      const codice = url.searchParams.get("code");

      if (codice) {
        await supabase.auth.exchangeCodeForSession(codice).catch(() => null);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (annullato) return;

      if (session) {
        const { data: riga } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (annullato) return;
        setRuolo(riga?.role ?? null);
        setStato("con-sessione");
        return;
      }

      // Nessuna sessione: se il link portava un errore lo diciamo, altrimenti
      // la conferma è avvenuta e manca solo l'accesso in questo browser.
      setStato(errore ? "link-scaduto" : "senza-sessione");
    }

    // La sessione può arrivare in ritardo: detectSessionInUrl è asincrono.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session && !annullato) setStato("con-sessione");
    });

    init();
    return () => {
      annullato = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function avanti() {
    router.push(ruolo === "professional" ? "/onboarding/piano" : "/");
    router.refresh();
  }

  return (
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="card p-7 text-center">
          <LogoMark className="mx-auto mb-4" />

          {stato === "verifica" && (
            <p className="text-sm text-bob-ink/50">Un istante…</p>
          )}

          {stato !== "verifica" && stato !== "link-scaduto" && (
            <>
              <CheckCircle2
                className="mx-auto mb-3 h-10 w-10 text-emerald-600"
                aria-hidden="true"
              />
              <h1 className="text-xl font-bold text-bob-ink">
                Email confermata
              </h1>
            </>
          )}

          {stato === "con-sessione" && (
            <>
              <p className="mt-2 text-sm text-bob-ink/60">
                {ruolo === "professional"
                  ? "Il tuo indirizzo è verificato. Ora scegliamo il piano e prepariamo il profilo: ci vogliono due minuti."
                  : "Il tuo indirizzo è verificato. Puoi iniziare a usare BOB."}
              </p>
              <button
                type="button"
                onClick={avanti}
                className="btn-primary mt-5 w-full"
                data-testid="button-continua-dopo-conferma"
              >
                {ruolo === "professional" ? "Continua" : "Vai su BOB"}
              </button>
            </>
          )}

          {stato === "senza-sessione" && (
            <>
              <p className="mt-2 text-sm text-bob-ink/60">
                Il tuo indirizzo è verificato. Da questo dispositivo serve
                accedere: se ti sei iscritto da un altro browser, quella scheda
                va avanti da sola.
              </p>
              <Link href="/login" className="btn-primary mt-5 inline-block w-full">
                Accedi
              </Link>
            </>
          )}

          {stato === "link-scaduto" && (
            <>
              <h1 className="text-xl font-bold text-bob-ink">
                Questo link non è più valido
              </h1>
              <p className="mt-2 text-sm text-bob-ink/60">
                I link di conferma scadono, e valgono una volta sola. Prova ad
                accedere: se l&apos;indirizzo risulta già confermato entri senza
                altri passaggi, altrimenti te ne mandiamo un altro.
              </p>
              <Link href="/login" className="btn-primary mt-5 inline-block w-full">
                Vai all&apos;accesso
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
