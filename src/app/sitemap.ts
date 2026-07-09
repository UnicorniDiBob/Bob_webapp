import type { MetadataRoute } from "next";
import { createStaticClient } from "@/lib/supabase/static";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

// Rigenerata al massimo una volta all'ora.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/servizi`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/citta`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/professionisti`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/come-funziona`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/per-i-professionisti`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/chi-siamo`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/cookie-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/termini`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const supabase = createStaticClient();
    const [{ data: services }, { data: cities }] = await Promise.all([
      supabase.from("services").select("slug"),
      supabase.from("cities").select("slug, status"),
    ]);

    const serviceRoutes: MetadataRoute.Sitemap = (services ?? []).map((s) => ({
      url: `${siteUrl}/servizi/${s.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    }));

    // Solo città attive: le pagine "in arrivo" restano fuori dalla sitemap
    // per non segnalare thin content a Google.
    const cityRoutes: MetadataRoute.Sitemap = (cities ?? [])
      .filter((c) => c.status === "active")
      .map((c) => ({
        url: `${siteUrl}/citta/${c.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.9,
      }));

    return [...staticRoutes, ...serviceRoutes, ...cityRoutes];
  } catch {
    // Env/DB non disponibili (es. build locale): sitemap solo con rotte statiche.
    return staticRoutes;
  }
}
