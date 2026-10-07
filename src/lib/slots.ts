// Calcolo degli slot liberi di un professionista, condiviso client/server.
//
// UNA SOLA FONTE PER GLI ORARI: professional_availability (05/09).
// Questo modulo esportava anche computeFreeSlots, che NON leggeva il profilo:
// aveva dentro una settimana scritta da noi — lun-sab 8:00-18:00, uguale per
// tutti — e la usavano /api/pro/slots e la scorciatoia «i tuoi prossimi orari
// liberi» in /messaggi. Il risultato era che al cliente comparivano ore in cui
// il professionista non lavora, e nessuno se ne accorgeva perché sembravano
// dati veri. La funzione è stata tolta, non deprecata: finché resta
// esportata, prima o poi qualcuno la richiama. Chi ha bisogno di slot usa
// computeFreeSlotsWithAvailability e, se le fasce sono zero, non propone
// niente — che è la risposta giusta, non un caso da tappare con un default.
//
// Le ore sono calcolate esplicitamente in Europe/Rome: il server (Vercel) gira
// in UTC e senza questa conversione gli slot uscivano spostati di 2 ore.

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
// Gli orari arrivano da professional_availability (fasce settimanali per
// weekday, 0=dom..6=sab). Zero fasce = zero slot, di proposito.

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
  durationMinutes: number; // durata reale del blocco prenotato
  stepMinutes?: number; // granularità degli orari di inizio (default = durata)
  days?: number; // orizzonte (default 14)
  minLeadMs?: number; // anticipo minimo (default 2 ore)
  max?: number; // massimo slot restituiti (default 400)
}): Date[] {
  const { windows, busy, durationMinutes } = opts;
  const step = Math.max(15, opts.stepMinutes ?? durationMinutes);
  const days = opts.days ?? 14;
  const lead = opts.minLeadMs ?? 2 * 3600 * 1000;
  const max = opts.max ?? 400;
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
        m += step
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

// --- Avvisi per chi fissa un orario a mano (113) ------------------------------
// Il pro sceglie lui l'orario (dialog del calendario, proposta in chat): qui
// non si calcolano slot, si dice soltanto se quello scelto cade fuori dalle
// fasce dichiarate o addosso a un altro impegno. Sono AVVISI: il divieto vero,
// per due appuntamenti con un cliente nello stesso orario, e' nel database.

/**
 * Vero se l'intervallo non sta tutto dentro una fascia dello stesso giorno.
 * Ora locale del browser, come il campo da cui arriva. Con zero fasce salvate
 * non c'e' niente da cui essere fuori: false.
 */
export function fuoriDalleFasce(
  inizio: Date,
  durataMinuti: number,
  finestre: AvailabilityWindow[]
): boolean {
  if (finestre.length === 0 || isNaN(inizio.getTime())) return false;
  const da = inizio.getHours() * 60 + inizio.getMinutes();
  const a = da + durataMinuti;
  return !finestre.some((w) => {
    if (w.weekday !== inizio.getDay()) return false;
    const [h1, m1] = w.start.split(":").map(Number);
    const [h2, m2] = w.end.split(":").map(Number);
    return da >= h1 * 60 + m1 && a <= h2 * 60 + m2;
  });
}

/** Vero se [inizio, inizio+durata) tocca uno degli intervalli occupati. */
/**
 * CON CHI SI SOVRAPPONE (116). Non basta dire «si sovrappone»: il pro deve
 * sapere a cosa, per decidere se gli va bene. Gli appuntamenti attivi
 * (confermati o proposti) che toccano l'intervallo, in ordine di orario.
 * `escludi` e' l'appuntamento che si sta spostando: non si sovrappone a se
 * stesso.
 */
export function conChiSiSovrappone<
  T extends { id: string; starts_at: string; duration_minutes: number; status: string },
>(inizio: Date, durataMinuti: number, righe: T[], escludi?: string | null): T[] {
  const s = inizio.getTime();
  if (isNaN(s)) return [];
  const e = s + durataMinuti * 60000;
  return righe
    .filter((r) => r.id !== escludi)
    .filter((r) => r.status === "confirmed" || r.status === "proposed")
    .filter((r) => {
      const rs = new Date(r.starts_at).getTime();
      return s < rs + r.duration_minutes * 60000 && e > rs;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function siSovrappone(
  inizio: Date,
  durataMinuti: number,
  occupato: BusyInterval[]
): boolean {
  const s = inizio.getTime();
  if (isNaN(s)) return false;
  const e = s + durataMinuti * 60000;
  return occupato.some((b) => s < b.end && e > b.start);
}
