import type { Metadata } from "next";
import { getCities, getServices, getProfessionals } from "@/lib/data";
import { ProfessionalFilters } from "@/components/ProfessionalFilters";
import { ProfessionalCardItem, EmptyState } from "@/components/ui";
import type { ProfessionalCard } from "@/lib/supabase/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Professionisti",
  description:
    "Sfoglia i professionisti verificati di BOB: idraulici, elettricisti, pulizie e altri servizi a Milano, con rating e tariffe trasparenti.",
};

function sortPros(pros: ProfessionalCard[], sort: string) {
  const copy = [...pros];
  if (sort === "rating") {
    copy.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
  } else if (sort === "prezzo") {
    copy.sort((a, b) => (a.minPrice ?? 9999) - (b.minPrice ?? 9999));
  }
  return copy;
}

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: { city?: string; service?: string; sort?: string };
}) {
  const [cities, services, pros] = await Promise.all([
    getCities(),
    getServices(),
    getProfessionals({
      citySlug: searchParams.city,
      serviceSlug: searchParams.service,
    }),
  ]);

  const sorted = sortPros(pros, searchParams.sort ?? "consigliati");

  return (
    <div className="container-bob py-10">
      <header className="mb-6">
        <span className="section-eyebrow">Professionisti</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Trova il professionista giusto
        </h1>
        <p className="mt-2 max-w-xl text-sm text-bob-ink/60">
          Filtra per città e servizio. Il costo orario è visibile dentro ogni
          scheda — Bob lo usa per ordinare i risultati.
        </p>
      </header>

      <ProfessionalFilters cities={cities} services={services} />

      <p className="mb-4 mt-5 text-sm text-bob-ink/55" data-testid="text-results-count">
        {sorted.length} professionist{sorted.length === 1 ? "a" : "i"}
      </p>

      {sorted.length === 0 ? (
        <EmptyState
          title="Nessun professionista con questi filtri"
          description="Prova ad allargare la ricerca o parla con Bob: ti avvisa appena ne arriva uno adatto."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <ProfessionalCardItem key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
