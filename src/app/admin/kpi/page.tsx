// Pagina admin: analisi KPI. Prima versione — vedi KpiDashboard per i
// dettagli di calcolo. Fetch grezzo lato server (dataset piccolo, come le
// altre pagine admin), filtri e aggregazioni lato client.
//
// Solo admin (non CS): dati commerciali sensibili. Se serve dare accesso
// al team CS in futuro, si aggiunge qui un secondo livello di permesso
// (rimandato per ora, come da decisione).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KpiDashboard, type KpiRawData } from "./KpiDashboard";

export const revalidate = 0;

export default async function AdminKpiPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: viewerRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  if (viewerRow?.role !== "admin") redirect("/admin");

  const [
    { data: cities },
    { data: users },
    { data: profiles },
    { data: professionals },
    { data: requests },
  ] = await Promise.all([
    supabase
      .from("cities")
      .select("id, name, slug, province, region, macro_region"),
    supabase.from("users").select("id, role, created_at"),
    supabase.from("profiles").select("user_id, date_of_birth"),
    supabase
      .from("professionals")
      .select("id, user_id, city_id, subscription_tier, verification_status, created_at"),
    supabase
      .from("requests")
      .select("id, customer_id, city_id, status, created_at"),
  ]);

  const data: KpiRawData = {
    cities: cities ?? [],
    users: users ?? [],
    profiles: profiles ?? [],
    professionals: professionals ?? [],
    requests: requests ?? [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Analisi KPI
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Scegli l&apos;indicatore e affina con i filtri. Prima versione: utenti
          per ruolo, conversione Free→Pro, interazioni vs contratti conclusi.
        </p>
      </div>

      <KpiDashboard data={data} />
    </div>
  );
}
