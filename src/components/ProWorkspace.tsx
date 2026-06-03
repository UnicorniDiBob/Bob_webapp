"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Stars, VerificationBadge } from "@/components/ui";
import { AppointmentDialog } from "@/components/AppointmentDialog";
import {
  getAppointments,
  computeStats,
  type ProStats,
} from "@/lib/messages";
import type { Appointment, VerificationStatus } from "@/lib/supabase/types";

interface ProProfile {
  id: string;
  headline: string | null;
  bio: string | null;
  verification_status: VerificationStatus;
  city: { name: string } | null;
}

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunedì = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtHour(d: Date): string {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

const STATUS_STYLE: Record<Appointment["status"], string> = {
  confirmed: "bg-bob-indigo-50 text-bob-indigo border-bob-indigo/20",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-black/5 text-bob-ink/40 border-black/10 line-through",
};

const STATUS_LABEL: Record<Appointment["status"], string> = {
  confirmed: "Confermato",
  completed: "Completato",
  cancelled: "Annullato",
};

export function ProWorkspace({
  profile,
  rating,
  name,
}: {
  profile: ProProfile | null;
  rating: { avg: number | null; n: number };
  name: string;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);

  const proId = profile?.id ?? null;

  async function reload() {
    if (!proId) return;
    setLoading(true);
    const data = await getAppointments(proId);
    setAppointments(data);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proId]);

  const stats: ProStats = useMemo(
    () => computeStats(appointments),
    [appointments]
  );

  const weekStart = useMemo(() => {
    const s = startOfWeek(new Date());
    s.setDate(s.getDate() + weekOffset * 7);
    return s;
  }, [weekOffset]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const apptByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const d = new Date(a.starts_at);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [appointments]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((a) => new Date(a.starts_at) >= now && a.status !== "cancelled")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 6);
  }, [appointments]);

  if (!profile) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-2xl">
          🛠️
        </div>
        <h3 className="font-semibold text-bob-ink">
          Il tuo profilo professionista è in preparazione
        </h3>
        <p className="max-w-sm text-sm text-bob-ink/60">
          Il nostro team ti contatterà per completare la verifica e pubblicare il
          tuo profilo.
        </p>
        <Link href="/per-i-professionisti" className="btn-primary mt-1 px-5 py-2.5">
          Scopri di più
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Guadagni questo mese"
          value={`€ ${stats.earningsMonth.toLocaleString("it-IT")}`}
          accent
        />
        <KpiCard
          label="Ore lavorate (mese)"
          value={`${stats.hoursMonth} h`}
        />
        <KpiCard
          label="Ore prenotate"
          value={`${stats.hoursBooked} h`}
          hint={`${stats.upcomingCount} appuntamenti`}
        />
        <KpiCard
          label="Guadagni totali"
          value={`€ ${stats.earningsTotal.toLocaleString("it-IT")}`}
          hint={`${stats.completedCount} lavori conclusi`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Calendario settimanale */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-bob-ink">Calendario</h2>
              <p className="text-xs text-bob-ink/55">
                {fmtDay(weekDays[0])} – {fmtDay(weekDays[6])}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/[0.03]"
                aria-label="Settimana precedente"
              >
                ‹
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03]"
              >
                Oggi
              </button>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/[0.03]"
                aria-label="Settimana successiva"
              >
                ›
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-black/[0.03]" />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d, i) => {
                const dayAppts = (apptByDay.get(d.toDateString()) ?? []).sort(
                  (a, b) => a.starts_at.localeCompare(b.starts_at)
                );
                const isToday = sameDay(d, new Date());
                return (
                  <div key={i} className="flex flex-col">
                    <div
                      className={`mb-1.5 rounded-lg py-1 text-center text-xs font-semibold ${
                        isToday
                          ? "bg-bob-indigo text-white"
                          : "text-bob-ink/55"
                      }`}
                    >
                      {DAYS[i]} {d.getDate()}
                    </div>
                    <button
                      onClick={() => {
                        const dt = new Date(d);
                        dt.setHours(9, 0, 0, 0);
                        setDefaultDate(dt);
                        setEditing(null);
                        setDialogOpen(true);
                      }}
                      className="mb-1 rounded-md border border-dashed border-black/10 py-1 text-[10px] text-bob-ink/35 hover:border-bob-indigo/40 hover:text-bob-indigo"
                      aria-label="Aggiungi appuntamento"
                    >
                      +
                    </button>
                    <div className="flex flex-col gap-1">
                      {dayAppts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setEditing(a);
                            setDefaultDate(undefined);
                            setDialogOpen(true);
                          }}
                          className={`rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight ${STATUS_STYLE[a.status]}`}
                          data-testid={`appt-${a.id}`}
                        >
                          <span className="block font-semibold">
                            {fmtHour(new Date(a.starts_at))}
                          </span>
                          <span className="block truncate">
                            {a.customer_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              setEditing(null);
              setDefaultDate(undefined);
              setDialogOpen(true);
            }}
            className="btn-primary mt-4 w-full py-2.5"
            data-testid="button-new-appointment"
          >
            + Nuovo appuntamento
          </button>
        </div>

        {/* Colonna laterale: prossimi + profilo */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-bob-ink">
              Prossimi appuntamenti
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-bob-ink/50">
                Nessun appuntamento in programma.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-2 border-b border-black/5 pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-bob-ink">
                        {a.customer_name}
                      </p>
                      <p className="truncate text-xs text-bob-ink/55">
                        {a.title ?? "Appuntamento"}
                      </p>
                      <p className="mt-0.5 text-xs text-bob-indigo">
                        {fmtDay(new Date(a.starts_at))} ·{" "}
                        {fmtHour(new Date(a.starts_at))}
                      </p>
                    </div>
                    {a.price != null && (
                      <span className="shrink-0 text-sm font-semibold text-bob-ink">
                        € {a.price}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-bob-ink">{name}</h3>
                {profile.headline && (
                  <p className="truncate text-xs text-bob-ink/60">
                    {profile.headline}
                  </p>
                )}
              </div>
              <VerificationBadge status={profile.verification_status} />
            </div>
            <div className="mt-3 border-t border-black/5 pt-3">
              <Stars value={rating.avg} count={rating.n} />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/messaggi"
                className="btn-secondary py-2 text-center text-sm"
              >
                Vai ai messaggi
              </Link>
              <Link
                href={`/professionisti/${profile.id}`}
                className="btn-ghost justify-center text-sm"
              >
                Vedi profilo pubblico
              </Link>
            </div>
          </div>
        </div>
      </div>

      {dialogOpen && proId && (
        <AppointmentDialog
          professionalId={proId}
          existing={editing}
          defaultDate={defaultDate}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`card p-4 ${
        accent ? "bg-bob-indigo text-white" : ""
      }`}
    >
      <p
        className={`text-xs font-medium ${
          accent ? "text-white/70" : "text-bob-ink/55"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold ${
          accent ? "text-white" : "text-bob-ink"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`mt-0.5 text-[11px] ${
            accent ? "text-white/60" : "text-bob-ink/45"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
