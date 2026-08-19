"use client";

// Sezione "Orari": quando lavori, e cosa un cliente puo' prenotare da solo.
//
// Erano gli ultimi due blocchi di /dashboard/profilo, in fondo, dopo la
// verifica: la parte che decide quando ti squilla il telefono stava sotto
// tutto il resto. Le due cose stanno insieme perche' sono la stessa
// domanda vista da due lati — quando sei disponibile, e cosa di quella
// disponibilita' e' prenotabile senza passare da te.

import Link from "next/link";
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
import AvailabilityEditor from "@/components/AvailabilityEditor";
import InstantBookingConfig from "@/components/InstantBookingConfig";

export default function OrariPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const { pro, loading, failed, reload } = useProfessional();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?returnTo=/dashboard/orari");
    else if (role && role !== "professional") router.replace("/dashboard");
  }, [authLoading, user, role, router]);

  if (loading) return <SectionSkeleton rows={3} />;
  if (failed) return <SectionError onRetry={reload} />;
  if (!pro) return <NoProProfile />;

  return (
    <div className="space-y-5">
      <SectionHeader title="Orari e disponibilità">
        Da qui dipendono gli orari che Bob propone ai clienti. Se qui è vuoto,
        Bob propone comunque degli orari standard — e possono essere ore in cui
        non lavori.
      </SectionHeader>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">
          La tua settimana
        </h3>
        <p className="mt-1 text-sm text-bob-ink/55">
          Un intervallo per giorno. I giorni che lasci spenti sono giorni in cui
          non ti proponiamo.
        </p>
        <div className="mt-3">
          <AvailabilityEditor professionalId={pro.id} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-bob-ink">
          Prenotazione diretta
        </h3>
        <p className="mt-1 text-sm text-bob-ink/55">
          Per i lavori a tariffa fissa: il cliente prenota uno slot senza
          chiederti niente prima. Attivala solo su quello che sai già quanto
          costa e quanto dura.
        </p>
        <div className="mt-3">
          {pro.serviceId ? (
            <InstantBookingConfig
              professionalId={pro.id}
              serviceId={pro.serviceId}
              cityId={pro.cityId}
              subSlugs={pro.subSlugs}
              tier={pro.tier}
            />
          ) : (
            <p className="text-sm text-bob-ink/55">
              Prima scegli il servizio principale in{" "}
              <Link
                href="/dashboard/azienda"
                className="font-medium text-bob-indigo hover:underline"
              >
                La tua azienda
              </Link>
              : la prenotazione diretta si appoggia su quello.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
