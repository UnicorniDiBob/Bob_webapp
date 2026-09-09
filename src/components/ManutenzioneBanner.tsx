"use client";

// LA FASCIA DEL PREAVVISO — «Bob si ferma domani alle 3».
//
// PERCHE' UNA FASCIA QUI, quando AvvisiPopup dice che le fasce non si leggono.
// Quel ragionamento vale per gli avvisi in generale, e resta vero. Qui pero'
// c'e' una cosa che la finestra non puo' fare: la finestra della 071 arriva
// solo a chi ha un account, perche' la policy di lettura degli avvisi si ferma
// ad `authenticated`. Un fermo riguarda anche chi sta guardando un profilo
// senza essere registrato, e riguarda soprattutto chi sta per mandare una
// richiesta e non sa che fra un'ora non riceve risposta. Per quella persona la
// fascia e' l'unico canale che esiste, e la 073 e' fatta apposta perche' la
// finestra sia leggibile anche da anonimi.
//
// Le due cose non si pestano i piedi: la finestra dice la stessa cosa una
// volta sola e con piu' forza a chi ha un account, la fascia resta li' per
// tutti gli altri. Si chiude, e chiusa resta per quella manutenzione.
//
// LA SECONDA FASCIA E' PER NOI. Quando il fermo e' in corso, lo staff e'
// l'unico che entra: senza un cartello, si lavora per dieci minuti dentro un
// sito che per tutti gli altri e' chiuso senza accorgersene.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PowerOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ContoAllaRovescia } from "@/components/ContoAllaRovescia";
import {
  fermoAdesso,
  leggiManutenzioni,
  prossimoFermo,
  quandoLeggibile,
  type Manutenzione,
} from "@/lib/manutenzione";

const CHIAVE = "bob:manutenzione-chiusa";

export function ManutenzioneBanner() {
  const supabase = createClient();
  const { role } = useAuth();
  const [righe, setRighe] = useState<Manutenzione[]>([]);
  const [chiusa, setChiusa] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await leggiManutenzioni(supabase);
      if (vivo) setRighe(r);
    })();
    try {
      setChiusa(window.localStorage.getItem(CHIAVE));
    } catch {
      // Modalita' privata, cookie bloccati: la fascia resta, e va benissimo.
    }
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staff = role === "admin" || role === "cs";
  const adesso = fermoAdesso(righe);

  // Sito fermo e io sto navigando: vuol dire che sono staff. Vale sempre la
  // pena dirlo, e questa non si chiude.
  if (adesso && staff) {
    return (
      <div
        className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white"
        data-testid="banner-fermo-staff"
      >
        <PowerOff className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
        Bob è fermo per tutti tranne lo staff. Riapre{" "}
        <ContoAllaRovescia fine={adesso.fine_il} />.{" "}
        <Link href="/admin/manutenzione" className="underline">
          Gestisci
        </Link>
      </div>
    );
  }

  const prossimo = prossimoFermo(righe);
  if (!prossimo || chiusa === prossimo.id) return null;

  function chiudi() {
    if (!prossimo) return;
    setChiusa(prossimo.id);
    try {
      window.localStorage.setItem(CHIAVE, prossimo.id);
    } catch {
      // Se non si puo' ricordare, si ripresenta: fastidioso, non rotto.
    }
  }

  return (
    <div
      className="flex items-start gap-2 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
      data-testid="banner-preavviso"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">
          Bob si ferma {quandoLeggibile(prossimo.inizio_il)}
        </strong>{" "}
        e torna {quandoLeggibile(prossimo.fine_il)}. {prossimo.motivo}
      </p>
      <button
        type="button"
        onClick={chiudi}
        aria-label="Chiudi l'avviso"
        className="shrink-0 rounded-lg p-1 text-amber-900/60 transition hover:bg-amber-900/10 hover:text-amber-900"
        data-testid="banner-preavviso-chiudi"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
