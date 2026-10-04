// I TUOI NUMERI — l'Analisi base (04/10, Lucio). Spec:
// docs/SPEC_analisi_professionista.md, Fase 1.
//
// Uguale per tutti i piani: nessun controllo di piano qui ne' nella funzione
// (mig 109). Quanto un professionista ha fatturato su Bob e' un fatto suo, e
// il conto non si vende.
//
// Pagina server: i numeri arrivano gia' fatti da public.analisi_base(), che
// gira come l'utente (SECURITY INVOKER) e quindi vede solo le sue righe. Al
// browser arriva il riassunto di un mese, non le tabelle.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalisiBase, type DatiAnalisiBase } from "@/components/analisi/AnalisiBase";

export const revalidate = 0;

export default async function NumeriPage({
  searchParams,
}: {
  searchParams: { mese?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ?mese=2026-09: qualunque altra forma vale «questo mese».
  const mese = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "")
    ? `${searchParams.mese}-01`
    : null;

  const { data, error } = await supabase.rpc("analisi_base", { p_mese: mese });
  // Un errore non deve sembrare «non sei un professionista»: va alla pagina
  // d'errore, e nei log.
  if (error) throw new Error(`analisi_base: ${error.message}`);

  // null = chi guarda non e' un professionista.
  if (!data) redirect("/dashboard");

  return <AnalisiBase dati={data as DatiAnalisiBase} />;
}
