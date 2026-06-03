import type { Metadata } from "next";
import Link from "next/link";
import { getCities, getProfessionals } from "@/lib/data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Città",
  description:
    "Le città in cui BOB è attivo. Milano è operativa, altre città arrivano presto.",
};

export default async function CitiesPage() {
  const [cities, pros] = await Promise.all([getCities(), getProfessionals()]);

  const countByCity: Record<string, number> = {};
  for (const p of pros) {
    countByCity[p.city.slug] = (countByCity[p.city.slug] ?? 0) + 1;
  }

  return (
    <div className="container-bob py-10">
      <header className="mb-7">
        <span className="section-eyebrow">Città</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Dove puoi trovare un professionista
        </h1>
        <p className="mt-2 max-w-xl text-sm text-bob-ink/60">
          Partiamo da Milano, dove i professionisti sono già verificati e pronti.
          Le altre città arrivano una alla volta, con la stessa cura.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => {
          const active = c.status === "active";
          const n = countByCity[c.slug] ?? 0;
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bob-indigo-100 text-2xl">
                  📍
                </div>
                {active ? (
                  <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                    Attiva
                  </span>
                ) : (
                  <span className="chip border-black/10 bg-black/[0.03] text-bob-ink/60">
                    In arrivo
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-bob-ink">{c.name}</h2>
              <p className="mt-1 text-sm text-bob-ink/60">
                {active
                  ? `${n} professionist${n === 1 ? "a" : "i"} disponibil${
                      n === 1 ? "e" : "i"
                    }`
                  : "Stiamo selezionando i primi professionisti."}
              </p>
              {active && (
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-bob-indigo">
                  Esplora {c.name}
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </>
          );

          return active ? (
            <Link
              key={c.id}
              href={`/citta/${c.slug}`}
              className="card flex flex-col p-5 hover:-translate-y-0.5 hover:shadow-card-hover"
              data-testid={`card-city-${c.slug}`}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={c.id}
              className="card flex flex-col p-5 opacity-80"
              data-testid={`card-city-${c.slug}`}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
