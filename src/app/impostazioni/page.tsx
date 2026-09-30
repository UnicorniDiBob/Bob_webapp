"use client";

// /impostazioni — LA GRIGLIA (30/09, modello Amazon).
//
// Prima questo indirizzo non era una pagina: next.config lo rimandava su
// /impostazioni/dati, e le sezioni si vedevano solo come una colonna che
// cresceva a ogni funzione nuova. Qui ogni sezione e' un riquadro con icona,
// titolo e la stessa riga di aiuto della colonna: tre per riga su desktop,
// uno per riga a 390px. Le voci sono quelle di vociImpostazioni(), le stesse
// della colonna: chi vede cosa si decide in un posto solo.

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { vociImpostazioni } from "@/components/ImpostazioniShell";

export default function ImpostazioniPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // Il middleware rimanda gia' al login chi arriva senza sessione; questo
  // copre la sessione che scade mentre la pagina e' aperta.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?returnTo=/impostazioni");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="card p-6 text-sm text-bob-ink/65" aria-busy="true">
        Carico…
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="griglia-impostazioni">
      {vociImpostazioni(role).map(({ href, label, hint, icona: Icona }) => (
        <li key={href} className="flex">
          <Link
            href={href}
            className="card flex w-full items-start gap-4 p-5 hover:-translate-y-0.5 hover:border-bob-indigo/30 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-bob-indigo/30"
            data-testid={`riquadro-${href.split("/").pop()}`}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bob-indigo-50 text-bob-indigo">
              <Icona className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-bob-ink">{label}</span>
              <span className="mt-1 block text-sm leading-snug text-bob-ink/70">{hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
