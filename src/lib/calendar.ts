import type { Appointment } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Helper condivisi dalla vista calendario del professionista.
//
// Nota sui fusi orari: tutta l'app mostra gli orari nel fuso locale del
// browser (il pro lavora in Italia). Il posizionamento dei blocchi usa
// l'orario "da orologio" (getHours/getMinutes) e non differenze in
// millisecondi: così le etichette delle ore restano allineate alle righe
// anche nei due giorni all'anno in cui cambia l'ora legale.
// ---------------------------------------------------------------------------

export const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export const DAY_LABELS_LONG = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

/** Altezza di un'ora nella griglia, in px. */
export const HOUR_PX_WEEK = 56;
export const HOUR_PX_DAY = 72;

/** Altezza minima di un blocco, per restare leggibile anche a 15 minuti. */
export const MIN_BLOCK_PX = 20;

/** Finestra oraria mostrata di default (estesa se ci sono appuntamenti fuori). */
export const DEFAULT_START_HOUR = 7;
export const DEFAULT_END_HOUR = 21;

export const STATUS_STYLE: Record<Appointment["status"], string> = {
  proposed: "bg-amber-50 text-amber-800 border-amber-300",
  confirmed: "bg-bob-indigo-50 text-bob-indigo border-bob-indigo/30",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-300",
  cancelled: "bg-black/[0.04] text-bob-ink/40 border-black/10",
  declined: "bg-black/[0.04] text-bob-ink/40 border-black/10",
};

/** Barretta colorata sul bordo sinistro del blocco, come su Google Calendar. */
export const STATUS_BAR: Record<Appointment["status"], string> = {
  proposed: "bg-amber-400",
  confirmed: "bg-bob-indigo",
  completed: "bg-emerald-500",
  cancelled: "bg-black/20",
  declined: "bg-black/20",
};

export const STATUS_LABEL: Record<Appointment["status"], string> = {
  proposed: "Da confermare",
  confirmed: "Confermato",
  completed: "Completato",
  cancelled: "Annullato",
  declined: "Rifiutato",
};

export const STATUS_CHIP: Record<Appointment["status"], string> = {
  proposed: "bg-amber-100 text-amber-800",
  confirmed: "bg-bob-indigo-100 text-bob-indigo",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-black/[0.06] text-bob-ink/50",
  declined: "bg-black/[0.06] text-bob-ink/50",
};

// ----- date -----

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunedì come primo giorno della settimana. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Indice 0-6 con lunedì = 0, per leggere DAY_LABELS. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function fmtHour(d: Date): string {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function fmtDayLong(d: Date): string {
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

/** Fine dell'appuntamento, calcolata da starts_at + duration_minutes. */
export function apptEnd(a: Appointment): Date {
  return new Date(new Date(a.starts_at).getTime() + a.duration_minutes * 60000);
}

/** "14:00 – 15:30" */
export function fmtRange(a: Appointment): string {
  return `${fmtHour(new Date(a.starts_at))} – ${fmtHour(apptEnd(a))}`;
}

/** "1 h 30 min" */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function wallMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

// ----- layout -----

export interface PositionedAppointment {
  appt: Appointment;
  /** Minuti dall'inizio della finestra visibile. */
  startMin: number;
  endMin: number;
  /** Colonna assegnata e numero di colonne del gruppo sovrapposto. */
  col: number;
  cols: number;
  /** L'appuntamento inizia prima / finisce dopo la finestra visibile. */
  clipStart: boolean;
  clipEnd: boolean;
}

/**
 * Calcola la posizione verticale di ogni appuntamento di un giorno e
 * distribuisce su colonne affiancate quelli che si sovrappongono.
 * I valori sono in minuti: il componente li converte in px.
 */
export function layoutDay(
  appts: Appointment[],
  day: Date,
  startHour: number,
  endHour: number
): PositionedAppointment[] {
  const dayStart = startOfDay(day);
  const nextDayStart = addDays(dayStart, 1);
  const winStart = startHour * 60;
  const winEnd = endHour * 60;

  interface Item {
    appt: Appointment;
    s: number;
    e: number;
    clipStart: boolean;
    clipEnd: boolean;
  }

  const items: Item[] = [];

  for (const a of appts) {
    const s0 = new Date(a.starts_at);
    const e0 = new Date(s0.getTime() + Math.max(a.duration_minutes, 5) * 60000);
    // L'appuntamento tocca questo giorno?
    if (e0 <= dayStart || s0 >= nextDayStart) continue;

    const rawStart = sameDay(s0, day) ? wallMinutes(s0) : 0;
    const rawEnd = sameDay(e0, day) ? wallMinutes(e0) : 24 * 60;

    const s = Math.max(rawStart, winStart);
    const e = Math.min(rawEnd, winEnd);
    if (e <= s) continue; // interamente fuori dalla finestra visibile

    items.push({
      appt: a,
      s: s - winStart,
      e: e - winStart,
      // Bordo "tagliato" se l'appuntamento continua fuori dalla finestra
      // visibile o prosegue in un altro giorno.
      clipStart: rawStart < winStart || !sameDay(s0, day),
      clipEnd: rawEnd > winEnd || !sameDay(e0, day),
    });
  }

  // Ordine: per inizio, poi il più lungo prima (colonna di sinistra).
  items.sort((x, y) => x.s - y.s || y.e - x.e);

  const out: PositionedAppointment[] = [];

  // Raggruppa in "cluster" di appuntamenti che si sovrappongono a catena,
  // poi assegna la prima colonna libera dentro ogni cluster.
  let cluster: Item[] = [];
  let clusterEnd = -1;

  function flush() {
    if (cluster.length === 0) return;
    const colEnds: number[] = [];
    const assigned: number[] = [];
    for (const it of cluster) {
      let col = colEnds.findIndex((end) => end <= it.s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.e);
      } else {
        colEnds[col] = it.e;
      }
      assigned.push(col);
    }
    const cols = colEnds.length;
    cluster.forEach((it, i) => {
      out.push({
        appt: it.appt,
        startMin: it.s,
        endMin: it.e,
        col: assigned[i],
        cols,
        clipStart: it.clipStart,
        clipEnd: it.clipEnd,
      });
    });
    cluster = [];
    clusterEnd = -1;
  }

  for (const it of items) {
    if (cluster.length > 0 && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();

  return out;
}

/**
 * Finestra oraria da mostrare: di default 7-21, allargata quanto serve per
 * non nascondere appuntamenti presto/tardi nei giorni visibili.
 */
export function hourBounds(
  appts: Appointment[],
  days: Date[],
  fullDay: boolean
): { startHour: number; endHour: number } {
  if (fullDay || days.length === 0) return { startHour: 0, endHour: 24 };

  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;

  const from = startOfDay(days[0]);
  const to = addDays(startOfDay(days[days.length - 1]), 1);

  for (const a of appts) {
    const s = new Date(a.starts_at);
    const e = new Date(s.getTime() + a.duration_minutes * 60000);
    if (e <= from || s >= to) continue;

    if (s >= from) startHour = Math.min(startHour, s.getHours());
    else startHour = 0;

    if (e <= to) {
      const endMin = e.getHours() * 60 + e.getMinutes();
      endHour = Math.max(endHour, Math.ceil(endMin / 60));
    } else {
      endHour = 24;
    }
  }

  return {
    startHour: Math.max(0, Math.min(startHour, 23)),
    endHour: Math.min(24, Math.max(endHour, startHour + 1)),
  };
}

/** Gli appuntamenti che occupano spazio nel calendario (annullati esclusi). */
export function isLiveAppointment(a: Appointment): boolean {
  return a.status !== "cancelled" && a.status !== "declined";
}
