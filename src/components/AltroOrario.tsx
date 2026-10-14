"use client";

// «ALTRO ORARIO»: IL CLIENTE CONTROPROPONE FRA GLI ORARI LIBERI DEL PRO.
// (17/10: esce da CustomerHome, identico, per usarlo anche nella pagina della
// richiesta.) Mostra solo gli slot liberi, mai il calendario del pro.

import { useEffect, useState } from "react";

export function AltroOrario({
  appuntamento,
  nomePro,
  onChiudi,
  onProposto,
}: {
  appuntamento: { id: string; professional_id: string; duration_minutes: number };
  nomePro: string;
  onChiudi: () => void;
  /** Dopo la controproposta andata a buon fine (il dialog si e' gia' chiuso). */
  onProposto: () => void | Promise<void>;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  /** false = il pro non ha ancora confermato i suoi orari (05/09). */
  const [orariConfermati, setOrariConfermati] = useState(true);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotErr, setSlotErr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/pro/slots?professionalId=${appuntamento.professional_id}&duration=${appuntamento.duration_minutes}`
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
  }, [appuntamento.professional_id, appuntamento.duration_minutes]);

  async function counterPropose(slotIso: string) {
    if (slotSaving) return;
    setSlotSaving(true);
    setSlotErr(null);
    try {
      const res = await fetch("/api/appointments/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appuntamento.id,
          startsAt: slotIso,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setSlotErr(d.error ?? "Qualcosa è andato storto. Riprova.");
        setSlotSaving(false);
        return;
      }
      onChiudi();
      await onProposto();
    } catch {
      setSlotErr("Qualcosa è andato storto. Riprova.");
    }
    setSlotSaving(false);
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
        data-testid="dialog-slot-picker"
      >
        <h3 className="text-lg font-bold text-bob-ink">
          Proponi un altro orario
        </h3>
        <p className="mt-1 text-sm text-bob-ink/70">
          Questi sono gli orari liberi di {nomePro} nei prossimi giorni:
          scegline uno e glielo propongo io.
        </p>
        {slotsLoading ? (
          <p className="mt-5 text-sm text-bob-ink/65">
            Controllo le disponibilità…
          </p>
        ) : !orariConfermati ? (
          /* Vedi /api/pro/slots: «nessuno slot» e «orari mai dichiarati»
             sono due cose diverse e al cliente vanno dette diverse. */
          <p
            className="mt-5 text-sm text-bob-ink/70"
            data-testid="slot-orari-mancanti"
          >
            {nomePro} non ha ancora indicato i suoi orari, quindi non posso
            mostrarti quando è libero: scrivi in chat e proponi tu quando ti
            andrebbe bene.
          </p>
        ) : slots.length === 0 ? (
          <p className="mt-5 text-sm text-bob-ink/70">
            Non ci sono slot liberi nei prossimi 7 giorni: scrivigli in
            chat e trovate un orario insieme.
          </p>
        ) : (
          (() => {
            const byDay = new Map<string, string[]>();
            for (const s of slots) {
              const d = new Date(s);
              const key = d.toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "short",
              });
              byDay.set(key, [...(byDay.get(key) ?? []), s]);
            }
            return (
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
                          onClick={() => counterPropose(s)}
                          disabled={slotSaving}
                          className="chip hover:bg-bob-indigo-100 disabled:opacity-50"
                          data-testid={`slot-${s}`}
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
            );
          })()
        )}
        {slotErr && <p className="mt-3 text-xs text-red-600">{slotErr}</p>}
        <button onClick={onChiudi} className="btn-secondary mt-5 w-full py-2.5">
          Annulla
        </button>
      </div>
    </div>
  );
}
