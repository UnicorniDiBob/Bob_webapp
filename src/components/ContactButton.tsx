"use client";

import { useState } from "react";
import { RequestDialog } from "./RequestDialog";
import type { ProfessionalCard } from "@/lib/supabase/types";

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

  const prefilled = `Ciao ${professional.displayName}, ho bisogno ${
    professional.serviceNeedPhrase ?? "di un intervento"
  } a ${professional.city.name}. Quando saresti disponibile e che costo prevedi?`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
