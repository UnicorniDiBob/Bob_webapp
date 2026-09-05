// /admin/avvisi — le comunicazioni dello staff a tutta la comunità.
//
// PERCHE' STA IN /admin E NON IN /impostazioni. Non e' una preferenza di chi
// la scrive: e' una cosa che finisce sullo schermo di tutti. Sta insieme alle
// altre leve che agiscono sugli altri, non insieme alle proprie.
//
// SOLO ADMIN, NON CS. Il cs legge tutti gli avvisi (gli serve per rispondere a
// «che succede?») ma non ne pubblica: parlare a nome di Bob a tutta la
// comunità è una cosa sola e deve avere un nome sopra. La regola la fa la RLS
// della 071; questa pagina la ripete perché mostrare un modulo che poi il
// database rifiuta è un modo per far perdere tempo.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvvisiAdmin } from "./AvvisiAdmin";

export const dynamic = "force-dynamic";

export default async function AvvisiPage() {
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

  return <AvvisiAdmin />;
}
