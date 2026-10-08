"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Appointment } from "@/lib/supabase/types";
import { Check, ChevronDown, MapPin, Maximize2, Minimize2 } from "lucide-react";
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
type CalView = "week" | "day" | "month" | "year";

/** Granularità dei click sulle zone vuote: mezz'ora. */
const SLOT_MINUTES = 30;

/** Altezza massima della griglia scrollabile, quando non e' a tutto schermo. */
const VIEWPORT_PX = 560;

// LE VISTE IN UN PANNELLO, NON IN QUATTRO BOTTONI (12/09, Lucio). Quattro
// bottoni sempre accesi si prendevano la riga intera e su mobile la mandavano
// a capo sopra le frecce. Un bottone solo dice dove sei — «Mese ▾» — e il
// pannello dice dove puoi andare, con accanto la lettera che ci porta da
// tastiera: si cambia vista senza staccare le mani.
const VISTE: { v: CalView; etichetta: string; tasto: string }[] = [
  { v: "day", etichetta: "Giorno", tasto: "D" },
  { v: "week", etichetta: "Settimana", tasto: "W" },
  { v: "month", etichetta: "Mese", tasto: "M" },
  { v: "year", etichetta: "Anno", tasto: "Y" },
];
const ETICHETTA_VISTA: Record<CalView, string> = {
  day: "Giorno",
  week: "Settimana",
  month: "Mese",
  year: "Anno",
};

/**
 * L'orario che si sta proponendo, prima che diventi un appuntamento. Non e'
 * una riga di `appointments`: vive solo nel dialog che lo compila.
 */
export interface Bozza {
  start: Date;
  durationMinutes: number;
  /** Si sovrappone a un appuntamento confermato o in attesa. */
  conflitto?: boolean;
}

/** Il passo del trascinamento: un quarto d'ora, come i campi del dialog. */
const PASSO_TRASCINA = 15;

export function ProCalendar({
  appointments,
  loading,
  onCreateAt,
  onSelect,
  onFocusDayChange,
  selectedId,
  bozza = null,
  onBozzaChange,
  vaiA = null,
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
  /**
   * LO SLOT SCELTO SI VEDE (01/10, Lucio). Prima un click su uno spazio vuoto
   * chiamava onCreateAt e basta: il calendario non disegnava niente, e la
   * conferma dell'orario stava in una riga di testo sotto, fuori vista. Con
   * una bozza il blocco compare dove l'hai messo.
   */
  bozza?: Bozza | null;
  /**
   * Se c'e', il blocco della bozza si trascina (sposta) e si allunga dal
   * bordo in basso (durata), come su Google Calendar. Si chiama al rilascio,
   * non a ogni pixel: chi ascolta puo' anche fare lavoro vero.
   */
  onBozzaChange?: (start: Date, durationMinutes: number) => void;
  /** Porta il calendario su quel giorno (08/10, «Vedi nel calendario»): una data nuova a ogni richiesta. */
  vaiA?: Date | null;
}) {
  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [fullDay, setFullDay] = useState(false);
  // A TUTTO SCHERMO (12/09, Lucio). In una colonna da 320px il mese e' un
  // francobollo: per guardare quattro settimane intere serve la finestra
  // tutta, anche da PC. Non usa l'API fullscreen del browser — su iOS non
  // funziona sugli elementi normali — ma un pannello che copre la finestra.
  // Dal 04/10 e' l'UNICO modo di vedere il calendario grande: cambiare vista
  // non allarga piu' niente (ProWorkspace).
  const [espanso, setEspanso] = useState(false);
  const [menuVista, setMenuVista] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  // Su mobile la settimana a 7 colonne è illeggibile: partiamo dal giorno.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setView("day");
    }
  }, []);

  // Il pannello delle viste si chiude cliccando fuori.
  useEffect(() => {
    if (!menuVista) return;
    const fuori = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuVista(false);
    };
    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, [menuVista]);

  // D, W, M, Y cambiano vista; Esc chiude prima il pannello, poi il tutto
  // schermo. Mai mentre si scrive: dentro un campo la «m» e' una lettera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (menuVista) setMenuVista(false);
        else if (espanso) setEspanso(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      )
        return;
      const scelta = VISTE.find(
        (x) => x.tasto.toLowerCase() === e.key.toLowerCase()
      );
      if (scelta) {
        e.preventDefault();
        setView(scelta.v);
        setMenuVista(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuVista, espanso]);

  // Con il calendario a tutto schermo la pagina sotto non deve scorrere.
  useEffect(() => {
    if (!espanso) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prima;
    };
  }, [espanso]);

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

  // Il trascinamento in corso: posizione provvisoria, in minuti dalla
  // mezzanotte del giorno, e indice della colonna. Null = nessun trascinamento.
  const [trascina, setTrascina] = useState<{
    giorno: number;
    inizioMin: number;
    durata: number;
  } | null>(null);
  const colonneRef = useRef<HTMLDivElement>(null);

  // Anche la bozza allarga la finestra delle ore: una proposta alle 6:30 che
  // cade fuori dalla griglia e' una proposta che non si vede.
  const { startHour, endHour } = useMemo(
    () =>
      hourBounds(
        bozza
          ? [
              ...appointments,
              {
                starts_at: bozza.start.toISOString(),
                duration_minutes: bozza.durationMinutes,
              } as Appointment,
            ]
          : appointments,
        days,
        fullDay
      ),
    [appointments, days, fullDay, bozza]
  );

  // Una data scritta a mano porta il calendario su quel giorno: la bozza
  // deve stare dove si guarda, non in una settimana che nessuno ha aperto.
  const bozzaGiorno = bozza ? startOfDay(bozza.start).getTime() : null;
  useEffect(() => {
    if (bozzaGiorno === null || (view !== "day" && view !== "week")) return;
    if (!days.some((d) => d.getTime() === bozzaGiorno))
      setAnchor(new Date(bozzaGiorno));
    // Anche al cambio di vista: da telefono il calendario nasce in settimana
    // e passa al giorno subito dopo, e il giorno sarebbe oggi, non quello
    // della bozza (provato a 375px il 01/10). Le frecce invece no: chi va a
    // guardare un altro giorno ci deve poter restare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bozzaGiorno, view]);

  useEffect(() => {
    if (vaiA) setAnchor(startOfDay(vaiA));
  }, [vaiA]);

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
    // Solo al primo render utile e ai cambi di periodo/vista. Se c'e' una
    // bozza si va da lei: e' la cosa che si sta guardando, il primo
    // appuntamento del periodo no (01/10: aprendo il dialog la proposta
    // delle 10 restava sopra il riquadro, scorso alle 14).
    const rif = bozza
      ? bozza.start.getHours() * 60 + bozza.start.getMinutes() - startHour * 60
      : firstStartMin;
    const target = Math.max(0, (rif - 30) * pxPerMin);
    el.scrollTo({ top: target, behavior: didAutoScroll.current ? "smooth" : "auto" });
    didAutoScroll.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor, loading, startHour, endHour]);

  // E la bozza deve stare anche nella parte di griglia che si vede: dopo una
  // data o un'ora scritte a mano, se e' sopra o sotto il riquadro, ci si va.
  const bozzaInizio = bozza ? bozza.start.getTime() : null;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !bozza || loading) return;
    const min = bozza.start.getHours() * 60 + bozza.start.getMinutes();
    const top = (min - startHour * 60) * pxPerMin;
    const h = bozza.durationMinutes * pxPerMin;
    if (top < el.scrollTop + 40 || top + h > el.scrollTop + el.clientHeight)
      el.scrollTo({ top: Math.max(0, top - 60), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bozzaInizio, view, loading]);

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

  // LE MISURE CAMBIANO COL TUTTO SCHERMO. Mese e anno non sono agende, sono
  // mappe: se le celle restano quelle della colonna stretta, allargare la
  // finestra non serve a niente — piu' bianco intorno e gli stessi quadratini.
  const righeMese = Math.max(1, Math.round(monthCells.length / 7));
  // UNA MISURA SOLA PER TUTTE LE VISTE (01/10, Lucio). Prima ogni vista si
  // dimensionava per conto suo: la settimana su VIEWPORT_PX, il mese su celle
  // da 104px (quindi 520px con cinque righe e 624 con sei: cambiava anche fra
  // un mese e l'altro), l'anno su quanto venivano i dodici quadratini. Il
  // risultato era che cambiando vista — o solo scorrendo a un mese con una
  // riga in piu' — il riquadro saltava su e giu' e tutto quello che gli stava
  // sotto si spostava. Adesso l'altezza la decide questa riga e basta: dentro,
  // ogni vista si arrangia (la settimana scorre, il mese divide, l'anno
  // scorre).
  const altezzaGriglia = espanso ? "calc(100vh - 12rem)" : VIEWPORT_PX;
  const cellaAnno = espanso ? "h-8 text-xs" : "h-6 text-[11px]";
  const quantiNelGiorno = espanso ? 6 : 3;

  // TRASCINARE IL BLOCCO (01/10, Lucio). Due gesti sullo stesso blocco: dal
  // corpo si sposta (ora e, in settimana, giorno), dal bordo in basso si
  // allunga. Tutto a passi di un quarto d'ora e dentro la finestra visibile,
  // cosi' la griglia non cambia misura sotto il dito. Eventi «pointer»:
  // funziona uguale con mouse, penna e dito.
  //
  // GLI ASCOLTATORI STANNO SULLA FINESTRA, NON SUL BLOCCO. Il blocco e' figlio
  // della colonna del suo giorno: quando lo trascini a un altro giorno React
  // lo ridisegna nell'altra colonna, cioe' e' un elemento nuovo, e quello su
  // cui ascoltavi non c'e' piu'. Con gli ascoltatori sul blocco il rilascio
  // non arrivava mai e il blocco restava a mezz'aria (provato il 01/10).
  function iniziaTrascina(
    e: React.PointerEvent<HTMLElement>,
    modo: "sposta" | "allunga",
    giorno: number,
    inizioMin: number,
    durata: number
  ) {
    if (!onBozzaChange) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.pointerId;
    const y0 = e.clientY;
    const minWin = startHour * 60;
    const maxWin = endHour * 60;
    let ultimo = { giorno, inizioMin, durata };
    setTrascina(ultimo);

    const muovi = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const passi = Math.round((ev.clientY - y0) / pxPerMin / PASSO_TRASCINA);
      const delta = passi * PASSO_TRASCINA;
      if (modo === "allunga") {
        const d = Math.max(
          PASSO_TRASCINA,
          Math.min(durata + delta, maxWin - inizioMin)
        );
        ultimo = { giorno, inizioMin, durata: d };
      } else {
        const inizio = Math.max(
          minWin,
          Math.min(inizioMin + delta, maxWin - durata)
        );
        let g = giorno;
        const box = colonneRef.current?.getBoundingClientRect();
        if (box && days.length > 1) {
          const x = Math.max(0, Math.min(ev.clientX - box.left, box.width - 1));
          g = Math.floor((x / box.width) * days.length);
        }
        ultimo = { giorno: g, inizioMin: inizio, durata };
      }
      setTrascina(ultimo);
    };
    const fine = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener("pointermove", muovi);
      window.removeEventListener("pointerup", fine);
      window.removeEventListener("pointercancel", fine);
      setTrascina(null);
      const d = new Date(days[ultimo.giorno]);
      d.setHours(Math.floor(ultimo.inizioMin / 60), ultimo.inizioMin % 60, 0, 0);
      onBozzaChange(d, ultimo.durata);
    };
    window.addEventListener("pointermove", muovi);
    window.addEventListener("pointerup", fine);
    window.addEventListener("pointercancel", fine);
  }

  function handleSlotClick(day: Date, minutesFromWindowStart: number) {
    const d = new Date(day);
    const abs = startHour * 60 + minutesFromWindowStart;
    d.setHours(Math.floor(abs / 60), abs % 60, 0, 0);
    onCreateAt(d);
  }

  const contenuto = (
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
          {/* Un bottone dice dove sei, il pannello dice dove puoi andare.
              L'ordine resta dal piu' stretto al piu' largo: e' il verso in cui
              si zooma, e l'unico che non costringe a cercare. */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuVista((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.04] px-3 py-1.5 text-xs font-medium text-bob-ink transition hover:bg-black/[0.08]"
              aria-haspopup="listbox"
              aria-expanded={menuVista}
              data-testid="cal-view-menu"
            >
              {ETICHETTA_VISTA[view]}
              <ChevronDown
                className={`h-3.5 w-3.5 opacity-60 transition ${
                  menuVista ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            {menuVista && (
              <div
                role="listbox"
                aria-label="Vista del calendario"
                className="absolute right-0 z-40 mt-1.5 w-52 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-card"
                data-testid="cal-view-panel"
              >
                {VISTE.map(({ v, etichetta, tasto }) => (
                  <button
                    key={v}
                    type="button"
                    role="option"
                    aria-selected={view === v}
                    onClick={() => {
                      setView(v);
                      setMenuVista(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-black/[0.04] ${
                      view === v
                        ? "font-semibold text-bob-indigo"
                        : "text-bob-ink"
                    }`}
                    data-testid={`cal-view-${v}`}
                  >
                    <span className="flex items-center gap-2">
                      {view === v ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <span className="w-3.5" aria-hidden="true" />
                      )}
                      {etichetta}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-bob-ink/40">
                      {tasto}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
          {/* IL TASTO HA UN NOME (04/10, Lucio). Era un'icona sola accanto a
              «Oggi», e finche' mese e anno si allargavano da soli bastava.
              Adesso e' l'unica strada per il calendario grande, quindi si
              legge: «Ingrandisci» / «Riduci». Su mese e anno, le viste che
              ne hanno bisogno, si colora: e' li' che va trovato. Sotto i
              640px la parola non ci sta (a 390 la barra sbordava di 17px in
              settimana) e resta l'icona colorata: sul telefono il calendario
              e' gia' largo quanto la pagina. */}
          <button
            onClick={() => setEspanso((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              !espanso && (view === "month" || view === "year")
                ? "border-bob-indigo/30 bg-bob-indigo-50 text-bob-indigo hover:bg-bob-indigo-50/70"
                : "border-black/10 text-bob-ink/75 hover:bg-black/[0.03]"
            }`}
            aria-label={
              espanso ? "Riduci il calendario" : "Calendario a tutto schermo"
            }
            title={espanso ? "Riduci (Esc)" : "A tutto schermo"}
            data-testid="cal-fullscreen"
          >
            {espanso ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {espanso ? "Riduci" : "Ingrandisci"}
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="animate-pulse rounded-xl bg-black/[0.03]"
          style={{ height: altezzaGriglia }}
        />
      ) : view === "year" ? (
        <div
          // Le colonne seguono la larghezza vera: nella colonna del cruscotto
          // quattro mesi in fila stanno solo da xl in su, a tutto schermo
          // l'anno si stende su sei e si vede in due righe.
          className={`grid auto-rows-min grid-cols-2 content-start overflow-y-auto overscroll-contain sm:grid-cols-3 ${
            espanso ? "gap-4 lg:grid-cols-4 xl:grid-cols-6" : "gap-3 xl:grid-cols-4"
          }`}
          style={{ height: altezzaGriglia }}
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
                className={`mb-1 w-full text-left font-semibold capitalize text-bob-ink transition hover:text-bob-indigo ${
                  espanso ? "text-sm" : "text-xs"
                }`}
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
                    return (
                      <span
                        key={i}
                        className={espanso ? "h-8" : "h-6"}
                        aria-hidden="true"
                      />
                    );
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
                      className={`flex ${cellaAnno} items-center justify-center rounded tabular-nums transition ${
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
          className="flex flex-col overflow-hidden rounded-xl border border-black/[0.07]"
          style={{ height: altezzaGriglia }}
          data-testid="cal-month"
        >
          <div className="grid shrink-0 grid-cols-7 border-b border-black/[0.06] bg-black/[0.02]">
            {DAY_LABELS.map((l) => (
              <div
                key={l}
                className="px-1 py-1.5 text-center text-[11px] font-semibold text-bob-ink/65"
              >
                {l}
              </div>
            ))}
          </div>
          {/* Le righe si spartiscono quello che resta: cinque righe o sei, il
              riquadro e' alto uguale. */}
          <div
            className="grid min-h-0 flex-1 grid-cols-7"
            style={{ gridTemplateRows: `repeat(${righeMese}, minmax(0, 1fr))` }}
          >
            {monthCells.map((d) => {
              const delMese = d.getMonth() === anchor.getMonth();
              const oggi = sameDay(d, now);
              const delGiorno = perGiorno.get(d.toDateString()) ?? [];
              const conBozza = !!bozza && sameDay(bozza.start, d);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    setAnchor(startOfDay(d));
                    setView("day");
                  }}
                  className={`overflow-hidden border-b border-l border-black/[0.06] p-1 text-left align-top transition first:border-l-0 hover:bg-bob-indigo-50/50 ${
                    delMese ? "bg-white" : "bg-black/[0.015]"
                  } ${conBozza ? "ring-2 ring-inset ring-bob-indigo" : ""}`}
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
                    {conBozza && bozza && (
                      <span className="truncate rounded bg-bob-indigo px-1 py-0.5 text-[10px] font-semibold leading-tight text-white">
                        {fmtHour(bozza.start)} Proposta
                      </span>
                    )}
                    {delGiorno.slice(0, quantiNelGiorno).map((a) => (
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
                    {delGiorno.length > quantiNelGiorno && (
                      <span className="px-1 text-[10px] text-bob-ink/65">
                        +{delGiorno.length - quantiNelGiorno}
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
          style={{ height: altezzaGriglia }}
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
            <div ref={colonneRef} className="flex min-w-0 flex-1">
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

                  {/* La bozza: l'orario che si sta proponendo. */}
                  {(() => {
                    if (!bozza && !trascina) return null;
                    const pos = trascina
                      ? trascina
                      : bozza && sameDay(bozza.start, d)
                        ? {
                            giorno: di,
                            inizioMin:
                              bozza.start.getHours() * 60 +
                              bozza.start.getMinutes(),
                            durata: bozza.durationMinutes,
                          }
                        : null;
                    if (!pos || pos.giorno !== di) return null;
                    const daMin = pos.inizioMin - startHour * 60;
                    const top = daMin * pxPerMin;
                    const height = Math.max(pos.durata * pxPerMin, MIN_BLOCK_PX);
                    const inizio = new Date(d);
                    inizio.setHours(
                      Math.floor(pos.inizioMin / 60),
                      pos.inizioMin % 60,
                      0,
                      0
                    );
                    const fineOra = new Date(
                      inizio.getTime() + pos.durata * 60000
                    );
                    const conflitto = !trascina && bozza?.conflitto;
                    const trascinabile = !!onBozzaChange;
                    return (
                      <div
                        className={`absolute inset-x-0.5 z-[25] flex select-none flex-col overflow-hidden rounded-md border-2 text-left shadow-card ${
                          conflitto
                            ? "border-red-500 bg-red-50/75 text-red-800"
                            : "border-bob-indigo bg-bob-indigo text-white"
                        } ${
                          trascinabile
                            ? "cursor-grab touch-none active:cursor-grabbing"
                            : "pointer-events-none"
                        } ${
                          trascina ? "opacity-90 ring-4 ring-bob-indigo/20" : ""
                        }`}
                        style={{ top, height }}
                        onPointerDown={(e) =>
                          iniziaTrascina(
                            e,
                            "sposta",
                            di,
                            pos.inizioMin,
                            pos.durata
                          )
                        }
                        data-testid="cal-bozza"
                        aria-label={`Orario proposto: ${fmtHour(inizio)} – ${fmtHour(
                          fineOra
                        )}`}
                      >
                        <span className="min-w-0 flex-1 px-1.5 py-0.5 leading-tight">
                          <span className="block truncate text-2xs font-bold tabular-nums">
                            {fmtHour(inizio)} – {fmtHour(fineOra)}
                          </span>
                          {height >= 30 && (
                            <span className="block truncate text-2xs font-medium opacity-80">
                              {conflitto ? "Sovrapposto" : "Proposta"}
                            </span>
                          )}
                        </span>
                        {trascinabile && (
                          <span
                            className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize touch-none items-end justify-center pb-1"
                            onPointerDown={(e) =>
                              iniziaTrascina(
                                e,
                                "allunga",
                                di,
                                pos.inizioMin,
                                pos.durata
                              )
                            }
                            data-testid="cal-bozza-allunga"
                            aria-hidden="true"
                          >
                            <span
                              className={`h-0.5 w-6 rounded-full ${
                                conflitto ? "bg-red-400" : "bg-white/70"
                              }`}
                            />
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            </div>
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

  // Fuori dal flusso della pagina solo quando serve: cosi' la colonna di
  // fianco, gli altri pannelli e la barra in alto restano sotto, e Esc
  // riporta tutto com'era.
  if (!espanso) return contenuto;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-white p-4 sm:p-6"
      data-testid="cal-fullscreen-overlay"
    >
      {contenuto}
    </div>,
    document.body
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
