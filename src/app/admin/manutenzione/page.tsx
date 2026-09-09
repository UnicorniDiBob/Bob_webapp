// /admin/manutenzione — chiudere Bob, e riaprirlo.
//
// SOLO ADMIN, NON CS, come per gli avvisi e per la stessa ragione: il cs deve
// SAPERE che il sito e' fermo — glielo chiedono — ma fermarlo e' un gesto che
// deve avere un nome sopra. La regola la fa la RLS della 073; questa pagina la
// ripete perche' mostrare un pannello che poi il database rifiuta e' solo un
// modo per far perdere tempo.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManutenzioneAdmin } from "./ManutenzioneAdmin";

export const dynamic = "force-dynamic";

export default async function ManutenzionePage() {
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

  return <ManutenzioneAdmin />;
}
