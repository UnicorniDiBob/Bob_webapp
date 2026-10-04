// LE ANALISI AVANZATE (04/10, Lucio). Uguali per Plus e Business, chiuse per
// il Free. Spec: docs/SPEC_analisi_professionista.md, Fase 2.
//
// Il piano lo decide public.analisi_avanzata() (mig 110), non questa pagina:
// per un Free risponde 42501, e qui diventa la scheda che dice cosa contiene
// e in quale piano c'e'. Una pagina che nasconde e basta non e' un limite.
//
// Il periodo sta nell'URL (?da=2026-01&a=2026-10&contro=anno&esterni=1), cosi'
// un link riapre esattamente gli stessi numeri.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AnalisiAvanzata,
  AnalisiAvanzataChiusa,
  type DatiAvanzati,
} from "@/components/analisi/AnalisiAvanzata";
import { meseDiOggi, periodoContro, periodoDaUrl } from "@/lib/analisi";

export const revalidate = 0;

export default async function AvanzatePage({
  searchParams,
}: {
  searchParams: { da?: string; a?: string; contro?: string; esterni?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const oggi = meseDiOggi();
  const { periodo, confronto } = periodoDaUrl(searchParams, oggi);
  const contro = periodoContro(periodo, confronto);
  const conEsterni = searchParams.esterni === "1";

  const { data, error } = await supabase.rpc("analisi_avanzata", {
    p_da: `${periodo.da}-01`,
    p_a: `${periodo.a}-01`,
    p_contro_da: contro ? `${contro.da}-01` : null,
    p_contro_a: contro ? `${contro.a}-01` : null,
    p_con_esterni: conEsterni,
  });

  if (error?.code === "42501") return <AnalisiAvanzataChiusa />;
  if (error) throw new Error(`analisi_avanzata: ${error.message}`);
  // null = chi guarda non e' un professionista.
  if (!data) redirect("/dashboard");

  return (
    <AnalisiAvanzata
      // Il periodo nuovo arriva come pagina nuova: la chiave riparte da zero i
      // campi «Da» e «A», che altrimenti terrebbero i valori di prima.
      key={`${periodo.da}-${periodo.a}-${confronto}-${conEsterni}`}
      dati={data as DatiAvanzati}
      periodo={periodo}
      confronto={confronto}
      oggi={oggi}
      conEsterni={conEsterni}
    />
  );
}
