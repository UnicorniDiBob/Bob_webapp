"use client";

// Azioni sulla coda di verifica P.IVA (blocco 10, §5.3).
//
// Tre decisioni, tutte umane e tutte tracciate. La motivazione è obbligatoria
// per "chiedi documenti" e "rifiuta" perché la legge il professionista: la
// vede nel suo profilo e la riceve per email (Reg. UE 2019/1150, art. 4).
// Il rifiuto chiede una conferma esplicita: azzera il livello, non è un
// bottone da premere per sbaglio mentre si scorre la lista.
//
// Sopra le decisioni c'è la barra di lavoro: il controllo vero, per chi non è
// nel VIES, si fa sul servizio dell'Agenzia delle Entrate, che è protetto da
// CAPTCHA e quindi non si può integrare. La sola cosa sensata è togliere di
// mezzo il lavoro manuale intorno: copiare il numero, aprire la pagina giusta,
// e avere una traccia già scritta da correggere invece di un campo vuoto.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "grant" | "request_docs" | "reject";

const MIN_NOTE_LENGTH = 15;

/** Servizio ufficiale dell'Agenzia: stato, denominazione, data inizio attività. */
const AGENZIA_ENTRATE_URL =
  "https://telematici.agenziaentrate.gov.it/VerificaPIVA/Scegli.do?parameter=verificaPiva";
/** Indice ministeriale delle PEC: serve per il riscontro sull'intestatario. */
const INIPEC_URL = "https://www.inipec.gov.it/cerca-pec";

function oggi(): string {
  return new Date().toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

export function VatReviewActions({
  proId,
  proName,
  hasLevel = false,
  vatNumber = null,
  holderName = null,
  scheda = null,
}: {
  proId: string;
  proName: string;
  /** Il professionista ha già un livello attivo: qui l'azione utile è la revoca. */
  hasLevel?: boolean;
  /** Partita IVA dichiarata: senza, la barra di lavoro non ha senso. */
  vatNumber?: string | null;
  /** Intestazione restituita dal controllo automatico, se c'è. */
  holderName?: string | null;
  /** Riepilogo del caso, pronto da incollare in una mail o in un appunto. */
  scheda?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [copiato, setCopiato] = useState<string | null>(null);

  // La Clipboard API vuole un contesto sicuro e il permesso: se manca, invece
  // di lasciare l'operatore senza risposta gli diciamo cosa copiare a mano.
  async function copia(testo: string, etichetta: string) {
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(etichetta);
      setError(null);
      setTimeout(() => setCopiato(null), 2500);
    } catch {
      setError(`Il browser non mi lascia copiare. Il valore è: ${testo}`);
    }
  }

  /** Il gesto che si ripete cento volte: numero negli appunti e sito aperto. */
  async function copiaEApri() {
    if (!vatNumber) return;
    await copia(vatNumber, "Partita IVA copiata: incollala nel campo del sito");
    window.open(AGENZIA_ENTRATE_URL, "_blank", "noopener,noreferrer");
  }

  // Tracce già scritte: l'operatore corregge, non compone da zero. I trattini
  // bassi sono voluti — obbligano a mettere il dato letto davvero.
  const modelli: { etichetta: string; testo: string }[] = [
    {
      etichetta: "Riscontro positivo",
      testo: `Controllo sul servizio dell'Agenzia delle Entrate del ${oggi()}: partita IVA ATTIVA, intestata a ${
        holderName ?? "___"
      }. Corrisponde al professionista.`,
    },
    {
      etichetta: "Intestazione diversa",
      testo: `Sui registri pubblici la partita IVA risulta intestata a ${
        holderName ?? "___"
      }, che non corrisponde al nome del tuo profilo. Mandaci la visura camerale o un documento che colleghi il profilo all'impresa e completiamo la verifica.`,
    },
    {
      etichetta: "Risulta cessata",
      testo: `Controllo sul servizio dell'Agenzia delle Entrate del ${oggi()}: la partita IVA risulta CESSATA. Se ne hai una attiva, inseriscila dal tuo profilo e la ricontrolliamo subito.`,
    },
  ];

  async function run(action: Action) {
    if (pending) return;
    if (action !== "grant" && note.trim().length < MIN_NOTE_LENGTH) {
      setError(
        `Scrivi la motivazione (almeno ${MIN_NOTE_LENGTH} caratteri): la legge ${proName}.`
      );
      return;
    }
    if (action === "reject") {
      const ok = window.confirm(
        hasLevel
          ? `Revocare il livello di ${proName}? Torna a "Iscritto", il badge sparisce dal profilo pubblico e la motivazione gli viene mostrata.`
          : `Respingere la richiesta di ${proName}? Il livello resta "Iscritto" e la motivazione gli viene mostrata.`
      );
      if (!ok) return;
    }

    setPending(action);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/admin/verifiche/${proId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        emailSent?: boolean;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Non sono riuscito a salvare la decisione.");
        return;
      }
      setDone(
        `${json.message ?? "Fatto."}${
          json.emailSent ? " Email inviata." : " (Email non inviata: Resend non è attivo.)"
        }`
      );
      setNote("");
      router.refresh();
    } catch {
      setError("Non sono riuscito a contattare il server. Riprova.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 border-t border-black/5 pt-3">
      {/* Barra di lavoro: il controllo si fa fuori, qui si toglie l'attrito. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {vatNumber && (
          <>
            <button
              type="button"
              onClick={copiaEApri}
              className="rounded-xl bg-bob-indigo px-3 py-2 text-xs font-semibold text-white transition hover:bg-bob-indigo/90"
              data-testid={`vat-open-ade-${proId}`}
            >
              Copia P.IVA e apri Agenzia Entrate ↗
            </button>
            <button
              type="button"
              onClick={() => copia(vatNumber, "Partita IVA copiata")}
              className="rounded-xl border border-black/10 px-3 py-2 text-xs font-medium text-bob-ink/70 transition hover:border-bob-indigo/30 hover:text-bob-indigo"
              data-testid={`vat-copy-${proId}`}
            >
              Copia solo la P.IVA
            </button>
          </>
        )}
        {scheda && (
          <button
            type="button"
            onClick={() => copia(scheda, "Scheda del caso copiata")}
            className="rounded-xl border border-black/10 px-3 py-2 text-xs font-medium text-bob-ink/70 transition hover:border-bob-indigo/30 hover:text-bob-indigo"
            data-testid={`vat-copy-card-${proId}`}
          >
            Copia la scheda
          </button>
        )}
        <a
          href={INIPEC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-black/10 px-3 py-2 text-xs font-medium text-bob-ink/70 transition hover:border-bob-indigo/30 hover:text-bob-indigo"
        >
          INI-PEC ↗
        </a>
      </div>
      {copiato && (
        <p className="mb-2 text-xs text-emerald-700" data-testid={`vat-copied-${proId}`}>
          ✓ {copiato}
        </p>
      )}

      <label className="label-bob" htmlFor={`note-${proId}`}>
        Motivazione (la legge il professionista)
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-bob-ink/45">Parti da:</span>
        {modelli.map((m) => (
          <button
            key={m.etichetta}
            type="button"
            onClick={() => setNote(m.testo)}
            className="rounded-lg border border-black/10 px-2 py-1 text-[11px] font-medium text-bob-ink/60 transition hover:border-bob-indigo/30 hover:text-bob-indigo"
            data-testid={`vat-template-${proId}`}
          >
            {m.etichetta}
          </button>
        ))}
      </div>
      <textarea
        id={`note-${proId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Es. la partita IVA risulta cessata dal 2024: se non è corretto, mandaci la visura camerale aggiornata."
        className="input-bob mt-1 resize-none text-sm"
        data-testid={`vat-review-note-${proId}`}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {!hasLevel && (
          <button
            type="button"
            onClick={() => run("grant")}
            disabled={pending !== null}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
            data-testid={`vat-grant-${proId}`}
          >
            {pending === "grant" ? "…" : "✓ Concedi Pro"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("request_docs")}
          disabled={pending !== null}
          className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
          data-testid={`vat-docs-${proId}`}
        >
          {pending === "request_docs" ? "…" : "Chiedi documenti"}
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={pending !== null}
          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
          data-testid={`vat-reject-${proId}`}
        >
          {pending === "reject" ? "…" : hasLevel ? "✕ Revoca livello" : "✕ Rifiuta"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600" data-testid={`vat-review-error-${proId}`}>
          {error}
        </p>
      )}
      {done && (
        <p className="mt-2 text-xs text-emerald-700" data-testid={`vat-review-done-${proId}`}>
          {done}
        </p>
      )}
    </div>
  );
}
