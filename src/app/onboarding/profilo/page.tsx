"use client";

// Onboarding professionista, passo 2: il questionario.
//
// PERCHÉ QUESTA PAGINA
// Poche domande che servono davvero al servizio: che lavoro fai e dove — senza
// queste due il matching non può proporti a nessuno — più anzianità (mostrata
// sul profilo) e canale di provenienza (facoltativo, per capire cosa funziona).
// Flusso deciso con Lucio il 14/08: piano → questionario → dashboard.
//
// COSA FA DAVVERO
// 1. salva le risposte in onboarding_answers (RLS: solo tu e lo staff);
// 2. crea la riga professionals se manca — è QUESTO il momento in cui il
//    profilo pro nasce, prima lo creava lo staff a mano;
// 3. sincronizza il tier con gli eventuali codici promo riscattati al passo 1
//    (il tier è protetto da trigger: passa dal server, non da qui).
//
// PRIVACY (DATA_COMPLIANCE §2): base giuridica contratto per mestiere/città/
// zona/esperienza; heard_from è facoltativo (legittimo interesse, metrica di
// canale). Retention: vita dell'account, cancellazione a cascata. Riga RoPA
// in docs/legal/ROPA.md nello stesso commit.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";

interface CityRow {
  id: string;
  name: string;
  status: string | null;
}
interface ServiceRow {
  id: string;
  name: string;
  slug: string;
}

const CANALI = [
  "Passaparola",
  "Ricerca Google",
  "Social (Instagram, Facebook…)",
  "Un altro professionista",
  "Stampa o news",
  "Altro",
];

export default function OnboardingProfiloPage() {
  return (
    <Suspense
      fallback={
        <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
          Carico…
        </div>
      }
    >
      <ProfiloInner />
    </Suspense>
  );
}

function ProfiloInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const piano = params.get("piano") ?? "free";

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  const [profession, setProfession] = useState("");
  const [professionAltro, setProfessionAltro] = useState("");
  const [cityId, setCityId] = useState("");
  const [zone, setZone] = useState("");
  const [years, setYears] = useState("");
  const [heardFrom, setHeardFrom] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?mode=signup&role=professional");
        return;
      }
      const [{ data: roleRow }, citiesRes, servicesRes] = await Promise.all([
        supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
        supabase.from("cities").select("id, name, status").order("name"),
        supabase.from("services").select("id, name, slug").order("name"),
      ]);
      if (roleRow?.role !== "professional") {
        router.replace("/dashboard");
        return;
      }
      setUserId(user.id);
      setCities((citiesRes.data ?? []) as CityRow[]);
      setServices((servicesRes.data ?? []) as ServiceRow[]);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const professionValue =
        profession === "__altro__" ? professionAltro.trim() : profession;
      if (!professionValue) {
        setError("Dicci che lavoro fai: serve per proporti alle persone giuste.");
        setSubmitting(false);
        return;
      }
      if (!cityId) {
        setError("Scegli la città in cui lavori.");
        setSubmitting(false);
        return;
      }

      // 1. Risposte del questionario (upsert: ricompilare non è un errore).
      const { error: ansErr } = await supabase.from("onboarding_answers").upsert({
        user_id: userId,
        role: "professional",
        profession: professionValue,
        city: cities.find((c) => c.id === cityId)?.name ?? null,
        zone: zone.trim() || null,
        years_experience: years ? Number(years) : null,
        heard_from: heardFrom || null,
        chosen_plan: piano,
      });
      if (ansErr) throw ansErr;

      // 2. La riga professionals nasce qui, se non c'è già.
      const { data: existing } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabase.from("professionals").insert({
          user_id: userId,
          city_id: cityId,
          years_experience: years ? Number(years) : null,
          verification_status: "unverified",
          subscription_tier: "free",
        });
        if (insErr) throw insErr;
      }

      // 3. Applica l'eventuale codice promo riscattato al passo del piano.
      await fetch("/api/onboarding/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });

      router.push("/dashboard/profilo");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
      setSubmitting(false);
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
    <div className="container-bob flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="w-full max-w-lg">
        <div className="card p-7">
          <div className="mb-5 text-center">
            <LogoMark className="mx-auto mb-3" />
            <h1 className="text-xl font-bold text-bob-ink">
              Due domande e ci siamo
            </h1>
            <p className="mt-1 text-sm text-bob-ink/55">
              Servono per proporti alle persone giuste nella tua zona.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label-bob" htmlFor="profession">
                Che lavoro fai?
              </label>
              <select
                id="profession"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="input-bob"
                data-testid="input-profession"
                required
              >
                <option value="">Scegli la categoria…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="__altro__">Altro…</option>
              </select>
              {profession === "__altro__" && (
                <input
                  type="text"
                  value={professionAltro}
                  onChange={(e) => setProfessionAltro(e.target.value)}
                  className="input-bob mt-2"
                  placeholder="Scrivi il tuo mestiere"
                  data-testid="input-profession-altro"
                />
              )}
            </div>

            <div>
              <label className="label-bob" htmlFor="city">
                In che città lavori?
              </label>
              <select
                id="city"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="input-bob"
                data-testid="input-city"
                required
              >
                <option value="">Scegli la città…</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status !== "active" ? " (prossimamente)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-bob" htmlFor="zone">
                Zona o quartiere <span className="font-normal text-bob-ink/40">(facoltativo)</span>
              </label>
              <input
                id="zone"
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="input-bob"
                placeholder="Es. Isola, Navigli, hinterland nord…"
                data-testid="input-zone"
              />
            </div>

            <div>
              <label className="label-bob" htmlFor="years">
                Da quanti anni fai questo lavoro?
              </label>
              <select
                id="years"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="input-bob"
                data-testid="input-years"
              >
                <option value="">Preferisco non dirlo</option>
                {[1, 2, 3, 5, 10, 15, 20, 25, 30].map((y) => (
                  <option key={y} value={String(y)}>
                    {y === 30 ? "30 o più" : `${y}${y === 1 ? " anno" : " anni"}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-bob" htmlFor="heardFrom">
                Come ci hai conosciuto? <span className="font-normal text-bob-ink/40">(facoltativo)</span>
              </label>
              <select
                id="heardFrom"
                value={heardFrom}
                onChange={(e) => setHeardFrom(e.target.value)}
                className="input-bob"
                data-testid="input-heard-from"
              >
                <option value="">Scegli…</option>
                {CANALI.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-50"
              data-testid="button-completa-onboarding"
            >
              {submitting ? "Salvo…" : "Completa e vai al profilo"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
