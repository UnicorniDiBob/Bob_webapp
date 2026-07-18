// Calcolo degli slot liberi di un professionista, condiviso client/server.
// Regole del pilota: lun-sab, 8:00-18:00, slot di un'ora, anticipo minimo
// 2 ore. Quando i pro avranno orari configurabili, questo modulo li leggerà
// dal profilo invece che dalle costanti.

export interface BusyInterval {
  start: number; // epoch ms
  end: number; // epoch ms
}

export function computeFreeSlots(opts: {
  busy: BusyInterval[];
  durationMinutes: number;
  days?: number; // orizzonte in giorni (default 7)
  dayStartHour?: number; // default 8
  dayEndHour?: number; // default 18
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
    const day = new Date();
    day.setDate(day.getDate() + d);
    if (day.getDay() === 0) continue; // domenica: riposo

    for (
      let h = startH;
      h + durationMinutes / 60 <= endH && out.length < max;
      h++
    ) {
      const slot = new Date(day);
      slot.setHours(h, 0, 0, 0);
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
