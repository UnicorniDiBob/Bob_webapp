"use client";

// Sezione "Assistenza": le richieste che hai aperto, e le nostre risposte.
//
// E' la meta' che rende onesto il form di /supporto. Un ticket che si puo'
// mandare ma non rileggere e' una cassetta della posta senza serratura: si
// scrive dentro e non si sa piu' niente. Qui la conversazione ha un posto, e
// funziona senza che nessuna email debba partire.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { SectionHeader } from "@/components/ImpostazioniShell";
import { SectionSkeleton, SectionError } from "@/components/SectionStates";

interface Ticket {
  id: string;
  ref: string;
  category: string;
  subject: string;
  message: string;
  status: "nuovo" | "in_lavorazione" | "risposto" | "chiuso";
  staff_reply: string | null;
  staff_reply_at: string | null;
  created_at: string;
}

const ETICHETTA_STATO: Record<Ticket["status"], { testo: string; classe: string }> = {
  nuovo: { testo: "Ricevuta", classe: "bg-bob-indigo-50 text-bob-indigo" },
  in_lavorazione: { testo: "Ci stiamo guardando", classe: "bg-amber-50 text-amber-800" },
  risposto: { testo: "Risposta pronta", classe: "bg-emerald-50 text-emerald-700" },
  chiuso: { testo: "Chiusa", classe: "bg-black/[0.05] text-bob-ink/55" },
};

const ETICHETTA_CATEGORIA: Record<string, string> = {
  problema_tecnico: "Qualcosa non funziona",
  account: "Il mio account",
  professionista: "Un professionista",
  pagamenti: "Piano e pagamenti",
  privacy: "Privacy e dati personali",
  altro: "Altro",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function AssistenzaPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/assistenza");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, ref, category, subject, message, status, staff_reply, staff_reply_at, created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      setFailed(true);
      setBooted(true);
      return;
    }
    setTickets((data ?? []) as Ticket[]);
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  if (authLoading || !booted) return <SectionSkeleton rows={2} />;
  if (failed) return <SectionError onRetry={load} />;

  return (
    <div>
      <SectionHeader title="Assistenza">
        Le richieste che hai aperto e le nostre risposte. Restano qui: non devi
        cercarle nella posta.
      </SectionHeader>

      {tickets.length === 0 ? (
        <div className="card p-6" data-testid="assistenza-vuota">
          <p className="text-sm font-semibold text-bob-ink">
            Non hai richieste aperte
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-bob-ink/60">
            Se qualcosa non funziona o non ti torna, scrivici: rispondiamo entro
            un giorno lavorativo.
          </p>
          <Link href="/supporto" className="btn-primary mt-4 py-2.5">
            Scrivi all&apos;assistenza
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => {
            const s = ETICHETTA_STATO[t.status];
            return (
              <article
                key={t.id}
                className="card p-5"
                data-testid={`ticket-${t.ref}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-bob-ink">{t.subject}</h3>
                    <p className="mt-0.5 text-xs text-bob-ink/50">
                      {ETICHETTA_CATEGORIA[t.category] ?? t.category} ·{" "}
                      {fmt(t.created_at)} ·{" "}
                      <span className="font-mono">{t.ref}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.classe}`}
                  >
                    {s.testo}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap border-l-2 border-black/[0.07] pl-3 text-sm leading-relaxed text-bob-ink/70">
                  {t.message}
                </p>

                {t.staff_reply ? (
                  <div className="mt-4 rounded-xl bg-bob-indigo-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-bob-indigo">
                      La nostra risposta
                      {t.staff_reply_at ? ` · ${fmt(t.staff_reply_at)}` : ""}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-bob-ink/80">
                      {t.staff_reply}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-bob-ink/50">
                    Non abbiamo ancora risposto. Quando lo facciamo, la risposta
                    compare qui.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
