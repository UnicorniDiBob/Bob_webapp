// I tre piani, in un posto solo.
//
// PERCHE' QUI E NON NELLA PAGINA
// L'elenco viveva dentro /onboarding/piano. Da quando esiste anche
// /dashboard/piano, che deve dire a un professionista cosa ha comprato, due
// copie della stessa lista sono due liste che divergono: la prima volta che si
// aggiunge una funzione a Bob Pro, una delle due resta indietro e il pro legge
// due verita' diverse sullo stesso abbonamento.
//
// ONESTA' DEL LISTINO (23.1): qui si elencano SOLO funzioni che esistono nel
// prodotto oggi. Il listino commerciale completo sta su /per-i-professionisti
// e va riallineato prima di Stripe (12.4, P4.7): quello promette la Garanzia
// Bob e una fee che non esistono ancora, questo no.

import type { SubscriptionTier } from "@/lib/supabase/types";

export interface Piano {
  id: SubscriptionTier;
  nome: string;
  prezzo: string;
  nota: string | null;
  punti: string[];
}

export const PIANI: Piano[] = [
  {
    id: "free",
    nome: "Free",
    prezzo: "€0",
    nota: "per sempre",
    punti: [
      "Profilo pubblico su BOB",
      "Ricevi richieste e messaggi dai clienti",
      "Calendario e appuntamenti",
    ],
  },
  {
    id: "pro",
    nome: "Bob Pro",
    prezzo: "€24",
    nota: "al mese — €19 con fatturazione annuale",
    punti: [
      "Tutto di Free",
      "Verifica della partita IVA e badge sul profilo",
      "Caricamento documenti per il livello Pro+",
      "1 foto portfolio sul profilo",
      "Prenotazione diretta sui lavori a tariffa fissa",
    ],
  },
  {
    id: "business",
    nome: "Bob Business",
    prezzo: "€59",
    nota: "al mese — €49 con fatturazione annuale",
    punti: ["Tutto di Bob Pro", "Foto portfolio illimitate"],
  },
];

export function pianoById(id: SubscriptionTier): Piano {
  return PIANI.find((p) => p.id === id) ?? PIANI[0];
}
