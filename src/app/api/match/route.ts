import { NextResponse } from "next/server";
import { getProfessionals } from "@/lib/data";

// Endpoint usato dalla chat di Bob per restituire i professionisti filtrati.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const citySlug = searchParams.get("city") ?? undefined;
  const serviceSlug = searchParams.get("service") ?? undefined;
  // La zona, se il cliente l'ha detta: fa scattare il confronto per gettoni
  // di copertura invece del solo confronto per citta' (057/058).
  const zoneSlug = searchParams.get("zone") ?? undefined;
  const maxPriceParam = searchParams.get("maxPrice");
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;

  const professionals = await getProfessionals({
    citySlug,
    serviceSlug,
    zoneSlug,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
  });

  return NextResponse.json({ professionals });
}
