"use client";

// Banda pre-footer per l'acquisizione professionisti.
// Il funnel pro esce dall'header (che serve il lato domanda) e vive qui:
// visibile a fine scroll sulle pagine pubbliche, solo per chi non è loggato.
// Sparisce dove sarebbe rumore: pagina pro stessa, login/auth, aree personali.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const HIDDEN_PREFIXES = [
  "/per-i-professionisti",
  "/login",
  "/auth",
  "/admin",
  "/dashboard",
  "/impostazioni",
  "/messaggi",
];

export function ProBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || user) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <section className="bg-bob-indigo" data-testid="pro-banner">
      <div className="container-bob flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Sei un professionista?
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            Più lavoro vero, zero contatti comprati.
          </p>
          <p className="mt-1 text-sm text-white/70">
            Nessun lead a pagamento: la fee si applica solo quando un lavoro si
            chiude davvero.
          </p>
        </div>
        <Link
          href="/per-i-professionisti"
          className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-bob-indigo transition hover:bg-white/90"
          data-testid="link-pro-banner"
        >
          Scopri come funziona →
        </Link>
      </div>
    </section>
  );
}
