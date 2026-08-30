"use client";

// /notifiche — l'elenco per intero.
//
// PERCHE' UNA PAGINA E NON SOLO LA TENDINA. La tendina mostra quattro voci e
// tronca i testi: va bene per accorgersi, non per leggere. Una risposta
// dell'assistenza puo' essere lunga dieci righe, e leggerla dentro un
// riquadro che si chiude al primo clic fuori e' un modo per non leggerla.
//
// PERCHE' NON STA SOTTO /impostazioni. Le impostazioni sono cose che decidi
// tu; queste sono cose che diciamo noi. Metterle li' dentro le avrebbe
// rimesse esattamente dove stavano prima: in una sezione in cui si entra
// due volte l'anno.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, RotateCw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useNotifiche } from "@/components/NotificheProvider";
import { NotificaVoce } from "@/components/NotificaVoce";
import { daVedere, leggiViste } from "@/lib/notifiche";

export default function NotifichePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { notifiche, caricate, ricarica, segnaLette } = useNotifiche();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?returnTo=/notifiche");
  }, [loading, user, router]);

  // Arrivare qui vale come averle aperte: le notizie diventano lette, le cose
  // da fare no (si spengono quando sono fatte).
  useEffect(() => {
    if (caricate) segnaLette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caricate]);

  // Congelato al primo render: i pallini restano visibili mentre li leggi.
  const visteAllApertura =
    typeof window === "undefined" ? null : leggiViste();

  if (loading || !user) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico…
      </div>
    );
  }

  return (
    <div className="container-bob max-w-2xl py-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="section-eyebrow">Notifiche di servizio</span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-bob-ink">
            <Bell className="h-6 w-6 text-bob-ink/40" aria-hidden="true" />
            Cosa ti abbiamo detto
          </h1>
          <p className="mt-1.5 text-sm text-bob-ink/60">
            Verifica, risposte dell&apos;assistenza, stato del tuo profilo e
            del tuo account. I messaggi dei clienti stanno in{" "}
            <Link
              href="/messaggi"
              className="font-medium text-bob-indigo hover:underline"
            >
              Messaggi
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => ricarica()}
          className="btn-ghost inline-flex items-center gap-1.5 text-sm"
          data-testid="button-ricarica-notifiche"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Ricontrolla
        </button>
      </header>

      {!caricate ? (
        <div className="card p-6 text-center text-sm text-bob-ink/50">
          Controllo…
        </div>
      ) : notifiche.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-base font-semibold text-bob-ink">
            Non c&apos;è niente da leggere.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-bob-ink/55">
            Quando avremo qualcosa da dirti — una verifica da completare, una
            risposta dell&apos;assistenza, un problema sul tuo profilo — lo
            trovi qui, e la campanella nell&apos;intestazione si accende.
          </p>
        </div>
      ) : (
        <ul
          className="card divide-y divide-black/5 overflow-hidden p-0"
          data-testid="elenco-notifiche"
        >
          {notifiche.map((n) => (
            <NotificaVoce
              key={n.id}
              n={n}
              nuova={daVedere(n, visteAllApertura)}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-xs leading-relaxed text-bob-ink/40">
        Queste notifiche si calcolano dal tuo account ogni volta che apri la
        pagina: non sono una copia salvata da qualche parte, quindi spariscono
        da sole quando la cosa che le ha fatte nascere è risolta.
      </p>
    </div>
  );
}
