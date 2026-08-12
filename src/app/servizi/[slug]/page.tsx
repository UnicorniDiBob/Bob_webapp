import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getServiceBySlug,
  getSubservicesByServiceSlug,
  getProfessionals,
  getCities,
} from "@/lib/data";
import { ProfessionalCardItem, EmptyState } from "@/components/ui";
import { ServiceIcon } from "@/lib/serviceIcons";
import { withArticle, quale } from "@/lib/italian";
import { JsonLd } from "@/components/JsonLd";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meetonda.com";

export const revalidate = 180;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const service = await getServiceBySlug(params.slug);
  if (!service) return { title: "Servizio non trovato" };
  return {
    title: `${service.name} vicino a te — prezzi chiari e professionisti verificati`,
    description:
      service.description ??
      // La frase parla di "professionisti" e non mette al plurale il nome del
      // servizio: "elettricista" → "elettricisti" richiederebbe un'altra
      // colonna, e l'articolo concordato basta a tenere l'italiano corretto.
      `Cerchi ${withArticle(service)} a Milano? Su BOB trovi professionisti verificati, con fasce di prezzo trasparenti, disponibilità e recensioni vere. Raccontaci il problema.`,
    alternates: { canonical: `/servizi/${params.slug}` },
  };
}

export default async function ServicePage({
  params,
}: {
  params: { slug: string };
}) {
  const service = await getServiceBySlug(params.slug);
  if (!service) notFound();

  const [subservices, pros, cities] = await Promise.all([
    getSubservicesByServiceSlug(service.slug),
    getProfessionals({ serviceSlug: service.slug }),
    getCities(),
  ]);

  // Città dove questo servizio ha davvero qualcuno, e che sono attive: sono le
  // pagine servizio × città che esistono. Il link da qui è quello che le fa
  // scoprire a Google e all'utente che arriva sulla pagina nazionale.
  const citiesWithPros = new Set(pros.map((p) => p.city.slug));
  const localCities = cities.filter(
    (c) => c.status === "active" && citiesWithPros.has(c.slug)
  );

  return (
    <div className="container-bob py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.name,
          serviceType: service.name,
          description:
            service.description ??
            `${service.name} con prezzi chiari e professionisti verificati su BOB.`,
          areaServed: { "@type": "City", name: "Milano" },
          provider: { "@type": "Organization", name: "BOB" },
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
          ],
        }}
      />
      <nav className="mb-4 text-sm text-bob-ink/50" aria-label="breadcrumb">
        <Link href="/servizi" className="hover:text-bob-indigo">
          Servizi
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-bob-ink/70">{service.name}</span>
      </nav>

      <header className="mb-7 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-bob-indigo-50 text-bob-indigo">
          <ServiceIcon slug={service.slug} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
            {service.name}
          </h1>
          {service.description && (
            <p className="mt-2 max-w-xl text-sm text-bob-ink/60">
              {service.description}
            </p>
          )}
        </div>
      </header>

      {localCities.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
            Scegli la città
          </h2>
          <div className="flex flex-wrap gap-2">
            {localCities.map((c) => (
              <Link
                key={c.id}
                href={`/servizi/${service.slug}/${c.slug}`}
                className="chip border-black/10 bg-white hover:border-bob-indigo/30 hover:bg-bob-indigo-50"
                data-testid={`chip-city-${c.slug}`}
              >
                {service.name} a {c.name}
              </Link>
            ))}
          </div>
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
              Raccontami il problema e ti aiuto a capire chi contattare, con più
              chiarezza su prezzo, disponibilità e qualità.
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bob-ink/55">
          {pros.length} professionist{pros.length === 1 ? "a" : "i"} disponibil
          {pros.length === 1 ? "e" : "i"}
        </h2>
        {pros.length === 0 ? (
          <EmptyState
            title="Nessun professionista disponibile per questo servizio"
            description="Parla con Bob: ti aiuta a capire chi contattare e ti avvisa appena c'è un profilo adatto."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pros.map((p) => (
              <ProfessionalCardItem key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
