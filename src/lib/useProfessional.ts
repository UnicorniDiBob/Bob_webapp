"use client";

// Il profilo professionista di chi sta guardando, caricato una volta per
// pagina. Prima stava dentro la pagina unica: adesso che le sezioni sono
// pagine separate, ognuna ha bisogno degli stessi quattro dati di base
// (id, piano, citta', servizio principale) e non ha senso riscrivere quattro
// volte la stessa query.
//
// Nota sul caso "riga assente": un utente con ruolo professionista puo' non
// avere ancora una riga in professionals se si e' iscritto prima
// dell'onboarding del 14/08 o se l'ha abbandonato a meta'. Non e' un errore
// ed e' importante non trattarlo come tale: si torna al percorso di
// iscrizione, che e' l'unico posto dove quella riga nasce.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { SubscriptionTier } from "@/lib/supabase/types";

export interface ProBase {
  id: string;
  userId: string;
  cityId: string;
  serviceId: string;
  serviceRowId: string | null;
  subSlugs: string[];
  tier: SubscriptionTier;
  headline: string | null;
}

export function useProfessional() {
  const supabase = createClient();
  const { user, role, loading: authLoading } = useAuth();

  const [pro, setPro] = useState<ProBase | null>(null);
  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    const { data, error } = await supabase
      .from("professionals")
      .select(
        "id, user_id, city_id, headline, subservice_slugs, subscription_tier"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setFailed(true);
      setBooted(true);
      return;
    }
    if (!data) {
      setPro(null);
      setBooted(true);
      return;
    }

    const p = data as Record<string, unknown>;
    // Il servizio principale e i prezzi vivono in professional_services:
    // una riga per (professionista, servizio), oggi una sola.
    const { data: ps } = await supabase
      .from("professional_services")
      .select("id, service_id")
      .eq("professional_id", p.id as string)
      .limit(1)
      .maybeSingle();
    const s = (ps ?? {}) as Record<string, unknown>;

    setPro({
      id: p.id as string,
      userId: p.user_id as string,
      cityId: (p.city_id as string) ?? "",
      serviceId: (s.service_id as string) ?? "",
      serviceRowId: (s.id as string) ?? null,
      subSlugs: (p.subservice_slugs as string[]) ?? [],
      tier: (p.subscription_tier as SubscriptionTier) ?? "free",
      headline: (p.headline as string) ?? null,
    });
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== "professional") {
      setBooted(true);
      return;
    }
    load();
  }, [authLoading, user, role, load]);

  return {
    pro,
    /** true finche' non si sa nulla: le pagine mostrano lo scheletro. */
    loading: authLoading || !booted,
    /** La query e' andata male (rete, permessi): diverso da "riga assente". */
    failed,
    reload: load,
  };
}
