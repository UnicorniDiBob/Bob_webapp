"use client";

// SCEGLIERE UN ORARIO FRA QUELLI LIBERI DEL PROFESSIONISTA.
//
// Il cliente non scrive un'ora a mano: sceglie fra gli slot liberi che
// /api/pro/slots calcola dalle fasce dichiarate dal pro (05/09). Serve a due
// strade: la controproposta a una proposta del pro (AppointmentActions) e lo
// spostamento di un appuntamento confermato (SpostaAppuntamento, 115). Una
// sola finestra, cosi' le due non dicono cose diverse quando gli orari
// mancano o sono pieni.
//
// Gli slot si chiedono all'apertura: chi apre questa finestra la monta, chi
// la chiude la smonta.

import { useEffect, useState } from "react";

export function SceltaOrario({
  professionalId,
  durataMinuti,
  nomePro,
  titolo,
  testo,
  busy,
  errore,
  onScegli,
  onChiudi,
}: {
  professionalId: string;
  durataMinuti: number;
  /** Come chiamare il pro nelle frasi: «Milano Clean Squad». */
  nomePro: string;
  titolo: string;
  testo: React.ReactNode;
  busy: boolean;
  errore: string | null;
  onScegli: (slotIso: string) => void;
  onChiudi: () => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  /**
   * false = il professionista non ha ancora confermato i suoi orari. Non e'
   * la stessa cosa di «e' pieno»: lo dice la rotta, e va detto al cliente con
   * parole diverse (05/09).
   */
  const [orariConfermati, setOrariConfermati] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/pro/slots?professionalId=${professionalId}&duration=${durataMinuti}`
        );
        const d = await res.json();
        if (!vivo) return;
        setSlots((d.slots as string[]) ?? []);
        setOrariConfermati(d.orariConfermati !== false);
      } catch {
        if (vivo) setSlots([]);
      }
      if (vivo) setSlotsLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [professionalId, durataMinuti]);

  const byDay = new Map<string, string[]>();
  for (const s of slots) {
    const key = new Date(s).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onChiudi}
    >
      <div
        className="card max-h-[80dvh] w-full max-w-md overflow-y-auto overscroll-contain p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-chat-slot-picker"
      >
        <h3 className="text-lg font-bold text-bob-ink">{titolo}</h3>
        <p className="mt-1 text-sm text-bob-ink/70">{testo}</p>
        {slotsLoading ? (
          <p className="mt-5 text-sm text-bob-ink/65">
            Controllo le disponibilità…
          </p>
        ) : !orariConfermati ? (
          /* NON E' «E' PIENO» (05/09). Prima qui finiva anche il pro che
             non aveva mai dichiarato i suoi orari, e al suo posto ne
             proponevamo di inventati. Adesso, quando gli orari non ci
             sono, si dice quello che e' vero. */
          <p
            className="mt-5 text-sm text-bob-ink/70"
            data-testid="chat-slot-orari-mancanti"
          >
            {nomePro} non ha ancora indicato i suoi orari, quindi non posso
            mostrarti quando è libero: scrivi in chat e proponi tu quando ti
            andrebbe bene.
          </p>
        ) : slots.length === 0 ? (
          <p className="mt-5 text-sm text-bob-ink/70">
            Non ci sono slot liberi nei prossimi 7 giorni: scrivigli in chat e
            trovate un orario insieme.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {Array.from(byDay.entries()).map(([day, daySlots]) => (
              <div key={day}>
                <p className="text-xs font-semibold capitalize text-bob-ink/70">
                  {day}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {daySlots.map((s) => (
                    <button
                      key={s}
                      onClick={() => onScegli(s)}
                      disabled={busy}
                      className="chip hover:bg-bob-indigo-100 disabled:opacity-50"
                      data-testid={`chat-slot-${s}`}
                    >
                      {new Date(s).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {errore && <p className="mt-3 text-xs text-red-600">{errore}</p>}
        <button onClick={onChiudi} className="btn-secondary mt-5 w-full py-2.5">
          Annulla
        </button>
      </div>
    </div>
  );
}
