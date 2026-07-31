// Client per l'API REST VIES della Commissione europea.
//
// Gratuita, pubblica, senza autenticazione né contratto:
//   GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/{vat}
//
// Va chiamata SOLO da server (route API), mai dal browser: così non esponiamo
// il traffico degli utenti verso terzi e controlliamo timeout e frequenza.
//
// Limite noto e importante: il VIES contiene le partite IVA abilitate alle
// operazioni intra-UE. Un esito negativo NON significa "partita IVA
// inesistente": può semplicemente non essere iscritta. Per questo il risultato
// distingue "confermata" da "non confermata", e la seconda apre un caso da
// esaminare, non un rifiuto.

import { normalizeVat } from "@/lib/vat";

/** Cosa salviamo dell'esito: solo i campi utili, non l'intera risposta. */
export interface ViesSnapshot {
  isValid: boolean;
  name: string | null;
  address: string | null;
  /** Timestamp dichiarato dal VIES: è la data del controllo che esponiamo. */
  requestDate: string | null;
}

export type ViesOutcome =
  /** Il VIES conferma: partita IVA valida e attiva per le operazioni UE. */
  | { status: "confirmed"; snapshot: ViesSnapshot }
  /** Il VIES risponde ma non conferma: da esaminare, NON un rifiuto. */
  | { status: "not_confirmed"; snapshot: ViesSnapshot }
  /** Servizio non raggiungibile o in errore: da ritentare più tardi. */
  | { status: "unavailable"; reason: string };

const ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const TIMEOUT_MS = 6000;

/**
 * Interroga il VIES per una partita IVA italiana.
 * Non lancia eccezioni: gli errori diventano status "unavailable", così la UI
 * non si rompe mai e la richiesta può essere ritentata.
 */
export async function checkVatOnVies(
  vatInput: string,
  countryCode = "IT"
): Promise<ViesOutcome> {
  const vat = normalizeVat(vatInput);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${ENDPOINT}/${countryCode}/vat/${vat}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Mai cache: un esito vecchio non ha valore probatorio.
      cache: "no-store",
    });

    if (!res.ok) {
      return { status: "unavailable", reason: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      isValid?: boolean;
      name?: string;
      address?: string;
      requestDate?: string;
      userError?: string;
    };

    const snapshot: ViesSnapshot = {
      isValid: data.isValid === true,
      // Il VIES usa "---" quando il dato non è disponibile.
      name: data.name && data.name !== "---" ? data.name.trim() : null,
      address:
        data.address && data.address !== "---"
          ? data.address.replace(/\s*\n\s*/g, ", ").trim()
          : null,
      requestDate: data.requestDate ?? null,
    };

    // Alcuni errori lato Stato membro arrivano con HTTP 200: sono guasti
    // temporanei, non risposte negative sul contribuente.
    const transient = ["MS_UNAVAILABLE", "MS_MAX_CONCURRENT_REQ", "TIMEOUT", "SERVICE_UNAVAILABLE"];
    if (data.userError && transient.includes(data.userError)) {
      return { status: "unavailable", reason: data.userError };
    }

    return snapshot.isValid
      ? { status: "confirmed", snapshot }
      : { status: "not_confirmed", snapshot };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
        ? err.message
        : "errore sconosciuto";
    return { status: "unavailable", reason };
  } finally {
    clearTimeout(timer);
  }
}
