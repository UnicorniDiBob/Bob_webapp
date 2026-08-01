"use client";

// Profilo professionista self-service: onboarding (prima creazione) e modifica.
// Le colonne sensibili (verifica, tier) sono protette lato DB (migration 016):
// qui il pro gestisce solo presentazione, servizi e prezzi.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import InstantBookingConfig from "@/components/InstantBookingConfig";
import AvailabilityEditor from "@/components/AvailabilityEditor";
import VatVerification from "@/components/VatVerification";
import type { SubscriptionTier } from "@/lib/supabase/types";

interface City {
  id: string;
  name: string;
  status: string;
}
interface Service {
  id: string;
  name: string;
  slug: string;
}
interface Subservice {
  id: string;
  service_id: string;
  name: string;
  slug: string;
}

// Scala standard dei tempi di risposta: un'unica tassonomia
// al posto del testo libero (coerenza sulle card).
const RESPONSE_OPTIONS = [
  "Risponde in poche ore",
  "Risponde in giornata",
  "Risponde in 24h",
  "Risponde in 48h",
];

export default function ProProfiloPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [booted, setBooted] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null); // null = onboarding
  const [serviceRowId, setServiceRowId] = useState<string | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");

  // dati di supporto
  const [cities, setCities] = useState<City[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [subservices, setSubservices] = useState<Subservice[]>([]);

  // campi del form
  const [cityId, setCityId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState<string>("");
  const [responseLabel, setResponseLabel] = useState(RESPONSE_OPTIONS[2]);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [priceNote, setPriceNote] = useState("");
  const [subSlugs, setSubSlugs] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && role && role !== "professional")
      router.replace("/dashboard");
  }, [loading, user, role, router]);

  // Carico dati di supporto + eventuale profilo esistente.
  useEffect(() => {
    if (!user || role !== "professional") return;
    let active = true;
    (async () => {
      const [{ data: cs }, { data: svcs }, { data: subs }, { data: prof }] =
        await Promise.all([
          supabase.from("cities").select("id, name, status").order("name"),
          supabase.from("services").select("id, name, slug").order("name"),
          supabase
            .from("subservices")
            .select("id, service_id, name, slug")
            .order("name"),
          supabase
            .from("professionals")
            .select(
              "id, city_id, headline, bio, years_experience, response_time_label, subservice_slugs, subscription_tier"
            )
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      if (!active) return;

      setCities((cs ?? []) as City[]);
      setServices((svcs ?? []) as Service[]);
      setSubservices((subs ?? []) as Subservice[]);

      if (prof) {
        const p = prof as Record<string, unknown>;
        setProfileId(p.id as string);
        setCityId((p.city_id as string) ?? "");
        setHeadline((p.headline as string) ?? "");
        setBio((p.bio as string) ?? "");
        setYears(
          p.years_experience != null ? String(p.years_experience) : ""
        );
        if (p.response_time_label)
          setResponseLabel(p.response_time_label as string);
        setSubSlugs((p.subservice_slugs as string[]) ?? []);
        setTier((p.subscription_tier as SubscriptionTier) ?? "free");

        // servizio principale + prezzi
        const { data: ps } = await supabase
          .from("professional_services")
          .select("id, service_id, min_price, max_price, price_note")
          .eq("professional_id", p.id as string)
          .limit(1)
          .maybeSingle();
        if (active && ps) {
          const s = ps as Record<string, unknown>;
          setServiceRowId(s.id as string);
          setServiceId((s.service_id as string) ?? "");
          setMinPrice(s.min_price != null ? String(s.min_price) : "");
          setMaxPrice(s.max_price != null ? String(s.max_price) : "");
          setPriceNote((s.price_note as string) ?? "");
        }
      }
      setBooted(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const serviceSubs = useMemo(
    () => subservices.filter((s) => s.service_id === serviceId),
    [subservices, serviceId]
  );

  function toggleSub(slug: string) {
    setSubSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function handleSave() {
    if (!user || saving) return;
    setError(null);

    if (!cityId) return setError("Scegli la tua città.");
    if (!serviceId) return setError("Scegli il servizio che offri.");
    if (headline.trim().length < 5)
      return setError("Scrivi un titolo breve per il tuo profilo (min 5 caratteri).");
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;
    if (minP != null && maxP != null && minP > maxP)
      return setError("Il prezzo minimo non può superare il massimo.");

    setSaving(true);
    try {
      const profileFields = {
        city_id: cityId,
        headline: headline.trim(),
        bio: bio.trim() || null,
        years_experience: years ? Number(years) : null,
        response_time_label: responseLabel,
        subservice_slugs: subSlugs,
      };

      let pid = profileId;
      if (pid) {
        const { error: upErr } = await supabase
          .from("professionals")
          .update(profileFields)
          .eq("id", pid);
        if (upErr) throw upErr;
      } else {
        // Onboarding: la policy impone unverified + free.
        const { data: ins, error: insErr } = await supabase
          .from("professionals")
          .insert({
            user_id: user.id,
            verification_status: "unverified",
            subscription_tier: "free",
            ...profileFields,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        pid = (ins as { id: string }).id;
        setProfileId(pid);
      }

      const serviceFields = {
        professional_id: pid,
        service_id: serviceId,
        city_id: cityId,
        min_price: minP,
        max_price: maxP,
        price_note: priceNote.trim() || null,
      };
      if (serviceRowId) {
        const { error: sErr } = await supabase
          .from("professional_services")
          .update(serviceFields)
          .eq("id", serviceRowId);
        if (sErr) throw sErr;
      } else {
        const { data: sIns, error: sErr } = await supabase
          .from("professional_services")
          .insert(serviceFields)
          .select("id")
          .single();
        if (sErr) throw sErr;
        setServiceRowId((sIns as { id: string }).id);
      }

      setSavedAt(Date.now());
    } catch {
      setError(
        "Non sono riuscito a salvare. Controlla i campi e riprova tra poco."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !booted) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico il tuo profilo…
      </div>
    );
  }

  const isOnboarding = !profileId;

  return (
    <div className="container-bob max-w-3xl py-10">
      <header className="mb-6">
        <span className="section-eyebrow">
          {isOnboarding ? "Benvenuto su BOB" : "Il tuo profilo"}
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          {isOnboarding
            ? "Raccontaci cosa offri"
            : "Modifica il tuo profilo"}
        </h1>
        <p className="mt-2 text-sm text-bob-ink/60">
          {isOnboarding
            ? "Bastano due minuti: queste informazioni compaiono sul tuo profilo pubblico. Dopo il salvataggio il team verifica il profilo e attiva il badge."
            : "Le modifiche sono visibili subito sul tuo profilo pubblico. Il badge di verifica e il piano si gestiscono con il team BOB."}
        </p>
      </header>

      <div className="card space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-bob" htmlFor="pf-city">Città</label>
            <select
              id="pf-city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="input-bob"
              data-testid="profile-city"
            >
              <option value="">Scegli…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status !== "active" ? " (in arrivo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-bob" htmlFor="pf-service">Servizio principale</label>
            <select
              id="pf-service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSubSlugs([]);
              }}
              className="input-bob"
              data-testid="profile-service"
            >
              <option value="">Scegli…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label-bob" htmlFor="pf-headline">
            Titolo del profilo
          </label>
          <input
            id="pf-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={80}
            placeholder="Es. Interventi idraulici rapidi in città"
            className="input-bob"
            data-testid="profile-headline"
          />
        </div>

        <div>
          <label className="label-bob" htmlFor="pf-bio">Chi sei (bio)</label>
          <textarea
            id="pf-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={600}
            rows={4}
            placeholder="Es. Idraulico con 10 anni di esperienza su appartamenti e piccoli condomini…"
            className="input-bob resize-none"
            data-testid="profile-bio"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-bob" htmlFor="pf-years">Anni di esperienza</label>
            <input
              id="pf-years"
              type="number"
              min={0}
              max={60}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="input-bob"
              data-testid="profile-years"
            />
          </div>
          <div>
            <label className="label-bob" htmlFor="pf-response">Tempo di risposta</label>
            <select
              id="pf-response"
              value={responseLabel}
              onChange={(e) => setResponseLabel(e.target.value)}
              className="input-bob"
              data-testid="profile-response"
            >
              {RESPONSE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label-bob">Tariffa indicativa (€/h)</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="input-bob"
              aria-label="Tariffa minima oraria"
              data-testid="profile-min-price"
            />
            <span className="text-bob-ink/40">–</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="input-bob"
              aria-label="Tariffa massima oraria"
              data-testid="profile-max-price"
            />
          </div>
          <input
            value={priceNote}
            onChange={(e) => setPriceNote(e.target.value)}
            maxLength={120}
            placeholder="Nota sul prezzo (es. sopralluogo incluso entro Milano città)"
            className="input-bob mt-2"
            aria-label="Nota sul prezzo"
            data-testid="profile-price-note"
          />
          <p className="mt-1 text-xs text-bob-ink/45">
            I clienti su BOB scelgono chi è trasparente: una forbice onesta
            porta richieste più in linea con le tue tariffe.
          </p>
        </div>

        {serviceSubs.length > 0 && (
          <div>
            <span className="label-bob">Di cosa ti occupi (seleziona)</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {serviceSubs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSub(s.slug)}
                  className={`chip ${
                    subSlugs.includes(s.slug)
                      ? "bg-bob-indigo text-white"
                      : "hover:bg-bob-indigo-100"
                  }`}
                  data-testid={`profile-sub-${s.slug}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isOnboarding && profileId && (
          <div className="border-t border-black/5 pt-5">
            <span className="label-bob">Verifica della partita IVA</span>
            <VatVerification professionalId={profileId} />
          </div>
        )}

        <div className="border-t border-black/5 pt-5">
          <span className="label-bob">Prenotazione diretta</span>
          {isOnboarding || !serviceId ? (
            <p className="mt-1 text-sm text-bob-ink/55">
              Salva prima il profilo e i servizi: poi potrai attivare la
              prenotazione diretta sui lavori a tariffa fissa.
            </p>
          ) : (
            <div className="mt-2">
              <InstantBookingConfig
                professionalId={profileId as string}
                serviceId={serviceId}
                cityId={cityId}
                subSlugs={subSlugs}
                tier={tier}
              />
            </div>
          )}
        </div>

        {!isOnboarding && profileId && (
          <div className="border-t border-black/5 pt-5">
            <span className="label-bob">Orari di disponibilità</span>
            <div className="mt-2">
              <AvailabilityEditor professionalId={profileId} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600" data-testid="profile-error">{error}</p>}
        {savedAt && !error && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ Profilo salvato. {isOnboarding ? "" : "Le modifiche sono già online."}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3"
            data-testid="profile-save"
          >
            {saving
              ? "Salvo…"
              : isOnboarding
              ? "Crea il mio profilo"
              : "Salva le modifiche"}
          </button>
          <Link href="/dashboard" className="btn-secondary flex-1 py-3 text-center">
            Torna alla dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
