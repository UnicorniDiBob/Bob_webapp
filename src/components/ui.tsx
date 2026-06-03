import Link from "next/link";
import type { VerificationStatus, ProfessionalCard } from "@/lib/supabase/types";

// ---------- Rating a stelle ----------
export function Stars({
  value,
  count,
  size = "sm",
}: {
  value: number | null;
  count?: number;
  size?: "sm" | "md";
}) {
  if (value === null) {
    return (
      <span className="text-xs text-bob-ink/40" data-testid="text-no-rating">
        Ancora senza recensioni
      </span>
    );
  }
  const px = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1" data-testid="rating">
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={`${px} ${i <= full ? "text-bob-yellow" : "text-black/15"}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.36 4.18a1 1 0 0 0 .95.69h4.4c.97 0 1.37 1.24.59 1.81l-3.56 2.59a1 1 0 0 0-.36 1.12l1.36 4.18c.3.92-.75 1.69-1.54 1.12l-3.56-2.59a1 1 0 0 0-1.18 0l-3.56 2.59c-.78.57-1.83-.2-1.53-1.12l1.36-4.18a1 1 0 0 0-.36-1.12L1.4 9.6c-.78-.57-.38-1.81.59-1.81h4.4a1 1 0 0 0 .95-.69L9.05 2.93Z" />
          </svg>
        ))}
      </span>
      <span className="text-sm font-semibold text-bob-ink">{value.toFixed(1)}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-xs text-bob-ink/50">({count})</span>
      )}
    </span>
  );
}

// ---------- Badge di verifica ----------
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "verified") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
        data-testid="badge-verified"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.58l-1.3-1.3a1 1 0 0 0-1.4 1.42l2 2a1 1 0 0 0 1.4 0l4-4Z"
            clipRule="evenodd"
          />
        </svg>
        Verificato
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Verifica in corso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-bob-ink/60">
      Non ancora verificato
    </span>
  );
}

// ---------- Prezzo ----------
export function PriceTag({
  min,
  max,
}: {
  min: number | null;
  max: number | null;
}) {
  if (min === null && max === null) {
    return <span className="text-sm text-bob-ink/50">Tariffa su richiesta</span>;
  }
  const fmt = (n: number) => `${Number(n).toLocaleString("it-IT")}€`;
  return (
    <span className="text-sm font-semibold text-bob-ink" data-testid="text-price">
      {min !== null && max !== null
        ? `${fmt(min)}–${fmt(max)}`
        : fmt((min ?? max) as number)}
      <span className="font-normal text-bob-ink/50">/h</span>
    </span>
  );
}

// ---------- Card professionista ----------
export function ProfessionalCardItem({ p }: { p: ProfessionalCard }) {
  const initials = p.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/professionisti/${p.id}`}
      className="card group flex flex-col gap-3 p-5 hover:-translate-y-0.5 hover:shadow-card-hover"
      data-testid={`card-professional-${p.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bob-indigo-100 text-sm font-bold text-bob-indigo">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-bob-ink">{p.fullName}</h3>
          </div>
          <p className="truncate text-sm text-bob-ink/60">{p.headline}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {p.serviceName && <span className="chip">{p.serviceName}</span>}
        <span className="chip border-black/10 bg-black/[0.03] text-bob-ink/70">
          {p.city.name}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-black/5 pt-3">
        <Stars value={p.avgRating} count={p.nRatings} />
        <PriceTag min={p.minPrice} max={p.maxPrice} />
      </div>

      <div className="flex items-center justify-between">
        <VerificationBadge status={p.verificationStatus} />
        {p.responseTimeLabel && (
          <span className="text-xs text-bob-ink/50">{p.responseTimeLabel}</span>
        )}
      </div>
    </Link>
  );
}

// ---------- Stato vuoto ----------
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-2xl">
        🔎
      </div>
      <h3 className="font-semibold text-bob-ink">{title}</h3>
      <p className="max-w-sm text-sm text-bob-ink/60">{description}</p>
    </div>
  );
}
