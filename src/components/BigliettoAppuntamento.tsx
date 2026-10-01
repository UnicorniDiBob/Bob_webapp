// Il biglietto di un appuntamento proposto in chat.
//
// UN BIGLIETTO, NON UN MESSAGGIO (01/10, Lucio). La proposta arrivava come
// una bolla di testo — «Ti propongo un appuntamento: mer 8 ott, 10:00 (60
// min).» — con sotto tre bottoni: si leggeva come una frase qualunque della
// conversazione, e il prezzo non c'era da nessuna parte. Adesso ha la forma
// di quello che e': un impegno con una data, un'ora, una durata, cosa si fa,
// dove e quanto costa. Le informazioni stanno tutte gia' in `appointments`
// (price, title, notes, location_*): nessuna colonna nuova.
//
// Un componente solo per i due lati: e' lo stesso biglietto che il
// professionista vede in anteprima mentre lo compila e che il cliente riceve.
// Due copie divergerebbero alla prima modifica, e il pro firmerebbe una cosa
// diversa da quella che il cliente legge.

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

export type ToniStato = "attesa" | "azione" | "ok" | "chiuso" | "anteprima";

const TONO: Record<ToniStato, string> = {
  attesa: "bg-amber-100 text-amber-900",
  azione: "bg-white text-bob-indigo",
  ok: "bg-emerald-100 text-emerald-800",
  chiuso: "bg-black/[0.06] text-bob-ink/70",
  anteprima: "bg-white/20 text-white",
};

/** «1 h 30 min», «45 min», «2 h». */
export function durataLeggibile(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** «80 €», «75,50 €». */
export function prezzoLeggibile(n: number): string {
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function BigliettoAppuntamento({
  intestazione,
  stato,
  inizio,
  durataMinuti,
  titolo,
  luogo,
  prezzo,
  note,
  avvolgiData,
  azioni,
  testId,
}: {
  /** Chi propone, o com'e' finita: «Proposta di Marco», «Appuntamento confermato». */
  intestazione: string;
  stato: { etichetta: string; tono: ToniStato };
  inizio: Date;
  durataMinuti: number;
  titolo: string | null;
  luogo: string | null;
  prezzo: number | null;
  note: string | null;
  /** La data diventa un bottone (per esempio «aggiungi al calendario»). */
  avvolgiData?: (data: ReactNode) => ReactNode;
  azioni?: ReactNode;
  testId?: string;
}) {
  const valido = !isNaN(inizio.getTime());
  const fine = new Date(inizio.getTime() + durataMinuti * 60000);
  const ora = (d: Date) =>
    d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const data = (
    <span className="flex flex-col items-center leading-none">
      <span className="text-2xs font-semibold uppercase tracking-wider text-bob-indigo">
        {valido ? inizio.toLocaleDateString("it-IT", { weekday: "short" }) : "—"}
      </span>
      <span className="mt-1 text-3xl font-bold tabular-nums text-bob-ink">
        {valido ? inizio.getDate() : "?"}
      </span>
      <span className="mt-1 text-2xs font-medium uppercase tracking-wider text-bob-ink/65">
        {valido
          ? inizio.toLocaleDateString("it-IT", { month: "short" })
          : "data"}
      </span>
    </span>
  );

  return (
    <article
      className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-black/10 bg-white text-bob-ink shadow-card"
      data-testid={testId}
    >
      <header className="flex items-center justify-between gap-2 bg-bob-indigo px-4 py-2 text-white">
        <span className="min-w-0 truncate text-2xs font-semibold uppercase tracking-wider">
          {intestazione}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${
            TONO[stato.tono]
          }`}
        >
          {stato.etichetta}
        </span>
      </header>

      <div className="flex">
        <div className="flex w-20 shrink-0 items-center justify-center border-r-2 border-dashed border-black/10 px-2 py-4">
          {avvolgiData ? avvolgiData(data) : data}
        </div>
        <div className="min-w-0 flex-1 px-4 py-3">
          <p className="text-lg font-bold tabular-nums leading-tight">
            {valido ? `${ora(inizio)} – ${ora(fine)}` : "Scegli un orario"}
          </p>
          <p className="text-xs text-bob-ink/65">
            {durataLeggibile(durataMinuti)}
          </p>
          {titolo && (
            <p className="mt-2 truncate text-sm font-semibold">{titolo}</p>
          )}
          {luogo && (
            <p className="mt-1 flex items-center gap-1 text-xs text-bob-ink/70">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{luogo}</span>
            </p>
          )}
        </div>
      </div>

      {/* La riga del prezzo e' separata come la matrice di un biglietto: due
          tacche ai lati e una linea tratteggiata. */}
      <div className="relative border-t border-dashed border-black/10 px-4 py-2.5">
        <span
          className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-black/10 bg-white"
          aria-hidden="true"
        />
        <span
          className="absolute -right-2 -top-2 h-4 w-4 rounded-full border border-black/10 bg-white"
          aria-hidden="true"
        />
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-2xs font-semibold uppercase tracking-wider text-bob-ink/65">
            Prezzo
          </span>
          {prezzo != null ? (
            <span
              className="text-base font-bold tabular-nums"
              data-testid="biglietto-prezzo"
            >
              {prezzoLeggibile(prezzo)}
            </span>
          ) : (
            <span className="text-sm font-medium text-bob-ink/65">
              Da concordare
            </span>
          )}
        </p>
        {note && (
          <p className="mt-1.5 whitespace-pre-line text-xs leading-snug text-bob-ink/70">
            {note}
          </p>
        )}
      </div>

      {azioni && (
        <div className="border-t border-black/[0.06] bg-black/[0.015] px-3 py-2.5">
          {azioni}
        </div>
      )}
    </article>
  );
}
