"use client";

// Dashboard KPI admin — prima versione.
//
// Dataset piccolo (demo/early stage): fetch grezzo lato server (vedi
// page.tsx), tutto il filtro/aggregazione avviene qui lato client, come
// già fatto in UsersList.
//
// KPI inclusi in questa prima parte:
// 1. Utenti per ruolo (clienti vs professionisti), con breakdown per fascia
//    d'età e filtro per periodo di iscrizione.
// 2. Conversione Free→Pro: quota di professionisti Pro/Business sul totale
//    filtrato. È uno snapshot sulla situazione attuale, non un vero tasso
//    "nel tempo" — non abbiamo ancora uno storico dei cambi tier in DB
//    (richiederebbe una tabella di audit dedicata, rimandato).
// 3. Interazioni vs contratti conclusi: quante richieste escono dalla bozza
//    ("interazione") e quante arrivano a "closed", con il relativo tasso.
//
// Filtro geografico: usa la città della RICHIESTA (requests.city_id) per il
// KPI 3, e la città di registrazione del professionista (professionals.city_id)
// per il KPI 2 — sono cose diverse apposta: la città del lavoro può non
// coincidere con quella del professionista che risponde, specie nei centri
// piccoli.
//
// Non ancora incluso (serve capire meglio lo scope prima di costruirlo):
// frequenza delle keyword di ricerca (non logghiamo ancora il testo libero
// delle richieste in una forma aggregabile) e un vero storico di
// conversione Free→Pro nel tempo.

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MacroRegion = "nord" | "centro" | "sud";

interface CityRow {
  id: string;
  name: string;
  slug: string;
  province: string | null;
  region: string | null;
  macro_region: MacroRegion | null;
}

interface UserRow {
  id: string;
  role: "customer" | "professional" | "admin" | "cs";
  created_at: string | null;
}

interface ProfileRow {
  user_id: string;
  date_of_birth: string | null;
}

interface ProfessionalRow {
  id: string;
  user_id: string;
  city_id: string;
  subscription_tier: "free" | "pro" | "business";
  verification_status: string;
  created_at: string | null;
}

interface RequestRow {
  id: string;
  customer_id: string;
  city_id: string;
  status: "draft" | "sent" | "quote_request" | "matched" | "closed";
  created_at: string | null;
}

export interface KpiRawData {
  cities: CityRow[];
  users: UserRow[];
  profiles: ProfileRow[];
  professionals: ProfessionalRow[];
  requests: RequestRow[];
}

type Tab = "roles" | "conversion" | "funnel";

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: "roles", label: "Utenti per ruolo", icon: "👥" },
  { value: "conversion", label: "Conversione Free→Pro", icon: "⭐" },
  { value: "funnel", label: "Interazioni vs contratti conclusi", icon: "🔁" },
];

const AGE_BRACKETS = [
  { key: "18-24", min: 18, max: 24 },
  { key: "25-34", min: 25, max: 34 },
  { key: "35-44", min: 35, max: 44 },
  { key: "45-54", min: 45, max: 54 },
  { key: "55-64", min: 55, max: 64 },
  { key: "65+", min: 65, max: 200 },
] as const;

const MACRO_ORDER: MacroRegion[] = ["nord", "centro", "sud"];
const MACRO_LABEL: Record<MacroRegion, string> = {
  nord: "Nord",
  centro: "Centro",
  sud: "Sud",
};

const REQUEST_STATUS_LABEL: Record<RequestRow["status"], string> = {
  draft: "Bozza",
  sent: "Inviata",
  quote_request: "Richiesta preventivo",
  matched: "Abbinata",
  closed: "Conclusa",
};

const TIER_LABEL: Record<ProfessionalRow["subscription_tier"], string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const COLORS = {
  indigo: "#3730a3",
  indigoLight: "#818cf8",
  yellow: "#fbbf24",
  emerald: "#10b981",
  slate: "#94a3b8",
};

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function bracketFor(age: number | null): string | null {
  if (age == null) return null;
  const b = AGE_BRACKETS.find((b) => age >= b.min && age <= b.max);
  return b?.key ?? null;
}

function inDateRange(dateStr: string | null, from: string, to: string): boolean {
  if (!dateStr) return !from && !to;
  const t = new Date(dateStr).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 24 * 3600 * 1000 - 1) return false;
  return true;
}

export function KpiDashboard({ data }: { data: KpiRawData }) {
  const [tab, setTab] = useState<Tab>("roles");

  // Filtri periodo (condivisi, riletti per la data pertinente a ogni tab)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Filtro età (solo tab "roles")
  const [selectedBrackets, setSelectedBrackets] = useState<Set<string>>(new Set());

  // Filtro geografico cascading (tab "conversion" e "funnel")
  const [macroRegion, setMacroRegion] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [cityId, setCityId] = useState<string>("");

  const cityById = useMemo(
    () => Object.fromEntries(data.cities.map((c) => [c.id, c])),
    [data.cities]
  );

  const regionOptions = useMemo(() => {
    const set = new Set(
      data.cities
        .filter((c) => !macroRegion || c.macro_region === macroRegion)
        .map((c) => c.region)
        .filter((r): r is string => !!r)
    );
    return [...set].sort();
  }, [data.cities, macroRegion]);

  const provinceOptions = useMemo(() => {
    const set = new Set(
      data.cities
        .filter((c) => !macroRegion || c.macro_region === macroRegion)
        .filter((c) => !region || c.region === region)
        .map((c) => c.province)
        .filter((p): p is string => !!p)
    );
    return [...set].sort();
  }, [data.cities, macroRegion, region]);

  const cityOptions = useMemo(() => {
    return data.cities
      .filter((c) => !macroRegion || c.macro_region === macroRegion)
      .filter((c) => !region || c.region === region)
      .filter((c) => !province || c.province === province)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.cities, macroRegion, region, province]);

  const cityMatchesGeo = useCallback(
    (cid: string | null): boolean => {
      if (!cid) return !macroRegion && !region && !province && !cityId;
      const c = cityById[cid];
      if (!c) return false;
      if (cityId) return c.id === cityId;
      if (province) return c.province === province;
      if (region) return c.region === region;
      if (macroRegion) return c.macro_region === macroRegion;
      return true;
    },
    [cityById, cityId, province, region, macroRegion]
  );

  function toggleBracket(key: string) {
    setSelectedBrackets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ---------- KPI 1: utenti per ruolo ----------
  const profileByUser = useMemo(
    () => Object.fromEntries(data.profiles.map((p) => [p.user_id, p])),
    [data.profiles]
  );

  const rolesResult = useMemo(() => {
    const marketplaceUsers = data.users.filter(
      (u) => u.role === "customer" || u.role === "professional"
    );
    const filtered = marketplaceUsers.filter((u) => {
      if (!inDateRange(u.created_at, dateFrom, dateTo)) return false;
      if (selectedBrackets.size > 0) {
        const dob = profileByUser[u.id]?.date_of_birth ?? null;
        const bracket = bracketFor(ageFromDob(dob));
        if (!bracket || !selectedBrackets.has(bracket)) return false;
      }
      return true;
    });

    const customers = filtered.filter((u) => u.role === "customer").length;
    const professionals = filtered.filter((u) => u.role === "professional").length;

    const byBracket = AGE_BRACKETS.map((b) => {
      const inBracket = filtered.filter(
        (u) => bracketFor(ageFromDob(profileByUser[u.id]?.date_of_birth ?? null)) === b.key
      );
      return {
        bracket: b.key,
        Clienti: inBracket.filter((u) => u.role === "customer").length,
        Professionisti: inBracket.filter((u) => u.role === "professional").length,
      };
    });

    const staffCount = data.users.length - marketplaceUsers.length;

    return { total: filtered.length, customers, professionals, byBracket, staffCount };
  }, [data.users, profileByUser, dateFrom, dateTo, selectedBrackets]);

  // ---------- KPI 2: conversione free -> pro ----------
  const conversionResult = useMemo(() => {
    const filtered = data.professionals.filter((p) => {
      if (!inDateRange(p.created_at, dateFrom, dateTo)) return false;
      if (!cityMatchesGeo(p.city_id)) return false;
      return true;
    });

    const free = filtered.filter((p) => p.subscription_tier === "free").length;
    const pro = filtered.filter((p) => p.subscription_tier === "pro").length;
    const business = filtered.filter((p) => p.subscription_tier === "business").length;
    const total = filtered.length;
    const nonFreePct = total > 0 ? ((pro + business) / total) * 100 : 0;

    const chartData = [
      { tier: "Free", Professionisti: free },
      { tier: "Pro", Professionisti: pro },
      { tier: "Business", Professionisti: business },
    ];

    return { total, free, pro, business, nonFreePct, chartData };
  }, [data.professionals, dateFrom, dateTo, cityMatchesGeo]);

  // ---------- KPI 3: interazioni vs contratti conclusi ----------
  const funnelResult = useMemo(() => {
    const filtered = data.requests.filter((r) => {
      if (!inDateRange(r.created_at, dateFrom, dateTo)) return false;
      if (!cityMatchesGeo(r.city_id)) return false;
      return true;
    });

    const interactions = filtered.filter((r) => r.status !== "draft").length;
    const closed = filtered.filter((r) => r.status === "closed").length;
    const conversionPct = interactions > 0 ? (closed / interactions) * 100 : 0;

    const statusOrder: RequestRow["status"][] = [
      "draft",
      "sent",
      "quote_request",
      "matched",
      "closed",
    ];
    const chartData = statusOrder.map((s) => ({
      status: REQUEST_STATUS_LABEL[s],
      Richieste: filtered.filter((r) => r.status === s).length,
    }));

    return { total: filtered.length, interactions, closed, conversionPct, chartData };
  }, [data.requests, dateFrom, dateTo, cityMatchesGeo]);

  const showGeoFilter = tab === "conversion" || tab === "funnel";
  const showAgeFilter = tab === "roles";

  return (
    <div className="space-y-5">
      {/* Selettore KPI */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === t.value
                ? "bg-bob-indigo text-white"
                : "border border-black/10 text-bob-ink/60 hover:bg-black/[0.04]"
            }`}
            data-testid={`kpi-tab-${t.value}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filtri */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label-bob" htmlFor="dateFrom">Dal</label>
          <input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-bob"
            data-testid="kpi-date-from"
          />
        </div>
        <div>
          <label className="label-bob" htmlFor="dateTo">Al</label>
          <input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-bob"
            data-testid="kpi-date-to"
          />
        </div>

        {showGeoFilter && (
          <>
            <div>
              <label className="label-bob" htmlFor="macroRegion">Macro-area</label>
              <select
                id="macroRegion"
                value={macroRegion}
                onChange={(e) => {
                  setMacroRegion(e.target.value);
                  setRegion("");
                  setProvince("");
                  setCityId("");
                }}
                className="input-bob"
                data-testid="kpi-filter-macro"
              >
                <option value="">Tutte</option>
                {MACRO_ORDER.map((m) => (
                  <option key={m} value={m}>{MACRO_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-bob" htmlFor="region">Regione</label>
              <select
                id="region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setProvince("");
                  setCityId("");
                }}
                className="input-bob"
                data-testid="kpi-filter-region"
              >
                <option value="">Tutte</option>
                {regionOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-bob" htmlFor="province">Provincia</label>
              <select
                id="province"
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setCityId("");
                }}
                className="input-bob"
                data-testid="kpi-filter-province"
              >
                <option value="">Tutte</option>
                {provinceOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-bob" htmlFor="city">Città</label>
              <select
                id="city"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="input-bob"
                data-testid="kpi-filter-city"
              >
                <option value="">Tutte</option>
                {cityOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {showAgeFilter && (
          <div>
            <span className="label-bob">Fascia d&apos;età</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {AGE_BRACKETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => toggleBracket(b.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selectedBrackets.has(b.key)
                      ? "bg-bob-indigo text-white"
                      : "border border-black/10 text-bob-ink/60 hover:bg-black/[0.04]"
                  }`}
                  data-testid={`kpi-age-${b.key}`}
                >
                  {b.key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contenuto KPI */}
      {tab === "roles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Clienti" value={rolesResult.customers} />
            <StatCard label="Professionisti" value={rolesResult.professionals} />
            <StatCard label="Totale filtrato" value={rolesResult.total} highlight />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">
              Distribuzione per fascia d&apos;età
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rolesResult.byBracket}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="bracket" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Clienti" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Professionisti" fill={COLORS.yellow} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-bob-ink/40">
              {rolesResult.staffCount} account staff (admin/CS) esclusi dal conteggio.
            </p>
          </div>
        </div>
      )}

      {tab === "conversion" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Professionisti (filtro)" value={conversionResult.total} />
            <StatCard label="Free" value={conversionResult.free} />
            <StatCard label="Pro + Business" value={conversionResult.pro + conversionResult.business} />
            <StatCard
              label="% non-Free"
              value={`${conversionResult.nonFreePct.toFixed(1)}%`}
              highlight
            />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">
              Distribuzione per tier
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionResult.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="tier" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="Professionisti" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-bob-ink/40">
              Snapshot sul tier attuale, filtrato per città del professionista e periodo di
              iscrizione. Non è ancora uno storico dei cambi tier nel tempo.
            </p>
          </div>
        </div>
      )}

      {tab === "funnel" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Richieste (filtro)" value={funnelResult.total} />
            <StatCard label="Interazioni" value={funnelResult.interactions} />
            <StatCard label="Contratti conclusi" value={funnelResult.closed} />
            <StatCard
              label="Tasso di chiusura"
              value={`${funnelResult.conversionPct.toFixed(1)}%`}
              highlight
            />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">
              Richieste per stato
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelResult.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="status" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="Richieste" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-bob-ink/40">
              &quot;Interazione&quot; = richiesta uscita dalla bozza (inviata, con preventivo,
              abbinata o conclusa). Filtro geografico sulla città della richiesta, non su
              quella del professionista che risponde.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-5 ${highlight ? "border-amber-200 bg-amber-50" : ""}`}>
      <p className={`text-xs font-medium ${highlight ? "text-amber-700" : "text-bob-ink/55"}`}>
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${highlight ? "text-amber-800" : "text-bob-ink"}`}>
        {value}
      </p>
    </div>
  );
}
