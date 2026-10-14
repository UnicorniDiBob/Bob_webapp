// LA PAGINA DI UNA RICHIESTA, LATO CLIENTE: LE REGOLE SENZA REACT (17/10).
//
// Tre decisioni che la pagina prende per ogni richiesta e che conviene poter
// provare da sole: quale prezzo di un pro vale per QUESTA richiesta, cosa
// mostra «Com'è andata?», e qual e' l'ultimo messaggio di ogni chat.

import { recensibile } from "@/lib/daFareCliente";

export interface RigaPrezzo {
  service_id: string | null;
  subservice_id: string | null;
  min_price: number | null;
  max_price: number | null;
  price_note: string | null;
  /** Lo slug legacy rimasto accanto al canonico (090): non e' un'offerta. */
  subservices?: { superseded_by: string | null } | null;
}

export interface PrezzoRichiesta {
  min: number | null;
  max: number | null;
  nota: string | null;
}

// IL PREZZO DI QUESTO LAVORO, NON DEL MESTIERE (17/10). Un pro dichiara un
// prezzo per intervento (070). Se la richiesta ha un intervento e il pro lo
// ha prezzato, vale quella riga: e' la risposta esatta. Altrimenti vale la
// fascia delle righe dello stesso servizio, letta come la legge la scheda
// pubblica (data.ts, toCard): il minimo piu' basso e il massimo piu' alto.
// Senza nessun prezzo: null, e la pagina dice «Prezzo da concordare».
export function prezzoPerRichiesta(
  righe: RigaPrezzo[],
  serviceId: string | null,
  subserviceId: string | null
): PrezzoRichiesta | null {
  const vive = righe.filter((r) => !r.subservices?.superseded_by);
  const conPrezzo = (r: RigaPrezzo) => r.min_price !== null || r.max_price !== null;

  if (subserviceId) {
    const esatta = vive.find(
      (r) => r.subservice_id === subserviceId && r.service_id === serviceId && conPrezzo(r)
    );
    if (esatta) {
      return { min: esatta.min_price, max: esatta.max_price, nota: esatta.price_note };
    }
  }

  const delServizio = vive.filter((r) => serviceId !== null && r.service_id === serviceId);
  const minimi = delServizio.map((r) => r.min_price).filter((n): n is number => n !== null);
  const massimi = delServizio.map((r) => r.max_price).filter((n): n is number => n !== null);
  if (minimi.length === 0 && massimi.length === 0) return null;
  return {
    min: minimi.length > 0 ? Math.min(...minimi) : null,
    max: massimi.length > 0 ? Math.max(...massimi) : null,
    nota: delServizio.find((r) => r.price_note)?.price_note ?? null,
  };
}

const euro = (n: number) => `${Number(n).toLocaleString("it-IT")} €`;

/** «da 20 €», «20–28 €», «fino a 40 €», «30 €». */
export function testoPrezzo(p: PrezzoRichiesta): string {
  if (p.min !== null && p.max !== null) {
    return p.min === p.max
      ? euro(p.min)
      : `${Number(p.min).toLocaleString("it-IT")}–${euro(p.max)}`;
  }
  if (p.min !== null) return `da ${euro(p.min)}`;
  return `fino a ${euro(p.max as number)}`;
}

// «COM'È ANDATA?» MOSTRA UNA COSA SOLA (17/10):
//   - richiesta aperta con almeno un pro: «Il lavoro è concluso?»;
//   - chiusa, recensibile, con pro ancora da recensire: il modulo;
//   - chiusa e tutto recensito: il grazie, con le stelle date;
//   - disdetta (113) o senza pro: niente, non c'e' un lavoro da giudicare.
export type ComEAndata = "chiudi" | "recensisci" | "grazie" | null;

export function cosaMostraComEAndata(r: {
  status: string;
  closed_reason: string | null;
  proIds: string[];
  recensiti: Set<string>;
}): ComEAndata {
  if (!recensibile(r) || r.proIds.length === 0) return null;
  if (r.status !== "closed") return "chiudi";
  return r.proIds.some((id) => !r.recensiti.has(id)) ? "recensisci" : "grazie";
}

export interface MessaggioChat {
  professional_id: string | null;
  sender_type: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface RiassuntoChat {
  ultimo: MessaggioChat | null;
  /** Messaggi del pro che il cliente non ha ancora letto. */
  nonLetti: number;
}

/** Per ogni pro: l'ultimo messaggio della chat e quanti non letti. */
export function riassuntoChat(messaggi: MessaggioChat[]): Map<string, RiassuntoChat> {
  const out = new Map<string, RiassuntoChat>();
  for (const m of messaggi) {
    if (!m.professional_id) continue;
    const r = out.get(m.professional_id) ?? { ultimo: null, nonLetti: 0 };
    if (!r.ultimo || new Date(m.created_at) > new Date(r.ultimo.created_at)) r.ultimo = m;
    if (m.sender_type === "professional" && m.read_at === null) r.nonLetti += 1;
    out.set(m.professional_id, r);
  }
  return out;
}

/** Un id di richiesta e' un uuid: altrimenti la query fallirebbe invece di non trovare. */
export function sembraUnId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Il codice breve da dire all'assistenza: le prime 8 cifre, maiuscole. */
export function codiceBreve(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
