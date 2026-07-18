"use client";

// Dashboard "Analisi" — admin.
//
// Dataset piccolo (early stage): fetch grezzo lato server (page.tsx),
// filtri e aggregazioni qui lato client.
//
// Filtri — un unico pannello, sempre lo stesso su ogni indicatore:
// - Periodo: default 1° gennaio dell'anno in corso → oggi.
// - Fascia d'età: risale sempre al profilo (professionista via user_id,
//   richiesta via customer_id).
// - Geografia (macro-area → regione → provincia → città) e categoria
//   (servizio → sottoservizio) valgono su TUTTE le schede. Per gli utenti:
//   un professionista aggancia la propria città e i servizi che offre; un
//   cliente aggancia le città/categorie delle sue richieste. Con un filtro
//   geo/categoria attivo, i clienti senza richieste restano quindi esclusi.
// - Il sottoservizio compare solo se la categoria scelta ne ha.
//
// Nota geografica (voluta): per le schede basate su richieste conta la
// città della RICHIESTA; per quelle basate su professionisti conta la
// città di registrazione del professionista. Nei centri piccoli le due
// possono differire.
//
// Export: pulsante "Esporta Excel" sempre visibile — genera un .xlsx con
// un foglio Riepilogo (filtri + numeri chiave) e un foglio Dati (le righe
// filtrate dell'indicatore corrente).
//
// Disdette: si appoggia a subscription_tier_events (migration 025), che
// registra i cambi di tier dal deploy in poi. Lo storico precedente non
// esiste e non è ricostruibile.

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
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
type Tier = "free" | "pro" | "business";

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
  full_name: string | null;
  date_of_birth: string | null;
}

interface ProfessionalRow {
  id: string;
  user_id: string;
  city_id: string;
  subscription_tier: Tier;
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

interface TierEventRow {
  professional_id: string;
  old_tier: string;
  new_tier: string;
  changed_at: string | null;
}

// Evento di ricerca anonimo (migration 026): solo slug categoria/città e
// data — mai user_id né testo libero, per privacy by design.
interface SearchEventRow {
  source: "brief" | "richiesta";
  service_slug: string | null;
  subservice_slug: string | null;
  city_slug: string | null;
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
  tierEvents: TierEventRow[];
  searchEvents: SearchEventRow[];
}

type Tab =
  | "roles"
  | "keywords"
  | "funnel"
  | "response_time"
  | "verification"
  | "conversion"
  | "churn";

// Ordine "a funnel": chi arriva → cosa cerca → cosa chiede → quanto in
// fretta risponde l'offerta → qualità dell'offerta → monetizzazione →
// retention.
const TABS: { value: Tab; label: string; title: string; desc: string }[] = [
  {
    value: "roles",
    label: "Utenti",
    title: "Utenti per ruolo",
    desc: "Clienti e professionisti iscritti nel periodo, con distribuzione per fascia d'età.",
  },
  {
    value: "keywords",
    label: "Ricerche",
    title: "Ricerche per categoria",
    desc: "Quante volte ogni categoria viene cercata con Bob e trasformata in richiesta. Dati anonimi.",
  },
  {
    value: "funnel",
    label: "Richieste",
    title: "Interazioni e contratti conclusi",
    desc: "Richieste uscite dalla bozza e quante arrivano alla chiusura.",
  },
  {
    value: "response_time",
    label: "Prima risposta",
    title: "Tempo di prima risposta",
    desc: "Ore tra l'invio della richiesta e il primo messaggio di un professionista.",
  },
  {
    value: "verification",
    label: "Verifiche",
    title: "Verifica professionisti",
    desc: "Stato di verifica dei profili professionali nel periodo di iscrizione scelto.",
  },
  {
    value: "conversion",
    label: "Conversione Pro",
    title: "Conversione Free → Pro",
    desc: "Quota di professionisti con abbonamento a pagamento (snapshot sul tier attuale).",
  },
  {
    value: "churn",
    label: "Disdette",
    title: "Disdette e cambi di abbonamento",
    desc: "Professionisti che rinunciano a Pro/Business o cambiano piano (storico dal deploy della funzione).",
  },
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

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, business: 2 };

const CHART = {
  indigo: "#3730a3",
  yellow: "#fbbf24",
  emerald: "#10b981",
  red: "#ef4444",
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

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function janFirstIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function AnalisiDashboard({ data }: { data: AnalisiRawData }) {
  const [tab, setTab] = useState<Tab>("roles");

  // Periodo: default 1° gennaio anno corrente → oggi (richiesta esplicita).
  const defaultFrom = janFirstIso();
  const defaultTo = todayIso();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [ageBracket, setAgeBracket] = useState("");
  const [macroRegion, setMacroRegion] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [cityId, setCityId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [subserviceId, setSubserviceId] = useState("");

  const currentTab = TABS.find((t) => t.value === tab)!;

  // ---------- Indici ----------
  const cityById = useMemo(
    () => Object.fromEntries(data.cities.map((c) => [c.id, c])),
    [data.cities]
  );
  const serviceById = useMemo(
    () => Object.fromEntries(data.services.map((s) => [s.id, s])),
    [data.services]
  );
  const subserviceById = useMemo(
    () => Object.fromEntries(data.subservices.map((s) => [s.id, s])),
    [data.subservices]
  );
  const profileByUser = useMemo(
    () => Object.fromEntries(data.profiles.map((p) => [p.user_id, p])),
    [data.profiles]
  );
  const professionalByUser = useMemo(
    () => Object.fromEntries(data.professionals.map((p) => [p.user_id, p])),
    [data.professionals]
  );
  const professionalById = useMemo(
    () => Object.fromEntries(data.professionals.map((p) => [p.id, p])),
    [data.professionals]
  );
  const requestsByCustomer = useMemo(() => {
    const map: Record<string, RequestRow[]> = {};
    for (const r of data.requests) (map[r.customer_id] ??= []).push(r);
    return map;
  }, [data.requests]);
  const cityBySlug = useMemo(
    () => Object.fromEntries(data.cities.map((c) => [c.slug, c])),
    [data.cities]
  );
  const serviceNameBySlug = useMemo(
    () => Object.fromEntries(data.services.map((s) => [s.slug, s.name])),
    [data.services]
  );
  const subserviceNameBySlug = useMemo(
    () => Object.fromEntries(data.subservices.map((s) => [s.slug, s.name])),
    [data.subservices]
  );

  // ---------- Opzioni cascading ----------
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

  // Sottocategoria: solo se la categoria scelta ne possiede.
  const subserviceOptions = useMemo(() => {
    if (!serviceId) return [];
    return data.subservices
      .filter((s) => s.service_id === serviceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.subservices, serviceId]);

  // ---------- Predicati filtro ----------
  const geoActive = !!(macroRegion || region || province || cityId);
  const catActive = !!(serviceId || subserviceId);

  const cityMatchesGeo = useCallback(
    (cid: string | null): boolean => {
      if (!cid) return !geoActive;
      const c = cityById[cid];
      if (!c) return false;
      if (cityId) return c.id === cityId;
      if (province) return c.province === province;
      if (region) return c.region === region;
      if (macroRegion) return c.macro_region === macroRegion;
      return true;
    },
    [cityById, cityId, province, region, macroRegion, geoActive]
  );

  const requestMatchesCategory = useCallback(
    (r: { service_id: string; subservice_id: string | null }): boolean => {
      if (subserviceId) return r.subservice_id === subserviceId;
      if (serviceId) return r.service_id === serviceId;
      return true;
    },
    [serviceId, subserviceId]
  );

  // Come cityMatchesGeo ma a partire dallo slug (gli eventi di ricerca
  // anonimi non hanno l'id della città).
  const citySlugMatchesGeo = useCallback(
    (slug: string | null): boolean => {
      if (!slug) return !geoActive;
      const c = cityBySlug[slug];
      if (!c) return false;
      if (cityId) return c.id === cityId;
      if (province) return c.province === province;
      if (region) return c.region === region;
      if (macroRegion) return c.macro_region === macroRegion;
      return true;
    },
    [cityBySlug, cityId, province, region, macroRegion, geoActive]
  );

  const professionalMatchesCategory = useCallback(
    (professionalId: string): boolean => {
      if (!catActive) return true;
      return data.professionalServices.some((ps) => {
        if (ps.professional_id !== professionalId) return false;
        if (subserviceId) return ps.subservice_id === subserviceId;
        return ps.service_id === serviceId;
      });
    },
    [data.professionalServices, serviceId, subserviceId, catActive]
  );

  const userMatchesAge = useCallback(
    (userId: string): boolean => {
      if (!ageBracket) return true;
      const dob = profileByUser[userId]?.date_of_birth ?? null;
      return bracketFor(ageFromDob(dob)) === ageBracket;
    },
    [profileByUser, ageBracket]
  );

  // Geografia/categoria per un UTENTE: il professionista aggancia la sua
  // città e i servizi che offre; il cliente aggancia le sue richieste.
  const userMatchesGeoCat = useCallback(
    (u: UserRow): boolean => {
      if (!geoActive && !catActive) return true;
      if (u.role === "professional") {
        const p = professionalByUser[u.id];
        if (!p) return false;
        return cityMatchesGeo(p.city_id) && professionalMatchesCategory(p.id);
      }
      const reqs = requestsByCustomer[u.id] ?? [];
      return reqs.some(
        (r) => cityMatchesGeo(r.city_id) && requestMatchesCategory(r)
      );
    },
    [
      geoActive,
      catActive,
      professionalByUser,
      requestsByCustomer,
      cityMatchesGeo,
      professionalMatchesCategory,
      requestMatchesCategory,
    ]
  );

  const activeFilterCount =
    (dateFrom !== defaultFrom || dateTo !== defaultTo ? 1 : 0) +
    (ageBracket ? 1 : 0) +
    (geoActive ? 1 : 0) +
    (catActive ? 1 : 0);

  function resetFilters() {
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
    setAgeBracket("");
    setMacroRegion("");
    setRegion("");
    setProvince("");
    setCityId("");
    setServiceId("");
    setSubserviceId("");
  }

  // ---------- 1. Utenti per ruolo ----------
  const rolesResult = useMemo(() => {
    const marketplaceUsers = data.users.filter(
      (u) => u.role === "customer" || u.role === "professional"
    );
    const base = marketplaceUsers.filter(
      (u) => inDateRange(u.created_at, dateFrom, dateTo) && userMatchesGeoCat(u)
    );
    const filtered = base.filter((u) => userMatchesAge(u.id));

    const customers = filtered.filter((u) => u.role === "customer").length;
    const professionals = filtered.filter((u) => u.role === "professional").length;

    // Il grafico mostra sempre tutte le fasce (con gli altri filtri applicati),
    // così il filtro età sopra non svuota il contesto.
    const byBracket = AGE_BRACKETS.map((b) => {
      const inBracket = base.filter(
        (u) =>
          bracketFor(ageFromDob(profileByUser[u.id]?.date_of_birth ?? null)) === b.key
      );
      return {
        bracket: b.key,
        Clienti: inBracket.filter((u) => u.role === "customer").length,
        Professionisti: inBracket.filter((u) => u.role === "professional").length,
      };
    });

    const staffCount = data.users.length - marketplaceUsers.length;
    return { rows: filtered, customers, professionals, byBracket, staffCount };
  }, [data.users, profileByUser, dateFrom, dateTo, userMatchesAge, userMatchesGeoCat]);

  // ---------- 1b. Ricerche per categoria ----------
  // Eventi anonimi (migration 026): il filtro età non si applica per
  // costruzione — non sappiamo chi ha cercato, ed è voluto (privacy).
  const keywordsResult = useMemo(() => {
    const rows = data.searchEvents.filter((e) => {
      if (!inDateRange(e.created_at, dateFrom, dateTo)) return false;
      if (!citySlugMatchesGeo(e.city_slug)) return false;
      if (subserviceId) {
        return e.subservice_slug === (subserviceById[subserviceId]?.slug ?? "");
      }
      if (serviceId) {
        return e.service_slug === (serviceById[serviceId]?.slug ?? "");
      }
      return true;
    });

    const briefs = rows.filter((e) => e.source === "brief").length;
    const richieste = rows.filter((e) => e.source === "richiesta").length;

    // Ranking per categoria; se una categoria è già selezionata, il ranking
    // scende al livello delle sue sottocategorie.
    const drillToSub = !!serviceId && !subserviceId;
    const buckets = new Map<string, { Ricerche: number; Richieste: number }>();
    for (const e of rows) {
      const slug = drillToSub ? e.subservice_slug : e.service_slug;
      const name = drillToSub
        ? slug
          ? subserviceNameBySlug[slug] ?? slug
          : "(generica)"
        : slug
        ? serviceNameBySlug[slug] ?? slug
        : "(non riconosciuta)";
      const b = buckets.get(name) ?? { Ricerche: 0, Richieste: 0 };
      if (e.source === "brief") b.Ricerche++;
      else b.Richieste++;
      buckets.set(name, b);
    }
    const ranking = [...buckets.entries()]
      .map(([categoria, v]) => ({ categoria, ...v, Totale: v.Ricerche + v.Richieste }))
      .sort((a, b) => b.Totale - a.Totale);

    const chartData = ranking.slice(0, 10);
    const topCategory = ranking[0]?.categoria ?? "—";

    return { rows, briefs, richieste, ranking, chartData, topCategory, drillToSub };
  }, [
    data.searchEvents,
    dateFrom,
    dateTo,
    citySlugMatchesGeo,
    serviceId,
    subserviceId,
    serviceById,
    subserviceById,
    serviceNameBySlug,
    subserviceNameBySlug,
  ]);

  // ---------- 2. Conversione Free → Pro ----------
  const conversionResult = useMemo(() => {
    const rows = data.professionals.filter(
      (p) =>
        inDateRange(p.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(p.city_id) &&
        professionalMatchesCategory(p.id) &&
        userMatchesAge(p.user_id)
    );

    const free = rows.filter((p) => p.subscription_tier === "free").length;
    const pro = rows.filter((p) => p.subscription_tier === "pro").length;
    const business = rows.filter((p) => p.subscription_tier === "business").length;
    const nonFreePct = rows.length > 0 ? ((pro + business) / rows.length) * 100 : 0;

    const chartData = [
      { tier: "Free", Professionisti: free },
      { tier: "Pro", Professionisti: pro },
      { tier: "Business", Professionisti: business },
    ];

    return { rows, free, pro, business, nonFreePct, chartData };
  }, [data.professionals, dateFrom, dateTo, cityMatchesGeo, professionalMatchesCategory, userMatchesAge]);

  // ---------- 3. Richieste: interazioni vs contratti ----------
  const funnelResult = useMemo(() => {
    const rows = data.requests.filter(
      (r) =>
        inDateRange(r.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(r.city_id) &&
        requestMatchesCategory(r) &&
        userMatchesAge(r.customer_id)
    );

    const interactions = rows.filter((r) => r.status !== "draft").length;
    const closed = rows.filter((r) => r.status === "closed").length;
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
      Richieste: rows.filter((r) => r.status === s).length,
    }));

    return { rows, interactions, closed, conversionPct, chartData };
  }, [data.requests, dateFrom, dateTo, cityMatchesGeo, requestMatchesCategory, userMatchesAge]);

  // ---------- 4. Verifica professionisti ----------
  const verificationResult = useMemo(() => {
    const rows = data.professionals.filter(
      (p) =>
        inDateRange(p.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(p.city_id) &&
        professionalMatchesCategory(p.id) &&
        userMatchesAge(p.user_id)
    );

    const unverified = rows.filter((p) => p.verification_status === "unverified").length;
    const pending = rows.filter((p) => p.verification_status === "pending").length;
    const verified = rows.filter((p) => p.verification_status === "verified").length;
    const verifiedPct = rows.length > 0 ? (verified / rows.length) * 100 : 0;

    const chartData = (["unverified", "pending", "verified"] as const).map((s) => ({
      stato: VERIFICATION_LABEL[s],
      Professionisti: rows.filter((p) => p.verification_status === s).length,
    }));

    return { rows, unverified, pending, verified, verifiedPct, chartData };
  }, [data.professionals, dateFrom, dateTo, cityMatchesGeo, professionalMatchesCategory, userMatchesAge]);

  // ---------- 5. Tempo di prima risposta ----------
  const firstProReplyByRequest = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data.requestMessages) {
      if (m.sender_type !== "professional" || !m.created_at) continue;
      if (!map.has(m.request_id)) map.set(m.request_id, m.created_at);
    }
    return map;
  }, [data.requestMessages]);

  const responseTimeResult = useMemo(() => {
    const rows = data.requests.filter(
      (r) =>
        r.status !== "draft" &&
        inDateRange(r.created_at, dateFrom, dateTo) &&
        cityMatchesGeo(r.city_id) &&
        requestMatchesCategory(r) &&
        userMatchesAge(r.customer_id)
    );

    const detailed = rows.map((r) => {
      const replyAt = firstProReplyByRequest.get(r.id) ?? null;
      const hours =
        replyAt && r.created_at
          ? (new Date(replyAt).getTime() - new Date(r.created_at).getTime()) / 3600000
          : null;
      return { request: r, replyAt, hours: hours != null && hours >= 0 ? hours : null };
    });

    const withReply = detailed.filter((d) => d.hours != null) as {
      request: RequestRow;
      replyAt: string;
      hours: number;
    }[];

    const avgHours =
      withReply.length > 0
        ? withReply.reduce((sum, x) => sum + x.hours, 0) / withReply.length
        : null;
    const within24h = withReply.filter((x) => x.hours <= 24).length;
    const within24hPct = withReply.length > 0 ? (within24h / withReply.length) * 100 : 0;

    const chartData = [
      { fascia: "< 1h", Richieste: withReply.filter((x) => x.hours < 1).length },
      { fascia: "1–6h", Richieste: withReply.filter((x) => x.hours >= 1 && x.hours < 6).length },
      { fascia: "6–24h", Richieste: withReply.filter((x) => x.hours >= 6 && x.hours < 24).length },
      { fascia: "> 24h", Richieste: withReply.filter((x) => x.hours >= 24).length },
    ];

    return {
      rows: detailed,
      total: rows.length,
      replied: withReply.length,
      noReply: rows.length - withReply.length,
      avgHours,
      within24hPct,
      chartData,
    };
  }, [data.requests, firstProReplyByRequest, dateFrom, dateTo, cityMatchesGeo, requestMatchesCategory, userMatchesAge]);

  // ---------- 6. Disdette e cambi di abbonamento ----------
  const churnResult = useMemo(() => {
    const rows = data.tierEvents.filter((e) => {
      if (!inDateRange(e.changed_at, dateFrom, dateTo)) return false;
      const p = professionalById[e.professional_id];
      if (!p) return false;
      return (
        cityMatchesGeo(p.city_id) &&
        professionalMatchesCategory(p.id) &&
        userMatchesAge(p.user_id)
      );
    });

    // Disdetta = ritorno a Free da un piano a pagamento.
    const cancellations = rows.filter(
      (e) => e.new_tier === "free" && (e.old_tier === "pro" || e.old_tier === "business")
    ).length;
    const downgrades = rows.filter(
      (e) => e.old_tier === "business" && e.new_tier === "pro"
    ).length;
    const upgrades = rows.filter(
      (e) => (TIER_RANK[e.new_tier] ?? 0) > (TIER_RANK[e.old_tier] ?? 0)
    ).length;

    // Churn approssimato: disdette nel periodo / (abbonati attuali + disdette).
    const activePaid = data.professionals.filter(
      (p) =>
        p.subscription_tier !== "free" &&
        cityMatchesGeo(p.city_id) &&
        professionalMatchesCategory(p.id) &&
        userMatchesAge(p.user_id)
    ).length;
    const churnPct =
      cancellations + activePaid > 0
        ? (cancellations / (cancellations + activePaid)) * 100
        : 0;

    // Grafico mensile: disdette vs upgrade.
    const months = new Map<string, { Disdette: number; Upgrade: number }>();
    for (const e of rows) {
      if (!e.changed_at) continue;
      const d = new Date(e.changed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.get(key) ?? { Disdette: 0, Upgrade: 0 };
      if (e.new_tier === "free" && e.old_tier !== "free") bucket.Disdette++;
      else if ((TIER_RANK[e.new_tier] ?? 0) > (TIER_RANK[e.old_tier] ?? 0)) bucket.Upgrade++;
      months.set(key, bucket);
    }
    const chartData = [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ mese: key, ...v }));

    return { rows, cancellations, downgrades, upgrades, activePaid, churnPct, chartData };
  }, [data.tierEvents, data.professionals, professionalById, dateFrom, dateTo, cityMatchesGeo, professionalMatchesCategory, userMatchesAge]);

  // ---------- Export Excel ----------
  const nameOf = useCallback(
    (userId: string) => profileByUser[userId]?.full_name ?? "—",
    [profileByUser]
  );

  function geoLabel(): string {
    if (cityId) return cityById[cityId]?.name ?? "—";
    if (province) return `Provincia di ${province}`;
    if (region) return region;
    if (macroRegion) return MACRO_LABEL[macroRegion as MacroRegion];
    return "Tutta Italia";
  }
  function categoryLabel(): string {
    if (subserviceId) return subserviceById[subserviceId]?.name ?? "—";
    if (serviceId) return serviceById[serviceId]?.name ?? "—";
    return "Tutte le categorie";
  }

  function handleExport() {
    const wb = XLSX.utils.book_new();

    const summary: (string | number)[][] = [
      ["BOB — Analisi", ""],
      ["Indicatore", currentTab.title],
      ["Esportato il", new Date().toLocaleString("it-IT")],
      ["", ""],
      ["Filtri applicati", ""],
      ["Periodo", `${dateFrom} → ${dateTo}`],
      ["Area geografica", geoLabel()],
      ["Categoria", categoryLabel()],
      ["Fascia d'età", ageBracket || "Tutte"],
      ["", ""],
      ["Numeri chiave", ""],
    ];

    let detail: Record<string, string | number>[] = [];

    if (tab === "roles") {
      summary.push(
        ["Clienti", rolesResult.customers],
        ["Professionisti", rolesResult.professionals],
        ["Totale", rolesResult.rows.length]
      );
      detail = rolesResult.rows.map((u) => ({
        Nome: nameOf(u.id),
        Ruolo: u.role === "customer" ? "Cliente" : "Professionista",
        "Età": ageFromDob(profileByUser[u.id]?.date_of_birth ?? null) ?? "",
        "Fascia": bracketFor(ageFromDob(profileByUser[u.id]?.date_of_birth ?? null)) ?? "",
        "Iscritto il": fmtDate(u.created_at),
      }));
    } else if (tab === "conversion" || tab === "verification") {
      const rows = tab === "conversion" ? conversionResult.rows : verificationResult.rows;
      if (tab === "conversion") {
        summary.push(
          ["Professionisti", rows.length],
          ["Free", conversionResult.free],
          ["Pro", conversionResult.pro],
          ["Business", conversionResult.business],
          ["% non-Free", `${conversionResult.nonFreePct.toFixed(1)}%`]
        );
      } else {
        summary.push(
          ["Professionisti", rows.length],
          ["Non verificati", verificationResult.unverified],
          ["In attesa", verificationResult.pending],
          ["Verificati", verificationResult.verified],
          ["% verificati", `${verificationResult.verifiedPct.toFixed(1)}%`]
        );
      }
      detail = rows.map((p) => ({
        Nome: nameOf(p.user_id),
        "Città": cityById[p.city_id]?.name ?? "—",
        Provincia: cityById[p.city_id]?.province ?? "—",
        Regione: cityById[p.city_id]?.region ?? "—",
        Piano: TIER_LABEL[p.subscription_tier],
        "Stato verifica": VERIFICATION_LABEL[p.verification_status],
        "Età": ageFromDob(profileByUser[p.user_id]?.date_of_birth ?? null) ?? "",
        "Iscritto il": fmtDate(p.created_at),
      }));
    } else if (tab === "funnel") {
      summary.push(
        ["Richieste", funnelResult.rows.length],
        ["Interazioni (fuori bozza)", funnelResult.interactions],
        ["Contratti conclusi", funnelResult.closed],
        ["Tasso di chiusura", `${funnelResult.conversionPct.toFixed(1)}%`]
      );
      detail = funnelResult.rows.map((r) => ({
        Cliente: nameOf(r.customer_id),
        "Città": cityById[r.city_id]?.name ?? "—",
        Categoria: serviceById[r.service_id]?.name ?? "—",
        Sottocategoria: r.subservice_id
          ? subserviceById[r.subservice_id]?.name ?? "—"
          : "",
        Stato: REQUEST_STATUS_LABEL[r.status],
        "Creata il": fmtDate(r.created_at),
      }));
    } else if (tab === "response_time") {
      summary.push(
        ["Richieste inviate", responseTimeResult.total],
        ["Con risposta", responseTimeResult.replied],
        ["Senza risposta", responseTimeResult.noReply],
        [
          "Tempo medio (ore)",
          responseTimeResult.avgHours != null
            ? responseTimeResult.avgHours.toFixed(1)
            : "—",
        ],
        ["% risposta <24h", `${responseTimeResult.within24hPct.toFixed(1)}%`]
      );
      detail = responseTimeResult.rows.map((d) => ({
        Cliente: nameOf(d.request.customer_id),
        "Città": cityById[d.request.city_id]?.name ?? "—",
        Categoria: serviceById[d.request.service_id]?.name ?? "—",
        Stato: REQUEST_STATUS_LABEL[d.request.status],
        "Creata il": fmtDate(d.request.created_at),
        "Prima risposta": d.replyAt ? fmtDate(d.replyAt) : "Nessuna",
        "Ore alla risposta": d.hours != null ? Number(d.hours.toFixed(1)) : "",
      }));
    } else if (tab === "keywords") {
      summary.push(
        ["Ricerche con Bob", keywordsResult.briefs],
        ["Richieste create", keywordsResult.richieste],
        ["Totale eventi", keywordsResult.rows.length],
        ["Categoria più cercata", keywordsResult.topCategory]
      );
      detail = keywordsResult.ranking.map((r) => ({
        [keywordsResult.drillToSub ? "Sottocategoria" : "Categoria"]: r.categoria,
        "Ricerche (Bob)": r.Ricerche,
        "Richieste create": r.Richieste,
        Totale: r.Totale,
      }));
    } else if (tab === "churn") {
      summary.push(
        ["Disdette (→ Free)", churnResult.cancellations],
        ["Downgrade (Business → Pro)", churnResult.downgrades],
        ["Upgrade", churnResult.upgrades],
        ["Abbonati attivi", churnResult.activePaid],
        ["Churn stimato", `${churnResult.churnPct.toFixed(1)}%`]
      );
      detail = churnResult.rows.map((e) => {
        const p = professionalById[e.professional_id];
        return {
          Professionista: p ? nameOf(p.user_id) : "—",
          "Città": p ? cityById[p.city_id]?.name ?? "—" : "—",
          "Da piano": TIER_LABEL[e.old_tier] ?? e.old_tier,
          "A piano": TIER_LABEL[e.new_tier] ?? e.new_tier,
          Data: fmtDate(e.changed_at),
        };
      });
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 34 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Riepilogo");

    const wsDetail =
      detail.length > 0
        ? XLSX.utils.json_to_sheet(detail)
        : XLSX.utils.aoa_to_sheet([["Nessun dato con i filtri correnti"]]);
    if (detail.length > 0) {
      wsDetail["!cols"] = Object.keys(detail[0]).map((k) => ({
        wch: Math.max(k.length + 2, 14),
      }));
    }
    XLSX.utils.book_append_sheet(wb, wsDetail, "Dati");

    XLSX.writeFile(wb, `bob_analisi_${tab}_${todayIso()}.xlsx`);
  }

  // ---------- UI ----------
  return (
    <div className="space-y-5">
      {/* Selettore indicatore + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-black/10 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                tab === t.value
                  ? "bg-bob-indigo text-white shadow-sm"
                  : "text-bob-ink/60 hover:bg-black/[0.04] hover:text-bob-ink"
              }`}
              data-testid={`analisi-tab-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          className="btn-primary px-4 py-2.5 text-sm"
          data-testid="analisi-export"
        >
          ⬇ Esporta Excel
        </button>
      </div>

      {/* Pannello filtri */}
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 bg-black/[0.02] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-bob-ink">Filtri</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-bob-indigo px-2 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount} personalizzat{activeFilterCount === 1 ? "o" : "i"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-medium text-bob-indigo hover:underline"
            data-testid="analisi-filters-reset"
          >
            ↺ Reimposta
          </button>
        </div>

        <div className="grid gap-x-5 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-bob" htmlFor="dateFrom">Periodo — dal</label>
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
            <label className="label-bob" htmlFor="dateTo">Periodo — al</label>
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
                <option key={b.key} value={b.key}>{b.key} anni</option>
              ))}
            </select>
          </div>
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
              <option value="">Tutta Italia</option>
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
          {serviceId && subserviceOptions.length > 0 && (
            <div>
              <label className="label-bob" htmlFor="subservice">Sottocategoria</label>
              <select
                id="subservice"
                value={subserviceId}
                onChange={(e) => setSubserviceId(e.target.value)}
                className="input-bob"
                data-testid="analisi-filter-subservice"
              >
                <option value="">Tutte</option>
                {subserviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Intestazione indicatore */}
      <div>
        <h2 className="text-lg font-bold text-bob-ink">{currentTab.title}</h2>
        <p className="mt-0.5 text-sm text-bob-ink/55">{currentTab.desc}</p>
      </div>

      {/* Contenuto indicatore */}
      {tab === "roles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Clienti" value={rolesResult.customers} />
            <StatCard label="Professionisti" value={rolesResult.professionals} />
            <StatCard label="Totale nel filtro" value={rolesResult.rows.length} highlight />
          </div>
          <ChartCard title="Distribuzione per fascia d'età">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rolesResult.byBracket}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                <XAxis dataKey="bracket" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                <Legend iconType="circle" />
                <Bar dataKey="Clienti" fill={CHART.indigo} radius={[4, 4, 0, 0]} maxBarSize={42} />
                <Bar dataKey="Professionisti" fill={CHART.yellow} radius={[4, 4, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <FootNote>
            {rolesResult.staffCount} account staff (admin/CS) esclusi. Il grafico mostra tutte
            le fasce d&apos;età con gli altri filtri applicati; il filtro età restringe solo i
            numeri in alto. Con un filtro geografico o di categoria attivo, i clienti senza
            richieste non sono conteggiati.
          </FootNote>
        </div>
      )}

      {tab === "keywords" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Ricerche con Bob" value={keywordsResult.briefs} />
            <StatCard label="Richieste create" value={keywordsResult.richieste} />
            <StatCard label="Totale eventi" value={keywordsResult.rows.length} />
            <StatCard label="Categoria top" value={keywordsResult.topCategory} highlight />
          </div>
          {keywordsResult.chartData.length > 0 ? (
            <ChartCard
              title={
                keywordsResult.drillToSub
                  ? "Sottocategorie più cercate (nella categoria selezionata)"
                  : "Categorie più cercate"
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={keywordsResult.chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="categoria"
                    width={150}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Ricerche" fill={CHART.yellow} radius={[0, 4, 4, 0]} maxBarSize={18} />
                  <Bar dataKey="Richieste" fill={CHART.indigo} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 py-10 text-center text-sm text-bob-ink/40">
              Nessuna ricerca registrata con i filtri correnti.
            </div>
          )}
          <FootNote>
            &quot;Ricerche&quot; = chat con Bob completate (una per brief); &quot;Richieste&quot; =
            richieste effettivamente create. Dati anonimi per costruzione: registriamo solo
            categoria, città e data — mai chi ha cercato né il testo digitato. Per questo il
            filtro fascia d&apos;età non si applica a questa scheda. Selezionando una categoria
            il ranking scende alle sue sottocategorie.
          </FootNote>
        </div>
      )}

      {tab === "conversion" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Professionisti" value={conversionResult.rows.length} />
            <StatCard label="Free" value={conversionResult.free} />
            <StatCard label="Pro + Business" value={conversionResult.pro + conversionResult.business} />
            <StatCard label="% non-Free" value={`${conversionResult.nonFreePct.toFixed(1)}%`} highlight />
          </div>
          <ChartCard title="Distribuzione per piano">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionResult.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                <XAxis dataKey="tier" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                <Bar dataKey="Professionisti" fill={CHART.indigo} radius={[4, 4, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <FootNote>
            Snapshot sul piano attuale; per l&apos;andamento nel tempo delle disdette vedi la
            scheda &quot;Disdette&quot;. Geografia sulla città del professionista.
          </FootNote>
        </div>
      )}

      {tab === "funnel" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Richieste" value={funnelResult.rows.length} />
            <StatCard label="Interazioni" value={funnelResult.interactions} />
            <StatCard label="Contratti conclusi" value={funnelResult.closed} />
            <StatCard label="Tasso di chiusura" value={`${funnelResult.conversionPct.toFixed(1)}%`} highlight />
          </div>
          <ChartCard title="Richieste per stato">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelResult.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                <XAxis dataKey="status" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                <Bar dataKey="Richieste" fill={CHART.indigo} radius={[4, 4, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <FootNote>
            &quot;Interazione&quot; = richiesta uscita dalla bozza. Geografia e categoria sono
            quelle della richiesta, non del professionista che risponde.
          </FootNote>
        </div>
      )}

      {tab === "verification" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Professionisti" value={verificationResult.rows.length} />
            <StatCard label="Non verificati" value={verificationResult.unverified} />
            <StatCard label="In attesa" value={verificationResult.pending} />
            <StatCard label="% verificati" value={`${verificationResult.verifiedPct.toFixed(1)}%`} highlight />
          </div>
          <ChartCard title="Stato di verifica">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verificationResult.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                <XAxis dataKey="stato" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                <Bar dataKey="Professionisti" fill={CHART.indigo} radius={[4, 4, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <FootNote>
            Collegato all&apos;avviso &quot;in attesa di verifica&quot; della Dashboard admin,
            qui affettabile per area, categoria, età e periodo di iscrizione.
          </FootNote>
        </div>
      )}

      {tab === "response_time" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Richieste inviate" value={responseTimeResult.total} />
            <StatCard label="Con risposta pro" value={responseTimeResult.replied} />
            <StatCard
              label="Tempo medio"
              value={responseTimeResult.avgHours != null ? `${responseTimeResult.avgHours.toFixed(1)}h` : "—"}
            />
            <StatCard label="% risposta <24h" value={`${responseTimeResult.within24hPct.toFixed(1)}%`} highlight />
          </div>
          <ChartCard title="Distribuzione del tempo di prima risposta">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeResult.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                <XAxis dataKey="fascia" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                <Bar dataKey="Richieste" fill={CHART.indigo} radius={[4, 4, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <FootNote>
            Rispecchia il KPI di business plan &quot;tasso di match, risposta &lt;24h&quot;.
            {" "}{responseTimeResult.noReply} richieste nel filtro sono ancora senza risposta.
          </FootNote>
        </div>
      )}

      {tab === "churn" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Disdette (→ Free)" value={churnResult.cancellations} />
            <StatCard label="Downgrade Business→Pro" value={churnResult.downgrades} />
            <StatCard label="Upgrade" value={churnResult.upgrades} />
            <StatCard label="Churn stimato" value={`${churnResult.churnPct.toFixed(1)}%`} highlight />
          </div>
          {churnResult.chartData.length > 0 ? (
            <ChartCard title="Andamento mensile">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={churnResult.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececf3" vertical={false} />
                  <XAxis dataKey="mese" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "rgba(55,48,163,0.05)" }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Disdette" fill={CHART.red} radius={[4, 4, 0, 0]} maxBarSize={42} />
                  <Bar dataKey="Upgrade" fill={CHART.emerald} radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 py-10 text-center text-sm text-bob-ink/40">
              Nessun cambio di abbonamento registrato nel periodo selezionato.
            </div>
          )}
          <FootNote>
            Lo storico dei cambi di piano parte dall&apos;attivazione di questa funzione: i
            cambi precedenti non sono stati registrati. Churn stimato = disdette nel periodo /
            (abbonati attuali + disdette). {churnResult.activePaid} abbonati attivi nel filtro.
          </FootNote>
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
    <div className={`card p-5 ${highlight ? "border-bob-indigo/20 bg-bob-indigo-50" : ""}`}>
      <p
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          highlight ? "text-bob-indigo/70" : "text-bob-ink/45"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 text-3xl font-bold tabular-nums ${
          highlight ? "text-bob-indigo" : "text-bob-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="mb-4 text-sm font-semibold text-bob-ink">{title}</p>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

function FootNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-bob-ink/45">{children}</p>;
}
