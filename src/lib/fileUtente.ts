// I FILE DI UN ACCOUNT, DA TOGLIERE PRIMA DI CANCELLARLO (16/10, cron-cancella-foto).
//
// La cancellazione di auth.users porta via le righe a cascata, non i file:
// lo storage non conosce le chiavi esterne. Fino a oggi il cron svuotava solo
// verifica-documenti/<user_id>/; portfolio (PUBBLICO) e brief-photos
// restavano per sempre (ROPA A28, roadmap/findings.csv del 16/10).
//
// COSA TOGLIE
// - verifica-documenti/<user_id>/, portfolio/<user_id>/, brief-photos/<user_id>/:
//   le cartelle dove scrive /api/upload/immagine. Tutte le pagine, non le
//   prime 100 (il limite di default di storage.list, che il cron di prima non
//   superava).
// - brief-photos/chat/...: le foto della chat. Non stanno in una cartella per
//   utente: si ritrovano solo dai job_briefs del cliente. Vanno lette PRIMA di
//   deleteUser, perche' job_briefs.user_id e' ON DELETE SET NULL: dopo, la riga
//   resta anonima e non dice piu' di chi era. Tolti i file, photos di quelle
//   righe si azzera, cosi' una riga che sopravvive non punta a niente.
//
// UNA PROTEZIONE, PERCHE' I PERCORSI DEI BRIEF LI SCRIVE IL CLIENT
// /api/bob/brief salva photos come arriva dal browser. Un percorso preso dai
// brief si cancella solo se NESSUN altro job_briefs (di un altro utente o
// anonimo) lo cita: altrimenti chiudere il proprio account potrebbe cancellare
// la foto di qualcun altro. Un percorso fuori da chat/ o con ".." non si tocca.
//
// Non lancia: restituisce cosa ha tolto e cosa non e' riuscito. Il cron decide
// (oggi: un file orfano nelle cartelle dell'utente non ferma una cancellazione
// dovuta, e si conta; le foto della chat si', vedi fotoChatFallite).

import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_PER_UTENTE = ["verifica-documenti", "portfolio", "brief-photos"] as const;
const PAGINA = 1000;
const LOTTO_REMOVE = 100;

export interface EsitoFileUtente {
  rimossi: Record<string, number>;
  /** Percorsi di brief tenuti perche' citati anche da un altro brief. */
  tenuti: number;
  errori: string[];
  /**
   * Le foto della chat non sono state tolte (lettura dei brief, controllo o
   * remove falliti): i brief citano ancora i loro percorsi e sono l'UNICO
   * modo di ritrovarle. Il cron allora non tocca i brief e rimanda l'account
   * alla notte dopo (17/10): una cartella <user_id>/ si ritrova sempre, una
   * foto di chat senza il suo brief non piu'.
   */
  fotoChatFallite: boolean;
}

async function elencaCartella(admin: SupabaseClient, bucket: string, cartella: string): Promise<string[]> {
  const percorsi: string[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await admin.storage.from(bucket).list(cartella, { limit: PAGINA, offset });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    // Le voci senza id sono sottocartelle, non file: qui non ce ne sono, e se
    // ci fossero non si cancellano alla cieca.
    for (const f of data ?? []) if (f.id) percorsi.push(`${cartella}/${f.name}`);
    if (!data || data.length < PAGINA) return percorsi;
  }
}

async function rimuovi(admin: SupabaseClient, bucket: string, percorsi: string[]): Promise<number> {
  let tolti = 0;
  for (let i = 0; i < percorsi.length; i += LOTTO_REMOVE) {
    const { data, error } = await admin.storage.from(bucket).remove(percorsi.slice(i, i + LOTTO_REMOVE));
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
    tolti += data?.length ?? 0;
  }
  return tolti;
}

/** Un percorso di chat scritto da /api/bob/chat: chat/<qualcosa>, senza salti di cartella. */
export function percorsoChatValido(p: unknown): p is string {
  return typeof p === "string" && /^chat\/[^/]+$/.test(p) && !p.includes("..");
}

/**
 * Si puo' consegnare a `proprietario` questo percorso, letto dal brief
 * `brief`? No se e' fuori da chat/, o se un brief di un altro (o anonimo),
 * diverso da questo, lo citava gia' prima. Un errore della query nega.
 */
// FOTO1 (17/10), lo strato 2 di src/lib/fotoBrief.ts: per l'export e per
// /api/pro/request-summary, che leggono i brief col service role.
export async function fotoConsegnabile(
  admin: SupabaseClient,
  brief: { id: string; created_at: string },
  proprietario: string,
  percorso: unknown
): Promise<boolean> {
  if (!percorsoChatValido(percorso)) return false;
  const { count, error } = await admin
    .from("job_briefs")
    .select("id", { count: "exact", head: true })
    // Il JSON come testo: .contains() con un array JS su jsonb fallisce
    // (trovato dal vivo il 16/10, vedi sotto).
    .filter("photos", "cs", JSON.stringify([{ storagePath: percorso }]))
    .neq("id", brief.id)
    .lte("created_at", brief.created_at)
    .or(`user_id.is.null,user_id.neq.${proprietario}`);
  if (error) {
    console.error("[fileUtente] controllo dei brief altrui fallito, la foto non esce:", error.message);
    return false;
  }
  return (count ?? 0) === 0;
}

export async function svuotaFileUtente(admin: SupabaseClient, userId: string): Promise<EsitoFileUtente> {
  const esito: EsitoFileUtente = { rimossi: {}, tenuti: 0, errori: [], fotoChatFallite: false };

  for (const bucket of BUCKET_PER_UTENTE) {
    try {
      esito.rimossi[bucket] = await rimuovi(admin, bucket, await elencaCartella(admin, bucket, userId));
    } catch (e) {
      esito.errori.push(e instanceof Error ? e.message : `${bucket}: errore`);
    }
  }

  // Le foto della chat, dai brief del cliente.
  try {
    const { data: brief, error } = await admin.from("job_briefs").select("id, photos").eq("user_id", userId);
    if (error) throw new Error(`job_briefs: ${error.message}`);
    const candidati = new Set<string>();
    for (const b of brief ?? []) {
      for (const f of Array.isArray(b.photos) ? b.photos : []) {
        const p = (f as { storagePath?: unknown })?.storagePath;
        if (percorsoChatValido(p)) candidati.add(p);
      }
    }
    const daTogliere: string[] = [];
    for (const p of Array.from(candidati)) {
      const { count, error: e2 } = await admin
        .from("job_briefs")
        .select("id", { count: "exact", head: true })
        // .contains() con un array JS manda un array letterale di Postgres
        // ({...}), non JSON: su una colonna jsonb la query fallisce. Trovato
        // dal vivo il 16/10. Il filtro cs vuole il JSON come testo.
        .filter("photos", "cs", JSON.stringify([{ storagePath: p }]))
        .or(`user_id.is.null,user_id.neq.${userId}`);
      if (e2) throw new Error(`job_briefs (controllo): ${e2.message}`);
      if ((count ?? 0) > 0) esito.tenuti++;
      else daTogliere.push(p);
    }
    const tolti = await rimuovi(admin, "brief-photos", daTogliere);
    esito.rimossi["brief-photos"] = (esito.rimossi["brief-photos"] ?? 0) + tolti;
    if ((brief ?? []).length > 0) {
      const { error: e3 } = await admin.from("job_briefs").update({ photos: [] }).eq("user_id", userId);
      if (e3) throw new Error(`job_briefs (azzero photos): ${e3.message}`);
    }
  } catch (e) {
    esito.errori.push(e instanceof Error ? e.message : "brief: errore");
    esito.fotoChatFallite = true;
  }

  return esito;
}
