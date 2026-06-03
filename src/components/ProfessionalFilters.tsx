"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { City, Service } from "@/lib/supabase/types";

export function ProfessionalFilters({
  cities,
  services,
}: {
  cities: City[];
  services: Service[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  const city = params.get("city") ?? "";
  const service = params.get("service") ?? "";
  const sort = params.get("sort") ?? "consigliati";

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[140px] flex-1">
        <label className="label-bob">Città</label>
        <select
          value={city}
          onChange={(e) => setParam("city", e.target.value)}
          className="input-bob py-2.5"
          data-testid="select-city"
        >
          <option value="">Tutte</option>
          {cities.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
              {c.status !== "active" ? " (in arrivo)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[140px] flex-1">
        <label className="label-bob">Servizio</label>
        <select
          value={service}
          onChange={(e) => setParam("service", e.target.value)}
          className="input-bob py-2.5"
          data-testid="select-service"
        >
          <option value="">Tutti</option>
          {services.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[140px] flex-1">
        <label className="label-bob">Ordina per</label>
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="input-bob py-2.5"
          data-testid="select-sort"
        >
          <option value="consigliati">Consigliati da Bob</option>
          <option value="rating">Rating più alto</option>
          <option value="prezzo">Prezzo più basso</option>
        </select>
      </div>

      {(city || service || sort !== "consigliati") && (
        <button
          onClick={() => router.push(pathname)}
          className="btn-ghost"
          data-testid="button-clear-filters"
        >
          Azzera
        </button>
      )}
    </div>
  );
}
