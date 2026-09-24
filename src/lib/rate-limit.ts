// Limite di frequenza per /api/bob/chat e /api/bob/brief (Fase 5, P1.5,
// migrazione 097). Due meccanismi distinti — vedi il commento in testa
// alla migrazione per il perché di ciascuno:
//
// 1. checkActorRateLimit — per attore (IP anonimo o utente loggato):
//    troppe richieste dallo stesso chiamante → 429.
// 2. checkGlobalDailyCap — aggregato su tutta /api/bob/chat: rotto il
//    tetto, non c'è nessun errore per il cliente. Il chiamante (route.ts)
//    smette di interrogare Claude e passa a ruleBasedDecision — la spesa
//    si ferma, l'app continua a rispondere, e i log "[bob/chat] ...
//    fallback a regole" già esistenti raccontano cos'è successo.
//
// FALLISCE CHIUSO SU ENTRAMBI, per motivi diversi (vedi migrazione 097):
// checkActorRateLimit chiuso = 429 (blocca quel chiamante);
// checkGlobalDailyCap chiuso = tratta come "tetto raggiunto" = degrada a
// regole (non blocca mai il cliente, smette solo di spendere). In
// entrambi i casi: un controllo di sicurezza che fallisce aperto in
// silenzio è l'errore peggiore, non quello più sicuro.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Route = "chat" | "brief";

interface ActorLimits {
  perMinute: number;
  perHour: number;
}

// NUMERI, RAGIONATI NON TONDI (vedi PR): un cliente vero ha 6-10 turni per
// conversazione e ogni turno richiede prima di leggere la risposta di Bob —
// nessun utente reale batte di molto quel ritmo.
//
// chat: 10/min copre anche chi digita messaggi di prova a raffica senza
// aspettare; 60/ora è ~1.5-2x una sessione intensa (3-4 conversazioni
// riavviate nella stessa ora), limita comunque uno script lento-e-costante
// a un costo per IP che resta limitato e prevedibile.
//
// brief: nessuna chiamata a Claude, solo un insert — il rischio è
// l'inondazione di scrittura, non la spesa. Tetti più larghi apposta.
//
// loggato = 2x anonimo: un account è responsabile (tracciabile,
// sospendibile, vincolato ai ToS) in un modo che un IP non è mai — ma
// loggarsi non prova buona fede, quindi 2x, non illimitato: la rotta
// costa comunque per ogni chiamata, chiunque chiami.
export const ACTOR_LIMITS: Record<Route, { anonymous: ActorLimits; authenticated: ActorLimits }> = {
  chat: {
    anonymous: { perMinute: 10, perHour: 60 },
    authenticated: { perMinute: 20, perHour: 120 },
  },
  brief: {
    anonymous: { perMinute: 30, perHour: 200 },
    authenticated: { perMinute: 60, perHour: 400 },
  },
};

// Tetto aggregato giornaliero, solo /api/bob/chat (spec §6.3: "il conto lo
// paga Bob"). Ragionato dal costo reale, non da un numero tondo: Haiku 4.5
// costa $1/$5 per milione di token input/output (Console Anthropic,
// verificato prima di proporre questo numero, non a memoria). Un turno di
// /api/bob/chat porta il catalogo intero nel system prompt + lo schema del
// tool + la cronologia: stima prudente 1500-3000 token di input, output
// tipico ben sotto il tetto di 1000 — circa $0.005-0.01 a chiamata.
//
// Questo è un pilota pre-lancio (gennaio 2027): il traffico legittimo di
// oggi sono i fondatori e qualche prova, non centinaia di clienti veri. Un
// singolo IP già al proprio tetto orario per 24 ore continue farebbe da
// solo 1440 chiamate — il tetto globale deve reggere anche quel caso, non
// solo "molti IP distribuiti" (l'esempio che l'ha reso necessario). 2000
// richieste/giorno: ~2-6x una giornata di prova intensa (anche 100
// conversazioni reali da 8 turni sono 800), tiene fuori un solo IP
// esaurito e la maggior parte di un attacco distribuito, e a quel volume
// costa comunque 10-20$ nel caso peggiore — una cifra che si nota, non un
// buco. DA RIVEDERE quando ci sono dati di traffico reali: è una stima
// prudente per la fase attuale, non un numero definitivo.
export const GLOBAL_DAILY_CAP_CHAT = 2000;

// Tetto al payload: la conversazione porta al più una foto (l'ultimo
// messaggio soltanto — toAnthropicMessages in bob.ts), già ridotta lato
// client a 1280px JPEG qualità 0.85 (BobChat.tsx, handlePhotoFile): circa
// 150-400KB grezzi, 200-550KB in base64. 2MB lascia ampio margine per una
// foto vera + una cronologia lunga, e respinge fermamente chi imbottisce
// il corpo con più immagini o con padding sintetico.
//
// brief non porta mai binario: solo JSON strutturato coi percorsi delle
// foto (il binario è già su brief-photos), quindi il tetto resta stretto.
export const MAX_BODY_BYTES: Record<Route, number> = {
  chat: 2 * 1024 * 1024,
  brief: 64 * 1024,
};

// Timeout stretto sul controllo stesso: se Postgres è lento SOLO su questa
// tabella (non sull'intero progetto, altrimenti la rotta è già rotta per
// altri motivi — vedi migrazione 097), la richiesta degrada in fretta a un
// 429/rules invece di restare appesa per la durata piena della chiamata a
// Claude.
const CHECK_TIMEOUT_MS = 500;

/**
 * L'IP del chiamante da x-forwarded-for (Vercel lo imposta al bordo della
 * sua rete; non è un header che un client puo' falsificare superando
 * l'edge Vercel). Il primo valore della lista è il client originale, i
 * successivi sono i proxy che la richiesta ha attraversato.
 */
export function extractClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

/**
 * Legge il corpo della richiesta con un tetto in byte, senza fidarsi solo
 * di Content-Length (assente o falso su una richiesta chunked). Interrompe
 * la lettura appena il tetto è superato, invece di bufferizzare l'intero
 * payload per poi scartarlo.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    return { ok: false };
  }

  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

export interface ActorRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Limite per attore (IP o utente). Chiude su errore o timeout: allowed:false,
 * un retry-after prudente di 60s. Vedi il commento in testa al file per il
 * perché "chiuso" è la scelta giusta qui.
 */
export async function checkActorRateLimit(
  admin: SupabaseClient,
  key: string,
  route: Route,
  limits: ActorLimits
): Promise<ActorRateLimitResult> {
  const result = await withTimeout(
    admin.rpc("check_rate_limit", {
      p_key: key,
      p_route: route,
      p_minute_limit: limits.perMinute,
      p_hour_limit: limits.perHour,
    }),
    CHECK_TIMEOUT_MS
  );

  if (!result || result.error || !result.data || !result.data[0]) {
    if (result?.error) {
      console.error(
        `[rate-limit] check_rate_limit fallito per ${route}, chiudo (nego):`,
        result.error
      );
    } else {
      console.error(
        `[rate-limit] check_rate_limit senza risposta entro ${CHECK_TIMEOUT_MS}ms per ${route}, chiudo (nego).`
      );
    }
    return { allowed: false, retryAfterSeconds: 60 };
  }

  const row = result.data[0] as {
    allowed: boolean;
    retry_after_seconds: number;
  };
  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(1, row.retry_after_seconds),
  };
}

/**
 * Tetto globale giornaliero su una rotta. Chiude su errore o timeout
 * trattandolo come "tetto raggiunto" (false): mai un errore per il
 * cliente, solo la spesa che si ferma per prudenza quando il controllo
 * stesso non si può fidare.
 */
export async function checkGlobalDailyCap(
  admin: SupabaseClient,
  route: Route,
  dailyLimit: number
): Promise<boolean> {
  const result = await withTimeout(
    admin.rpc("check_global_daily_cap", {
      p_route: route,
      p_daily_limit: dailyLimit,
    }),
    CHECK_TIMEOUT_MS
  );

  if (!result || result.error || typeof result.data !== "boolean") {
    if (result?.error) {
      console.error(
        `[rate-limit] check_global_daily_cap fallito per ${route}, tratto come tetto raggiunto:`,
        result.error
      );
    } else {
      console.error(
        `[rate-limit] check_global_daily_cap senza risposta entro ${CHECK_TIMEOUT_MS}ms per ${route}, tratto come tetto raggiunto.`
      );
    }
    return false;
  }

  return result.data;
}
