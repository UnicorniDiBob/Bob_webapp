"use client";

// Area personale: smista per ruolo.
// - Professionista → ProWorkspace (profilo, calendario, richieste, portfolio)
// - Cliente → CustomerHome (Da fare ora, lavori in corso, appuntamenti,
//   professionisti di fiducia, storico) — vive in components/CustomerHome.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ProWorkspace } from "@/components/ProWorkspace";
import VerificaPromoBanner from "@/components/VerificaPromoBanner";
import { CustomerHome } from "@/components/CustomerHome";

interface StatoVerifica {
  level: "none" | "vat_verified" | "documents_verified";
  reviewState: "pending" | "docs_requested" | "rejected" | null;
  reviewNote: string | null;
}

interface ProProfile {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  verification_status: "unverified" | "pending" | "verified";
  /** Livello del blocco 10: decide sia il badge sia l'invito alla verifica. */
  verification_level: "none" | "vat_verified" | "documents_verified";
  subscription_tier: "free" | "pro" | "business";
  city: { name: string } | null;
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role, fullName, loading } = useAuth();

  const [proProfile, setProProfile] = useState<ProProfile | null>(null);
  const [statoVerifica, setStatoVerifica] = useState<StatoVerifica | null>(null);
  const [proRating, setProRating] = useState<{ avg: number | null; n: number }>({
    avg: null,
    n: 0,
  });
  const [loadingPro, setLoadingPro] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Gli account staff non hanno un'area personale: dritti al pannello admin.
  useEffect(() => {
    if (!loading && (role === "admin" || role === "cs")) {
      router.replace("/admin");
    }
  }, [loading, role, router]);

  useEffect(() => {
    if (!user || role !== "professional") {
      setLoadingPro(false);
      return;
    }
    let active = true;

    (async () => {
      setLoadingPro(true);
      const { data: prof } = await supabase
        .from("professionals")
        .select(
          "id, user_id, headline, bio, verification_status, verification_level, subscription_tier, cities ( name )"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (prof) {
        const p = prof as Record<string, unknown>;
        // Stato della pratica di verifica: la riga è sua e la RLS gliela fa
        // leggere. Serve al banner per dire a che punto è, invece di ripetere
        // "verifica ora" a chi ha già mandato tutto.
        const { data: ver } = await supabase
          .from("professional_verification")
          .select("level, vat_review_state, vat_review_note")
          .eq("professional_id", p.id as string)
          .maybeSingle();
        if (active) {
          const v = (ver ?? {}) as Record<string, unknown>;
          setStatoVerifica({
            level: (v.level as StatoVerifica["level"]) ?? "none",
            reviewState:
              (v.vat_review_state as StatoVerifica["reviewState"]) ?? null,
            reviewNote: (v.vat_review_note as string) ?? null,
          });
        }
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
            verification_level:
              (p.verification_level as ProProfile["verification_level"]) ??
              "none",
            subscription_tier:
              (p.subscription_tier as ProProfile["subscription_tier"]) ?? "free",
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
            ? Math.round(
                (arr.reduce((s, r) => s + r.score, 0) / arr.length) * 10
              ) / 10
            : null;
        if (active) setProRating({ avg, n: arr.length });
      }

      if (active) setLoadingPro(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  if (loading || (!user && !loading) || role === "admin" || role === "cs") {
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
          Ciao {firstName}
        </h1>
        <p className="mt-2 text-sm text-bob-ink/60">
          {role === "professional"
            ? "Qui trovi il tuo profilo e le tue valutazioni."
            : "Il punto della situazione sui tuoi lavori."}
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

      {role === "professional" ? (
        loadingPro ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="card h-28 animate-pulse bg-black/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invito alla verifica: solo a chi non ce l'ha ancora. */}
            {proProfile && statoVerifica && statoVerifica.level === "none" && (
              <VerificaPromoBanner
                reviewState={statoVerifica.reviewState}
                reviewNote={statoVerifica.reviewNote}
              />
            )}
            <ProWorkspace
              profile={proProfile}
              rating={proRating}
              name={fullName ?? "Professionista"}
            />
          </div>
        )
      ) : (
        <CustomerHome />
      )}
    </div>
  );
}
