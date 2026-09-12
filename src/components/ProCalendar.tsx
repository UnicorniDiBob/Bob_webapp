"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Appointment } from "@/lib/supabase/types";
import { MapPin } from "lucide-react";
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
  fmtMonthYear,
  hourBounds,
  layoutDay,
  locationLabel,
  sameDay,
  startOfDay,
  startOfWeek,
  weekdayIndex,
} from "@/lib/calendar";

// QUATTRO VISTE, DALLA PIU' STRETTA ALLA PIU' LARGA (12/09, Lucio).
// Giorno e settimana rispondono a «cosa faccio adesso» e hanno le ore. Mese e
// anno rispondono a «com'e' messo il mese / l'anno», che e' la domanda di chi
// deve promettere una data a un cliente: non hanno le ore perche' sono mappe,
// non agende. Si clicca e si scende — dall'anno al mese, dal mese al giorno.
export type CalView = "week" | "day" | "month" | "year";

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
  onViewChange,
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
  /**
   * Quale vista e' aperta. Serve fuori: mese e anno vogliono tutta la pagina,
   * e la pagina non puo' saperlo se il calendario non glielo dice.
   */
  onViewChange?: (v: CalView) => void;
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

  useEffect(() => {
    onViewChange?.(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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

  // La griglia del mese: parte dal lunedi' della settimana in cui cade il
  // primo del mese e arriva alla domenica di quella in cui cade l'ultimo, cosi'
  // le colonne restano allineate ai giorni della settimana.
  const celleMese = useCallback((rif: Date) => {
    const primo = new Date(rif.getFullYear(), rif.getMonth(), 1);
    const ultimo = new Date(rif.getFullYear(), rif.getMonth() + 1, 0);
    const dal = startOfWeek(primo);
    const al = addDays(startOfWeek(ultimo), 6);
    const out: Date[] = [];
    for (let d = dal; d <= al; d = addDays(d, 1)) out.push(d);
    return out;
  }, []);

  const monthCells = useMemo(() => celleMese(anchor), [celleMese, anchor]);

  const mesiDellAnno = useMemo(
    () =>
      Array.from(
        { length: 12 },
        (_, m) => new Date(anchor.getFullYear(), m, 1)
      ),
    [anchor]
  );

  /** Appuntamenti per giorno, calcolati una volta per tutto il mese. */
  const perGiorno = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const k = startOfDay(new Date(a.starts_at)).toDateString();
      const l = m.get(k);
      if (l) l.push(a);
      else m.set(k, [a]);
    }
    for (const l of m.values())
      l.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    return m;
  }, [appointments]);

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
      setAnchor((d) => {
        if (view === "year") {
          const x = new Date(d);
          x.setDate(1);
          x.setFullYear(x.getFullYear() + dir);
          return startOfDay(x);
        }
        if (view === "month") {
          const x = new Date(d);
          x.setDate(1);
          x.setMonth(x.getMonth() + dir);
          return startOfDay(x);
        }
        return addDays(d, dir * (view === "day" ? 1 : 7));
      }),
    [view]
  );

  // L'ANNO C'E' SEMPRE (12/09). Diceva «7 Set – 13 Set»: in un calendario di
  // lavoro, dove si guardano anche mesi avanti, l'anno che manca e' un modo
  // per sbagliare una promessa a un cliente.
  const periodLabel =
    view === "year"
      ? String(anchor.getFullYear())
      : view === "month"
      ? fmtMonthYear(anchor)
      : view === "day"
        ? `${fmtDayLong(anchor)} ${anchor.getFullYear()}`
        : `${fmtDay(days[0])} – ${fmtDay(days[days.length - 1])} ${days[
            days.length - 1
          ].getFullYear()}`;

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
          <p className="truncate text-xs capitalize text-bob-ink/70">
            {periodLabel}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Le quattro viste, dalla piu' stretta alla piu' larga: e' l'ordine
              in cui si zooma, e l'unico che non costringe a cercare. */}
          <div className="flex overflow-hidden rounded-lg border border-black/10">
            {(
              [
                ["day", "Giorno"],
                ["week", "Settimana"],
                ["month", "Mese"],
                ["year", "Anno"],
              ] as [CalView, string][]
            ).map(([v, etichetta], i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 text-xs font-medium transition ${
                  i > 0 ? "border-l border-black/10" : ""
                } ${
                  view === v
                    ? "bg-bob-indigo text-white"
                    : "text-bob-ink/70 hover:bg-black/[0.03]"
                }`}
                aria-pressed={view === v}
                data-testid={`cal-view-${v}`}
              >
                {etichetta}
              </button>
            ))}
          </div>

          <button
            onClick={() => step(-1)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/[0.03]"
            aria-label={
              view === "day"
                ? "Giorno precedente"
                : view === "month"
                  ? "Mese precedente"
                  : "Settimana precedente"
            }
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
            aria-label={
              view === "day"
                ? "Giorno successivo"
                : view === "month"
                  ? "Mese successivo"
                  : "Settimana successiva"
            }
            data-testid="cal-next"
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-black/[0.03]" />
      ) : view === "year" ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          data-testid="cal-year"
        >
          {mesiDellAnno.map((m) => (
            <div
              key={m.getMonth()}
              className="rounded-xl border border-black/[0.07] p-2"
            >
              <button
                type="button"
                onClick={() => {
                  setAnchor(startOfDay(m));
                  setView("month");
                }}
                className="mb-1 w-full text-left text-xs font-semibold capitalize text-bob-ink transition hover:text-bob-indigo"
              >
                {m.toLocaleDateString("it-IT", { month: "long" })}
              </button>
              <div className="grid grid-cols-7 gap-px">
                {celleMese(m).map((d, i) => {
                  const dentro = d.getMonth() === m.getMonth();
                  const quanti = dentro
                    ? (perGiorno.get(d.toDateString()) ?? []).length
                    : 0;
                  const oggi = dentro && sameDay(d, now);
                  if (!dentro) {
                    return <span key={i} className="h-5" aria-hidden="true" />;
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setAnchor(startOfDay(d));
                        setView("day");
                      }}
                      title={
                        quanti === 0
                          ? fmtDayLong(d)
                          : `${fmtDayLong(d)}: ${quanti} appuntamenti`
                      }
                      className={`flex h-5 items-center justify-center rounded text-[10px] tabular-nums transition ${
                        oggi
                          ? "bg-bob-indigo font-bold text-white"
                          : quanti > 0
                            ? "bg-bob-indigo-50 font-semibold text-bob-indigo"
                            : "text-bob-ink/50 hover:bg-black/[0.04]"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : view === "month" ? (
        <div
          className="overflow-hidden rounded-xl border border-black/[0.07]"
          data-testid="cal-month"
        >
          <div className="grid grid-cols-7 border-b border-black/[0.06] bg-black/[0.02]">
            {DAY_LABELS.map((l) => (
              <div
                key={l}
                className="px-1 py-1.5 text-center text-[11px] font-semibold text-bob-ink/65"
              >
                {l}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((d) => {
              const delMese = d.getMonth() === anchor.getMonth();
              const oggi = sameDay(d, now);
              const delGiorno = perGiorno.get(d.toDateString()) ?? [];
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    setAnchor(startOfDay(d));
                    setView("day");
                  }}
                  className={`min-h-[76px] border-b border-l border-black/[0.06] p-1 text-left align-top transition first:border-l-0 hover:bg-bob-indigo-50/50 ${
                    delMese ? "bg-white" : "bg-black/[0.015]"
                  }`}
                  aria-label={`${fmtDayLong(d)}: ${
                    delGiorno.length === 0
                      ? "nessun appuntamento"
                      : `${delGiorno.length} appuntamenti`
                  }`}
                  data-testid={`cal-month-day-${d.getDate()}`}
                >
                  <span
                    className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                      oggi
                        ? "bg-bob-indigo text-white"
                        : delMese
                          ? "text-bob-ink"
                          : "text-bob-ink/40"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-0.5 flex flex-col gap-0.5">
                    {delGiorno.slice(0, 2).map((a) => (
                      <span
                        key={a.id}
                        className="truncate rounded bg-bob-indigo-50 px-1 py-0.5 text-[10px] leading-tight text-bob-indigo"
                      >
                        {new Date(a.starts_at).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {a.customer_name}
                      </span>
                    ))}
                    {delGiorno.length > 2 && (
                      <span className="px-1 text-[10px] text-bob-ink/65">
                        +{delGiorno.length - 2}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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
                  <span className="block text-2xs font-medium uppercase tracking-wide text-bob-ink/65">
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
                  className="absolute right-1.5 text-2xs font-medium tabular-nums text-bob-ink/65"
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
                        <span className="pointer-events-none hidden text-2xs font-semibold text-bob-indigo group-hover:inline">
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
                            className={`block truncate text-2xs font-bold tabular-nums ${
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
                            <span className="block truncate text-2xs font-medium">
                              {a.customer_name}
                            </span>
                          )}
                          {height >= 62 && a.title && (
                            <span className="block truncate text-2xs opacity-70">
                              {a.title}
                            </span>
                          )}
                          {height >= 78 && a.location_address && (
                            <span className="flex items-center gap-1 text-2xs opacity-70">
                              <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{a.location_address}</span>
                            </span>
                          )}
                          {height >= 96 && a.price != null && (
                            <span className="block truncate text-2xs font-semibold opacity-80">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-bob-ink/65">
            <LegendDot className="bg-bob-indigo" label="Confermato" />
            <LegendDot className="bg-amber-400" label="Da confermare" />
            <LegendDot className="bg-emerald-500" label="Completato" />
            <LegendDot className="bg-black/20" label="Annullato" />
          </div>
          <button
            onClick={() => setFullDay((v) => !v)}
            className="text-2xs font-medium text-bob-indigo hover:underline"
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
