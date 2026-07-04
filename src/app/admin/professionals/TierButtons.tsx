"use client";

// Selettore del piano di abbonamento (Free / Pro / Business) per un professionista.
// Stesso pattern di VerifyButtons: componente client con fetch verso l'API admin.

import { useState } from "react";
import { useRouter } from "next/navigation";

type SubscriptionTier = "free" | "pro" | "business";

const TIERS: { tier: SubscriptionTier; label: string; active: string }[] = [
  { tier: "free", label: "Free", active: "bg-black/70 text-white" },
  { tier: "pro", label: "Pro", active: "bg-bob-indigo text-white" },
  { tier: "business", label: "Business", active: "bg-emerald-600 text-white" },
];

export function TierButtons({
  proId,
  currentTier,
}: {
  proId: string;
  currentTier: SubscriptionTier;
}) {
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [current, setCurrent] = useState(currentTier);
  const router = useRouter();

  async function updateTier(tier: SubscriptionTier) {
    if (tier === current || loading) return;
    setLoading(tier);
    try {
      const res = await fetch(`/api/admin/professionals/${proId}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (res.ok) {
        setCurrent(tier);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-bob-ink/40">
        Piano
      </span>
      <div className="flex overflow-hidden rounded-xl border border-black/10">
        {TIERS.map((t) => (
          <button
            key={t.tier}
            onClick={() => updateTier(t.tier)}
            disabled={loading !== null}
            className={`px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
              t.tier === current
                ? t.active
                : "bg-white text-bob-ink/55 hover:bg-black/[0.04]"
            }`}
            data-testid={`tier-btn-${t.tier}-${proId}`}
          >
            {loading === t.tier ? "…" : t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
