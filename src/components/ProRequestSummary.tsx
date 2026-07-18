// [F3] Componente: riassunto nuove richieste per il professionista.
// Mostra le richieste attive con riassunto AI e bozza di risposta copiabile.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RequestSummaryItem {
  id: string;
  service: string | null;
  city: string | null;
  urgency: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string | null;
  summary: string;
  draftReply: string;
  briefSummary: string | null;
  briefPhotos: { url: string; caption: string | null }[];
}

function urgencyLabel(u: string | null): { label: string; color: string } {
  if (u === "alta") return { label: "Urgente", color: "bg-red-50 text-red-700" };
  if (u === "media") return { label: "Media", color: "bg-yellow-50 text-yellow-700" };
  return { label: "Pianificabile", color: "bg-green-50 text-green-700" };
}

export function ProRequestSummary() {
  const [items, setItems] = useState<RequestSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pro/request-summary")
      .then((r) => r.json())
      .then((d) => setItems(d.requests ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function copyDraft(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (loading) {
    return (
      <div className="card p-5">
        <p className="text-sm text-bob-ink/50">Carico nuove richieste…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-5">
        <p className="text-sm text-bob-ink/60">Nessuna nuova richiesta da revisionare.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-bob-ink">Nuove richieste</h3>
      {items.map((item) => {
        const urg = urgencyLabel(item.urgency);
        const budget =
          item.budgetMin || item.budgetMax
            ? `€${item.budgetMin ?? 0}–€${item.budgetMax ?? "?"}`
            : "Budget non indicato";
        return (
          <div key={item.id} className="card p-4 flex flex-col gap-3">
            {/* Header richiesta */}
            <div className="flex flex-wrap items-center gap-2">
              {item.service && (
                <span className="chip bg-bob-indigo-50 text-bob-indigo text-xs">
                  {item.service}
                </span>
              )}
              {item.city && (
                <span className="chip bg-gray-100 text-bob-ink text-xs">
                  {item.city}
                </span>
              )}
              <span className={`chip text-xs ${urg.color}`}>{urg.label}</span>
              <span className="chip bg-gray-100 text-bob-ink/60 text-xs">
                {budget}
              </span>
            </div>

            {/* Riassunto AI */}
            <p className="text-sm text-bob-ink leading-relaxed">{item.summary}</p>

            {/* Contesto raccolto da Bob (022): brief + foto del problema */}
            {(item.briefSummary || item.briefPhotos?.length > 0) && (
              <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3">
                <p className="mb-1.5 text-xs font-medium text-bob-ink/50">
                  Dalla chat con Bob
                </p>
                {item.briefSummary && (
                  <p className="text-sm text-bob-ink/75">{item.briefSummary}</p>
                )}
                {item.briefPhotos?.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {item.briefPhotos.map((ph, i) => (
                      <a
                        key={i}
                        href={ph.url}
                        target="_blank"
                        rel="noreferrer"
                        title={ph.caption ?? "Foto del problema"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ph.url}
                          alt={ph.caption ?? "Foto del problema"}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bozza risposta */}
            <div className="rounded-xl border border-black/5 bg-bob-indigo-50 p-3">
              <p className="mb-1.5 text-xs font-medium text-bob-ink/50">Bozza risposta</p>
              <p className="text-sm text-bob-ink">{item.draftReply}</p>
            </div>

            {/* Azioni */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copyDraft(item.id, item.draftReply)}
                className="btn-secondary py-1.5 text-xs"
              >
                {copied === item.id ? "Copiato ✓" : "Copia bozza"}
              </button>
              <Link
                href={`/messaggi?r=${item.id}`}
                className="btn-primary py-1.5 text-xs"
              >
                Vai ai messaggi →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
