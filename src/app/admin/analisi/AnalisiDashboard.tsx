"use client";

// Dashboard "Analisi" (ex "KPI") — admin.
//
// Dataset piccolo (demo/early stage): fetch grezzo lato server (vedi
// page.tsx), tutto il filtro/aggregazione avviene qui lato client, come già
// fatto in UsersList.
//
// Filtri unificati (stessi menu a tendina su ogni scheda dove ha senso):
// - Periodo (data da/a)
// - Area geografica: macro-area → regione → provincia → città
// - Categoria: servizio → sottoservizio
// - Fascia d'età (select singola, non più pulsanti multipli)
//
// La fascia d'età ora si applica a TUTTE le schede (prima solo a "Utenti per
// ruolo"): ogni entità risale a un utente con un profilo — professionista
// tramite professionals.user_id, richiesta tramite requests.customer_id.
//
// La geografia usa la città della RICHIESTA per le schede basate su
// richieste (interazioni, tempo di risposta), e la città di registrazione
// del professionista per le schede basate su professionisti (conversione,
// verifica) — sono cose diverse apposta, vedi commenti sotto.
//
// La categoria (servizio/sottoservizio) filtra: le richieste per
// service_id/subservice_id diretti, i professionisti tramite le righe che
// hanno in professional_services (un professionista può offrire più
// categorie).
//
// Non ancora incluso: frequenza delle keyword di ricerca (non logghiamo
// ancora testo libero in una forma aggregabile) e uno storico vero della
// conversione Free→Pro nel tempo (serve una tabella di audit dedicata).

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

interface ServiceRow {
  id: string;
  name: string;
  slug: string;
}

interface SubserviceRow {
  id: string;
  service_id: string;
  name: string;
  slug: string;
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
  verification_status: "unverified" | "pending" | "verified";
  created_at: string | null;
}

interface ProfessionalServiceRow {
  professional_id: string;
  service_id: string;
  subservice_id: string | null;
}

interface RequestRow {
  id: string;
  customer_id: string;
  city_id: string;
  service_id: string;
  subservice_id: string | null;
  status: "draft" | "sent" | "quote_request" | "matched" | "closed";
  created_at: string | null;
}

interface RequestMessageRow {
  request_id: string;
  sender_type: "customer" | "professional" | "bob";
  created_at: string | null;
}

export interface AnalisiRawData {
  cities: CityRow[];
  services: ServiceRow[];
  subservices: SubserviceRow[];
  users: UserRow[];
  profiles: ProfileRow[];
  professionals: ProfessionalRow[];
  professionalServices: ProfessionalServiceRow[];
  requests: RequestRow[];
  requestMessages: RequestMessageRow[];
}

type Tab = "roles" | "conversion" | "funnel" | "verification" | "response_time";

const TABS: { value: Tab; label: string; icon: string; geo: boolean; category: boolean }[] = [
  { value: "roles", label: "Utenti per ruolo", icon: "👥", geo: false, category: false },
  { value: "conversion", label: "Conversione Free→Pro", icon: "⭐", geo: true, category: true },
  { value: "funnel", label: "Interazioni vs contratti conclusi", icon: "🔁", geo: true, category: true },
  { value: "verification", label: "Verifica professionisti", icon: "🪪", geo: true, category: true },
  { value: "response_time", label: "Tempo di prima risposta", icon: "⏱️", geo: true, category: true },
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

const VERIFICATION_LABEL: Record<ProfessionalRow["verification_status"], string> = {
  unverified: "Non verificato",
  pending: "In attesa",
  verified: "Verificato",
};

const COLORS = {
  indigo: "#3730a3",
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

export function AnalisiDashboard({ data }: { data: AnalisiRawData }) {
  const [tab, setTab] = useState<Tab>("roles");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ageBracket, setAgeBracket] = useState(""); // "" = tutte, select singola

  const [macroRegion, setMacroRegion] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [cityId, setCityId] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [subserviceId, setSubserviceId] = useState("");

  const currentTab = TABS.find((t) => t.value === tab)!;

  const cityById = useMemo(
    () => Object.fromEntries(data.cities.map((c) => [c.id, c])),
    [data.cities]
  );
  const profileByUser = useMemo(
    () => Object.fromEntries(data.profiles.map((p) => [p.user_id, p])),
    [data.profiles]
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

  const subserviceOptions = useMemo(() => {
    if (!serviceId) return [];
    return data.subservices
      .filter((s) => s.service_id === serviceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.subservices, serviceId]);

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

  const requestMatchesCategory = useCallback(
    (r: { service_id: string; subservice_id: string | null }): boolean => {
      if (subserviceId) return r.subservice_id === subserviceId;
      if (serviceId) return r.service_id === serviceId;
      return true;
    },
    [serviceId, subserviceId]
  );

  const professionalMatchesCategory = useCallback(
    (professionalId: string): boolean => {
      if (!serviceId && !subserviceId) return true;
      return data.professionalServices.some((ps) => {
        if (ps.professional_id !== professionalId) return false;
        if (subserviceId) return ps.subservice_id === subserviceId;
        return ps.service_id === serviceId;
      });
    },
    [data.professionalServices, serviceId, subserviceId]
  );

  const userMatchesAge = useCallback(
    (userId: string): boolean => {
      if (!ageBracket) return true;
      const dob = profileByUser[userId]?.date_of_birth ?? null;
      return bracketFor(ageFromDob(dob)) === ageBracket;
    },
    [profileByUser, ageBracket]
  );

  function resetGeo() {
    setMacroRegion("");
    setRegion("");
    setProvince("");
    setCityId("");
  }
  function resetCategory() {
    setServiceId("");
    setSubserviceId("");
  }

  // ---------- 1. Utenti per ruolo ----------
  const rolesResult = useMemo(() => {
    const marketplaceUsers = data.users.filter(
      (u) => u.role === "customer" || u.role === "professional"
    );
    const filtered = marketplaceUsers.filter(
      (u) => inDateRange(u.created_at, dateFrom, dateTo) && userMatchesAge(u.id)
    );

    const customers = filtered.filter((u) => u.role === "customer").length;
    const professionals = filtered.filter((u) => u.role === "professional").length;

    const byBracket = AGE_BRACKETS.map((b) => {
      const inBracket = marketplaceUsers.filter(
        (u) =>
          inDateRange(u.created_at, dateFrom, dateTo) &&
          bracketFor(ageFromDob(profileByUser[u.id]?.date_of_birth ?? null)) === b.key
      );
      return {
        bracket: b.key,
        Clienti: inBracket.filter((u) => u.role === "customer").length,
        Professionisti: inBracket.filter((u) => u.role === "professional").length,
      };
    });

    const staffCount = data.users.length - marketplaceUsers.length;
    return { total: filtered.length, customers, professionals, byBracket, staffCount };
  }, [data.users, profileByUser, dateFrom, dateTo, userMatchesAge]);

  // ---------- 2. Conversione Free -> Pro ----------
  const conversionResult = useMemo(() => {
    const filtered = data.professionals.filter(
      (p) =>
        inDateRange(p.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(p.city_id) &&
        professionalMatchesCategory(p.id) &&
        userMatchesAge(p.user_id)
    );

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
  }, [data.professionals, dateFrom, dateTo, cityMatchesGeo, professionalMatchesCategory, userMatchesAge]);

  // ---------- 3. Interazioni vs contratti conclusi ----------
  const funnelResult = useMemo(() => {
    const filtered = data.requests.filter(
      (r) =>
        inDateRange(r.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(r.city_id) &&
        requestMatchesCategory(r) &&
        userMatchesAge(r.customer_id)
    );

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
  }, [data.requests, dateFrom, dateTo, cityMatchesGeo, requestMatchesCategory, userMatchesAge]);

  // ---------- 4. Verifica professionisti ----------
  const verificationResult = useMemo(() => {
    const filtered = data.professionals.filter(
      (p) =>
        inDateRange(p.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(p.city_id) &&
        professionalMatchesCategory(p.id) &&
        userMatchesAge(p.user_id)
    );

    const unverified = filtered.filter((p) => p.verification_status === "unverified").length;
    const pending = filtered.filter((p) => p.verification_status === "pending").length;
    const verified = filtered.filter((p) => p.verification_status === "verified").length;
    const total = filtered.length;
    const verifiedPct = total > 0 ? (verified / total) * 100 : 0;

    const chartData = (["unverified", "pending", "verified"] as const).map((s) => ({
      stato: VERIFICATION_LABEL[s],
      Professionisti: filtered.filter((p) => p.verification_status === s).length,
    }));

    return { total, unverified, pending, verified, verifiedPct, chartData };
  }, [data.professionals, dateFrom, dateTo, cityMatchesGeo, professionalMatchesCategory, userMatchesAge]);

  // ---------- 5. Tempo di prima risposta ----------
  // Prima risposta professionista = primo messaggio con sender_type
  // 'professional' su quella richiesta. Usiamo requests.created_at come
  // riferimento (non abbiamo uno storico dei cambi di stato, quindi è
  // un'approssimazione — ragionevole perché una richiesta in bozza non ha
  // ancora interazioni). Rispecchia il KPI "tasso di match <24h" del piano
  // di business.
  const firstProReplyByRequest = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data.requestMessages) {
      if (m.sender_type !== "professional" || !m.created_at) continue;
      if (!map.has(m.request_id)) map.set(m.request_id, m.created_at);
    }
    return map;
  }, [data.requestMessages]);

  const responseTimeResult = useMemo(() => {
    const filtered = data.requests.filter(
      (r) =>
        r.status !== "draft" &&
        inDateRange(r.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(r.city_id) &&
        requestMatchesCategory(r) &&
        userMatchesAge(r.customer_id)
    );

    const withReply: { hours: number }[] = [];
    for (const r of filtered) {
      const replyAt = firstProReplyByRequest.get(r.id);
      if (!replyAt || !r.created_at) continue;
      const hours = (new Date(replyAt).getTime() - new Date(r.created_at).getTime()) / 3600000;
      if (hours >= 0) withReply.push({ hours });
    }

    const avgHours =
      withReply.length > 0
        ? withReply.reduce((sum, x) => sum + x.hours, 0) / withReply.length
        : null;
    const within24h = withReply.filter((x) => x.hours <= 24).length;
    const within24hPct = withReply.length > 0 ? (within24h / withReply.length) * 100 : 0;
    const noReply = filtered.length - withReply.length;

    const chartData = [
      { fascia: "< 1h", Richieste: withReply.filter((x) => x.hours < 1).length },
      { fascia: "1-6h", Richieste: withReply.filter((x) => x.hours >= 1 && x.hours < 6).length },
      { fascia: "6-24h", Richieste: withReply.filter((x) => x.hours >= 6 && x.hours < 24).length },
      { fascia: "> 24h", Richieste: withReply.filter((x) => x.hours >= 24).length },
    ];

    return { total: filtered.length, replied: withReply.length, noReply, avgHours, within24hPct, chartData };
  }, [data.requests, firstProReplyByRequest, dateFrom, dateTo, cityMatchesGeo, requestMatchesCategory, userMatchesAge]);

  return (
    <div className="space-y-5">
      {/* Selettore indicatore */}
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
            data-testid={`analisi-tab-${t.value}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filtri: un unico pannello con menu a tendina, coerente su tutte le schede */}
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label-bob" htmlFor="dateFrom">Dal</label>
          <input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-bob"
            data-testid="analisi-date-from"
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
            data-testid="analisi-date-to"
          />
        </div>

        <div>
          <label className="label-bob" htmlFor="ageBracket">Fascia d&apos;età</label>
          <select
            id="ageBracket"
            value={ageBracket}
            onChange={(e) => setAgeBracket(e.target.value)}
            className="input-bob"
            data-testid="analisi-filter-age"
          >
            <option value="">Tutte</option>
            {AGE_BRACKETS.map((b) => (
              <option key={b.key} value={b.key}>{b.key}</option>
            ))}
          </select>
        </div>

        {currentTab.geo && (
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
                data-testid="analisi-filter-macro"
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
                data-testid="analisi-filter-region"
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
                data-testid="analisi-filter-province"
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
                data-testid="analisi-filter-city"
              >
                <option value="">Tutte</option>
                {cityOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {(macroRegion || region || province || cityId) && (
              <button
                type="button"
                onClick={resetGeo}
                className="h-[42px] rounded-xl border border-black/10 px-3 text-xs font-medium text-bob-ink/60 hover:bg-black/[0.04]"
              >
                Azzera area
              </button>
            )}
          </>
        )}

        {currentTab.category && (
          <>
            <div>
              <label className="label-bob" htmlFor="service">Categoria</label>
              <select
                id="service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setSubserviceId("");
                }}
                className="input-bob"
                data-testid="analisi-filter-service"
              >
                <option value="">Tutte</option>
                {data.services
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label-bob" htmlFor="subservice">Sottocategoria</label>
              <select
                id="subservice"
                value={subserviceId}
                onChange={(e) => setSubserviceId(e.target.value)}
                className="input-bob"
                disabled={!serviceId}
                data-testid="analisi-filter-subservice"
              >
                <option value="">Tutte</option>
                {subserviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {(serviceId || subserviceId) && (
              <button
                type="button"
                onClick={resetCategory}
                className="h-[42px] rounded-xl border border-black/10 px-3 text-xs font-medium text-bob-ink/60 hover:bg-black/[0.04]"
              >
                Azzera categoria
              </button>
            )}
          </>
        )}
      </div>

      {/* Contenuto indicatore */}
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
              {rolesResult.staffCount} account staff (admin/CS) esclusi dal conteggio. Il grafico
              mostra sempre tutte le fasce per contesto; il filtro età sopra restringe solo i numeri
              in alto.
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
            <StatCard label="% non-Free" value={`${conversionResult.nonFreePct.toFixed(1)}%`} highlight />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">Distribuzione per tier</p>
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
              Snapshot sul tier attuale. Non è ancora uno storico dei cambi tier nel tempo.
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
            <StatCard label="Tasso di chiusura" value={`${funnelResult.conversionPct.toFixed(1)}%`} highlight />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">Richieste per stato</p>
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
              &quot;Interazione&quot; = richiesta uscita dalla bozza. Filtro geografico e di
              categoria sulla richiesta, non sul professionista che risponde.
            </p>
          </div>
        </div>
      )}

      {tab === "verification" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Professionisti (filtro)" value={verificationResult.total} />
            <StatCard label="Non verificati" value={verificationResult.unverified} />
            <StatCard label="In attesa" value={verificationResult.pending} />
            <StatCard label="% verificati" value={`${verificationResult.verifiedPct.toFixed(1)}%`} highlight />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">Stato di verifica</p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={verificationResult.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="stato" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="Professionisti" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-bob-ink/40">
              Collegato all&apos;avviso &quot;in attesa di verifica&quot; della Dashboard admin — qui puoi
              affettarlo per città, categoria, età e periodo di iscrizione.
            </p>
          </div>
        </div>
      )}

      {tab === "response_time" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Richieste inviate (filtro)" value={responseTimeResult.total} />
            <StatCard label="Con risposta pro" value={responseTimeResult.replied} />
            <StatCard
              label="Tempo medio risposta"
              value={responseTimeResult.avgHours != null ? `${responseTimeResult.avgHours.toFixed(1)}h` : "—"}
            />
            <StatCard label="% risposta <24h" value={`${responseTimeResult.within24hPct.toFixed(1)}%`} highlight />
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-bob-ink">
              Distribuzione tempo di prima risposta
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseTimeResult.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="fascia" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="Richieste" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-bob-ink/40">
              Rispecchia il KPI di business plan &quot;tasso di match, risposta &lt;24h&quot;. Basato sul primo
              messaggio di un professionista sulla richiesta; {responseTimeResult.noReply} richieste
              nel filtro non hanno ancora ricevuto risposta.
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
