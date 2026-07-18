// Pagina admin: Analisi. Fetch grezzo lato server (dataset piccolo, come
// le altre pagine admin), filtri e aggregazioni lato client in
// AnalisiDashboard.
//
// Solo admin (non CS): dati commerciali sensibili. Se serve dare accesso
// al team CS in futuro, si aggiunge qui un secondo livello di permesso
// (rimandato per ora, come da decisione).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalisiDashboard, type AnalisiRawData } from "./AnalisiDashboard";

export const revalidate = 0;

export default async function AdminAnalisiPage() {
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
    { data: services },
    { data: subservices },
    { data: users },
    { data: profiles },
    { data: professionals },
    { data: professionalServices },
    { data: requests },
    { data: requestMessages },
    { data: tierEvents },
  ] = await Promise.all([
    supabase
      .from("cities")
      .select("id, name, slug, province, region, macro_region"),
    supabase.from("services").select("id, name, slug"),
    supabase.from("subservices").select("id, service_id, name, slug"),
    supabase.from("users").select("id, role, created_at"),
    supabase.from("profiles").select("user_id, full_name, date_of_birth"),
    supabase
      .from("professionals")
      .select("id, user_id, city_id, subscription_tier, verification_status, created_at"),
    supabase
      .from("professional_services")
      .select("professional_id, service_id, subservice_id"),
    supabase
      .from("requests")
      .select("id, customer_id, city_id, service_id, subservice_id, status, created_at"),
    supabase
      .from("request_messages")
      .select("request_id, sender_type, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("subscription_tier_events")
      .select("professional_id, old_tier, new_tier, changed_at"),
  ]);

  const data: AnalisiRawData = {
    cities: cities ?? [],
    services: services ?? [],
    subservices: subservices ?? [],
    users: users ?? [],
    profiles: profiles ?? [],
    professionals: professionals ?? [],
    professionalServices: professionalServices ?? [],
    requests: requests ?? [],
    requestMessages: requestMessages ?? [],
    tierEvents: tierEvents ?? [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Analisi
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Indicatori del marketplace, filtrabili per periodo, area geografica,
          categoria e fascia d&apos;età. Esporta in Excel in ogni momento con i
          filtri correnti.
        </p>
      </div>

      <AnalisiDashboard data={data} />
    </div>
  );
}
