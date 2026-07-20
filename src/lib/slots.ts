// Calcolo degli slot liberi di un professionista, condiviso client/server.
// Regole del pilota: lun-sab, 8:00-18:00 ORA ITALIANA, slot di un'ora,
// anticipo minimo 2 ore. Le ore sono calcolate esplicitamente in
// Europe/Rome: il server (Vercel) gira in UTC e senza questa conversione
// gli slot uscivano spostati di 2 ore. Quando i pro avranno orari
// configurabili, questo modulo li leggerà dal profilo.

export interface BusyInterval {
  start: number; // epoch ms
  end: number; // epoch ms
}

const TZ = "Europe/Rome";

function romeDay(d: Date): { ymd: string; weekday: string } {
  return {
    ymd: new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d),
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      weekday: "short",
    }).format(d),
  };
}

// Istante assoluto corrispondente alle HH:00 italiane del giorno ymd.
// Prova i due offset possibili (CEST/CET) e verifica quale è corretto.
function atRomeHour(ymd: string, hour: number): Date {
  const hh = String(hour).padStart(2, "0");
  for (const off of ["+02:00", "+01:00"]) {
    const d = new Date(`${ymd}T${hh}:00:00${off}`);
    const check = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ,
        hour: "2-digit",
        hour12: false,
      }).format(d)
    );
    if (check === hour % 24) return d;
  }
  return new Date(`${ymd}T${hh}:00:00+01:00`);
}

export function computeFreeSlots(opts: {
  busy: BusyInterval[];
  durationMinutes: number;
  days?: number; // orizzonte in giorni (default 7)
  dayStartHour?: number; // default 8 (ora italiana)
  dayEndHour?: number; // default 18 (ora italiana)
  minLeadMs?: number; // anticipo minimo (default 2 ore)
  max?: number; // massimo slot restituiti (default 24)
}): Date[] {
  const { busy, durationMinutes } = opts;
  const days = opts.days ?? 7;
  const startH = opts.dayStartHour ?? 8;
  const endH = opts.dayEndHour ?? 18;
  const lead = opts.minLeadMs ?? 2 * 3600 * 1000;
  const max = opts.max ?? 24;

  const out: Date[] = [];
  const now = Date.now();

  for (let d = 0; d < days && out.length < max; d++) {
    const base = new Date(now + d * 24 * 3600 * 1000);
    const { ymd, weekday } = romeDay(base);
    if (weekday === "Sun") continue; // domenica: riposo

    for (
      let h = startH;
      h + durationMinutes / 60 <= endH && out.length < max;
      h++
    ) {
      const slot = atRomeHour(ymd, h);
      const s = slot.getTime();
      const e = s + durationMinutes * 60000;
      if (s < now + lead) continue;
      if (busy.some((b) => s < b.end && e > b.start)) continue;
      out.push(slot);
    }
  }
  return out;
}

// Intervalli occupati a partire dalle righe appointments (proposti inclusi:
// uno slot in attesa di conferma non va offerto due volte).
export function busyFromAppointments(
  rows: { starts_at: string; duration_minutes: number; status: string }[]
): BusyInterval[] {
  return rows
    .filter((r) => r.status === "confirmed" || r.status === "proposed")
    .map((r) => {
      const start = new Date(r.starts_at).getTime();
      return { start, end: start + r.duration_minutes * 60000 };
    });
}

// --- Prenotazione diretta: slot dagli orari configurati dal pro ---------------
// A differenza di computeFreeSlots (finestra fissa 8-18), qui gli orari arrivano
// da professional_availability (fasce settimanali per weekday, 0=dom..6=sab).

export interface AvailabilityWindow {
  weekday: number; // 0=domenica .. 6=sabato
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

// Durata effettiva di una prenotazione diretta.
// Servizi a ore (rate_unit = 'hour'): la durata = ore prenotate (con minimo),
// così l'agenda blocca il tempo reale e non un solo slot fisso.
// Altre unità (m²/job/session): durata fissa impostata dal pro (slot_duration_min).
export function bookingDurationMinutes(opts: {
  unit: string;
  minUnits: number;
  slotDurationMin: number;
  qty: number;
}): number {
  if (opts.unit === "hour") {
    return Math.max(opts.minUnits, opts.qty) * 60;
  }
  return opts.slotDurationMin;
}

const WEEKDAY_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Istante assoluto per le HH:MM italiane del giorno ymd (gestisce CEST/CET).
function atRomeTime(ymd: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  for (const off of ["+02:00", "+01:00"]) {
    const d = new Date(`${ymd}T${hh}:${mm}:00${off}`);
    const check = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ,
        hour: "2-digit",
        hour12: false,
      }).format(d)
    );
    if (check === hour % 24) return d;
  }
  return new Date(`${ymd}T${hh}:${mm}:00+01:00`);
}

export function computeFreeSlotsWithAvailability(opts: {
  windows: AvailabilityWindow[];
  busy: BusyInterval[];
  durationMinutes: number;
  days?: number; // orizzonte (default 14)
  minLeadMs?: number; // anticipo minimo (default 2 ore)
  max?: number; // massimo slot restituiti (default 60)
}): Date[] {
  const { windows, busy, durationMinutes } = opts;
  const days = opts.days ?? 14;
  const lead = opts.minLeadMs ?? 2 * 3600 * 1000;
  const max = opts.max ?? 60;
  const out: Date[] = [];
  const now = Date.now();

  for (let d = 0; d < days && out.length < max; d++) {
    const base = new Date(now + d * 24 * 3600 * 1000);
    const { ymd, weekday } = romeDay(base);
    const wd = WEEKDAY_NUM[weekday];
    const dayWindows = windows.filter((w) => w.weekday === wd);
    for (const w of dayWindows) {
      const startM = toMinutes(w.start);
      const endM = toMinutes(w.end);
      for (
        let m = startM;
        m + durationMinutes <= endM && out.length < max;
        m += durationMinutes
      ) {
        const slot = atRomeTime(ymd, Math.floor(m / 60), m % 60);
        const s = slot.getTime();
        const e = s + durationMinutes * 60000;
        if (s < now + lead) continue;
        if (busy.some((b) => s < b.end && e > b.start)) continue;
        out.push(slot);
      }
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}
