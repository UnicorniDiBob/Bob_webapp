// Pagina admin: verifica dei professionisti.
// Mostra i professionisti raggruppati per stato di verifica.
// Admin e CS possono approvare (verified), mettere in attesa (pending) o rifiutare (unverified).

import { createClient } from "@/lib/supabase/server";
import { VerifyButtons } from "./VerifyButtons";
import { TierButtons } from "./TierButtons";

export const revalidate = 0; // sempre aggiornato

type VerificationStatus = "unverified" | "pending" | "verified";
type SubscriptionTier = "free" | "pro" | "business";

interface ProRow {
  id: string;
  verification_status: VerificationStatus;
  subscription_tier: SubscriptionTier;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  created_at: string | null;
  user_id: string;
  cities: { name: string } | null;
  professional_services: {
    services: { name: string } | null;
    min_price: number | null;
    max_price: number | null;
  }[];
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; badge: string; description: string }
> = {
  unverified: {
    label: "Non verificati",
    badge: "bg-red-50 text-red-700",
    description: "Nuovi iscritti che non sono ancora stati esaminati.",
  },
  pending: {
    label: "In revisione",
    badge: "bg-amber-50 text-amber-700",
    description: "Profili in corso di verifica.",
  },
  verified: {
    label: "Verificati",
    badge: "bg-emerald-50 text-emerald-700",
    description: "Profili approvati e visibili ai clienti.",
  },
};

export default async function AdminProfessionalsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("professionals")
    .select(`
      id,
      user_id,
      verification_status,
      subscription_tier,
      headline,
      bio,
      years_experience,
      created_at,
      cities ( name ),
      professional_services ( min_price, max_price, services ( name ) )
    `)
    .order("created_at", { ascending: false });

  const pros = (data ?? []) as unknown as ProRow[];

  // Recupera i nomi dai profili
  const userIds = pros.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone")
    .in("user_id", userIds);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  // Raggruppa per stato
  const grouped: Record<VerificationStatus, ProRow[]> = {
    unverified: [],
    pending: [],
    verified: [],
  };
  for (const p of pros) {
    grouped[p.verification_status].push(p);
  }

  const order: VerificationStatus[] = ["unverified", "pending", "verified"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Verifica professionisti
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Esamina i profili e aggiorna il loro stato di verifica.
        </p>
      </div>

      {order.map((status) => {
        const list = grouped[status];
        const config = STATUS_CONFIG[status];
        return (
          <section key={status}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-bob-ink">
                {config.label}
              </h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badge}`}>
                {list.length}
              </span>
            </div>
            <p className="mb-4 text-sm text-bob-ink/55">{config.description}</p>

            {list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 py-8 text-center text-sm text-bob-ink/40">
                Nessun professionista in questa categoria.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {list.map((pro) => {
                  const profile = profileMap[pro.user_id];
                  const svc = pro.professional_services?.[0];
                  return (
                    <div
                      key={pro.id}
                      className="card p-5"
                      data-testid={`pro-row-${pro.id}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Info professionista */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-bob-ink">
                              {profile?.full_name ?? "Professionista"}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}
                            >
                              {config.label}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bob-ink/55">
                            {svc?.services?.name && (
                              <span>🛠 {svc.services.name}</span>
                            )}
                            {pro.cities?.name && (
                              <span>📍 {pro.cities.name}</span>
                            )}
                            {pro.years_experience != null && (
                              <span>⏱ {pro.years_experience} anni di esperienza</span>
                            )}
                            {svc?.min_price != null && (
                              <span>
                                💶 da €{svc.min_price}
                                {svc.max_price ? ` a €${svc.max_price}` : ""}
                              </span>
                            )}
                            {profile?.phone && (
                              <span>📞 {profile.phone}</span>
                            )}
                            <span>📅 Iscritto {fmtDate(pro.created_at)}</span>
                          </div>

                          {pro.headline && (
                            <p className="mt-2 text-sm text-bob-ink/75">
                              {pro.headline}
                            </p>
                          )}
                          {pro.bio && (
                            <p className="mt-1 line-clamp-2 text-xs text-bob-ink/50">
                              {pro.bio}
                            </p>
                          )}
                        </div>

                        {/* Bottoni azione */}
                        <div className="flex shrink-0 flex-col items-end gap-2.5">
                          <VerifyButtons
                            proId={pro.id}
                            currentStatus={pro.verification_status}
                          />
                          <TierButtons
                            proId={pro.id}
                            currentTier={pro.subscription_tier ?? "free"}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
