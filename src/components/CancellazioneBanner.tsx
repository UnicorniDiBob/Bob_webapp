"use client";

// Avviso di cancellazione in corso, visibile su ogni pagina.
//
// PERCHE' SU OGNI PAGINA E NON SOLO NELLE IMPOSTAZIONI
// I sette giorni di ripensamento sono legittimi a una condizione: che siano una
// finestra DICHIARATA e controllata dalla persona, non un'attesa silenziosa
// nostra (art. 12(3) e 17(1) GDPR — la nota lunga sta nella migrazione 056). Un
// avviso nascosto in fondo a una sezione non e' dichiarato: e' sepolto. Quindi
// sta sotto l'intestazione, dove non si puo' non vederlo, e porta con se'
// l'annullamento — perche' una finestra di ripensamento senza il bottone per
// ripensarci non e' una finestra.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function CancellazioneBanner() {
  const supabase = createClient();
  const { user, loading } = useAuth();
  const [scadenza, setScadenza] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    if (!user) {
      setScadenza(null);
      return;
    }
    // Una riga per chiave primaria: e' la lettura piu' economica possibile, e
    // vale l'averla su ogni pagina.
    const { data } = await supabase
      .from("account_deletion_requests")
      .select("scheduled_for")
      .eq("user_id", user.id)
      .maybeSingle();
    setScadenza((data as { scheduled_for: string } | null)?.scheduled_for ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (loading) return;
    carica();
  }, [loading, carica]);

  async function annulla() {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/account/cancellazione", { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrore(j.error ?? "Non sono riuscito ad annullare. Riprova.");
        setBusy(false);
        return;
      }
      setScadenza(null);
      // Il profilo e' stato riaccceso lato server: la pagina va riletta perche'
      // le liste pubbliche sono renderizzate sul server.
      window.location.reload();
    } catch {
      setErrore("Non sono riuscito ad annullare. Riprova.");
      setBusy(false);
    }
  }

  if (loading || !user || !scadenza) return null;

  const quando = new Date(scadenza);
  const giorni = Math.max(
    0,
    Math.ceil((quando.getTime() - Date.now()) / 86_400_000)
  );

  return (
    <div
      className="border-b border-red-200 bg-red-50"
      role="status"
      data-testid="banner-cancellazione"
    >
      <div className="container-bob flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-sm leading-relaxed text-red-900">
          <strong>Il tuo account verrà cancellato</strong>{" "}
          {giorni === 0 ? "entro oggi" : giorni === 1 ? "domani" : `fra ${giorni} giorni`} (
          {quando.toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          ). Da adesso il tuo profilo non è più visibile. Puoi tornare indietro
          fino a quel momento.
        </p>
        <div className="flex items-center gap-3">
          {errore && <span className="text-sm text-red-700">{errore}</span>}
          <button
            onClick={annulla}
            disabled={busy}
            className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
            data-testid="annulla-cancellazione"
          >
            {busy ? "Annullo…" : "Annulla la cancellazione"}
          </button>
        </div>
      </div>
    </div>
  );
}
