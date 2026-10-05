"use client";

// IL PREAVVISO PER ANNULLARE (113, Lucio 05/10).
//
// Una sola impostazione del professionista, per tutti i suoi appuntamenti con
// un cliente: sotto queste ore prima dell'inizio, un appuntamento non si
// annulla dal sito, si chiama. Vale per entrambe le parti. 48 ore di base;
// 0 = sempre dal sito. Prima c'era una finestra per ogni servizio a
// prenotazione diretta: la sostituisce questa.
//
// Cambiarla vale per gli appuntamenti confermati da adesso in poi: quelli gia'
// confermati tengono il preavviso del giorno dell'accordo, fotografato dal
// database (appointments.cancellation_window_hours). E' una promessa fatta
// al cliente, e non cambia sotto di lui.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PREAVVISO_BASE_ORE } from "@/lib/disdettaPrenotazione";

const MAX_ORE = 336;

export default function PreavvisoAnnullamento({
  professionalId,
}: {
  professionalId: string;
}) {
  const [ore, setOre] = useState<string>("");
  const [salvate, setSalvate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    let vivo = true;
    createClient()
      .from("professionals")
      .select("preavviso_annullamento_ore")
      .eq("id", professionalId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) {
          setErrore("Non riesco a leggere l'impostazione. Ricarica la pagina.");
          return;
        }
        const v =
          (data as { preavviso_annullamento_ore?: number } | null)
            ?.preavviso_annullamento_ore ?? PREAVVISO_BASE_ORE;
        setSalvate(v);
        setOre(String(v));
      });
    return () => {
      vivo = false;
    };
  }, [professionalId]);

  const numero = Number(ore);
  const valido = ore.trim() !== "" && Number.isInteger(numero) && numero >= 0 && numero <= MAX_ORE;

  async function salva() {
    if (!valido) return;
    setBusy(true);
    setErrore(null);
    setFatto(false);
    const { error } = await createClient()
      .from("professionals")
      .update({ preavviso_annullamento_ore: numero })
      .eq("id", professionalId);
    setBusy(false);
    if (error) {
      setErrore("Salvataggio non riuscito. Riprova.");
      return;
    }
    setSalvate(numero);
    setFatto(true);
  }

  return (
    <div data-testid="preavviso-annullamento">
      <label className="label-bob" htmlFor="preavviso-ore">
        Sotto quante ore dall&apos;inizio si annulla solo per telefono
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="preavviso-ore"
          type="number"
          min={0}
          max={MAX_ORE}
          inputMode="numeric"
          value={ore}
          onChange={(e) => {
            setOre(e.target.value);
            setFatto(false);
          }}
          className="input-bob w-24 text-center"
          disabled={salvate === null}
        />
        <span className="text-sm text-bob-ink/70">ore</span>
        <button
          onClick={salva}
          disabled={busy || !valido || numero === salvate}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          data-testid="preavviso-salva"
        >
          {busy ? "Salvo…" : "Salva"}
        </button>
        {fatto && <span className="text-xs text-emerald-700">Salvato ✓</span>}
      </div>
      {!valido && ore.trim() !== "" && (
        <p className="mt-1 text-xs text-red-600">
          Scrivi un numero intero di ore, da 0 a {MAX_ORE}.
        </p>
      )}
      <p className="mt-2 text-xs text-bob-ink/65">
        Prima di questo limite tu e il cliente potete annullare dal sito: parte
        un messaggio in chat e lo vedete tutti e due. Dopo, si chiama: tu
        registri l&apos;annullamento solo dopo averne parlato con il cliente. 0 =
        sempre dal sito. Vale per gli appuntamenti confermati da adesso: quelli
        già confermati tengono il preavviso del giorno dell&apos;accordo.
      </p>
      {errore && <p className="mt-1 text-xs text-red-600">{errore}</p>}
    </div>
  );
}
