// Pagina admin: Copertura. Dove sono i professionisti, comune per comune.
//
// PERCHÉ ESISTE
// Dalla 086-087 un professionista può dichiarare i comuni in cui lavora, e
// dalla 085 dice dove ha la base. Erano due dati che non guardava nessuno: per
// sapere «quanti iscritti abbiamo a Sesto» bisognava scrivere una query. Qui
// diventano una mappa e una tabella — e soprattutto l'elenco dei buchi: i
// comuni da cui arrivano richieste e dove non copre nessuno, che è la lista da
// cui si decide dove fare outreach.
//
// SOLO ADMIN, NON CS
// Stessa scelta di /admin/analisi: questi sono numeri commerciali (dove siamo
// forti, dove siamo scoperti), non dati che servono a rispondere a un ticket.
//
// FETCH GREZZO LATO SERVER, AGGREGAZIONE QUI
// Come le altre pagine admin: i numeri sono piccoli (sei professionisti, dieci
// richieste, 133 comuni per la provincia guardata) e l'aggregazione in
// TypeScript si legge e si corregge, mentre una query con quattro left join si
// legge una volta sola — il giorno che la si scrive.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoperturaDashboard, type ComuneRiga } from "./CoperturaDashboard";

export const revalidate = 0;

const PROVINCIA_PREDEFINITA = "Milano";

export default async function AdminCoperturaPage({
  searchParams,
}: {
  searchParams: Promise<{ provincia?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: viewerRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  if (viewerRow?.role !== "admin") redirect("/admin");

  const params = await searchParams;
  const provincia = (params.provincia ?? PROVINCIA_PREDEFINITA).trim();

  const [
    { data: professionals },
    { data: gettoni },
    { data: coperture },
    { data: cities },
    { data: requests },
    { data: comuniProvincia },
    { data: tutteLeProvince },
  ] = await Promise.all([
    supabase
      .from("professionals")
      .select(
        "id, city_id, comune_istat, comune_name, province, region, postal_code, deactivated_at, subscription_tier, verification_status, created_at"
      ),
    supabase
      .from("professional_coverage_public")
      .select("professional_id, coverage_keys, best_scope"),
    supabase
      .from("professional_coverage")
      .select("professional_id, scope, mode, zone_slugs, comuni_istat, works_remote"),
    supabase.from("cities").select("id, name, slug, province, comune_istat"),
    supabase.from("requests").select("id, comune_istat, city_id, created_at"),
    supabase
      .from("comuni")
      .select("istat, nome, sigla, provincia, regione, lat, lng")
      .eq("provincia", provincia)
      .order("nome"),
    // Solo la colonna: 7.904 stringhe corte restano sul server e diventano 107
    // nomi. Una query «distinct» non esiste in PostgREST e un RPC per questo
    // sarebbe una funzione in più da mantenere.
    supabase.from("comuni").select("provincia"),
  ]);

  const attivi = (professionals ?? []).filter((p) => p.deactivated_at === null);
  // Solo gli attivi: un professionista disattivato non copre niente, e
  // contarlo gonfierebbe proprio il numero che serve a decidere dove cercarne
  // di nuovi.
  const idAttivi = new Set(attivi.map((p) => p.id as string));
  const chiaviPerPro = new Map<string, string[]>(
    (gettoni ?? [])
      .filter((g) => idAttivi.has(g.professional_id as string))
      .map((g) => [g.professional_id as string, (g.coverage_keys as string[]) ?? []])
  );

  // La città di Bob che corrisponde a un comune: dentro quella, coprire
  // «qualche quartiere» o «tutta la città» vuol dire coprire il comune.
  const cittaPerComune = new Map<string, { slug: string; name: string }>();
  for (const c of cities ?? []) {
    if (c.comune_istat) {
      cittaPerComune.set(c.comune_istat as string, {
        slug: c.slug as string,
        name: c.name as string,
      });
    }
  }

  const slugify = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const richiestePerComune = new Map<string, number>();
  for (const r of requests ?? []) {
    const istat = r.comune_istat as string | null;
    if (!istat) continue;
    richiestePerComune.set(istat, (richiestePerComune.get(istat) ?? 0) + 1);
  }

  const proBasePerComune = new Map<string, number>();
  for (const p of attivi) {
    const istat = p.comune_istat as string | null;
    if (!istat) continue;
    proBasePerComune.set(istat, (proBasePerComune.get(istat) ?? 0) + 1);
  }

  function copertura(istat: string, provinciaNome: string) {
    const citta = cittaPerComune.get(istat);
    const gettoneComune = `comune:${istat}`;
    const gettoneCitta = citta ? `city:${citta.slug}` : null;
    const prefissoZona = citta ? `zone:${citta.slug}/` : null;
    const gettoneProv = `prov:${slugify(provinciaNome)}`;

    let precisi = 0;
    let ampi = 0;
    for (const chiavi of chiaviPerPro.values()) {
      const preciso =
        chiavi.includes(gettoneComune) ||
        (gettoneCitta !== null && chiavi.includes(gettoneCitta)) ||
        (prefissoZona !== null && chiavi.some((k) => k.startsWith(prefissoZona)));
      if (preciso) {
        precisi++;
        continue;
      }
      const ampio =
        chiavi.includes(gettoneProv) ||
        chiavi.some((k) => k.startsWith("reg:") || k.startsWith("macro:") || k === "it:*");
      if (ampio) ampi++;
    }
    return { precisi, ampi };
  }

  const righe: ComuneRiga[] = (comuniProvincia ?? []).map((c) => {
    const istat = c.istat as string;
    const { precisi, ampi } = copertura(istat, c.provincia as string);
    return {
      istat,
      nome: c.nome as string,
      lat: (c.lat as number | null) ?? null,
      lng: (c.lng as number | null) ?? null,
      proBase: proBasePerComune.get(istat) ?? 0,
      proPrecisi: precisi,
      proAmpi: ampi,
      richieste: richiestePerComune.get(istat) ?? 0,
    };
  });

  const province = [...new Set((tutteLeProvince ?? []).map((r) => r.provincia as string))].sort(
    (a, b) => a.localeCompare(b, "it")
  );

  const sigla = ((comuniProvincia ?? [])[0]?.sigla as string | undefined) ?? null;

  const conArea = (coperture ?? []).filter(
    (c) =>
      idAttivi.has(c.professional_id as string) &&
      ((c.zone_slugs as string[] | null) ?? []).length > 0 ||
      ((c.comuni_istat as string[] | null) ?? []).length > 0 ||
      (c.scope as string) !== "zones"
  ).length;

  return (
    <CoperturaDashboard
      provincia={provincia}
      sigla={sigla}
      province={province}
      righe={righe}
      totali={{
        proAttivi: attivi.length,
        proConArea: conArea,
        proConBase: attivi.filter((p) => p.comune_istat !== null).length,
        richiesteTotali: (requests ?? []).length,
        richiesteConComune: (requests ?? []).filter((r) => r.comune_istat !== null).length,
      }}
    />
  );
}
