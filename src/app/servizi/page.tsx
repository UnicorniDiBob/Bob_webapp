import type { Metadata } from "next";
import Link from "next/link";
import { getServices, getServiceCounts } from "@/lib/data";
import { ServiceIcon } from "@/lib/serviceIcons";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Servizi",
  description:
    "Tutti i servizi disponibili su BOB: idraulico, elettricista, pulizie, imbianchino, traslochi e molto altro, con prezzi trasparenti.",
};

export default async function ServicesPage() {
  const [services, counts] = await Promise.all([
    getServices(),
    getServiceCounts(),
  ]);

  return (
    <div className="container-bob py-10">
      <header className="mb-7">
        <span className="section-eyebrow">Servizi</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Di cosa hai bisogno?
        </h1>
        <p className="mt-2 max-w-xl text-sm text-bob-ink/60">
          Scegli un servizio per vedere chi lo offre, con prezzi e rating in
          chiaro. Non sai da dove partire? Raccontalo a Bob.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => {
          const n = counts[s.id] ?? 0;
          return (
            <Link
              key={s.id}
              href={`/servizi/${s.slug}`}
              className="card flex items-center gap-4 p-4 hover:-translate-y-0.5 hover:shadow-card-hover"
              data-testid={`card-service-${s.slug}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bob-indigo-50 text-bob-indigo">
                <ServiceIcon slug={s.slug} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-bob-ink">{s.name}</h2>
                {/* Nessun "presto disponibile": una card senza professionisti
                    non annuncia il proprio vuoto, la riga sparisce. */}
                {n > 0 && (
                  <p className="text-xs text-bob-ink/55">
                    {n} professionist{n === 1 ? "a" : "i"}
                  </p>
                )}
              </div>
              <svg className="h-4 w-4 shrink-0 text-bob-ink/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
