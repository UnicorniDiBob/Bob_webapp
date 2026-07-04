"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ProWorkspace } from "@/components/ProWorkspace";

interface CustomerRequest {
  id: string;
  status: string;
  problem_description: string | null;
  created_at: string | null;
  service: { name: string } | null;
  city: { name: string } | null;
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
            "id, status, problem_description, created_at, services ( name ), cities ( name )"
          )
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });

        const rows = (data ?? []) as Record<string, unknown>[];
        if (active) {
          setRequests(
            rows.map((r) => ({
              id: r.id as string,
              status: r.status as string,
              problem_description: (r.problem_description as string) ?? null,
              created_at: (r.created_at as string) ?? null,
              service: r.services as { name: string } | null,
              city: r.cities as { name: string } | null,
            }))
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
        <CustomerDashboard requests={requests} />
      )}
    </div>
  );
}

function CustomerDashboard({ requests }: { requests: CustomerRequest[] }) {
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
        </li>
      ))}
    </ul>
  );
}
