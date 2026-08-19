"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface TicketAdmin {
  id: string;
  ref: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "nuovo" | "in_lavorazione" | "risposto" | "chiuso";
  staff_reply: string | null;
  staff_reply_at: string | null;
  created_at: string;
}

const CATEGORIA: Record<string, string> = {
  problema_tecnico: "Tecnico",
  account: "Account",
  professionista: "Professionista",
  pagamenti: "Pagamenti",
  privacy: "Privacy",
  altro: "Altro",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// Quanto e' vecchia la richiesta: e' il numero che dice se lo SLA di un giorno
// lavorativo sta tenendo, e va visto senza doverlo calcolare a mente.
function eta(iso: string): { testo: string; urgente: boolean } {
  const ore = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (ore < 1) return { testo: "adesso", urgente: false };
  if (ore < 24) return { testo: `${ore} h`, urgente: ore >= 16 };
  const giorni = Math.floor(ore / 24);
  return { testo: `${giorni} giorn${giorni === 1 ? "o" : "i"}`, urgente: true };
}

export function CodaAssistenza({
  aperti,
  chiusi,
}: {
  aperti: TicketAdmin[];
  chiusi: TicketAdmin[];
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        {aperti.map((t) => (
          <Riga key={t.id} t={t} apribile />
        ))}
      </section>

      {chiusi.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bob-ink/45">
            Già lavorate ({chiusi.length})
          </h2>
          <div className="space-y-3">
            {chiusi.map((t) => (
              <Riga key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Riga({ t, apribile }: { t: TicketAdmin; apribile?: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [aperto, setAperto] = useState(Boolean(apribile));
  const [risposta, setRisposta] = useState(t.staff_reply ?? "");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const age = eta(t.created_at);

  async function salva(nuovoStato: TicketAdmin["status"]) {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const patch: Record<string, unknown> = {
      status: nuovoStato,
      updated_at: new Date().toISOString(),
    };
    // La risposta si scrive solo se c'e': cambiare stato non deve azzerare
    // quella scritta prima.
    if (risposta.trim()) {
      patch.staff_reply = risposta.trim();
      patch.staff_reply_at = new Date().toISOString();
      patch.staff_reply_by = user?.id ?? null;
    }
    const { error } = await supabase
      .from("support_tickets")
      .update(patch)
      .eq("id", t.id);
    if (error) setErrore("Non sono riuscito a salvare. Riprova.");
    else router.refresh();
    setBusy(false);
  }

  return (
    <article className="rounded-2xl border border-black/[0.07] bg-white p-4">
      <button
        onClick={() => setAperto((a) => !a)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-bob-ink">{t.subject}</p>
          <p className="mt-0.5 text-xs text-bob-ink/50">
            <span className="font-mono">{t.ref}</span> ·{" "}
            {CATEGORIA[t.category] ?? t.category} · {t.email}
            {!t.user_id && " · senza account"} · {fmt(t.created_at)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
            age.urgente ? "bg-red-50 text-red-700" : "bg-black/[0.05] text-bob-ink/60"
          }`}
        >
          {age.testo}
        </span>
      </button>

      {aperto && (
        <div className="mt-3 border-t border-black/5 pt-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-bob-ink/75">
            {t.message}
          </p>

          <label className="label-bob mt-4" htmlFor={`r-${t.id}`}>
            Risposta {t.staff_reply_at ? "(già inviata, puoi correggerla)" : ""}
          </label>
          <textarea
            id={`r-${t.id}`}
            rows={4}
            value={risposta}
            onChange={(e) => setRisposta(e.target.value)}
            className="input-bob resize-none"
            placeholder="La legge la persona dentro Bob, in Impostazioni → Assistenza."
          />

          {errore && <p className="mt-2 text-sm text-red-600">{errore}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => salva("risposto")}
              disabled={busy || !risposta.trim()}
              className="btn-primary py-2 text-sm"
            >
              {busy ? "Salvo…" : "Rispondi"}
            </button>
            {t.status === "nuovo" && (
              <button
                onClick={() => salva("in_lavorazione")}
                disabled={busy}
                className="btn-secondary py-2 text-sm"
              >
                La sto guardando
              </button>
            )}
            <button
              onClick={() => salva("chiuso")}
              disabled={busy}
              className="btn-ghost text-sm"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
