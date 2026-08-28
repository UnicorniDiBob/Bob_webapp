"use client";

// Sezione «Dove lavori»: la stessa domanda del primo ingresso, riaperta.
// Sta in /impostazioni perché una risposta che non si può rivedere è un
// sondaggio, non un profilo.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfessional } from "@/lib/useProfessional";
import { SectionHeader } from "@/components/ImpostazioniShell";
import {
  SectionSkeleton,
  SectionError,
  NoProProfile,
} from "@/components/SectionStates";
import AreaLavoroEditor from "@/components/AreaLavoroEditor";

export default function ZonePage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const { pro, loading, failed, reload } = useProfessional();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/impostazioni/zone");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [authLoading, user, role, router]);

  if (loading) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={reload} />;
  if (!pro) return <NoProProfile />;

  return (
    <div className="space-y-5">
      <SectionHeader title="Dove lavori">
        Da qui dipende a quali richieste ti proponiamo. Disegna il cerchio del
        tuo giro abituale, o scegli i quartieri a mano: sono due modi di dire la
        stessa cosa.
      </SectionHeader>

      <div className="card p-5">
        <AreaLavoroEditor professionalId={pro.id} cityIdIniziale={pro.cityId} />
      </div>

      <p className="text-xs text-bob-ink/45">
        Il centro del cerchio resta privato: pubblichiamo solo le zone che
        copri, mai il punto da cui parti.
      </p>
    </div>
  );
}
