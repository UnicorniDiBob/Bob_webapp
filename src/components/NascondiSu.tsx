"use client";

// Nasconde un pezzo dell'impianto comune su alcune pagine. Serve al piede di
// pagina, che e' un componente del server: lo si passa qui come figlio.
//
// /messaggi (07/10) occupa tutta l'altezza sotto l'intestazione, come
// WhatsApp: un piede sotto la chat vorrebbe dire una pagina che scorre e un
// campo di scrittura che scappa via.

import { usePathname } from "next/navigation";

export function NascondiSu({
  prefissi,
  children,
}: {
  prefissi: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (prefissi.some((p) => pathname?.startsWith(p))) return null;
  return <>{children}</>;
}
