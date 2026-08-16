"use client";

// Onboarding professionista, passo 1: scelta del piano.
//
// PERCHÉ QUESTA PAGINA
// Prima del 14/08 un professionista dopo l'iscrizione atterrava in dashboard
// senza alcun percorso guidato (la riga professionals la creava lo staff a
// mano). Flusso deciso con Lucio il 14/08: conferma email → scelta piano →
// (pagamento, oggi non attivo: codice promo) → questionario → dashboard.
//
// La verifica P.IVA è ESCLUSIVA dei piani a pagamento (decisione 14/08, che
// anticipa una parte della 10.11): il piano Free si iscrive e riceve
// richieste, ma non ha il percorso di verifica.
//
// ONESTÀ DEL LISTINO (23.1): qui elenchiamo solo funzioni che ESISTONO oggi
// (portfolio, prenotazione diretta, verifica). Il listino marketing completo
// resta su /per-i-professionisti e va riallineato prima di Stripe (12.4).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Lock } from "lucide-react";
import { LogoMark } from "@/components/Logo";

type Piano = "free" | "pro" | "business";

const PIANI: {
  id: Piano;
  nome: string;
  prezzo: string;
  nota: string | null;
  punti: string[];
}[] = [
  {
    id: "free",
    nome: "Free",
    prezzo: "€0",
    nota: "per sempre",
    punti: [
      "Profilo pubblico su BOB",
      "Ricevi richieste e messaggi dai clienti",
      "Calendario e appuntamenti",
    ],
  },
  {
    id: "pro",
    nome: "Bob Pro",
    prezzo: "€24",
    nota: "al mese — €19 con fatturazione annuale",
    punti: [
      "Tutto di Free",
      "Verifica della partita IVA e badge sul profilo",
      "Caricamento documenti per il livello Pro+",
      "1 foto portfolio sul profilo",
      "Prenotazione diretta sui lavori a tariffa fissa",
    ],
  },
  {
    id: "business",
    nome: "Bob Business",
    prezzo: "€59",
    nota: "al mese — €49 con fatturazione annuale",
    punti: [
      "Tutto di Bob Pro",
      "Foto portfolio illimitate",
    ],
  },
];

export default function PianoPage() {
  const supabase = createClient();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [scelto, setScelto] = useState<Piano | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoOk, setPromoOk] = useState<string | null>(null);

  // Solo professionisti autenticati: i clienti non hanno piani.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?mode=signup&role=professional");
        return;
      }
      const { data: roleRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (roleRow?.role !== "professional") {
        router.replace("/dashboard");
        return;
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function avanti(piano: Piano) {
    router.push(`/onboarding/profilo?piano=${piano}`);
  }

  async function riscattaCodice() {
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", code: promoCode }),
      });
      const json = (await res.json()) as { ok?: boolean; tier?: string; error?: string };
      if (!res.ok || !json.ok) {
        setPromoError(json.error ?? "Codice non valido.");
        return;
      }
      setPromoOk(json.tier ?? null);
      // Il tier vero viene applicato/riapplicato a fine questionario (sync).
      avanti((json.tier as Piano) ?? scelto ?? "pro");
    } catch {
      setPromoError("Errore di rete: riprova.");
    } finally {
      setPromoBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico…
      </div>
    );
  }

  return (
    <div className="container-bob py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <LogoMark className="mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-bob-ink">Scegli il tuo piano</h1>
          <p className="mt-1 text-sm text-bob-ink/55">
            Puoi cambiare in ogni momento. Il piano Free non scade.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PIANI.map((p) => (
            <div
              key={p.id}
              className={`card flex flex-col p-6 ${
                scelto === p.id ? "ring-2 ring-bob-indigo" : ""
              }`}
            >
              <h2 className="text-lg font-bold text-bob-ink">{p.nome}</h2>
              <div className="mt-1">
                <span className="text-2xl font-bold text-bob-ink">{p.prezzo}</span>
                {p.nota && (
                  <span className="ml-1 text-xs text-bob-ink/50">{p.nota}</span>
                )}
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {p.punti.map((punto) => (
                  <li key={punto} className="flex items-start gap-2 text-sm text-bob-ink/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-bob-indigo" aria-hidden="true" />
                    {punto}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setScelto(p.id);
                  setPromoError(null);
                  if (p.id === "free") avanti("free");
                }}
                className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  p.id === "free"
                    ? "border border-black/10 text-bob-ink hover:border-black/25"
                    : "btn-primary"
                }`}
                data-testid={`piano-${p.id}`}
              >
                {p.id === "free" ? "Inizia gratis" : `Scegli ${p.nome}`}
              </button>
            </div>
          ))}
        </div>

        {/* Pannello pagamento: appare scegliendo un piano a pagamento. */}
        {scelto && scelto !== "free" && (
          <div className="card mx-auto mt-6 max-w-lg p-6">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-bob-ink/40" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-bob-ink">
                  Pagamenti temporaneamente non attivi
                </h3>
                <p className="mt-1 text-sm text-bob-ink/60">
                  Stiamo completando l&apos;integrazione dei pagamenti. Se hai
                  un codice promozionale puoi attivare il piano adesso;
                  altrimenti inizia con Free e passa a {PIANI.find((p) => p.id === scelto)?.nome}{" "}
                  quando i pagamenti saranno attivi.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="input-bob flex-1"
                placeholder="Codice promozionale"
                data-testid="input-promo-code"
              />
              <button
                type="button"
                onClick={riscattaCodice}
                disabled={promoBusy || !promoCode.trim()}
                className="btn-primary shrink-0 disabled:opacity-50"
                data-testid="button-redeem-promo"
              >
                {promoBusy ? "Verifico…" : "Attiva"}
              </button>
            </div>
            {promoError && (
              <p className="mt-2 text-xs text-red-600">{promoError}</p>
            )}
            {promoOk && (
              <p className="mt-2 text-xs text-emerald-700">
                Codice accettato: piano {promoOk} attivato.
              </p>
            )}
            <button
              type="button"
              onClick={() => avanti("free")}
              className="mt-3 text-xs font-medium text-bob-indigo hover:underline"
            >
              Continua con Free per ora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
