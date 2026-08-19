"use client";

// Sezione "Lavori": le foto degli interventi.
//
// Era in fondo alla dashboard operativa, sotto il calendario: un blocco che si
// aggiorna una volta al mese stava sotto quello che si guarda ogni mattina.
// Qui ha una pagina sua e la dashboard resta la giornata.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfessional } from "@/lib/useProfessional";
import { SectionHeader } from "@/components/DashboardShell";
import {
  SectionSkeleton,
  SectionError,
  NoProProfile,
} from "@/components/SectionStates";
import { ProPortfolio } from "@/components/ProPortfolio";

export default function LavoriPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const { pro, loading, failed, reload } = useProfessional();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/dashboard/lavori");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [authLoading, user, role, router]);

  if (loading) return <SectionSkeleton rows={2} />;
  if (failed) return <SectionError onRetry={reload} />;
  if (!pro) return <NoProProfile />;

  return (
    <div>
      <SectionHeader title="I tuoi lavori">
        Una foto di un lavoro fatto vale più di tre righe di bio. Quante ne puoi
        caricare dipende dal piano.
      </SectionHeader>

      <ProPortfolio
        professionalId={pro.id}
        userId={pro.userId}
        tier={pro.tier}
      />
    </div>
  );
}
