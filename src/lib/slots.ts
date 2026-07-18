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
