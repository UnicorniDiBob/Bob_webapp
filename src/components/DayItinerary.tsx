"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/supabase/types";
import { MapPin, Key } from "lucide-react";
import {
  fmtDayLong,
  fmtDuration,
  fmtHour,
  gapMinutes,
  isLiveAppointment,
  locationLabel,
  mapsRouteUrl,
  mapsSearchUrl,
  sameDay,
} from "@/lib/calendar";

/**
 * "Giro del giorno": le tappe di una giornata in ordine di orario, con
 * indirizzo, tempo libero fra un lavoro e l'altro e link a Maps.
 *
 * Perché una lista e non una mappa con i pin: i pin richiedono coordinate,
 * quindi un fornitore di geocoding — cioè un responsabile del trattamento in
 * più, con DPA, analisi dei trasferimenti, riga di ROPA e verifica DPIA
 * (roadmap 40.0). Qui non esce nessun dato da Bob: i link si aprono solo se il
 * pro clicca. La mappa si innesta sopra questo componente quando il vendor
 * sarà scelto e contrattualizzato.
 */
export function DayItinerary({
  day,
  appointments,
  onSelect,
}: {
  day: Date;
  appointments: Appointment[];
  onSelect: (a: Appointment) => void;
}) {
  const stops = useMemo(
    () =>
      appointments
        .filter(
          (a) => isLiveAppointment(a) && sameDay(new Date(a.starts_at), day)
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [appointments, day]
  );

  const totalMinutes = useMemo(
    () => stops.reduce((sum, a) => sum + a.duration_minutes, 0),
    [stops]
  );

  const withAddress = stops.filter((a) => locationLabel(a) !== null);
  const routeUrl = mapsRouteUrl(stops);
  const missing = stops.length - withAddress.length;

  return (
    <div className="card p-5" data-testid="day-itinerary">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-bob-ink">Giro del giorno</h3>
          <p className="truncate text-xs capitalize text-bob-ink/55">
            {fmtDayLong(day)}
          </p>
        </div>
        {stops.length > 0 && (
          <span className="shrink-0 rounded-full bg-bob-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-bob-indigo">
            {stops.length} {stops.length === 1 ? "tappa" : "tappe"} ·{" "}
            {fmtDuration(totalMinutes)}
          </span>
        )}
      </div>

      {stops.length === 0 ? (
        <p className="mt-3 text-sm text-bob-ink/50">
          Nessun appuntamento in questa giornata.
        </p>
      ) : (
        <>
          <ol className="mt-3.5 space-y-0">
            {stops.map((a, i) => {
              const prev = i > 0 ? stops[i - 1] : null;
              const gap = prev ? gapMinutes(prev, a) : null;
              const label = locationLabel(a);
              const mapsUrl = mapsSearchUrl(a);
              return (
                <li key={a.id}>
                  {/* Tempo fra la tappa precedente e questa */}
                  {gap !== null && (
                    <p
                      className={`py-1 pl-8 text-[11px] ${
                        gap < 0 ? "font-semibold text-red-600" : "text-bob-ink/40"
                      }`}
                    >
                      {gap < 0
                        ? `⚠ si sovrappone di ${fmtDuration(-gap)}`
                        : gap === 0
                          ? "di seguito, senza pausa"
                          : `${fmtDuration(gap)} liberi`}
                    </p>
                  )}
                  <div className="flex gap-2.5">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bob-indigo text-[11px] font-bold text-white"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 border-b border-black/5 pb-2.5">
                      <button
                        onClick={() => onSelect(a)}
                        className="block w-full text-left"
                        data-testid={`itinerary-stop-${a.id}`}
                      >
                        <p className="text-sm font-semibold tabular-nums text-bob-ink">
                          {fmtHour(new Date(a.starts_at))}
                          <span className="font-normal text-bob-ink/45">
                            {" "}
                            · {fmtDuration(a.duration_minutes)}
                          </span>
                        </p>
                        <p className="truncate text-sm text-bob-ink/75">
                          {a.customer_name}
                          {a.title ? ` — ${a.title}` : ""}
                        </p>
                        {label ? (
                          <p className="flex items-center gap-1 text-xs text-bob-ink/55">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{label}</span>
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-amber-700">
                            Indirizzo mancante
                          </p>
                        )}
                        {a.location_notes && (
                          <p className="flex items-center gap-1 text-xs text-bob-ink/45">
                            <Key className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{a.location_notes}</span>
                          </p>
                        )}
                      </button>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-bob-indigo hover:underline"
                        >
                          Apri in Maps ↗
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {routeUrl && (
            <a
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary mt-3.5 block w-full py-2 text-center text-sm"
              data-testid="itinerary-route"
            >
              Apri il percorso completo in Maps ↗
            </a>
          )}

          {missing > 0 && (
            <p className="mt-2 text-xs text-bob-ink/45">
              {missing === 1
                ? "1 tappa non ha un indirizzo e resta fuori dal percorso."
                : `${missing} tappe non hanno un indirizzo e restano fuori dal percorso.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
