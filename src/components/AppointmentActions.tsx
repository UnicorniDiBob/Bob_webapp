"use client";

// Card di risposta a una proposta di appuntamento, mostrata in chat sotto il
// messaggio che l'ha generata (collegamento messaggio → appuntamento: 033).
//
// Prima il cliente doveva uscire dalla conversazione e andare nell'area
// personale per confermare. Qui ha i tre tasti dove sta guardando:
//   Approva  → status 'confirmed'   (permesso al cliente dal trigger di 031)
//   Rifiuta  → status 'declined'    (idem)
//   Modifica → controproposta       (deve passare dal server: il cliente non
//              ha INSERT su appointments, vedi POST /api/appointments/counter)
//
// Lo stesso componente serve le due parti: chi ha proposto vede lo stato,
// la controparte vede i tasti.

import { useState } from "react";
import { Calendar, Check, Clock, PencilLine, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, updateAppointment } from "@/lib/messages";
import { notifyEvent } from "@/lib/notify";
import type { Appointment } from "@/lib/supabase/types";

// Solo i campi che ci servono: la chat fa una select ristretta.
export type ThreadAppointment = Pick<
  Appointment,
  | "id"
  | "professional_id"
  | "request_id"
  | "starts_at"
  | "duration_minutes"
  | "status"
  | "proposed_by"
  | "title"
>;

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDayParts(iso: string) {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString("it-IT", { weekday: "short" }),
    day: d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Appuntamento confermato",
  declined: "Proposta rifiutata",
  cancelled: "Appuntamento annullato",
  completed: "Lavoro concluso",
};

export function AppointmentActions({
  appointment,
  viewer,
  userId,
  professionalId,
  counterpartName,
  onChanged,
  onProModify,
}: {
  appointment: ThreadAppointment;
  viewer: "customer" | "professional";
  userId: string;
  // Id del pro del thread: serve a sendMessage per instradare la conversazione.
  professionalId: string | null;
  counterpartName: string;
  onChanged: () => void | Promise<void>;
  // Il pro non contropropone via API: riusa il dialog "Proponi appuntamento",
  // che sa già calcolare i suoi slot liberi ed evitare le sovrapposizioni.
  onProModify?: (appointmentId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  /**
   * false = il professionista non ha ancora confermato i suoi orari. Non e'
   * la stessa cosa di «e' pieno»: lo dice la rotta, e va detto al cliente con
   * parole diverse (05/09).
   */
  const [orariConfermati, setOrariConfermati] = useState(true);

  const a = appointment;
  const when = fmtWhen(a.starts_at);
  const isPast = new Date(a.starts_at).getTime() < Date.now();
  // Chi deve rispondere è la controparte di chi ha proposto.
  const mineToAnswer = a.proposed_by !== viewer;

  // --- Stati chiusi: nessuna azione, solo l'esito. --------------------------
  if (a.status !== "proposed") {
    const label = STATUS_LABEL[a.status] ?? "Proposta chiusa";
    const ok = a.status === "confirmed" || a.status === "completed";
    return (
      <div
        className={`mt-1.5 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
          ok ? "bg-emerald-50 text-emerald-700" : "bg-black/[0.04] text-bob-ink/55"
        }`}
        data-testid={`appt-status-${a.id}`}
      >
        {ok ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label} · {when}
      </div>
    );
  }

  // Proposta scaduta: non facciamo confermare un orario già passato.
  if (isPast) {
    return (
      <div
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-bob-ink/55"
        data-testid={`appt-expired-${a.id}`}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Proposta scaduta · {when}
      </div>
    );
  }

  // In attesa: l'ha proposto chi sta guardando.
  if (!mineToAnswer) {
    return (
      <div
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
        data-testid={`appt-waiting-${a.id}`}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        In attesa di risposta
      </div>
    );
  }

  async function respond(ok: boolean) {
    if (busy || !a.request_id) return;
    setBusy(true);
    setErr(null);

    const next = ok ? "confirmed" : "declined";
    // Il cliente aggiorna direttamente (il trigger di 031 consente
    // proposed → confirmed/declined); il pro passa dall'helper condiviso.
    const { error } =
      viewer === "customer"
        ? await (async () => {
            const supabase = createClient();
            const { error } = await supabase
              .from("appointments")
              .update({ status: next })
              .eq("id", a.id);
            return { error: error ? error.message : null };
          })()
        : await updateAppointment(a.id, { status: next });

    if (error) {
      setErr("Non sono riuscito a salvare. Riprova.");
      setBusy(false);
      return;
    }

    const { dow, day, time } = fmtDayParts(a.starts_at);
    const text =
      viewer === "customer"
        ? ok
          ? `Ho confermato l'appuntamento di ${dow} ${day} alle ${time}.`
          : `Non posso ${dow} ${day} alle ${time}: proponi un altro orario?`
        : ok
          ? `Confermo l'appuntamento di ${dow} ${day} alle ${time}. A presto!`
          : `Purtroppo ${dow} ${day} alle ${time} non riesco: scrivimi e troviamo un altro orario.`;

    await sendMessage(a.request_id, professionalId, userId, viewer, text);
    notifyEvent(ok ? "appointment_confirmed" : "appointment_declined", {
      requestId: a.request_id,
      professionalId: a.professional_id,
    });
    await onChanged();
    setBusy(false);
  }

  async function openPicker() {
    if (viewer === "professional") {
      onProModify?.(a.id);
      return;
    }
    setPickerOpen(true);
    setSlots([]);
    setErr(null);
    setOrariConfermati(true);
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/pro/slots?professionalId=${a.professional_id}&duration=${a.duration_minutes}`
      );
      const d = await res.json();
      setSlots((d.slots as string[]) ?? []);
      setOrariConfermati(d.orariConfermati !== false);
    } catch {
      setSlots([]);
    }
    setSlotsLoading(false);
  }

  async function counterPropose(slotIso: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/appointments/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: a.id, startsAt: slotIso }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Qualcosa è andato storto. Riprova.");
        setBusy(false);
        return;
      }
      setPickerOpen(false);
      await onChanged();
    } catch {
      setErr("Qualcosa è andato storto. Riprova.");
    }
    setBusy(false);
  }

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
    <>
      <div
        className="mt-1.5 rounded-xl border border-black/10 bg-white p-3"
        data-testid={`appt-actions-${a.id}`}
      >
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-bob-ink">
          <Calendar className="h-3.5 w-3.5 text-bob-indigo" aria-hidden="true" />
          {when} · {a.duration_minutes} min
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            onClick={() => respond(true)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
            data-testid={`appt-approve-${a.id}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Approva
          </button>
          <button
            onClick={openPicker}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-bob-ink hover:bg-black/[0.03] disabled:opacity-50"
            data-testid={`appt-modify-${a.id}`}
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Modifica
          </button>
          <button
            onClick={() => respond(false)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-bob-ink/70 hover:bg-black/[0.03] disabled:opacity-50"
            data-testid={`appt-reject-${a.id}`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Rifiuta
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="card max-h-[80dvh] w-full max-w-md overflow-y-auto overscroll-contain p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-chat-slot-picker"
          >
            <h3 className="text-lg font-bold text-bob-ink">
              Proponi un altro orario
            </h3>
            <p className="mt-1 text-sm text-bob-ink/60">
              Questi sono gli orari liberi di {counterpartName} nei prossimi
              giorni: scegline uno e glielo propongo io.
            </p>
            {slotsLoading ? (
              <p className="mt-5 text-sm text-bob-ink/50">
                Controllo le disponibilità…
              </p>
            ) : !orariConfermati ? (
              /* NON E' «E' PIENO» (05/09). Prima qui finiva anche il pro che
                 non aveva mai dichiarato i suoi orari, e al suo posto ne
                 proponevamo di inventati. Adesso, quando gli orari non ci
                 sono, si dice quello che e' vero. */
              <p
                className="mt-5 text-sm text-bob-ink/60"
                data-testid="chat-slot-orari-mancanti"
              >
                {counterpartName} non ha ancora indicato i suoi orari, quindi
                non posso mostrarti quando è libero: scrivi in chat e proponi
                tu quando ti andrebbe bene.
              </p>
            ) : slots.length === 0 ? (
              <p className="mt-5 text-sm text-bob-ink/60">
                Non ci sono slot liberi nei prossimi 7 giorni: scrivigli in chat
                e trovate un orario insieme.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {Array.from(byDay.entries()).map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="text-xs font-semibold capitalize text-bob-ink/55">
                      {day}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {daySlots.map((s) => (
                        <button
                          key={s}
                          onClick={() => counterPropose(s)}
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
            {err && <p className="mt-3 text-xs text-red-600">{err}</p>}
            <button
              onClick={() => setPickerOpen(false)}
              className="btn-secondary mt-5 w-full py-2.5"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </>
  );
}
