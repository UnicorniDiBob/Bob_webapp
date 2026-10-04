// I RICAVI ESTERNI (04/10, Lucio): il lavoro fatto fuori da Bob, scritto dal
// pro. Mig 111, spec §4. Plus e Business scrivono; tutti vedono, scaricano e
// cancellano i propri. Il piano lo fa rispettare la RLS, non questa pagina:
// qui si legge solo per dire al Free perche' il modulo non c'e'.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RicaviEsterni } from "@/components/analisi/RicaviEsterni";

export const revalidate = 0;

export default async function EsterniPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: pro }, { data: servizi }] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, subscription_tier")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("services").select("id, name").order("name"),
  ]);
  if (!pro) redirect("/dashboard");

  return (
    <RicaviEsterni
      proId={pro.id as string}
      piano={pro.subscription_tier as string}
      servizi={(servizi ?? []) as { id: string; name: string }[]}
    />
  );
}
