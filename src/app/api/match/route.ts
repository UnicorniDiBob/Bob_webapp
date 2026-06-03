import { NextResponse } from "next/server";
import { getProfessionals } from "@/lib/data";

// Endpoint usato dalla chat di Bob per restituire i professionisti filtrati.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const citySlug = searchParams.get("city") ?? undefined;
  const serviceSlug = searchParams.get("service") ?? undefined;
  const maxPriceParam = searchParams.get("maxPrice");
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;

  const professionals = await getProfessionals({
    citySlug,
    serviceSlug,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
  });

  return NextResponse.json({ professionals });
}
