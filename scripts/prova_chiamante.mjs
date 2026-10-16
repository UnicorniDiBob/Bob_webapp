// Prova dal vivo di src/lib/supabase/chiamante.ts: tre richieste vere a un
// server locale — cookie valido, Bearer valido, niente. Il Bearer scaduto e'
// in src/lib/supabase/chiamante.test.ts, con la risposta di Supabase finta.
//
//   npx next dev -p 3123
//   node scripts/prova_chiamante.mjs http://localhost:3123
//
// Il login lo fa lo script, con BOB_TEST_EMAIL e BOB_TEST_PASSWORD di
// .env.local (un account di PROVA, meglio un cliente: un pro con richieste
// farebbe partire il riassunto AI). Il token vive solo in memoria: non si
// stampa, non si scrive, non finisce in un messaggio d'errore. Si stampano
// solo i codici di stato. Alla fine revoca la sessione di prova.
//
// La rotta e' /api/pro/request-summary perche' lavora solo sotto RLS (gira
// anche senza service role) e non scrive niente: 401 = nessuno, 403 = un
// cliente riconosciuto, 200 = un pro riconosciuto.

import fs from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] ?? "http://localhost:3123";
const ROTTA = "/api/pro/request-summary";

function leggiEnv(file) {
  const env = {};
  for (const riga of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = leggiEnv(".env.local");
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = env.BOB_TEST_EMAIL;
const PASSWORD = env.BOB_TEST_PASSWORD;
if (!URL_SB || !ANON || !EMAIL || !PASSWORD) {
  console.error("Mancano in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, BOB_TEST_EMAIL, BOB_TEST_PASSWORD.");
  process.exit(2);
}

async function login() {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || !corpo.access_token) {
    throw new Error(`login rifiutato (${r.status}): ${corpo.error_description ?? corpo.msg ?? corpo.error ?? "?"}`);
  }
  return corpo;
}

// I cookie come li scrive il sito: @supabase/ssr in persona, non un formato
// ricostruito a mano.
async function cookieDelSito(sessione) {
  const barattolo = new Map();
  // Node 20 non ha WebSocket nativo e qui il realtime non serve: trasporto
  // finto, come in src/lib/supabase/punto-unico.test.ts.
  const sb = createServerClient(URL_SB, ANON, {
    realtime: { transport: class WsFinta {} },
    cookies: {
      getAll: () => [...barattolo].map(([name, value]) => ({ name, value })),
      setAll: (c) => c.forEach(({ name, value }) => barattolo.set(name, value)),
    },
  });
  const { error } = await sb.auth.setSession({
    access_token: sessione.access_token,
    refresh_token: sessione.refresh_token,
  });
  if (error) throw new Error(`setSession: ${error.message}`);
  return [...barattolo].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function prova(nome, headers) {
  const r = await fetch(`${BASE}${ROTTA}`, { headers });
  const corpo = await r.json().catch(() => null);
  const n = Array.isArray(corpo?.requests) ? corpo.requests.length : "?";
  console.log(`${nome.padEnd(16)} -> HTTP ${r.status}  (richieste nel corpo: ${n})`);
  return r.status;
}

async function revoca(sessione) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: sessione.refresh_token }),
  });
  const nuova = await r.json().catch(() => ({}));
  if (!nuova.access_token) return false;
  const out = await fetch(`${URL_SB}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${nuova.access_token}` },
  });
  return out.ok || out.status === 204;
}

async function main() {
  const sessione = await login();
  console.log(`login ok come ${EMAIL}`);

  const esiti = {};
  try {
    esiti.cookie = await prova("cookie valido", { cookie: await cookieDelSito(sessione) });
    esiti.bearer = await prova("bearer valido", { authorization: `Bearer ${sessione.access_token}` });
    esiti.niente = await prova("niente", {});
  } finally {
    const revocata = await revoca(sessione).catch(() => false);
    console.log(`sessione di prova revocata: ${revocata ? "si" : "NO, chiuderla a mano"}`);
  }

  const attesi = {
    cookie: (s) => s === 200 || s === 403,
    bearer: (s) => s === esiti.cookie,
    niente: (s) => s === 401,
  };
  const falliti = Object.keys(attesi).filter((k) => !attesi[k](esiti[k]));
  console.log(falliti.length ? `FALLITO: ${falliti.join(", ")}` : "TUTTI E TRE COME ATTESO");
  process.exit(falliti.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`errore: ${e?.message ?? "sconosciuto"}`);
  process.exit(1);
});
