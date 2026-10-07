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
//
// DAL 01/10 E' UN BIGLIETTO (BigliettoAppuntamento): data, ora, durata, cosa,
// dove e prezzo, con i tasti in fondo. Le proposte rifiutate, annullate o
// scadute restano una riga sola: in una trattativa con tre controproposte,
// tre biglietti morti coprirebbero quello vivo.

import { useState } from "react";
import { Check, Clock, PencilLine, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ERRORE_SOVRAPPOSIZIONE,
  sendMessage,
  updateAppointment,
} from "@/lib/messages";
import { notifyEvent } from "@/lib/notify";
import type { Appointment } from "@/lib/supabase/types";
import { AggiungiAlCalendario } from "@/components/AggiungiAlCalendario";
import {
  BigliettoAppuntamento,
  prezzoLeggibile,
} from "@/components/BigliettoAppuntamento";
import { AnnullaAppuntamento } from "@/components/AnnullaAppuntamento";
import { SpostaAppuntamento } from "@/components/SpostaAppuntamento";
import { SceltaOrario } from "@/components/SceltaOrario";
import { statoDisdetta } from "@/lib/disdettaPrenotazione";
import { SegnalaRitardo } from "@/components/SegnalaRitardo";
import { ritardoPossibile } from "@/lib/ritardo";

// Solo i campi che ci servono: la chat fa una select ristretta.
// spostato_da NON e' una colonna: e' l'orario di prima di uno spostamento
// chiesto dal cliente e ancora da confermare, letto dallo storico
// (appointment_events, 115) da chi carica la chat.
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
  | "price"
  | "notes"
  | "location_address"
  | "location_city"
  | "location_notes"
  | "cancellation_window_hours"
> & { spostato_da?: string | null };

/** Dove: l'indirizzo se c'e' (dopo la conferma), se no la zona della richiesta. */
function luogoDi(a: ThreadAppointment, zona: string | null): string | null {
  if (a.location_address)
    return [a.location_address, a.location_city].filter(Boolean).join(", ");
  return a.location_city ?? zona;
}

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
  zona = null,
  onChanged,
  onProModify,
}: {
  appointment: ThreadAppointment;
  viewer: "customer" | "professional";
  userId: string;
  // Id del pro del thread: serve a sendMessage per instradare la conversazione.
  professionalId: string | null;
  counterpartName: string;
  /** La zona della richiesta, finche' l'indirizzo non e' condiviso. */
  zona?: string | null;
  onChanged: () => void | Promise<void>;
  // Il pro non contropropone via API: riusa il dialog "Proponi appuntamento",
  // che sa già calcolare i suoi slot liberi ed evitare le sovrapposizioni.
  onProModify?: (appointmentId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const a = appointment;
  const when = fmtWhen(a.starts_at);
  const isPast = new Date(a.starts_at).getTime() < Date.now();
  // Chi deve rispondere è la controparte di chi ha proposto.
  const mineToAnswer = a.proposed_by !== viewer;
  // UNO SPOSTAMENTO NON E' UNA PROPOSTA QUALUNQUE (115): c'era gia' un
  // accordo, e se il pro dice no torna quello. Il biglietto lo dice a tutti
  // e due, con l'orario di prima.
  const spostamento =
    a.status === "proposed" && a.proposed_by === "customer" && a.spostato_da
      ? fmtWhen(a.spostato_da)
      : null;
  const intestazione = spostamento
    ? a.proposed_by === viewer
      ? `Hai chiesto di spostarlo · era ${spostamento}`
      : `${counterpartName} chiede di spostarlo · era ${spostamento}`
    : a.proposed_by === viewer
      ? "La tua proposta"
      : `Proposta di ${counterpartName}`;
  const biglietto = {
    inizio: new Date(a.starts_at),
    durataMinuti: a.duration_minutes,
    titolo: a.title,
    luogo: luogoDi(a, zona),
    prezzo: a.price,
    note: a.notes,
  };
  // La data e' cliccabile: apre «lo metto nel tuo calendario?» (05/09).
  const avvolgiData = (data: React.ReactNode) => (
    <AggiungiAlCalendario appuntamento={a}>{data}</AggiungiAlCalendario>
  );

  // --- Confermato o concluso: il biglietto resta. ---------------------------
  // IL CLIENTE DISDICE E SPOSTA ANCHE DA QUI (rilievo del 5/10; 115). La
  // stessa regola e gli stessi componenti dell'area personale: fuori dal
  // preavviso «Cambia orario» e «Disdici», dentro «Chiama per spostare» e
  // «Chiama per annullare». Quando la regola dice «no» (concluso, gia'
  // iniziato) il biglietto resta senza la fascia dei tasti.
  // IL PRO AGISCE DA QUI (07/10). Prima le azioni erano solo del cliente, e il
  // pro doveva uscire dalla chat e cercare l'appuntamento nel calendario. Ora
  // ha le stesse del dettaglio nel calendario (AppointmentDetail), con gli
  // stessi componenti e quindi le stesse regole: il ritardo (oggi), lo
  // spostamento e l'annullamento con il preavviso.
  if (a.status === "confirmed" || a.status === "completed") {
    const regola = statoDisdetta(a).tipo !== "no";
    const disdicibile = viewer === "customer" && regola;
    const perIlPro =
      viewer === "professional" && (regola || ritardoPossibile(a));
    return (
      <div className="mt-1.5" data-testid={`appt-status-${a.id}`}>
        <BigliettoAppuntamento
          {...biglietto}
          intestazione={
            a.status === "completed" ? "Lavoro concluso" : "Appuntamento"
          }
          stato={{ etichetta: STATUS_LABEL[a.status] ?? "", tono: "ok" }}
          avvolgiData={avvolgiData}
          testId={`biglietto-${a.id}`}
          azioni={
            disdicibile ? (
              <div className="flex flex-col gap-1">
                <SpostaAppuntamento
                  appt={a}
                  nomeAltro={counterpartName}
                  onSpostato={onChanged}
                />
                <AnnullaAppuntamento
                  appt={a}
                  ruolo="customer"
                  nomeAltro={counterpartName}
                  onAnnullato={onChanged}
                />
              </div>
            ) : perIlPro ? (
              <div className="flex flex-col gap-1">
                <SegnalaRitardo
                  appt={a}
                  nomeCliente={counterpartName}
                  onFatto={onChanged}
                />
                <SpostaAppuntamento
                  appt={a}
                  ruolo="professional"
                  nomeAltro={counterpartName}
                  onSpostato={onChanged}
                />
                <AnnullaAppuntamento
                  appt={a}
                  ruolo="professional"
                  nomeAltro={counterpartName}
                  onAnnullato={onChanged}
                />
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  // --- Stati chiusi: nessuna azione, solo l'esito. --------------------------
  if (a.status !== "proposed") {
    const label = STATUS_LABEL[a.status] ?? "Proposta chiusa";
    return (
      <div
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-bob-ink/70"
        data-testid={`appt-status-${a.id}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="line-through decoration-black/30">
          {label} · {when}
          {a.price != null ? ` · ${prezzoLeggibile(a.price)}` : ""}
        </span>
      </div>
    );
  }

  // Proposta scaduta: non facciamo confermare un orario già passato.
  if (isPast) {
    return (
      <div
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-bob-ink/70"
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
      <div className="mt-1.5" data-testid={`appt-waiting-${a.id}`}>
        <BigliettoAppuntamento
          {...biglietto}
          intestazione={intestazione}
          stato={{ etichetta: "In attesa di risposta", tono: "attesa" }}
          avvolgiData={avvolgiData}
          testId={`biglietto-${a.id}`}
        />
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
    const { error, code } =
      viewer === "customer"
        ? await (async () => {
            const supabase = createClient();
            const { error } = await supabase
              .from("appointments")
              .update({ status: next })
              .eq("id", a.id);
            return { error: error ? error.message : null, code: error?.code ?? null };
          })()
        : await updateAppointment(a.id, { status: next });

    if (error) {
      // Il pro rifiuta uno spostamento ma l'orario di prima nel frattempo e'
      // stato preso (115: il database non lo ridà sopra un altro cliente).
      setErr(
        spostamento && code === ERRORE_SOVRAPPOSIZIONE
          ? `L'orario di prima (${spostamento}) nel frattempo è stato preso: approva il nuovo o scrivi al cliente.`
          : "Non sono riuscito a salvare. Riprova."
      );
      setBusy(false);
      return;
    }

    // Il pro ha detto no a uno spostamento: il database ha gia' rimesso
    // l'orario di prima e l'ha scritto in chat (115). Un secondo messaggio
    // «troviamo un altro orario» direbbe il contrario. Se l'orario di prima
    // e' gia' passato il database non lo rimette, e il messaggio resta.
    if (
      spostamento &&
      viewer === "professional" &&
      !ok &&
      new Date(a.spostato_da as string).getTime() > Date.now()
    ) {
      await onChanged();
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
    setErr(null);
    setPickerOpen(true);
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

  // Sullo spostamento del cliente il pro approva o rifiuta, senza
  // «Modifica»: la sua controproposta rifiuterebbe lo spostamento (torna
  // l'orario di prima) e ne creerebbe un secondo, cioe' due appuntamenti per
  // un lavoro. Per un altro orario rifiuta e poi lo sposta dal calendario.
  const modificabile = !(spostamento && viewer === "professional");

  return (
    <>
      <div className="mt-1.5" data-testid={`appt-actions-${a.id}`}>
        <BigliettoAppuntamento
          {...biglietto}
          intestazione={intestazione}
          stato={{ etichetta: "Da confermare", tono: "azione" }}
          avvolgiData={avvolgiData}
          testId={`biglietto-${a.id}`}
          azioni={
            <>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => respond(true)}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
                  data-testid={`appt-approve-${a.id}`}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Approva
                </button>
                {modificabile && (
                  <button
                    onClick={openPicker}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-bob-ink hover:bg-black/[0.03] disabled:opacity-50"
                    data-testid={`appt-modify-${a.id}`}
                  >
                    <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                    Modifica
                  </button>
                )}
                <button
                  onClick={() => respond(false)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-bob-ink/70 hover:bg-black/[0.03] disabled:opacity-50"
                  data-testid={`appt-reject-${a.id}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Rifiuta
                </button>
              </div>
              {spostamento && viewer === "professional" && (
                <p
                  className="mt-2 text-xs text-bob-ink/70"
                  data-testid={`appt-spostamento-nota-${a.id}`}
                >
                  Se rifiuti, resta confermato l&apos;orario di prima.
                </p>
              )}
              {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
            </>
          }
        />
      </div>

      {pickerOpen && (
        <SceltaOrario
          professionalId={a.professional_id}
          durataMinuti={a.duration_minutes}
          nomePro={counterpartName}
          titolo="Proponi un altro orario"
          testo={
            <>
              Questi sono gli orari liberi di {counterpartName} nei prossimi
              giorni: scegline uno e glielo propongo io.
            </>
          }
          busy={busy}
          errore={err}
          onScegli={counterPropose}
          onChiudi={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
