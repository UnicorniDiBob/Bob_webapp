"use client";

// Percorso di chiusura dell'account.
//
// COME NASCE QUESTO DISEGNO (le fonti stanno nella migrazione 056)
// - Il MOTIVO e' facoltativo, ed e' scritto sullo schermo che lo e'. L'art.
//   12(2) GDPR obbliga ad agevolare l'esercizio dei diritti: chiedere una
//   giustificazione come condizione sarebbe un ostacolo, e un ostacolo alla
//   cancellazione e' una violazione. Serve a noi per capire, non a te per
//   ottenere.
// - La PASSWORD invece si chiede, e non e' un'incoerenza: non e' attrito sul
//   diritto, e' la prova che chi lo esercita e' la persona giusta. Senza,
//   chiunque trovi un telefono sbloccato cancella l'account di un altro.
// - SETTE GIORNI di ripensamento, dichiarati qui e nell'avviso in cima a ogni
//   pagina. Il profilo si spegne subito: l'attesa riguarda la cancellazione dei
//   dati, non la continuazione del servizio.

import { useState } from "react";
import { MOTIVI_CANCELLAZIONE } from "@/lib/cancellazione";


export function CancellazioneAccount({
  giorni,
  scadenzaIniziale,
}: {
  giorni: number;
  /** Se c'e' gia' una richiesta in corso, arriva da qui. */
  scadenzaIniziale: string | null;
}) {
  const [aperto, setAperto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [scadenza, setScadenza] = useState<string | null>(scadenzaIniziale);

  async function chiedi(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/account/cancellazione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          reasonCode: motivo || undefined,
          reasonNote: nota || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErrore(j.error ?? "Non sono riuscito a registrare la richiesta.");
        setBusy(false);
        return;
      }
      setScadenza(j.scheduledFor ?? null);
      setPassword("");
      // Il profilo e' stato spento lato server: ricarico per far comparire
      // l'avviso in cima e per aggiornare quello che il server renderizza.
      window.location.reload();
    } catch {
      setErrore("Non sono riuscito a registrare la richiesta. Riprova.");
      setBusy(false);
    }
  }

  if (scadenza) {
    const q = new Date(scadenza);
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-4"
        data-testid="cancellazione-in-corso"
      >
        <p className="text-sm font-semibold text-red-900">
          Cancellazione in corso
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-red-900/80">
          Il tuo account e i dati collegati verranno cancellati il{" "}
          {q.toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Il tuo profilo è già stato spento. Fino a quel giorno puoi tornare
          indietro con il bottone nell&apos;avviso in cima alla pagina.
        </p>
      </div>
    );
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="btn-secondary py-2.5 text-sm"
        data-testid="apri-cancellazione"
      >
        Chiudi il mio account
      </button>
    );
  }

  return (
    <form onSubmit={chiedi} className="rounded-xl border border-black/[0.09] p-4">
      <p className="text-sm font-semibold text-bob-ink">
        Chiudere l&apos;account
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/65">
        Il tuo profilo si spegne subito. La cancellazione dei dati avviene fra{" "}
        <strong>{giorni} giorni</strong>: se cambi idea prima, la annulli con un
        clic e torna tutto come era.
      </p>

      <div className="mt-4">
        <label className="label-bob" htmlFor="cnc-motivo">
          Perché te ne vai? <span className="font-normal text-bob-ink/45">— facoltativo</span>
        </label>
        <select
          id="cnc-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="input-bob"
          data-testid="cancellazione-motivo"
        >
          <option value="">Preferisco non dirlo</option>
          {MOTIVI_CANCELLAZIONE.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-bob-ink/50">
          Serve a noi per capire cosa non funziona, e non è una condizione:
          l&apos;account si chiude anche se lasci questo campo vuoto.
        </p>
      </div>

      {motivo && (
        <div className="mt-3">
          <label className="label-bob" htmlFor="cnc-nota">
            Vuoi aggiungere qualcosa?{" "}
            <span className="font-normal text-bob-ink/45">— facoltativo</span>
          </label>
          <textarea
            id="cnc-nota"
            rows={3}
            maxLength={1000}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="input-bob resize-none"
            data-testid="cancellazione-nota"
          />
          <p className="mt-1.5 text-xs text-bob-ink/50">
            Questa nota viene cancellata insieme all&apos;account: la leggiamo
            in questi giorni, non la conserviamo.
          </p>
        </div>
      )}

      <div className="mt-4">
        <label className="label-bob" htmlFor="cnc-pwd">
          La tua password
        </label>
        <input
          id="cnc-pwd"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-bob"
          autoComplete="current-password"
          data-testid="cancellazione-password"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-bob-ink/50">
          La chiediamo per essere sicuri che sia tu: è l&apos;unica cosa che
          impedisce a chi trovasse il tuo telefono sbloccato di chiudere il tuo
          account.
        </p>
      </div>

      {errore && (
        <p className="mt-3 text-sm text-red-600" data-testid="cancellazione-errore">
          {errore}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          data-testid="conferma-cancellazione"
        >
          {busy ? "Registro…" : `Chiudi l'account fra ${giorni} giorni`}
        </button>
        <button
          type="button"
          onClick={() => {
            setAperto(false);
            setErrore(null);
            setPassword("");
          }}
          className="btn-ghost text-sm"
        >
          Lascia stare
        </button>
      </div>
    </form>
  );
}
