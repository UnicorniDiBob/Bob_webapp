"use client";

// Bottoni interattivi per cambiare lo stato di verifica di un professionista.
// Separati in un componente client perché usano useState e fetch.

import { useState } from "react";
import { useRouter } from "next/navigation";

type VerificationStatus = "verified" | "pending" | "unverified";

const ACTIONS: {
  status: VerificationStatus;
  label: string;
  style: string;
}[] = [
  {
    status: "verified",
    label: "✓ Approva",
    style: "bg-emerald-500 text-white hover:bg-emerald-600",
  },
  {
    status: "pending",
    label: "⏳ In revisione",
    style: "bg-amber-500 text-white hover:bg-amber-600",
  },
  {
    status: "unverified",
    label: "✕ Rifiuta",
    style: "border border-red-200 text-red-600 hover:bg-red-50",
  },
];

export function VerifyButtons({
  proId,
  currentStatus,
}: {
  proId: string;
  currentStatus: VerificationStatus;
}) {
  const [loading, setLoading] = useState<VerificationStatus | null>(null);
  const [current, setCurrent] = useState(currentStatus);
  const router = useRouter();

  async function updateStatus(status: VerificationStatus) {
    if (status === current || loading) return;
    setLoading(status);
    try {
      const res = await fetch(`/api/admin/professionals/${proId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setCurrent(status);
        router.refresh(); // Aggiorna i dati della pagina
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.status}
          onClick={() => updateStatus(a.status)}
          disabled={a.status === current || loading !== null}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
            a.status === current
              ? "cursor-default opacity-40"
              : a.style
          }`}
          data-testid={`verify-btn-${a.status}-${proId}`}
        >
          {loading === a.status ? "…" : a.label}
        </button>
      ))}
    </div>
  );
}
