// Pagina servizio × città: la landing per "giardiniere varese", il pattern di
// ricerca più prezioso del settore (SEO.md §1-A: "idraulico milano" 22.200/mese,
// KD 18). Prima di questa pagina chi arrivava da Google atterrava su /servizi o
// sulla home e doveva rifare la ricerca che aveva già fatto.
//
// Solo città attive: una pagina "giardiniere a Varese" senza giardinieri a
// Varese è una doorway page, che SEO.md §5 dice esplicitamente di evitare e che
// Google declassa. Le città non attive restano sulla loro waitlist in
// /citta/[slug] e fuori dalla sitemap.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getServiceBySlug,
  getCityBySlug,
  getSubservicesByServiceSlug,
  getProfessionals,
} from "@/lib/data";
import { ProfessionalCardItem, EmptyState } from "@/components/ui";
import { ComeOrdiniamo } from "@/components/ComeOrdiniamo";
import { ServiceIcon } from "@/lib/serviceIcons";
import { withArticle, quale } from "@/lib/italian";
import { JsonLd } from "@/components/JsonLd";
import type { ProfessionalCard } from "@/lib/supabase/types";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

export const revalidate = 180;

/**
 * Fascia di prezzo reale della città, dalle tariffe dichiarate dai
 * professionisti. È il contenuto che i competitor non hanno (SEO.md §6.8):
 * numeri veri, non una forbice inventata. null se nessuno dichiara la tariffa.
 * L'unità è l'ora, come in PriceTag.
 */
function priceBand(pros: ProfessionalCard[]): { min: number; max: number } | null {
  const mins = pros.map((p) => p.minPrice).filter((n): n is number => n !== null);
  const maxs = pros.map((p) => p.maxPrice).filter((n): n is number => n !== null);
  const pool = [...mins, ...maxs];
  if (pool.length === 0) return null;
  return { min: Math.min(...pool), max: Math.max(...pool) };
}

const euro = (n: number) => `${Number(n).toLocaleString("it-IT")}€`;

export async function generateMetadata({
  params,
}: {
  params: { slug: string; citta: string };
}): Promise<Metadata> {
  const [service, city] = await Promise.all([
    getServiceBySlug(params.slug),
    getCityBySlug(params.citta),
  ]);
  if (!service || !city || city.status !== "active") {
    return { title: "Pagina non trovata" };
  }

  const pros = await getProfessionals({
    serviceSlug: service.slug,
    citySlug: city.slug,
  });
  const band = priceBand(pros);

  // Il title mette servizio e città nell'ordine in cui si cercano.
  return {
    title: `${service.name} a ${city.name} — prezzi chiari e professionisti verificati`,
    description: band
      ? `Cerchi ${withArticle(service)} a ${city.name}? Su BOB le tariffe dichiarate vanno da ${euro(band.min)} a ${euro(band.max)} all'ora. Professionisti verificati uno a uno, recensioni vere, nessun lead a pagamento.`
      : `Cerchi ${withArticle(service)} a ${city.name}? Su BOB trovi professionisti verificati uno a uno, con tariffe dichiarate, disponibilità e recensioni vere. Raccontaci il problema.`,
    alternates: { canonical: `/servizi/${service.slug}/${city.slug}` },
  };
}

export default async function ServiceCityPage({
  params,
}: {
  params: { slug: string; citta: string };
}) {
  const [service, city] = await Promise.all([
    getServiceBySlug(params.slug),
    getCityBySlug(params.citta),
  ]);
  if (!service || !city) notFound();
  // Città non ancora attiva: non esiste una pagina servizio×città per lei.
  // La waitlist vive su /citta/[slug] ed è quella la destinazione giusta.
  if (city.status !== "active") notFound();

  const [subservices, pros] = await Promise.all([
    getSubservicesByServiceSlug(service.slug),
    getProfessionals({ serviceSlug: service.slug, citySlug: city.slug }),
  ]);
  const band = priceBand(pros);

  return (
    <div className="container-bob py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: `${service.name} a ${city.name}`,
          serviceType: service.name,
          description:
            service.description ??
            `${service.name} a ${city.name} con tariffe dichiarate e professionisti verificati su BOB.`,
          areaServed: { "@type": "City", name: city.name },
          provider: { "@type": "Organization", name: "BOB" },
          ...(band
            ? {
                offers: {
                  "@type": "AggregateOffer",
                  priceCurrency: "EUR",
                  lowPrice: band.min,
                  highPrice: band.max,
                  offerCount: pros.length,
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Servizi",
              item: `${siteUrl}/servizi`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: service.name,
              item: `${siteUrl}/servizi/${service.slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: city.name,
              item: `${siteUrl}/servizi/${service.slug}/${city.slug}`,
            },
          ],
        }}
      />

      <nav className="mb-4 text-sm text-bob-ink/50" aria-label="breadcrumb">
        <Link href="/servizi" className="hover:text-bob-indigo">
          Servizi
        </Link>
        <span className="px-1.5">/</span>
        <Link href={`/servizi/${service.slug}`} className="hover:text-bob-indigo">
          {service.name}
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-bob-ink/70">{city.name}</span>
      </nav>

      <header className="mb-7 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-bob-indigo-50 text-bob-indigo">
          <ServiceIcon slug={service.slug} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
            {service.name} a {city.name}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-bob-ink/60">
            {band
              ? `Le tariffe dichiarate a ${city.name} vanno da ${euro(band.min)} a ${euro(band.max)} all'ora. Le vedi sul profilo prima di scrivere: nessun preventivo al buio.`
              : `Professionisti verificati uno a uno a ${city.name}. La tariffa è sul profilo, la vedi prima di scrivere.`}
          </p>
        </div>
      </header>

      {/* Fascia di prezzo in evidenza: il dato vero, non una stima */}
      {band && (
        <section className="mb-8 rounded-2xl border border-black/5 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
            Quanto costa a {city.name}
          </h2>
          <p className="mt-2 text-2xl font-bold text-bob-ink">
            {euro(band.min)}–{euro(band.max)}
            <span className="ml-1 text-sm font-medium text-bob-ink/50">
              all&apos;ora
            </span>
          </p>
          {/* Il singolare non si ottiene cambiando la desinenza del nome:
              cambiano articolo e verbo. In produzione si leggeva "sulle tariffe
              che i 1 professionista di questa pagina dichiarano". Due frasi. */}
          <p className="mt-1 text-xs leading-relaxed text-bob-ink/55">
            {pros.length === 1
              ? "Fascia calcolata sulla tariffa che l'unico professionista di questa pagina dichiara sul proprio profilo. Non è una stima: sono i suoi numeri."
              : `Fascia calcolata sulle tariffe che i ${pros.length} professionisti di questa pagina dichiarano sul proprio profilo. Non è una stima: sono i loro numeri.`}
          </p>
        </section>
      )}

      {subservices.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
            Tipi di intervento
          </h2>
          <div className="flex flex-wrap gap-2">
            {subservices.map((sub) => (
              <span
                key={sub.id}
                className="chip border-black/10 bg-white"
                data-testid={`chip-subservice-${sub.slug}`}
              >
                {sub.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* CTA "parla con Bob" */}
      <section className="mb-8 rounded-2xl bg-bob-indigo p-5 text-white sm:p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Non sai {quale(service).quale} {quale(service).subject}{" "}
              {quale(service).fa} per te?
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Raccontami il problema e ti aiuto a capire chi contattare a{" "}
              {city.name}, con più chiarezza su prezzo, disponibilità e qualità.
            </p>
          </div>
          <Link
            href="/#bob"
            className="shrink-0 rounded-xl bg-bob-yellow px-5 py-2.5 text-sm font-semibold text-bob-ink hover:brightness-95"
            data-testid="button-parla-con-bob"
          >
            Parla con Bob
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
          {pros.length} professionist{pros.length === 1 ? "a" : "i"} a {city.name}
        </h2>
        {/* I parametri di posizionamento vivono in una sezione sola
            (/come-funziona#ordine) e ci si arriva da qui: e' la forma che
            l'art. 22 comma 4-bis del Codice del Consumo descrive, ed e'
            l'unico modo di non avere quattro copie della stessa
            dichiarazione che divergono. Prima questa riga elencava i criteri
            in pagina, ma ne dimenticava il primo — la precisione dell'area,
            che dalla 057/058 e' quello che pesa di piu'. */}
        {pros.length > 0 && (
          <p className="mb-4">
            <ComeOrdiniamo />
          </p>
        )}
        {pros.length === 0 ? (
          <EmptyState
            title={`Nessun professionista per ${service.name.toLowerCase()} a ${city.name}`}
            description="Parla con Bob: ti aiuta a capire chi contattare e ti avvisa appena c'è un profilo adatto in zona."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pros.map((p) => (
              <ProfessionalCardItem key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* Link interni: la pagina nazionale del servizio e la pagina della città.
          Servono al lettore e passano link equity alle due pagine padre. */}
      <section className="mt-10 border-t border-black/5 pt-6 text-sm text-bob-ink/60">
        <p>
          Vedi anche{" "}
          <Link
            href={`/servizi/${service.slug}`}
            className="font-medium text-bob-indigo hover:underline"
          >
            {service.name.toLowerCase()} in tutte le città
          </Link>{" "}
          oppure{" "}
          <Link
            href={`/citta/${city.slug}`}
            className="font-medium text-bob-indigo hover:underline"
          >
            tutti i servizi a {city.name}
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
