"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Appointment } from "@/lib/supabase/types";
import {
  DAY_LABELS,
  HOUR_PX_DAY,
  HOUR_PX_WEEK,
  MIN_BLOCK_PX,
  STATUS_BAR,
  STATUS_STYLE,
  addDays,
  fmtDay,
  fmtDayLong,
  fmtHour,
  hourBounds,
  layoutDay,
  locationLabel,
  sameDay,
  startOfDay,
  startOfWeek,
  weekdayIndex,
} from "@/lib/calendar";

type CalView = "week" | "day";

/** Granularità dei click sulle zone vuote: mezz'ora. */
const SLOT_MINUTES = 30;

/** Altezza massima della griglia scrollabile. */
const VIEWPORT_PX = 560;

export function ProCalendar({
  appointments,
  loading,
  onCreateAt,
  onSelect,
  onFocusDayChange,
  selectedId,
}: {
  appointments: Appointment[];
  loading: boolean;
  /** Click su uno spazio vuoto: apre la creazione a quell'ora. */
  onCreateAt: (start: Date) => void;
  /** Click su un appuntamento: apre il pannello di dettaglio. */
  onSelect: (a: Appointment) => void;
  /** Giornata "a fuoco": alimenta il giro del giorno accanto al calendario. */
  onFocusDayChange?: (day: Date) => void;
  selectedId?: string | null;
}) {
  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [fullDay, setFullDay] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  // Su mobile la settimana a 7 colonne è illeggibile: partiamo dal giorno.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setView("day");
    }
  }, []);

  // Linea "adesso": aggiornata ogni minuto.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const ws = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [view, anchor]);

  const { startHour, endHour } = useMemo(
    () => hourBounds(appointments, days, fullDay),
    [appointments, days, fullDay]
  );

  // In vista giorno è il giorno mostrato; in vista settimana è oggi se cade
  // nella settimana aperta, altrimenti il lunedì di quella settimana.
  const focusDay = useMemo(() => {
    if (view === "day") return anchor;
    const today = startOfDay(new Date());
    return days.find((d) => sameDay(d, today)) ?? days[0];
  }, [view, anchor, days]);

  useEffect(() => {
    onFocusDayChange?.(focusDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDay.getTime()]);

  const hourPx = view === "day" ? HOUR_PX_DAY : HOUR_PX_WEEK;
  const pxPerMin = hourPx / 60;
  const totalPx = (endHour - startHour) * hourPx;

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const positioned = useMemo(
    () => days.map((d) => layoutDay(appointments, d, startHour, endHour)),
    [days, appointments, startHour, endHour]
  );

  // Porta in vista il primo appuntamento del periodo, altrimenti le 8:00.
  const firstStartMin = useMemo(() => {
    const mins = positioned.flat().map((p) => p.startMin);
    if (mins.length === 0) return Math.max(0, (8 - startHour) * 60);
    return Math.min(...mins);
  }, [positioned, startHour]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;
    // Solo al primo render utile e ai cambi di periodo/vista.
    const target = Math.max(0, (firstStartMin - 30) * pxPerMin);
    el.scrollTo({ top: target, behavior: didAutoScroll.current ? "smooth" : "auto" });
    didAutoScroll.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor, loading, startHour, endHour]);

  const goToday = useCallback(() => setAnchor(startOfDay(new Date())), []);
  const step = useCallback(
    (dir: 1 | -1) =>
      setAnchor((d) => addDays(d, dir * (view === "day" ? 1 : 7))),
    [view]
  );

  const periodLabel =
    view === "day"
      ? fmtDayLong(anchor)
      : `${fmtDay(days[0])} – ${fmtDay(days[days.length - 1])}`;

  const isCurrentPeriod = days.some((d) => sameDay(d, new Date()));

  function handleSlotClick(day: Date, minutesFromWindowStart: number) {
    const d = new Date(day);
    const abs = startHour * 60 + minutesFromWindowStart;
    d.setHours(Math.floor(abs / 60), abs % 60, 0, 0);
    onCreateAt(d);
  }

  return (
    <div data-testid="pro-calendar">
      {/* Barra strumenti */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-bob-ink">Calendario</h2>
          <p className="truncate text-xs capitalize text-bob-ink/55">
            {periodLabel}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Vista settimana / giorno */}
          <div className="flex overflow-hidden rounded-lg border border-black/10">
            <button
              onClick={() => setView("week")}
              className={`px-2.5 py-1.5 text-xs font-medium transition ${
                view === "week"
                  ? "bg-bob-indigo text-white"
                  : "text-bob-ink/60 hover:bg-black/[0.03]"
              }`}
              aria-pressed={view === "week"}
              data-testid="cal-view-week"
            >
              Settimana
            </button>
            <button
              onClick={() => setView("day")}
              className={`px-2.5 py-1.5 text-xs font-medium transition ${
                view === "day"
                  ? "bg-bob-indigo text-white"
                  : "text-bob-ink/60 hover:bg-black/[0.03]"
              }`}
              aria-pressed={view === "day"}
              data-testid="cal-view-day"
            >
              Giorno
            </button>
          </div>

          <button
            onClick={() => step(-1)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/[0.03]"
            aria-label={view === "day" ? "Giorno precedente" : "Settimana precedente"}
            data-testid="cal-prev"
          >
            ‹
          </button>
          <button
            onClick={goToday}
            disabled={isCurrentPeriod && view === "day" && sameDay(anchor, new Date())}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03] disabled:opacity-40"
            data-testid="cal-today"
          >
            Oggi
          </button>
          <button
            onClick={() => step(1)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/[0.03]"
            aria-label={view === "day" ? "Giorno successivo" : "Settimana successiva"}
            data-testid="cal-next"
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-black/[0.03]" />
      ) : (
        <div
          ref={scrollRef}
          className="relative overflow-y-auto overscroll-contain rounded-xl border border-black/[0.07]"
          style={{ maxHeight: VIEWPORT_PX }}
        >
          {/* Intestazione giorni: resta visibile durante lo scroll */}
          <div className="sticky top-0 z-30 flex border-b border-black/[0.07] bg-white/95 backdrop-blur-sm">
            <div className="w-11 shrink-0 sm:w-12" />
            {days.map((d) => {
              const isToday = sameDay(d, new Date());
              const isFocus = sameDay(d, focusDay);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    setAnchor(startOfDay(d));
                    setView("day");
                  }}
                  className={`min-w-0 flex-1 basis-0 border-l border-black/[0.06] px-1 py-1.5 text-center hover:bg-black/[0.03] ${
                    isFocus && view === "week" ? "bg-bob-indigo-50/50" : ""
                  }`}
                  aria-label={`Apri ${fmtDay(d)} in vista giorno`}
                >
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-bob-ink/45">
                    {DAY_LABELS[weekdayIndex(d)]}
                  </span>
                  <span
                    className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-bob-indigo text-white" : "text-bob-ink/75"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Corpo: righello delle ore + colonne */}
          <div className="flex">
            {/* Righello delle ore */}
            <div
              className="relative w-11 shrink-0 sm:w-12"
              style={{ height: totalPx }}
              aria-hidden="true"
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-1.5 text-[10px] font-medium tabular-nums text-bob-ink/40"
                  style={{
                    top: i * hourPx,
                    transform: i === 0 ? "none" : "translateY(-50%)",
                  }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Colonne dei giorni */}
            {days.map((d, di) => {
              const isToday = sameDay(d, new Date());
              const nowMin =
                isToday
                  ? now.getHours() * 60 + now.getMinutes() - startHour * 60
                  : null;
              const showNow =
                nowMin !== null && nowMin >= 0 && nowMin <= (endHour - startHour) * 60;
              const slots = Math.floor(((endHour - startHour) * 60) / SLOT_MINUTES);

              return (
                <div
                  key={d.toISOString()}
                  className={`relative min-w-0 flex-1 basis-0 border-l border-black/[0.06] ${
                    isToday ? "bg-bob-indigo-50/25" : ""
                  }`}
                  style={{
                    height: totalPx,
                    backgroundImage: [
                      `repeating-linear-gradient(to bottom, rgba(0,0,0,0.075) 0px, rgba(0,0,0,0.075) 1px, transparent 1px, transparent ${hourPx}px)`,
                      `repeating-linear-gradient(to bottom, transparent 0px, transparent ${hourPx / 2}px, rgba(0,0,0,0.03) ${hourPx / 2}px, rgba(0,0,0,0.03) ${hourPx / 2 + 1}px, transparent ${hourPx / 2 + 1}px, transparent ${hourPx}px)`,
                    ].join(", "),
                  }}
                >
                  {/* Zone cliccabili da 30 minuti per creare un appuntamento */}
                  {Array.from({ length: slots }, (_, i) => {
                    const min = i * SLOT_MINUTES;
                    const absMin = startHour * 60 + min;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSlotClick(d, min)}
                        className="group absolute inset-x-0 hover:bg-bob-indigo/[0.07]"
                        style={{ top: min * pxPerMin, height: SLOT_MINUTES * pxPerMin }}
                        aria-label={`Nuovo appuntamento ${fmtDay(d)} alle ${String(
                          Math.floor(absMin / 60)
                        ).padStart(2, "0")}:${String(absMin % 60).padStart(2, "0")}`}
                      >
                        <span className="pointer-events-none hidden text-[10px] font-semibold text-bob-indigo group-hover:inline">
                          +
                        </span>
                      </button>
                    );
                  })}

                  {/* Linea dell'ora corrente */}
                  {showNow && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: nowMin! * pxPerMin }}
                      data-testid="cal-now-line"
                    >
                      <div className="relative h-0 border-t-2 border-red-500">
                        <span className="absolute -left-0.5 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Blocchi appuntamento, altezza proporzionale alla durata */}
                  {positioned[di].map((p) => {
                    const a = p.appt;
                    const top = p.startMin * pxPerMin;
                    const height = Math.max(
                      (p.endMin - p.startMin) * pxPerMin,
                      MIN_BLOCK_PX
                    );
                    const widthPct = 100 / p.cols;
                    const dim =
                      a.status === "cancelled" || a.status === "declined";
                    const selected = selectedId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelect(a)}
                        title={`${fmtHour(new Date(a.starts_at))} · ${a.customer_name}${
                          a.title ? ` · ${a.title}` : ""
                        }${locationLabel(a) ? ` · ${locationLabel(a)}` : ""}`}
                        className={`absolute z-10 flex overflow-hidden rounded-md border text-left transition hover:z-20 hover:shadow-card ${
                          STATUS_STYLE[a.status]
                        } ${dim ? "opacity-60" : ""} ${
                          selected
                            ? "ring-2 ring-bob-indigo ring-offset-1"
                            : ""
                        }`}
                        style={{
                          top,
                          height,
                          left: `calc(${p.col * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          borderTopLeftRadius: p.clipStart ? 0 : undefined,
                          borderTopRightRadius: p.clipStart ? 0 : undefined,
                          borderBottomLeftRadius: p.clipEnd ? 0 : undefined,
                          borderBottomRightRadius: p.clipEnd ? 0 : undefined,
                        }}
                        data-testid={`appt-${a.id}`}
                      >
                        <span
                          className={`w-1 shrink-0 ${STATUS_BAR[a.status]}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 px-1.5 py-0.5 leading-tight">
                          <span
                            className={`block truncate text-[10px] font-bold tabular-nums ${
                              dim ? "line-through" : ""
                            }`}
                          >
                            {fmtHour(new Date(a.starts_at))}
                            {height >= 34 && (
                              <>
                                {" – "}
                                {fmtHour(
                                  new Date(
                                    new Date(a.starts_at).getTime() +
                                      a.duration_minutes * 60000
                                  )
                                )}
                              </>
                            )}
                          </span>
                          {height >= 30 && (
                            <span className="block truncate text-[11px] font-medium">
                              {a.customer_name}
                            </span>
                          )}
                          {height >= 62 && a.title && (
                            <span className="block truncate text-[10px] opacity-70">
                              {a.title}
                            </span>
                          )}
                          {height >= 78 && a.location_address && (
                            <span className="block truncate text-[10px] opacity-70">
                              📍 {a.location_address}
                            </span>
                          )}
                          {height >= 96 && a.price != null && (
                            <span className="block truncate text-[10px] font-semibold opacity-80">
                              € {a.price}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda + orario completo */}
      {!loading && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-bob-ink/50">
            <LegendDot className="bg-bob-indigo" label="Confermato" />
            <LegendDot className="bg-amber-400" label="Da confermare" />
            <LegendDot className="bg-emerald-500" label="Completato" />
            <LegendDot className="bg-black/20" label="Annullato" />
          </div>
          <button
            onClick={() => setFullDay((v) => !v)}
            className="text-[11px] font-medium text-bob-indigo hover:underline"
            data-testid="cal-toggle-fullday"
          >
            {fullDay ? "Mostra orario di lavoro" : "Mostra tutte le 24 ore"}
          </button>
        </div>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}
