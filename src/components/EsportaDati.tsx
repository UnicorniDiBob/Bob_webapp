"use client";

// Il bottone che rende esercitabile l'art. 15/20 senza scrivere a nessuno.
//
// PERCHE' STA IN "I TUOI DATI" E NON IN "ACCESSO E SICUREZZA"
// La cancellazione sta fra le impostazioni di accesso perche' e' un'azione
// sull'ACCOUNT. Questa e' un'azione sui DATI, e la pagina si chiama gia' con
// le parole che una persona userebbe cercandola. Chi vuole andarsene passa di
// qui prima: portarsi via la propria roba e poi chiudere la porta e' l'ordine
// naturale, e tenerli su due schermate diverse evita che il download sembri un
// passaggio della cancellazione.
//
// PERCHE' fetch E NON UN LINK
// Un <a href> scarica benissimo, ma un errore diventa una pagina bianca con
// scritto un JSON. Qui i due errori possibili sono entrambi cose da dire con
// parole umane: il limite di 24 ore e il guasto temporaneo.

import { useState } from "react";
import { INTERVALLO_EXPORT_ORE } from "@/lib/export-dati";

export function EsportaDati() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  async function scarica() {
    setBusy(true);
    setErr(null);
    setFatto(false);
    try {
      const res = await fetch("/api/account/esporta");
      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        let messaggio = corpo?.error ?? "Non sono riuscito a preparare l’archivio.";
        if (res.status === 429 && corpo?.disponibileDal) {
          const quando = new Date(corpo.disponibileDal);
          messaggio = `${messaggio} Potrai rifarlo dalle ${quando.toLocaleString("it-IT")}.`;
        }
        setErr(messaggio);
        return;
      }

      const blob = await res.blob();
      const nome =
        res.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "bob-i-tuoi-dati.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setFatto(true);
    } catch {
      setErr("Qualcosa è andato storto durante il download. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5 sm:p-6">
      <div>
        <h3 className="text-base font-semibold text-bob-ink">
          Scarica i tuoi dati
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
          Un archivio con tutto quello che Bob tiene collegato al tuo account:
          profilo, richieste, conversazioni con i professionisti, appuntamenti,
          recensioni che hai scritto, le tue scelte sulle comunicazioni e le
          foto che avevi caricato parlando con Bob. È tuo, non devi spiegare
          perché lo vuoi, e puoi portartelo altrove.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-bob-ink/50">
          Formato JSON, come previsto dal diritto alla portabilità (art. 20
          GDPR). Puoi scaricarlo una volta ogni {INTERVALLO_EXPORT_ORE} ore.
        </p>
      </div>

      {err && (
        <p className="text-sm text-red-600" data-testid="esporta-error">
          {err}
        </p>
      )}
      {fatto && !err && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ Archivio scaricato. Cerca il file nella cartella dei download.
        </p>
      )}

      <button
        type="button"
        onClick={scarica}
        disabled={busy}
        className="btn-secondary w-full py-3 disabled:opacity-50 sm:w-auto"
        data-testid="esporta-dati"
      >
        {busy ? "Preparo l’archivio…" : "Scarica i miei dati"}
      </button>
    </div>
  );
}
