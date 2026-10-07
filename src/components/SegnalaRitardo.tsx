"use client";

// «SONO IN RITARDO DI N MINUTI» (116, Lucio 07/10).
//
// Non e' uno spostamento: l'appuntamento resta confermato, il cliente non
// deve approvare niente e il preavviso non conta. Il pro sceglie i minuti
// (scelta rapida o campo libero), il motivo se vuole, e prima di confermare
// vede cosa succede: a che ora arriva, e quali appuntamenti della giornata
// il ritardo raggiunge. Per quelli decide lui se avvisarli: a ognuno arriva
// in chat «il tuo appuntamento potrebbe slittare di circa N minuti», ma il
// loro orario resta quello.
//
// Il cliente di questo appuntamento lo legge in chat e in campanella (la
// campanella lo deriva dallo storico, appointment_events, tipo 'ritardo').
//
// Lo stesso componente sta nel dettaglio del calendario e sul biglietto in
// chat. Decide il database (segnala_ritardo): qui c'e' solo l'interfaccia.

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  segnalaRitardo,
  type AppuntamentoToccato,
} from "@/lib/messages";
import {
  MAX_RITARDO,
  MINUTI_RITARDO,
  minutiValidi,
  oraRoma,
  ritardoPossibile,
  type AppuntamentoInRitardo,
} from "@/lib/ritardo";

export function SegnalaRitardo({
  appt,
  nomeCliente,
  onFatto,
}: {
  appt: AppuntamentoInRitardo & { id: string };
  /** «Marco Rossi», «il cliente». */
  nomeCliente: string;
  onFatto: () => void | Promise<void>;
}) {
  const [aperto, setAperto] = useState(false);
  const [minuti, setMinuti] = useState<number | null>(null);
  const [libero, setLibero] = useState("");
  const [motivo, setMotivo] = useState("");
  const [avvisa, setAvvisa] = useState(false);
  const [anteprima, setAnteprima] = useState<{
    inizioDopo: string;
    toccati: AppuntamentoToccato[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // L'anteprima si chiede al database a ogni scelta: chi viene toccato
  // dipende dagli altri appuntamenti della giornata, che qui non ci sono.
  useEffect(() => {
    if (!aperto || minuti === null || !minutiValidi(minuti)) {
      setAnteprima(null);
      return;
    }
    let vivo = true;
    const t = setTimeout(() => {
      segnalaRitardo(appt.id, minuti, { soloAnteprima: true }).then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setAnteprima({ inizioDopo: r.inizioDopo, toccati: r.toccati });
          setErrore(null);
        } else {
          setAnteprima(null);
          setErrore(r.messaggio);
        }
      });
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aperto, minuti, appt.id]);

  if (!ritardoPossibile(appt)) return null;

  const avvisabili = anteprima?.toccati.filter((x) => x.avvisabile) ?? [];

  async function conferma() {
    if (minuti === null || !minutiValidi(minuti) || busy) return;
    setBusy(true);
    setErrore(null);
    const r = await segnalaRitardo(appt.id, minuti, {
      motivo,
      avvisaToccati: avvisa && avvisabili.length > 0,
    });
    setBusy(false);
    if (!r.ok) {
      setErrore(r.messaggio);
      return;
    }
    setAperto(false);
    setMinuti(null);
    setLibero("");
    setMotivo("");
    setAvvisa(false);
    await onFatto();
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="btn-ghost inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 text-sm text-amber-800 hover:bg-amber-50"
        data-testid={`ritardo-apri-${appt.id}`}
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
        Sono in ritardo
      </button>
    );
  }

  return (
    <div
      className="w-full rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-left text-sm"
      data-testid={`ritardo-pannello-${appt.id}`}
    >
      <p className="font-semibold text-bob-ink">Di quanto sei in ritardo?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MINUTI_RITARDO.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMinuti(m);
              setLibero("");
            }}
            className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 text-sm font-semibold tabular-nums ${
              minuti === m && libero === ""
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-black/10 bg-white text-bob-ink hover:bg-black/[0.03]"
            }`}
            aria-pressed={minuti === m && libero === ""}
            data-testid={`ritardo-minuti-${m}`}
          >
            {m}′
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-bob-ink/70">
          <input
            type="number"
            min={1}
            max={MAX_RITARDO}
            inputMode="numeric"
            value={libero}
            onChange={(e) => {
              setLibero(e.target.value);
              const n = Number(e.target.value);
              setMinuti(e.target.value.trim() === "" ? null : n);
            }}
            className="input-bob min-h-[44px] w-20 px-2 text-center"
            placeholder="altro"
            aria-label="Minuti di ritardo"
            data-testid="ritardo-minuti-libero"
          />
          min
        </label>
      </div>
      {libero !== "" && minuti !== null && !minutiValidi(minuti) && (
        <p className="mt-1 text-xs text-red-600">
          Da 1 a {MAX_RITARDO} minuti: oltre, spostalo.
        </p>
      )}

      {anteprima && (
        <p className="mt-2 text-bob-ink/80" data-testid="ritardo-arrivo">
          Arrivi alle <strong>{oraRoma(anteprima.inizioDopo)}</strong> invece che
          alle {oraRoma(appt.starts_at)}. {nomeCliente} lo legge subito in chat,
          e l&apos;appuntamento resta confermato.
        </p>
      )}

      {anteprima && anteprima.toccati.length > 0 && (
        <div
          className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-testid="ritardo-toccati"
        >
          <p className="font-semibold">
            Il ritardo arriva anche a{" "}
            {anteprima.toccati.length === 1 ? "questo appuntamento" : "questi appuntamenti"}:
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {anteprima.toccati.map((x) => (
              <li key={x.id} className="break-words">
                {x.customer_name || "Appuntamento"} · {oraRoma(x.starts_at)} ·
                circa {x.slitta_minuti} min
                {!x.avvisabile && " (agenda privata)"}
              </li>
            ))}
          </ul>
          {avvisabili.length > 0 && (
            <label className="mt-1.5 flex min-h-[44px] items-start gap-2 pt-2">
              <input
                type="checkbox"
                checked={avvisa}
                onChange={(e) => setAvvisa(e.target.checked)}
                className="mt-0.5"
                data-testid="ritardo-avvisa-toccati"
              />
              <span>
                Sì, avvisali in chat: «il tuo appuntamento potrebbe slittare di
                circa N minuti». Il loro orario non cambia.
              </span>
            </label>
          )}
        </div>
      )}

      <div className="mt-3">
        <label className="label-bob" htmlFor={`ritardo-motivo-${appt.id}`}>
          Motivo (facoltativo, lo legge in chat)
        </label>
        <textarea
          id={`ritardo-motivo-${appt.id}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
          rows={2}
          className="input-bob resize-none"
          placeholder="Es. traffico, il lavoro prima è durato di più"
          data-testid="ritardo-motivo"
        />
      </div>

      {errore && (
        <p className="mt-2 text-xs text-red-600" data-testid="ritardo-errore">
          {errore}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={conferma}
          disabled={busy || minuti === null || !minutiValidi(minuti) || !anteprima}
          className="btn-primary min-h-[44px] bg-amber-600 px-4 py-2 text-sm hover:bg-amber-700 disabled:opacity-50"
          data-testid="ritardo-conferma"
        >
          {busy ? "Avviso…" : `Avvisa ${nomeCliente}`}
        </button>
        <button
          onClick={() => {
            setAperto(false);
            setErrore(null);
          }}
          className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-bob-ink/65 hover:underline"
        >
          Lascia stare
        </button>
      </div>
    </div>
  );
}
