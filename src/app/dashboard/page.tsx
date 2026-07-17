"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ProWorkspace } from "@/components/ProWorkspace";
import { ReviewDialog } from "@/components/ReviewDialog";

interface CustomerRequest {
  id: string;
  status: string;
  problem_description: string | null;
  created_at: string | null;
  service: { name: string } | null;
  city: { name: string } | null;
  // professionisti contattati in questa richiesta (per la recensione)
  pros: { id: string; name: string }[];
}

interface ProProfile {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  verification_status: "unverified" | "pending" | "verified";
  subscription_tier: "free" | "pro" | "business";
  city: { name: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviata",
  quote_request: "Preventivi richiesti",
  matched: "In contatto",
  closed: "Conclusa",
};

function fmtDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, fullName, loading } = useAuth();

  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [proProfile, setProProfile] = useState<ProProfile | null>(null);
  const [proRating, setProRating] = useState<{ avg: number | null; n: number }>({
    avg: null,
    n: 0,
  });
  const [loadingData, setLoadingData] = useState(true);

  // Reindirizza al login se non autenticato.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      setLoadingData(true);

      if (role === "professional") {
        const { data: prof } = await supabase
          .from("professionals")
          .select(
            "id, user_id, headline, bio, verification_status, subscription_tier, cities ( name )"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (prof) {
          const p = prof as Record<string, unknown>;
          const cityObj = p.cities as { name: string } | null;
          if (active) {
            setProProfile({
              id: p.id as string,
              user_id: p.user_id as string,
              headline: (p.headline as string) ?? null,
              bio: (p.bio as string) ?? null,
              verification_status:
                (p.verification_status as ProProfile["verification_status"]) ??
                "unverified",
              subscription_tier:
                (p.subscription_tier as ProProfile["subscription_tier"]) ??
                "free",
              city: cityObj ? { name: cityObj.name } : null,
            });
          }

          const { data: ratings } = await supabase
            .from("ratings")
            .select("score")
            .eq("professional_id", p.id as string);
          const arr = (ratings ?? []) as { score: number }[];
          const avg =
            arr.length > 0
              ? Math.round((arr.reduce((s, r) => s + r.score, 0) / arr.length) * 10) /
                10
              : null;
          if (active) setProRating({ avg, n: arr.length });
        }
      } else {
        const { data } = await supabase
          .from("requests")
          .select(
            "id, status, problem_description, created_at, services ( name ), cities ( name ), request_professionals ( professional_id, professionals ( id, user_id ) )"
          )
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });

        // Recensioni già lasciate: servono per non riproporre il bottone.
        const { data: myRatings } = await supabase
          .from("ratings")
          .select("request_id, professional_id")
          .eq("customer_id", user.id);

        const rows = (data ?? []) as Record<string, unknown>[];

        // Nomi pubblici dei professionisti da `profiles` (stesso pattern di messages.ts)
        const proUserIds = new Set<string>();
        for (const r of rows) {
          for (const rp of (r.request_professionals ?? []) as Record<
            string,
            unknown
          >[]) {
            const prof = rp.professionals as { user_id?: string } | null;
            if (prof?.user_id) proUserIds.add(prof.user_id);
          }
        }
        const nameByUser = new Map<string, string>();
        if (proUserIds.size) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", Array.from(proUserIds));
          for (const p of (profs ?? []) as {
            user_id: string;
            full_name: string | null;
          }[]) {
            if (p.full_name) nameByUser.set(p.user_id, p.full_name);
          }
        }

        if (active) {
          setRequests(
            rows.map((r) => {
              const rps = (r.request_professionals ?? []) as Record<
                string,
                unknown
              >[];
              const pros = rps
                .map((rp) => {
                  const prof = rp.professionals as {
                    id: string;
                    user_id: string | null;
                  } | null;
                  if (!prof) return null;
                  return {
                    id: prof.id,
                    name:
                      (prof.user_id && nameByUser.get(prof.user_id)) ||
                      "Professionista",
                  };
                })
                .filter(Boolean) as { id: string; name: string }[];
              return {
                id: r.id as string,
                status: r.status as string,
                problem_description: (r.problem_description as string) ?? null,
                created_at: (r.created_at as string) ?? null,
                service: r.services as { name: string } | null,
                city: r.cities as { name: string } | null,
                pros,
              };
            })
          );
          setReviewed(
            new Set(
              ((myRatings ?? []) as {
                request_id: string | null;
                professional_id: string;
              }[])
                .filter((x) => x.request_id)
                .map((x) => `${x.request_id}:${x.professional_id}`)
            )
          );
        }
      }

      if (active) setLoadingData(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  if (loading || (!user && !loading)) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico la tua area personale…
      </div>
    );
  }

  const firstName = fullName?.split(" ")[0] ?? "ciao";

  return (
    <div className="container-bob py-10">
      <header className="mb-7">
        <span className="section-eyebrow">Area personale</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink sm:text-3xl">
          Ciao {firstName} 👋
        </h1>
        <p className="mt-2 text-sm text-bob-ink/60">
          {role === "professional"
            ? "Qui trovi il tuo profilo e le tue valutazioni."
            : "Qui trovi tutte le richieste che hai inviato ai professionisti."}
        </p>
        {role !== "professional" && (
          <Link
            href="/dashboard/account"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-bob-indigo hover:underline"
            data-testid="link-account"
          >
            Gestisci il tuo account →
          </Link>
        )}
      </header>

      {loadingData ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card h-28 animate-pulse bg-black/[0.03]" />
          ))}
        </div>
      ) : role === "professional" ? (
        <ProWorkspace
          profile={proProfile}
          rating={proRating}
          name={fullName ?? "Professionista"}
        />
      ) : (
        <CustomerDashboard
          requests={requests}
          reviewed={reviewed}
          onMarkClosed={async (id) => {
            const { error } = await supabase
              .from("requests")
              .update({ status: "closed" })
              .eq("id", id);
            if (!error) {
              setRequests((rs) =>
                rs.map((r) => (r.id === id ? { ...r, status: "closed" } : r))
              );
            }
          }}
          onReviewed={(requestId, proId) =>
            setReviewed((prev) => new Set([...prev, `${requestId}:${proId}`]))
          }
        />
      )}
    </div>
  );
}

function CustomerDashboard({
  requests,
  reviewed,
  onMarkClosed,
  onReviewed,
}: {
  requests: CustomerRequest[];
  reviewed: Set<string>;
  onMarkClosed: (id: string) => Promise<void>;
  onReviewed: (requestId: string, proId: string) => void;
}) {
  const [reviewFor, setReviewFor] = useState<CustomerRequest | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  // Conferma chiusura con il dialog dell'app (coerenza con ReviewDialog,
  // niente window.confirm nativo).
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-2xl">
          💬
        </div>
        <h3 className="font-semibold text-bob-ink">Nessuna richiesta ancora</h3>
        <p className="max-w-sm text-sm text-bob-ink/60">
          Racconta a Bob cosa ti serve: ti aiuta a trovare il professionista
          giusto in pochi passi.
        </p>
        <Link href="/" className="btn-primary mt-1 px-5 py-2.5">
          Parla con Bob
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <li key={r.id} className="card p-5" data-testid={`request-${r.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{r.service?.name ?? "Servizio"}</span>
                {r.city?.name && (
                  <span className="chip border-black/10 bg-black/[0.03] text-bob-ink/70">
                    {r.city.name}
                  </span>
                )}
              </div>
              {r.problem_description && (
                <p className="mt-2 line-clamp-2 text-sm text-bob-ink/70">
                  {r.problem_description}
                </p>
              )}
              <p className="mt-2 text-xs text-bob-ink/45">
                Inviata il {fmtDate(r.created_at)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                r.status === "closed"
                  ? "bg-black/5 text-bob-ink/60"
                  : r.status === "matched"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-bob-indigo-50 text-bob-indigo"
              }`}
            >
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-black/5 pt-3">
            <Link
              href={`/messaggi?r=${r.id}`}
              className="text-sm font-medium text-bob-indigo hover:underline"
              data-testid={`link-conversation-${r.id}`}
            >
              Apri la conversazione →
            </Link>

            {(r.status === "sent" ||
              r.status === "matched" ||
              r.status === "quote_request") && (
              <button
                onClick={() => setConfirmClose(r.id)}
                disabled={closing === r.id}
                className="text-sm font-medium text-bob-ink/60 hover:text-bob-indigo hover:underline"
                data-testid={`button-close-${r.id}`}
              >
                {closing === r.id ? "Salvo…" : "Segna come concluso ✓"}
              </button>
            )}

            {r.status === "closed" &&
              r.pros.length > 0 &&
              (r.pros.some((p) => !reviewed.has(`${r.id}:${p.id}`)) ? (
                <button
                  onClick={() => setReviewFor(r)}
                  className="text-sm font-semibold text-bob-indigo hover:underline"
                  data-testid={`button-review-${r.id}`}
                >
                  ★ Lascia una recensione
                </button>
              ) : (
                <span className="text-sm text-emerald-700">
                  ✓ Recensione inviata
                </span>
              ))}
          </div>
        </li>
      ))}

      {confirmClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmClose(null)}
        >
          <div
            className="card w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-close-request"
          >
            <h3 className="text-lg font-bold text-bob-ink">Lavoro concluso?</h3>
            <p className="mt-2 text-sm text-bob-ink/65">
              Confermi che il lavoro è stato concluso? Dopo potrai lasciare una
              recensione al professionista.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmClose(null)}
                className="btn-secondary flex-1 py-2.5"
                data-testid="button-close-cancel"
              >
                Non ancora
              </button>
              <button
                onClick={async () => {
                  const id = confirmClose;
                  setConfirmClose(null);
                  setClosing(id);
                  await onMarkClosed(id);
                  setClosing(null);
                }}
                className="btn-primary flex-1 py-2.5"
                data-testid="button-close-confirm"
              >
                Sì, concluso ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewFor && (
        <ReviewDialog
          requestId={reviewFor.id}
          professionals={reviewFor.pros.filter(
            (p) => !reviewed.has(`${reviewFor.id}:${p.id}`)
          )}
          onClose={() => setReviewFor(null)}
          onSubmitted={(proId) => onReviewed(reviewFor.id, proId)}
        />
      )}
    </ul>
  );
}
