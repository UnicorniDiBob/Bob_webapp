import { createClient } from "@/lib/supabase/server";
import { publicVerificationLevel, type VerificationLevel } from "@/lib/vat";
import type {
  City,
  Service,
  Subservice,
  ProfessionalCard,
  PortfolioItem,
  VerificationStatus,
} from "@/lib/supabase/types";
import { withArticle, afterDi } from "@/lib/italian";

// ---------- Catalogo (lettura pubblica via RLS) ----------

export async function getCities(): Promise<City[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("cities")
    .select("*")
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as City[];
}

export async function getCityBySlug(slug: string): Promise<City | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as City) ?? null;
}

export async function getServices(): Promise<Service[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []) as Service[];
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Service) ?? null;
}

export async function getSubservices(serviceId: string): Promise<Subservice[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("subservices")
    .select("*")
    .eq("service_id", serviceId)
    .order("name", { ascending: true });
  return (data ?? []) as Subservice[];
}

// Tutti i sottoservizi con lo slug del servizio padre (per il brief di Bob).
export async function getAllSubservices(): Promise<
  { serviceSlug: string; slug: string; name: string }[]
> {
  const supabase = createClient();
  const { data } = await supabase
    .from("subservices")
    .select("slug, name, services(slug)")
    .order("name", { ascending: true });
  return (data ?? [])
    .map((row) => {
      const svc = row.services as { slug: string } | { slug: string }[] | null;
      const serviceSlug = Array.isArray(svc) ? svc[0]?.slug : svc?.slug;
      return serviceSlug
        ? { serviceSlug, slug: row.slug as string, name: row.name as string }
        : null;
    })
    .filter((x): x is { serviceSlug: string; slug: string; name: string } =>
      Boolean(x)
    );
}

// Comodità: sottocategorie a partire dallo slug del servizio.
export async function getSubservicesByServiceSlug(
  slug: string
): Promise<Subservice[]> {
  const service = await getServiceBySlug(slug);
  if (!service) return [];
  return getSubservices(service.id);
}

// Numero di professionisti che offrono ciascun servizio (per badge nelle liste).
export async function getServiceCounts(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("professional_services")
    .select("service_id");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { service_id: string }[]) {
    counts[row.service_id] = (counts[row.service_id] ?? 0) + 1;
  }
  return counts;
}

// ---------- Professionisti (aggregati per la UI) ----------

type RawProfessionalRow = {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  verification_status: VerificationStatus;
  verification_level: VerificationLevel | null;
  verification_level_at: string | null;
  response_time_label: string | null;
  cities: { name: string; slug: string } | null;
  professional_services: {
    min_price: number | null;
    max_price: number | null;
    price_note: string | null;
    service_id: string;
    services: {
      name: string;
      slug: string;
      gender: string | null;
      is_plural: boolean | null;
      takes_article: boolean | null;
    } | null;
  }[];
  ratings: { score: number }[];
};

// professionals -> profiles non ha FK diretta (passa da users), quindi
// il nome viene risolto a parte tramite una mappa user_id -> full_name.
const PROFESSIONAL_SELECT = `
  id,
  user_id,
  headline,
  bio,
  years_experience,
  verification_status,
  verification_level,
  verification_level_at,
  response_time_label,
  city_id,
  cities ( name, slug ),
  professional_services ( min_price, max_price, price_note, service_id, services ( name, slug, gender, is_plural, takes_article ) ),
  ratings ( score )
`;

async function namesByUserId(
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);
  const map: Record<string, string> = {};
  for (const p of (data ?? []) as { user_id: string; full_name: string | null }[]) {
    if (p.full_name) map[p.user_id] = p.full_name;
  }
  return map;
}

function toCard(
  row: RawProfessionalRow,
  names: Record<string, string>
): ProfessionalCard {
  const ratings = row.ratings ?? [];
  const nRatings = ratings.length;
  const avgRating =
    nRatings > 0
      ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / nRatings) * 10) /
        10
      : null;

  // Usiamo il primo servizio dichiarato (1 servizio per professionista nel pilota).
  const ps = row.professional_services?.[0];

  return {
    id: row.id,
    fullName: names[row.user_id] ?? "Professionista",
    headline: row.headline,
    bio: row.bio,
    yearsExperience: row.years_experience,
    verificationStatus: row.verification_status,
    // "Pro+" si mostra solo se anche lo staff ha approvato il profilo: la
    // regola sta in publicVerificationLevel, qui non si decide nulla.
    verificationLevel: publicVerificationLevel(
      row.verification_level ?? "none",
      row.verification_status
    ),
    verifiedAt: row.verification_level_at,
    responseTimeLabel: row.response_time_label,
    city: { name: row.cities?.name ?? "", slug: row.cities?.slug ?? "" },
    serviceName: ps?.services?.name ?? null,
    serviceSlug: ps?.services?.slug ?? null,
    // Nome già articolato, calcolato qui una volta così i componenti non devono
    // conoscere il genere grammaticale. Due forme perché il contesto cambia:
    // "cercavi delle pulizie" ma "ho bisogno di pulizie".
    serviceWithArticle: ps?.services ? withArticle(ps.services) : null,
    serviceNeedPhrase: ps?.services ? afterDi(ps.services) : null,
    minPrice: ps?.min_price ?? null,
    maxPrice: ps?.max_price ?? null,
    priceNote: ps?.price_note ?? null,
    avgRating,
    nRatings,
  };
}

export interface ProfessionalFilters {
  citySlug?: string;
  serviceSlug?: string;
  maxPrice?: number;
}

export async function getProfessionals(
  filters: ProfessionalFilters = {}
): Promise<ProfessionalCard[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("professionals")
    .select(PROFESSIONAL_SELECT)
    // Un profilo spento esce dagli elenchi. Lo spegne la richiesta di
    // cancellazione (mig 056): i sette giorni di ripensamento sono legittimi
    // solo se in quei giorni l'account NON continua a lavorare, altrimenti
    // stiamo rimandando una cancellazione mentre trattiamo ancora i dati.
    .is("deactivated_at", null);

  const rows = (data ?? []) as unknown as RawProfessionalRow[];
  const names = await namesByUserId(rows.map((r) => r.user_id));
  let cards = rows.map((r) => toCard(r, names));

  if (filters.citySlug) {
    cards = cards.filter((c) => c.city.slug === filters.citySlug);
  }
  if (filters.serviceSlug) {
    cards = cards.filter((c) => c.serviceSlug === filters.serviceSlug);
  }
  if (typeof filters.maxPrice === "number") {
    cards = cards.filter(
      (c) => c.minPrice === null || c.minPrice <= filters.maxPrice!
    );
  }

  // Ordinamento: verificati prima, poi rating più alto, poi prezzo minore.
  cards.sort((a, b) => {
    const v =
      verifiedWeight(b.verificationStatus) - verifiedWeight(a.verificationStatus);
    if (v !== 0) return v;
    const r = (b.avgRating ?? 0) - (a.avgRating ?? 0);
    if (r !== 0) return r;
    return (a.minPrice ?? 9999) - (b.minPrice ?? 9999);
  });

  return cards;
}

function verifiedWeight(status: VerificationStatus): number {
  if (status === "verified") return 2;
  if (status === "pending") return 1;
  return 0;
}

export async function getProfessionalById(
  id: string
): Promise<ProfessionalCard | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("professionals")
    .select(PROFESSIONAL_SELECT)
    .eq("id", id)
    // Anche il profilo pubblico: spento vuol dire non raggiungibile, non
    // "raggiungibile se hai il link". Chi ci arriva trova una pagina non
    // trovata, che e' la verita'.
    .is("deactivated_at", null)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as RawProfessionalRow;
  const names = await namesByUserId([row.user_id]);
  return toCard(row, names);
}

// Foto dei lavori conclusi (galleria pubblica sul profilo).
export async function getPortfolioItems(
  professionalId: string
): Promise<PortfolioItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PortfolioItem[];
}

export interface ProfessionalReview {
  id: string;
  score: number;
  comment: string | null;
  created_at: string | null;
}

export async function getProfessionalReviews(
  id: string
): Promise<ProfessionalReview[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("ratings")
    .select("id, score, comment, created_at")
    .eq("professional_id", id)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProfessionalReview[];
}
