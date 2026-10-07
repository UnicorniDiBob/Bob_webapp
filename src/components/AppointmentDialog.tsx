"use client";

import { useEffect, useMemo, useState } from "react";
import { ProCalendar } from "@/components/ProCalendar";
import SceltaComune, { type ComuneScelto } from "@/components/SceltaComune";
import { createClient } from "@/lib/supabase/client";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  ERRORE_SOVRAPPOSIZIONE,
  TESTO_SOVRAPPOSIZIONE,
  type NewAppointment,
} from "@/lib/messages";
import {
  conChiSiSovrappone,
  fuoriDalleFasce,
  type AvailabilityWindow,
} from "@/lib/slots";
import {
  AvvisoSovrapposizione,
  useAvvisoSovrapposizione,
} from "@/components/AvvisoSovrapposizione";
import type { Appointment } from "@/lib/supabase/types";
import { notifyEvent } from "@/lib/notify";

// Converte una data ISO in valore per <input type="datetime-local">.
function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function AppointmentDialog({
  professionalId,
  appointments = [],
  existing,
  defaultDate,
  onClose,
  onSaved,
}: {
  professionalId: string;
  /**
   * Gli appuntamenti che il pro ha gia'. Servono a far vedere QUI dentro il
   * calendario vero mentre si sceglie l'ora: senza, fissare un appuntamento
   * significa ricordarsi a memoria la propria settimana.
   */
  appointments?: Appointment[];
  existing?: Appointment | null;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState(existing?.customer_name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [startsAt, setStartsAt] = useState(
    toLocalInput(existing?.starts_at ?? defaultDate?.toISOString())
  );
  // La durata in due campi, come nella proposta in chat: una sola forma per
  // la stessa cosa in tutta l'app, e nessun minimo inventato (era 15).
  const [durataOre, setDurataOre] = useState(
    Math.floor((existing?.duration_minutes ?? 60) / 60)
  );
  const [durataMin, setDurataMin] = useState(
    (existing?.duration_minutes ?? 60) % 60
  );
  const duration = durataOre * 60 + durataMin;
  const [price, setPrice] = useState<string>(
    existing?.price != null ? String(existing.price) : ""
  );
  const [status, setStatus] = useState<Appointment["status"]>(
    existing?.status ?? "confirmed"
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  // Luogo del lavoro (031). Non precompilato dagli indirizzi salvati del
  // cliente: il pro non ha accesso a customer_addresses e non gliene diamo uno
  // nuovo qui (disclosure progressiva, DATA_COMPLIANCE §4). Nelle prenotazioni
  // dirette l'indirizzo arriva dal cliente stesso al momento della prenotazione.
  const [locAddress, setLocAddress] = useState(existing?.location_address ?? "");
  const [locNotes, setLocNotes] = useState(existing?.location_notes ?? "");
  // IL COMUNE E IL SERVIZIO (04/10, Analisi, mig 108). La citta' era testo
  // libero e il servizio non c'era: su 34 appuntamenti, 28 senza comune e 27
  // senza servizio, quindi i numeri per zona e per servizio non vedevano
  // quasi niente di quello che il pro annota da se'. Il comune si sceglie da
  // elenco (lo stesso campo della base del pro), il servizio fra i suoi.
  const [comune, setComune] = useState<ComuneScelto | null>(null);
  // Il comune salvato arriva dal server dopo l'apertura: chi salva prima che
  // arrivi non deve cancellarlo. Conta solo quello che il pro tocca.
  const [comuneToccato, setComuneToccato] = useState(false);
  const [cap, setCap] = useState(existing?.postal_code ?? "");
  const [servizioId, setServizioId] = useState(
    existing?.professional_service_id ?? ""
  );
  const [servizi, setServizi] = useState<{ id: string; nome: string }[]>([]);
  // Una citta' scritta a mano prima della 108 resta finche' non si sceglie
  // un comune: buttarla via aprendo il dialogo sarebbe perdere un dato.
  const cittaVecchia =
    !existing?.comune_istat && existing?.location_city
      ? existing.location_city
      : null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SPOSTARE CONTROLLA QUALCOSA (113, 05/10). Prima il dialog salvava
  // qualunque orario: addosso a un altro appuntamento, o fuori dalle fasce
  // del pro. Adesso lo dice prima di salvare. Sono avvisi, e un secondo clic
  // («Salva lo stesso») li supera: un sabato concordato a voce e' legittimo,
  // e una voce privata sopra un'altra e' affare del pro. Dalla 116 anche la
  // sovrapposizione con un cliente e' permessa al pro: l'avviso dice con
  // chi, e il pro puo' spegnerlo per sempre («non mostrarmelo piu'»). Il
  // divieto resta nel database solo per il cliente che sceglie un orario.
  const [finestre, setFinestre] = useState<AvailabilityWindow[]>([]);
  const [avvisiVisti, setAvvisiVisti] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);
  // Un appuntamento confermato con un cliente si annulla dal pannello di
  // dettaglio (motivo, preavviso, messaggio in chat): non da questo menu.
  const conCliente = Boolean(existing?.request_id);
  const confermatoConCliente = conCliente && existing?.status === "confirmed";
  const attivoConCliente =
    conCliente &&
    (existing?.status === "confirmed" || existing?.status === "proposed");

  useEffect(() => {
    let vivo = true;
    createClient()
      .from("professional_availability")
      .select("weekday, start_time, end_time")
      .eq("professional_id", professionalId)
      .then(({ data }) => {
        if (!vivo) return;
        setFinestre(
          ((data ?? []) as { weekday: number; start_time: string; end_time: string }[]).map(
            (w) => ({
              weekday: w.weekday,
              start: w.start_time.slice(0, 5),
              end: w.end_time.slice(0, 5),
            })
          )
        );
      });
    return () => {
      vivo = false;
    };
  }, [professionalId]);

  const inizioScelto = useMemo(() => new Date(startsAt), [startsAt]);
  const fuoriOrario = useMemo(
    () => status !== "cancelled" && fuoriDalleFasce(inizioScelto, duration, finestre),
    [status, inizioScelto, duration, finestre]
  );
  const avvisoSovrapposizione = useAvvisoSovrapposizione(professionalId);
  const conflitti = useMemo(
    () =>
      status === "cancelled"
        ? []
        : conChiSiSovrappone(inizioScelto, duration, appointments, existing?.id),
    [status, inizioScelto, duration, appointments, existing?.id]
  );
  const sovrapposto = avvisoSovrapposizione.mostra && conflitti.length > 0;
  // Un avviso visto vale per l'orario per cui e' stato visto.
  useEffect(() => {
    setAvvisiVisti(false);
  }, [startsAt, duration]);

  useEffect(() => {
    let vivo = true;
    if (existing?.comune_istat) {
      fetch(`/api/geo/comuni?istat=${encodeURIComponent(existing.comune_istat)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (vivo && d?.comune) setComune(d.comune as ComuneScelto);
        })
        .catch(() => null);
    }
    createClient()
      .from("professional_services")
      .select("id, services(name), subservices(name, superseded_by)")
      .eq("professional_id", professionalId)
      .then(({ data }) => {
        if (!vivo) return;
        const uno = <T,>(x: T | T[] | null | undefined) =>
          (Array.isArray(x) ? x[0] : x) ?? null;
        const elenco = ((data ?? []) as Record<string, unknown>[])
          .map((r) => {
            const srv = uno(r.services as { name: string } | null);
            const sub = uno(
              r.subservices as { name: string; superseded_by: string | null } | null
            );
            if (sub?.superseded_by) return null;
            return {
              id: r.id as string,
              nome: sub?.name ?? srv?.name ?? "Servizio",
            };
          })
          .filter((x): x is { id: string; nome: string } => x !== null)
          .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
        setServizi(elenco);
      });
    return () => {
      vivo = false;
    };
  }, [existing?.comune_istat, professionalId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSave() {
    if (customerName.trim().length < 2) {
      setError("Inserisci il nome del cliente.");
      return;
    }
    if ((fuoriOrario || sovrapposto) && !avvisiVisti) {
      setAvvisiVisti(true);
      return;
    }
    setSaving(true);
    setError(null);

    const payload: NewAppointment = {
      customer_name: customerName.trim(),
      title: title.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      duration_minutes: Number(duration) || 60,
      price: price.trim() === "" ? null : Number(price),
      status,
      notes: notes.trim() || null,
      location_address: locAddress.trim().slice(0, 200) || null,
      location_city: comune
        ? comune.nome
        : comuneToccato
          ? null
          : (existing?.location_city ?? null),
      location_notes: locNotes.trim().slice(0, 300) || null,
      comune_istat: comune
        ? comune.istat
        : comuneToccato
          ? null
          : (existing?.comune_istat ?? null),
      postal_code: /^\d{5}$/.test(cap) ? cap : null,
      // Su una richiesta il servizio e' gia' quello della richiesta.
      ...(existing?.request_id ? {} : { professional_service_id: servizioId || null }),
    };

    const res = existing
      ? await updateAppointment(existing.id, payload)
      : await createAppointment(professionalId, payload);

    setSaving(false);
    if (res.error) {
      setError(
        "code" in res && res.code === ERRORE_SOVRAPPOSIZIONE
          ? TESTO_SOVRAPPOSIZIONE
          : "hint" in res && res.hint === "chiama"
            ? `${res.error}. Dal dettaglio usa «Chiama per spostare».`
            : res.error.includes("Annulla appuntamento")
            ? "Per annullarlo usa «Annulla appuntamento» nel dettaglio: avvisa il cliente e ti chiede il motivo."
            : "Salvataggio non riuscito. Riprova."
      );
      return;
    }
    // Spostato o annullato con un cliente dall'altra parte: il messaggio in
    // chat e il ritorno a «da confermare» li fa il database (107); questa e'
    // la copia per email, che parte solo quando la posta e' accesa.
    if (existing?.request_id) {
      const spostato =
        new Date(existing.starts_at).getTime() !==
          new Date(payload.starts_at).getTime() ||
        existing.duration_minutes !== payload.duration_minutes;
      const evento =
        payload.status === "cancelled" && existing.status === "confirmed"
          ? "appointment_cancelled"
          : spostato
            ? "appointment_moved"
            : null;
      if (evento) {
        notifyEvent(evento, {
          requestId: existing.request_id,
          professionalId,
          preview: new Date(payload.starts_at).toLocaleString("it-IT", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
    }
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!existing) return;
    if (!confermaElimina) {
      setConfermaElimina(true);
      return;
    }
    setSaving(true);
    const res = await deleteAppointment(existing.id);
    setSaving(false);
    if (res.error) {
      setError("Eliminazione non riuscita.");
      return;
    }
    // Per il cliente eliminare e' annullare: il messaggio lo scrive il
    // database (107), questa e' la copia per email.
    if (
      existing.request_id &&
      (existing.status === "confirmed" || existing.status === "proposed") &&
      new Date(existing.starts_at).getTime() > Date.now()
    ) {
      notifyEvent("appointment_cancelled", {
        requestId: existing.request_id,
        professionalId,
      });
    }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center bg-bob-ink/40 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      {/* Riquadro flottante, identico a ogni dimensione: angoli arrotondati su
          tutti e quattro i lati e margine attorno, mai attaccato ai bordi
          (niente variante "bottom sheet", che con lo zoom del browser attivo
          compariva anche su desktop e tagliava gli angoli in basso).
          Tre fasce: intestazione fissa, corpo che scorre, azioni fisse — così
          il modulo più alto della finestra si ritaglia netto fra i due bordi e
          nulla passa sotto i pulsanti. overflow-hidden tiene i bordi delle
          fasce dentro gli angoli arrotondati.
          Le altezze sono in dvh (non vh): su iOS Safari vh misura il viewport
          "grande" (toolbar nascoste), quindi con le toolbar visibili il fondo
          del riquadro — e i pulsanti — finivano tagliati sotto la barra. */}
      <div
        className="flex max-h-[88dvh] w-full max-w-2xl animate-fade-up flex-col overflow-hidden rounded-2xl bg-white shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
        data-testid="appointment-dialog"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.07] px-5 py-4">
          <h3 className="text-lg font-semibold text-bob-ink">
            {existing ? "Modifica appuntamento" : "Nuovo appuntamento"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-bob-ink/65 hover:bg-black/5"
            aria-label="Chiudi"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          <div>
            <label className="label-bob">Cliente</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-bob"
              placeholder="Nome del cliente"
              data-testid="input-customer"
            />
          </div>
          {!existing?.request_id && servizi.length > 0 && (
            <div>
              <label className="label-bob" htmlFor="servizio-appuntamento">
                Servizio
              </label>
              <select
                id="servizio-appuntamento"
                value={servizioId}
                onChange={(e) => setServizioId(e.target.value)}
                className="input-bob"
                data-testid="select-servizio"
              >
                <option value="">Non specificato</option>
                {servizi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label-bob">Tipo di lavoro</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-bob"
              placeholder="Es. Riparazione perdita"
              data-testid="input-title"
            />
          </div>
          {/* IL CALENDARIO VERO, QUI DENTRO (12/09, segnalato da Lucio).
              Prima si fissava un appuntamento scrivendo una data in un campo,
              senza vedere la propria settimana: la cosa piu' importante per
              decidere — «quel giorno a quell'ora sono libero?» — era l'unica
              che non c'era, e stava nella pagina sotto, coperta dalla finestra.
              Adesso si sceglie cliccando lo spazio vuoto: il campo qui sotto
              resta, e si aggiorna da solo. Chi preferisce scrivere, scrive. */}
          <div>
            <label className="label-bob">Scegli dal tuo calendario</label>
            <div className="rounded-xl border border-black/[0.07] p-2 sm:p-3">
              <ProCalendar
                appointments={appointments}
                loading={false}
                onCreateAt={(start) => setStartsAt(toLocalInput(start.toISOString()))}
                onSelect={() => {}}
                selectedId={existing?.id ?? null}
              />
            </div>
            <p className="mt-1.5 text-xs text-bob-ink/65" data-testid="slot-scelto">
              {startsAt
                ? `Scelto: ${new Date(startsAt).toLocaleString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Clicca uno spazio libero nel calendario, oppure scrivi data e ora qui sotto."}
            </p>
          </div>

          {/* 2/3 + 1/3: il controllo datetime-local di iOS ha una larghezza
              minima intrinseca larga ("30.07.2026, 10:00"), in due colonne
              uguali sbordava sopra la durata. min-w-0 su ogni cella è
              necessario: un elemento di griglia ha min-width:auto e senza
              questo non si restringe mai sotto il proprio contenuto. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="label-bob">Data e ora</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="input-bob px-3"
                data-testid="input-startsat"
              />
            </div>
            <div className="min-w-0">
              <span className="label-bob">Durata</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={24}
                  inputMode="numeric"
                  value={durataOre}
                  onChange={(e) =>
                    setDurataOre(
                      Math.max(0, Math.min(24, Number(e.target.value) || 0))
                    )
                  }
                  className="input-bob min-w-0 flex-1 px-2 text-center"
                  aria-label="Durata: ore"
                  data-testid="input-duration"
                />
                <span className="shrink-0 text-xs text-bob-ink/65">h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  inputMode="numeric"
                  value={durataMin}
                  onChange={(e) =>
                    setDurataMin(
                      Math.max(0, Math.min(59, Number(e.target.value) || 0))
                    )
                  }
                  className="input-bob min-w-0 flex-1 px-2 text-center"
                  aria-label="Durata: minuti"
                  data-testid="input-duration-min"
                />
                <span className="shrink-0 text-xs text-bob-ink/65">min</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="label-bob">Prezzo (€)</label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input-bob"
                placeholder="Opzionale"
                data-testid="input-price"
              />
            </div>
            <div className="min-w-0">
              <label className="label-bob">Stato</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Appointment["status"])
                }
                className="input-bob"
                data-testid="select-status"
              >
                {/* Una proposta aperta qui dentro deve leggersi per quello
                    che e': senza questa voce il menu mostrava «Confermato». */}
                {existing?.status === "proposed" && (
                  <option value="proposed">Da confermare</option>
                )}
                <option value="confirmed">Confermato</option>
                <option value="completed">Completato</option>
                {(!confermatoConCliente || existing?.status === "cancelled") && (
                  <option value="cancelled">Annullato</option>
                )}
              </select>
            </div>
          </div>
          {/* CON UN CLIENTE DALL'ALTRA PARTE (107). Spostare un orario
              accettato lo rimanda a lui: lo riceve in chat e lo riconferma.
              E «Confermato» lo puo' dire solo lui, a meno che non sia una
              sua proposta che accetti cosi' com'e'. */}
          {existing?.request_id && (
            <p
              className="rounded-xl bg-bob-indigo-50 px-3 py-2 text-xs text-bob-ink/75"
              data-testid="dialog-avviso-cliente"
            >
              {existing.customer_name || "Il cliente"} vede questo appuntamento.
              Se cambi giorno, ora o durata gli arriva in chat e torna da
              confermare. Dentro il preavviso l&apos;orario non si cambia da
              qui: nel dettaglio usa «Chiama per spostare», o «Sono in
              ritardo» se è oggi. Per annullarlo usa «Annulla appuntamento»
              nel dettaglio: lo avvisa in chat.
            </p>
          )}
          {/* Luogo: serve al pro per sapere dove andare e per il giro del giorno */}
          <div className="rounded-xl border border-black/[0.07] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bob-ink/65">
              Luogo
            </p>
            <div className="space-y-3">
              <div>
                <label className="label-bob">Indirizzo</label>
                <input
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  className="input-bob"
                  placeholder="Via e numero civico"
                  maxLength={200}
                  data-testid="input-location-address"
                />
              </div>
              <SceltaComune
                comune={comune}
                cap={cap}
                onComune={(c) => {
                  setComune(c);
                  setComuneToccato(true);
                }}
                onCap={setCap}
              />
              {cittaVecchia && !comune && (
                <p className="text-xs text-bob-ink/65" data-testid="citta-vecchia">
                  Avevi scritto «{cittaVecchia}». Scegli il comune per
                  ritrovarlo nei tuoi numeri.
                </p>
              )}
              <div>
                <label className="label-bob">Accesso</label>
                <input
                  value={locNotes}
                  onChange={(e) => setLocNotes(e.target.value)}
                  className="input-bob"
                  placeholder="Citofono, piano…"
                  maxLength={300}
                  data-testid="input-location-notes"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label-bob">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input-bob resize-none"
              placeholder="Opzionale"
              data-testid="input-notes"
            />
          </div>

        </div>

        {/* Azioni sempre visibili, fuori dall'area che scorre. L'errore vive
            qui e non in fondo al modulo: se il salvataggio fallisce mentre il
            corpo è scorso in alto, deve restare leggibile. */}
        <div className="shrink-0 border-t border-black/[0.07] px-5 py-4">
          {error && (
            <p className="mb-2.5 text-sm text-red-600" data-testid="text-appt-error">
              {error}
            </p>
          )}
          {sovrapposto && (
            <div className="mb-2.5">
              <AvvisoSovrapposizione
                conflitti={conflitti}
                onSpegni={avvisoSovrapposizione.spegni}
                testo={avvisiVisti ? "Se va bene così, salva di nuovo." : undefined}
              />
            </div>
          )}
          {!sovrapposto && fuoriOrario && (
            <p
              className="mb-2.5 text-sm text-amber-800"
              data-testid="text-appt-avviso"
            >
              È fuori dalle fasce orarie che hai dichiarato.
              {avvisiVisti && " Se va bene così, salva di nuovo."}
            </p>
          )}
          {confermaElimina && (
            <p className="mb-2.5 text-sm text-red-600" data-testid="text-conferma-elimina">
              Lo tolgo dal calendario per sempre. Clicca di nuovo «Elimina» per
              confermare.
            </p>
          )}
          <div className="flex items-center gap-2">
            {/* Un appuntamento attivo con un cliente non si elimina: si
                annulla, cosi' lui lo sa (anche il database lo rifiuta, 113). */}
            {existing && !attivoConCliente && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="btn-ghost text-red-600 hover:bg-red-50"
                data-testid="button-delete-appt"
              >
                {confermaElimina ? "Elimina davvero" : "Elimina"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary ml-auto px-5 py-2.5"
              data-testid="button-save-appt"
            >
              {saving
                ? "Salvo…"
                : avvisiVisti && (sovrapposto || fuoriOrario)
                  ? "Salva lo stesso"
                  : existing
                    ? "Salva modifiche"
                    : "Aggiungi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
