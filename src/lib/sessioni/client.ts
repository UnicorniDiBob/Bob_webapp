"use client";

// Il lato browser delle sessioni multiple.
//
// UN ACCOUNT ATTIVO PER BROWSER, NON PER SCHEDA (decisione 1 di Lucio). Lo
// scambio lo fa il server (/api/sessioni/scambia); qui si fa quello che il
// server non puo' fare:
//   - fermare il rinnovo automatico prima dello scambio, cosi' il refresh token
//     di A non ruota mentre va in attesa (lo fanno anche le altre schede, al
//     segnale «inizio»);
//   - finito lo scambio, RICARICARE TUTTO: canali realtime, stato di
//     AuthProvider, cache del router. Nessuna pulizia pezzo per pezzo, che
//     prima o poi dimentica qualcosa;
//   - avvisare le ALTRE schede, che se no resterebbero su A con un token ancora
//     valido mentre si crede di essere su B. BroadcastChannel, e l'evento
//     «storage» come riserva dove BroadcastChannel non c'e'.

import type { SupabaseClient } from "@supabase/supabase-js";

export const CANALE_SESSIONI = "bob-sessioni";
/** Riserva per l'avviso fra schede: l'evento «storage» di un'altra scheda. */
export const CHIAVE_SEGNALE = "bob:sessioni:segnale";

export type Segnale = "inizio" | "fatto" | "annullato";

export function interpretaSegnale(dato: unknown): Segnale | null {
  const s =
    typeof dato === "string"
      ? (() => {
          try {
            return (JSON.parse(dato) as { s?: unknown }).s;
          } catch {
            return dato;
          }
        })()
      : (dato as { s?: unknown } | null)?.s;
  return s === "inizio" || s === "fatto" || s === "annullato" ? s : null;
}

export function annuncia(s: Segnale): void {
  try {
    const c = new BroadcastChannel(CANALE_SESSIONI);
    c.postMessage({ s });
    c.close();
  } catch {
    // BroadcastChannel assente: resta la riserva qui sotto.
  }
  try {
    window.localStorage.setItem(CHIAVE_SEGNALE, JSON.stringify({ s, t: Date.now() }));
  } catch {
    // localStorage non disponibile (navigazione privata rigida): pazienza,
    // il controllo al ritorno della scheda in AuthProvider resta.
  }
}

/** Ascolta i segnali delle altre schede. Restituisce la funzione per smettere. */
export function ascoltaSegnali(onSegnale: (s: Segnale) => void): () => void {
  let canale: BroadcastChannel | null = null;
  try {
    canale = new BroadcastChannel(CANALE_SESSIONI);
    canale.onmessage = (e) => {
      const s = interpretaSegnale(e.data);
      if (s) onSegnale(s);
    };
  } catch {
    canale = null;
  }
  const suStorage = (e: StorageEvent) => {
    if (e.key !== CHIAVE_SEGNALE || !e.newValue) return;
    const s = interpretaSegnale(e.newValue);
    if (s) onSegnale(s);
  };
  window.addEventListener("storage", suStorage);
  return () => {
    canale?.close();
    window.removeEventListener("storage", suStorage);
  };
}

export interface StatoSessioni {
  attivo: { email: string } | null;
  attesa: { email: string; daRiconnettere: boolean } | null;
}

export async function leggiStatoSessioni(): Promise<StatoSessioni | null> {
  try {
    const r = await fetch("/api/sessioni/stato", { cache: "no-store" });
    return r.ok ? ((await r.json()) as StatoSessioni) : null;
  } catch {
    return null;
  }
}

function ricarica(verso?: string) {
  window.location.replace(verso ?? window.location.pathname + window.location.search);
}

/** Passa all'account in attesa. Se non si puo', l'attivo resta com'era. */
export async function scambiaAccount(
  supabase: SupabaseClient
): Promise<{ ok: true } | { ok: false; motivo: string; email?: string }> {
  supabase.auth.stopAutoRefresh();
  annuncia("inizio");
  let r: Response;
  try {
    r = await fetch("/api/sessioni/scambia", { method: "POST" });
  } catch {
    annuncia("annullato");
    supabase.auth.startAutoRefresh();
    return { ok: false, motivo: "rete" };
  }
  if (r.ok) {
    annuncia("fatto");
    ricarica();
    return { ok: true };
  }
  annuncia("annullato");
  supabase.auth.startAutoRefresh();
  const corpo = (await r.json().catch(() => ({}))) as { motivo?: string; email?: string };
  return { ok: false, motivo: corpo.motivo ?? "errore", email: corpo.email };
}

/**
 * «Esci da questo» (l'altro account diventa attivo) o «esci da tutti», sempre
 * solo in questo browser. Finisce ricaricando: su «tutti», o se non resta
 * nessun account attivo, verso la home.
 */
export async function esciAccount(supabase: SupabaseClient, quale: "questo" | "tutti"): Promise<boolean> {
  supabase.auth.stopAutoRefresh();
  annuncia("inizio");
  let attivoDopo: unknown = null;
  let ok = false;
  try {
    const r = await fetch("/api/sessioni/esci", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quale }),
    });
    ok = r.ok;
    attivoDopo = ((await r.json().catch(() => ({}))) as { attivo?: unknown }).attivo ?? null;
  } catch {
    ok = false;
  }
  if (!ok) {
    annuncia("annullato");
    supabase.auth.startAutoRefresh();
    return false;
  }
  annuncia("fatto");
  ricarica(quale === "tutti" || !attivoDopo ? "/" : undefined);
  return true;
}
