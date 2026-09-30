// IL TETTO DI TENTATIVI SU «AGGIUNGI ACCOUNT» (29/09, migrazione 104).
//
// Per IP e per email, sulla rotta «accesso» di rate_limit_counters (097).
// L'email NON entra in chiaro e NON come hash nudo: uno SHA-256 di un indirizzo
// si inverte provando indirizzi, e la tabella diventerebbe l'elenco di chi ha
// provato a entrare su Bob. Entra come HMAC-SHA256 con una chiave segreta
// d'ambiente (ACCESSO_HMAC_SEGRETO, su Vercel): senza la chiave non si risale.
// Senza la chiave configurata, la route RIFIUTA (503) invece di ripiegare su
// un hash nudo.

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ROTTA_ACCESSO = "accesso";

/** I tetti: per email piu' stretti che per IP (un IP puo' essere condiviso). */
export const LIMITI_ACCESSO = {
  ip: { perMinuto: 10, perOra: 30 },
  email: { perMinuto: 5, perOra: 10 },
} as const;

/** Almeno 32 caratteri: una chiave corta si indovina, e con lei gli indirizzi. */
export function segretoValido(s: string | undefined): s is string {
  return typeof s === "string" && s.length >= 32;
}

export function normalizzaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** La chiave del contatore per un'email: «email:<HMAC-SHA256 esadecimale>». */
export function chiaveEmail(email: string, segreto: string): string {
  return `email:${createHmac("sha256", segreto).update(normalizzaEmail(email)).digest("hex")}`;
}

export function chiaveIp(ip: string): string {
  return `ip:${ip}`;
}

/**
 * Un tentativo contato e ammesso? Chiude su errore o timeout (nega), come il
 * limite della 097: un tetto che si apre quando il database non risponde non
 * e' un tetto.
 */
export async function tentativoAmmesso(
  admin: SupabaseClient,
  chiave: string,
  limiti: { perMinuto: number; perOra: number }
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .rpc("check_rate_limit", {
        p_key: chiave,
        p_route: ROTTA_ACCESSO,
        p_minute_limit: limiti.perMinuto,
        p_hour_limit: limiti.perOra,
      })
      .abortSignal(AbortSignal.timeout(2000));
    if (error || !Array.isArray(data) || !data[0]) {
      console.error(`[sessioni/aggiungi] tetto non verificabile (${error?.code ?? "nessuna risposta"}): nego`);
      return false;
    }
    return (data[0] as { allowed?: boolean }).allowed === true;
  } catch {
    console.error("[sessioni/aggiungi] tetto non verificabile (timeout): nego");
    return false;
  }
}
