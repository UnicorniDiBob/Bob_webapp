"use client";

import { useState } from "react";
import { RequestDialog } from "./RequestDialog";
import type { ProfessionalCard } from "@/lib/supabase/types";

/**
 * (6b) L'intervento che il cliente stava cercando arriva dall'elenco nel link,
 * come `?intervento=`. Lo leggiamo dalla URL al momento del clic e non dai
 * searchParams della pagina, per due ragioni:
 * - la pagina del professionista ha `revalidate = 120`, e leggere i
 *   searchParams la renderebbe dinamica a ogni visita per un parametro che
 *   serve solo dopo un tocco;
 * - `useSearchParams` in una pagina statica vuole un confine <Suspense>, e
 *   non ne serve uno per un valore che si guarda una volta sola.
 * Vedi docs/RICERCA.md §6.
 */
function interventoDallaUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("intervento");
  return v && v.length <= 80 ? v : null;
}

// Pulsante "Contatta" che apre il dialog di richiesta con messaggio precompilato.
export function ContactButton({
  professional,
  className,
  label = "Contatta",
}: {
  professional: ProfessionalCard;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  // Fissato al clic: se il cliente cambia URL col dialog aperto, la richiesta
  // resta quella che aveva davanti quando ha premuto.
  const [intervento, setIntervento] = useState<string | null>(null);

  const prefilled = `Ciao ${professional.displayName}, ho bisogno ${
    professional.serviceNeedPhrase ?? "di un intervento"
  } a ${professional.city.name}. Quando saresti disponibile e che costo prevedi?`;

  return (
    <>
      <button
        onClick={() => {
          setIntervento(interventoDallaUrl());
          setOpen(true);
        }}
        className={className ?? "btn-primary px-5 py-3"}
        data-testid="button-contact-professional"
      >
        {label}
      </button>
      {open && (
        <RequestDialog
          professional={professional}
          prefilledMessage={prefilled}
          context={{
            citySlug: professional.city.slug,
            serviceSlug: professional.serviceSlug ?? undefined,
            subserviceSlug: intervento,
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
