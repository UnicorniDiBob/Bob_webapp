// Admin — cura del catalogo per la prenotazione diretta.
// Solo admin: qui si decide quali subservice sono idonei alla prenotazione
// diretta (instant_book_eligible), l'unità di tariffa predefinita e i campi
// del modulo di prenotazione (booking_fields).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CatalogInstantEditor, {
  type EditorService,
  type EditorSubservice,
} from "@/components/admin/CatalogInstantEditor";

export const dynamic = "force-dynamic";

export default async function AdminCatalogoPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (userRow?.role !== "admin") redirect("/admin");

  const [{ data: services }, { data: subs }] = await Promise.all([
    supabase.from("services").select("id, name, slug").order("name"),
    supabase
      .from("subservices")
      .select(
        "id, service_id, name, slug, instant_book_eligible, default_rate_unit, booking_fields"
      )
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">
          Prenotazione diretta — catalogo
        </h1>
        <p className="mt-1 text-sm text-bob-ink/55">
          Scegli quali lavori possono essere prenotati direttamente e definisci i
          campi che il cliente compila. Solo i lavori a tariffa fissa dovrebbero
          essere idonei.
        </p>
      </div>

      <CatalogInstantEditor
        services={(services ?? []) as EditorService[]}
        subservices={(subs ?? []) as EditorSubservice[]}
      />
    </div>
  );
}
