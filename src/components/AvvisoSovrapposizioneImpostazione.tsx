"use client";

// L'AVVISO «SI SOVRAPPONE A...», ACCESO O SPENTO (116).
//
// Il pro lo spegne con «non mostrarmelo piu'» nel momento in cui lo vede; qui
// lo ritrova e lo riaccende. Sta su professionals.avviso_sovrapposizione, cosi'
// vale su ogni dispositivo. Spegnerlo non toglie nessuna regola: al cliente la
// sovrapposizione resta vietata dal database, e la lista degli orari liberi che
// vede non cambia.

import { useEffect, useState } from "react";
import {
  leggiAvvisoSovrapposizione,
  salvaAvvisoSovrapposizione,
} from "@/lib/messages";

export default function AvvisoSovrapposizioneImpostazione({
  professionalId,
}: {
  professionalId: string;
}) {
  const [attivo, setAttivo] = useState<boolean | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    leggiAvvisoSovrapposizione(professionalId).then((v) => {
      if (vivo) setAttivo(v);
    });
    return () => {
      vivo = false;
    };
  }, [professionalId]);

  async function cambia(valore: boolean) {
    const prima = attivo;
    setAttivo(valore);
    setErrore(null);
    const { error } = await salvaAvvisoSovrapposizione(professionalId, valore);
    if (error) {
      setAttivo(prima);
      setErrore("Salvataggio non riuscito. Riprova.");
    }
  }

  return (
    <div data-testid="avviso-sovrapposizione-impostazione">
      <label className="flex min-h-[44px] items-start gap-2 text-sm text-bob-ink/80">
        <input
          type="checkbox"
          checked={attivo ?? true}
          disabled={attivo === null}
          onChange={(e) => cambia(e.target.checked)}
          className="mt-1"
          data-testid="avviso-sovrapposizione-toggle"
        />
        <span>
          Avvisami quando un orario che scelgo si sovrappone a un altro
          appuntamento.
          <span className="mt-0.5 block text-xs text-bob-ink/65">
            Tu puoi sovrapporre due appuntamenti, per esempio quando sei in
            ritardo; i clienti no, e non vedono mai un orario già occupato.
          </span>
        </span>
      </label>
      {errore && <p className="mt-1 text-xs text-red-600">{errore}</p>}
    </div>
  );
}
