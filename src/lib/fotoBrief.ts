// DI CHI E' UNA FOTO DELLA CHAT (17/10, FOTO1 — roadmap/findings.csv, serious).
//
// Fino al 16/10 /api/bob/brief salvava photos come arrivava dal browser, e
// l'export art. 15/20 e /api/pro/request-summary leggevano quei percorsi col
// service role: bastava mettere nel proprio brief il percorso della foto di un
// altro per farsela consegnare. Il percorso difficile da indovinare non e' una
// protezione: trapela (log, schermate, un URL firmato inoltrato).
//
// DUE STRATI
// 1. All'ingresso. /api/bob/chat, quando scrive una foto nel bucket, la
//    restituisce con un'attestazione: HMAC del percorso e di chi chiama
//    (l'id utente, o "anonimo"), con un segreto che solo il server conosce
//    (BRIEF_PHOTOS_SECRET). /api/bob/brief tiene solo le foto la cui
//    attestazione vale per CHI sta salvando: chi non ha caricato la foto non
//    puo' produrla. Cookie e Bearer danno lo stesso id (chiamante()), quindi
//    la regola e' una sola per sito e app.
// 2. All'uscita, per i brief salvati prima di oggi (senza attestazione).
//    Un percorso si consegna solo se nessun brief di un ALTRO lo citava gia'
//    prima di quello da cui lo si legge: il primo che l'ha citato e' chi l'ha
//    caricato. Un brief anonimo conta come "un altro": non si sa di chi sia,
//    e nel dubbio la foto non esce (la stessa scelta di fileUtente.ts).
//
// Lo strato 2 sta in fileUtente.ts (fotoConsegnabile), accanto al controllo
// gemello del cron: export-dati.ts finisce anche in un componente client, e
// node:crypto li' non entra.
//
// Senza segreto non si attesta niente, e il brief non salva foto: chiude, non
// apre. Si logga, perche' sia visibile.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { BriefPhoto } from "@/lib/bob";
import { percorsoChatValido } from "@/lib/fileUtente";

const VERSIONE = "foto1.v1";

function segreto(): string | null {
  const s = process.env.BRIEF_PHOTOS_SECRET;
  if (!s) {
    console.error("[fotoBrief] BRIEF_PHOTOS_SECRET assente: nessuna foto della chat entra in un brief.");
    return null;
  }
  return s;
}

function firma(s: string, percorso: string, userId: string | null): string {
  return createHmac("sha256", s)
    .update(`${VERSIONE}\n${percorso}\n${userId ?? "anonimo"}`)
    .digest("base64url");
}

/** L'attestazione di /api/bob/chat per una foto appena scritta; null senza segreto. */
export function attestaFoto(percorso: string, userId: string | null): string | null {
  const s = segreto();
  return s ? firma(s, percorso, userId) : null;
}

/** L'attestazione vale per questo percorso E per questo chiamante. */
export function attestazioneValida(percorso: string, userId: string | null, attestazione: unknown): boolean {
  const s = segreto();
  if (!s || typeof attestazione !== "string") return false;
  const attesa = Buffer.from(firma(s, percorso, userId));
  const data = Buffer.from(attestazione);
  return data.length === attesa.length && timingSafeEqual(data, attesa);
}

/**
 * Le foto che /api/bob/brief puo' salvare: percorsi di chat attestati per chi
 * salva. L'attestazione non si conserva: serve solo a entrare.
 */
export function fotoAttestate(photos: unknown, userId: string | null): BriefPhoto[] {
  if (!Array.isArray(photos)) return [];
  const tenute: BriefPhoto[] = [];
  for (const f of photos) {
    const p = (f as { storagePath?: unknown })?.storagePath;
    if (!percorsoChatValido(p)) continue;
    if (!attestazioneValida(p, userId, (f as { attestazione?: unknown }).attestazione)) continue;
    const c = (f as { aiCaption?: unknown }).aiCaption;
    tenute.push({ storagePath: p, aiCaption: typeof c === "string" ? c : null });
  }
  return tenute;
}
