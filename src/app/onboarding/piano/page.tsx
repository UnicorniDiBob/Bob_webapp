"use client";

// Onboarding professionista, passo 1: scelta del piano.
//
// PERCHÉ QUESTA PAGINA
// Prima del 14/08 un professionista dopo l'iscrizione atterrava in dashboard
// senza alcun percorso guidato (la riga professionals la creava lo staff a
// mano). Flusso deciso con Lucio il 14/08: conferma email → scelta piano →
// (pagamento, oggi non attivo: codice sconto) → questionario → dashboard.
//
// COSA E' CAMBIATO IL 30/08. Il codice non sceglie più il piano al posto tuo.
// Prima stava in fondo, dentro il pannello di un piano già selezionato, e
// riscattarlo ne applicava un altro: sceglievi Pro e uscivi Business, senza
// che niente te lo dicesse. Adesso il codice sta IN CIMA, perché cambia i
// prezzi che stai per leggere, e dopo averlo inserito i tre piani si vedono
// scontati — a zero, con il codice dei fondatori — e scegli tu. È anche il
// solo modo che abbiamo, noi, di provare Bob da Free, da Pro e da Business
// con lo stesso account, senza correggere una colonna nel database.
//
// La verifica P.IVA è ESCLUSIVA dei piani a pagamento (decisione 14/08, che
// anticipa una parte della 10.11): il piano Free si iscrive e riceve
// richieste, ma non ha il percorso di verifica.
//
// ONESTÀ DEL LISTINO (23.1): qui elenchiamo solo funzioni che ESISTONO oggi
// (portfolio, prenotazione diretta, verifica). Il listino marketing completo
// resta su /per-i-professionisti e va riallineato prima di Stripe (12.4).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Lock, TicketPercent } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import {
  NESSUNO_SCONTO,
  PIANI,
  costaZero,
  etichettaPrezzo,
  pianoById,
  type ScontiPerPiano,
} from "@/lib/piani";

type Piano = "free" | "pro" | "business";

export default function PianoPage() {
  const supabase = createClient();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [sconti, setSconti] = useState<ScontiPerPiano>(NESSUNO_SCONTO);
  const [codici, setCodici] = useState<string[]>([]);
  const [daPagare, setDaPagare] = useState<Piano | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [avanzando, setAvanzando] = useState<Piano | null>(null);

  const leggiStato = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stato" }),
      });
      const json = (await res.json()) as {
        sconti?: ScontiPerPiano;
        codici?: { code: string }[];
      };
      if (json.sconti) setSconti(json.sconti);
      if (json.codici) setCodici([...new Set(json.codici.map((c) => c.code))]);
    } catch {
      // Senza sconti si vede il listino pieno: nessun danno, nessun blocco.
    }
  }, []);

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
      await leggiStato();
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sceglie il piano e passa al questionario. Il piano lo applica il server
  // (subscription_tier è protetta dal trigger): qui si chiede, non si scrive.
  // Se la riga professionals non c'è ancora — ed è il caso normale a questo
  // punto del percorso — la route risponde ok e non applica niente: ci
  // ripensa /onboarding/profilo appena la riga esiste.
  async function scegli(piano: Piano) {
    if (avanzando) return;
    setAvanzando(piano);
    setPromoError(null);
    try {
      const res = await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scegli", piano }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setPromoError(j.error ?? "Non sono riuscito ad attivare il piano.");
        setDaPagare(piano);
        setAvanzando(null);
        return;
      }
    } catch {
      // Rete caduta: si va avanti lo stesso. Il piano viene riapplicato a fine
      // questionario, ed è meglio di un'iscrizione che si blocca qui.
    }
    router.push(`/onboarding/profilo?piano=${piano}`);
  }

  async function riscatta() {
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", code: promoCode }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        sconti?: ScontiPerPiano;
        codici?: { code: string }[];
      };
      if (!res.ok || !json.ok) {
        setPromoError(json.error ?? "Codice non valido.");
        return;
      }
      if (json.sconti) setSconti(json.sconti);
      if (json.codici) setCodici([...new Set(json.codici.map((c) => c.code))]);
      setPromoCode("");
      setDaPagare(null);
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

  const conSconto = codici.length > 0;

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

        {/* IL CODICE STA IN CIMA perché cambia i prezzi che stai per leggere.
            In fondo era un accessorio del pagamento; qui è quello che è: uno
            sconto sul listino. */}
        <div className="card mx-auto mb-6 max-w-lg p-5" data-testid="pannello-codice">
          <div className="flex items-start gap-3">
            <TicketPercent
              className="mt-0.5 h-5 w-5 shrink-0 text-bob-indigo"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-bob-ink">
                {conSconto ? "Il tuo codice è attivo" : "Hai un codice?"}
              </h2>
              <p className="mt-1 text-sm text-bob-ink/60">
                {conSconto
                  ? `Con ${codici.join(", ")} i prezzi qui sotto sono già i tuoi. Scegli il piano che ti serve: nessuno te lo assegna al posto tuo.`
                  : "Inseriscilo adesso: sconta i piani qui sotto, e poi scegli tu quello che vuoi."}
              </p>
              <div className="mt-3 flex gap-2">
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
                  onClick={riscatta}
                  disabled={promoBusy || !promoCode.trim()}
                  className="btn-primary shrink-0 disabled:opacity-50"
                  data-testid="button-redeem-promo"
                >
                  {promoBusy ? "Verifico…" : "Applica"}
                </button>
              </div>
              {promoError && (
                <p className="mt-2 text-xs text-red-600" data-testid="promo-errore">
                  {promoError}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PIANI.map((p) => {
            const et = etichettaPrezzo(p, sconti);
            const gratis = costaZero(p, sconti);
            return (
              <div key={p.id} className="card flex flex-col p-6">
                <h2 className="text-lg font-bold text-bob-ink">{p.nome}</h2>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold text-bob-ink">
                    {et.attuale}
                  </span>
                  {et.listino && (
                    <span className="text-sm text-bob-ink/40 line-through">
                      {et.listino}
                    </span>
                  )}
                </div>
                {et.nota && (
                  <p className="mt-0.5 text-xs text-bob-ink/50">{et.nota}</p>
                )}
                <ul className="mt-4 flex-1 space-y-2">
                  {p.punti.map((punto) => (
                    <li
                      key={punto}
                      className="flex items-start gap-2 text-sm text-bob-ink/70"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-bob-indigo"
                        aria-hidden="true"
                      />
                      {punto}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => (gratis ? scegli(p.id) : setDaPagare(p.id))}
                  disabled={avanzando !== null}
                  className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    gratis && p.id !== "free"
                      ? "btn-primary"
                      : "border border-black/10 text-bob-ink hover:border-black/25"
                  }`}
                  data-testid={`piano-${p.id}`}
                >
                  {avanzando === p.id
                    ? "Attivo…"
                    : p.id === "free"
                      ? "Inizia gratis"
                      : gratis
                        ? `Attiva ${p.nome}`
                        : `Scegli ${p.nome}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Il pannello del pagamento appare solo per un piano che costa
            davvero: con il codice dei fondatori non lo vedrà nessuno. */}
        {daPagare && (
          <div className="card mx-auto mt-6 max-w-lg p-6">
            <div className="flex items-start gap-3">
              <Lock
                className="mt-0.5 h-5 w-5 shrink-0 text-bob-ink/40"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-bob-ink">
                  Pagamenti temporaneamente non attivi
                </h3>
                <p className="mt-1 text-sm text-bob-ink/60">
                  Stiamo completando l&apos;integrazione dei pagamenti:{" "}
                  {pianoById(daPagare).nome} costa{" "}
                  {etichettaPrezzo(pianoById(daPagare), sconti).attuale} al mese
                  e non c&apos;è ancora modo di pagarlo. Se hai un codice che lo
                  copre, inseriscilo qui sopra; altrimenti inizia con Free e
                  passi quando i pagamenti saranno attivi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => scegli("free")}
              className="btn-primary mt-4 py-2.5"
              data-testid="button-continua-free"
            >
              Continua con Free
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
