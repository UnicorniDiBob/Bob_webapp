// Prova dal vivo di chiamante() sulle route convertite (17/10, chiamante-ovunque).
//
//   npm run build
//   node scripts/prova_chiamante_ovunque.mjs            la prova (dura poco piu' di un token: ~1 ora)
//   node scripts/prova_chiamante_ovunque.mjs --pulisci  toglie cio' che un giro interrotto ha lasciato
//
// Su un server locale (next start, avviato da qui con un CRON_SECRET generato
// e mai scritto):
//
// 1. GET /api/account/esporta e POST /api/appointments/<uuid inesistente>/disdici,
//    ciascuna con cookie del sito, Bearer valido, Bearer SCADUTO, niente.
//    Il Bearer scaduto e' vero: lo stesso token del caso valido, riprovato
//    dopo il suo exp. Non si falsifica: un token con firma sbagliata e' un
//    altro caso. In piu': Bearer scaduto + cookie valido -> 401, i cookie
//    non si leggono.
//    disdici con un id che non esiste non tocca niente; 404 «non_trovato»
//    vuol dire che annulla_appuntamento() e' girata con il token del
//    chiamante (anon non la puo' eseguire: senza token sarebbe un 500).
// 2. POST /api/account/cancellazione con il Bearer e la password, poi la
//    richiesta portata a scaduta e il cron cancella-account: l'utente deve
//    sparire da auth.users, public.users e profiles.
//
// L'utente e' usa-e-getta, prova.cancellazione@bobapp.it, con una password
// casuale che vive solo in memoria. I token non si stampano. La pulizia gira
// in finally e su SIGINT/SIGTERM, e VERIFICA che l'utente non ci sia piu'.

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const PORTA = 3126;
const BASE = `http://localhost:${PORTA}`;
const EMAIL = "prova.cancellazione@bobapp.it";
const REGISTRO = path.join(process.env.TMPDIR ?? "/tmp", "prova_chiamante_ovunque_registro.json");

const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_SB, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: class WsFinta {} },
});

let reg = { userId: null };
const annota = () => fs.writeFileSync(REGISTRO, JSON.stringify(reg));
let server = null;
let pulito = null;

async function pulisci(motivo) {
  if (pulito !== null) return pulito;
  console.log(`\n== pulizia (${motivo}) ==`);
  if (server) { server.kill("SIGTERM"); server = null; }
  if (reg.userId) {
    if ((await admin.auth.admin.getUserById(reg.userId)).data?.user) {
      const { error } = await admin.auth.admin.deleteUser(reg.userId);
      console.log(error ? `deleteUser: ${error.message}` : "utente di prova cancellato dalla pulizia");
    }
    await admin.from("account_deletion_requests").delete().eq("user_id", reg.userId);
    const resta = (await admin.auth.admin.getUserById(reg.userId)).data?.user;
    if (resta) {
      console.log(`PULIZIA INCOMPLETA: l'utente esiste ancora. Registro in ${REGISTRO}: rilanciare con --pulisci.`);
      return (pulito = false);
    }
  }
  fs.rmSync(REGISTRO, { force: true });
  console.log("pulizia verificata: l'utente di prova non c'e' piu'");
  return (pulito = true);
}
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, async () => { await pulisci(s); process.exit(130); });

const esiti = [];
function esito(rotta, caso, stato, atteso, nota = "") {
  const ok = atteso.includes(stato);
  esiti.push(ok);
  console.log(`${ok ? "OK " : "NO "} ${rotta.padEnd(26)} ${caso.padEnd(28)} -> HTTP ${stato}  (atteso ${atteso.join("/")}) ${nota}`);
}

async function login(password) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  const s = await r.json().catch(() => ({}));
  if (!r.ok || !s.access_token) throw new Error(`login rifiutato (${r.status})`);
  return s;
}

// I cookie come li scrive il sito: @supabase/ssr in persona.
async function cookieDelSito(s) {
  const b = new Map();
  const sb = createServerClient(URL_SB, ANON, {
    realtime: { transport: class WsFinta {} },
    cookies: { getAll: () => [...b].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => b.set(name, value)) },
  });
  const { error } = await sb.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) throw new Error(`setSession: ${error.message}`);
  return [...b].map(([n, v]) => `${n}=${v}`).join("; ");
}

const exp = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).exp;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function esporta(headers) {
  const r = await fetch(`${BASE}/api/account/esporta`, { headers });
  const tipo = r.headers.get("content-type") ?? "";
  const corpo = Buffer.from(await r.arrayBuffer());
  const zip = corpo.subarray(0, 2).toString() === "PK";
  return { stato: r.status, nota: r.status === 200 ? `${tipo}, ${corpo.length} byte, zip: ${zip ? "si" : "NO"}` : corpo.toString().slice(0, 80) };
}
// Il limite di 24 ore (art. 12(5)) ripartirebbe dal primo export: si azzera
// fra un caso e l'altro, solo per l'utente di prova.
const azzeraExport = () => admin.from("profile_private").update({ last_export_at: null }).eq("user_id", reg.userId);

const ID_FINTO = randomUUID();
async function disdici(headers) {
  const r = await fetch(`${BASE}/api/appointments/${ID_FINTO}/disdici`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: "{}",
  });
  const c = await r.json().catch(() => null);
  return { stato: r.status, nota: c?.motivo ? `motivo: ${c.motivo}` : (c?.error ?? "") };
}

async function avviaServer(segreto) {
  server = spawn("npx", ["next", "start", "-p", String(PORTA)], { env: { ...process.env, CRON_SECRET: segreto }, stdio: ["ignore", "ignore", "ignore"] });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/`); return; } catch { await dorme(1000); }
  }
  throw new Error("il server locale non risponde");
}

async function prova() {
  // Se esiste gia', createUser rifiuta: l'utente di un altro giro non si tocca.
  const password = randomBytes(24).toString("base64url");
  const { data: nuovo, error } = await admin.auth.admin.createUser({ email: EMAIL, password, email_confirm: true });
  if (error || !nuovo.user) throw new Error(`createUser: ${error?.message}`);
  reg.userId = nuovo.user.id; annota();
  console.log(`utente di prova creato: ${reg.userId}`);

  const segreto = randomBytes(32).toString("base64url");
  await avviaServer(segreto);
  console.log(`server locale pronto su ${BASE}\n`);

  // --- 1. cookie, Bearer valido, niente --------------------------------
  const A = await login(password);
  const scade = exp(A.access_token);
  console.log(`token A: scade alle ${new Date(scade * 1000).toISOString()} (fra ${Math.round(scade - Date.now() / 1000)} s)\n`);
  const cookieA = await cookieDelSito(A);
  const bearerA = { authorization: `Bearer ${A.access_token}` };

  await azzeraExport();
  let e = await esporta({ cookie: cookieA }); esito("GET account/esporta", "cookie", e.stato, [200], e.nota);
  await azzeraExport();
  e = await esporta(bearerA); esito("GET account/esporta", "Bearer valido", e.stato, [200], e.nota);
  e = await esporta({}); esito("GET account/esporta", "niente", e.stato, [401], e.nota);

  let d = await disdici({ cookie: cookieA }); esito("POST appointments/disdici", "cookie", d.stato, [404], d.nota);
  d = await disdici(bearerA); esito("POST appointments/disdici", "Bearer valido", d.stato, [404], d.nota);
  d = await disdici({}); esito("POST appointments/disdici", "niente", d.stato, [401], d.nota);

  // --- 2. lo stesso token, dopo la sua scadenza -------------------------
  const attesa = Math.max(0, scade * 1000 - Date.now()) + 15_000;
  console.log(`\nattendo ${Math.round(attesa / 1000)} s che il token A scada davvero...`);
  await dorme(attesa);
  const B = await login(password);
  const cookieB = await cookieDelSito(B);
  await azzeraExport();
  e = await esporta(bearerA); esito("GET account/esporta", "Bearer scaduto", e.stato, [401], e.nota);
  e = await esporta({ ...bearerA, cookie: cookieB }); esito("GET account/esporta", "Bearer scaduto + cookie ok", e.stato, [401], e.nota);
  d = await disdici(bearerA); esito("POST appointments/disdici", "Bearer scaduto", d.stato, [401], d.nota);
  d = await disdici({ ...bearerA, cookie: cookieB }); esito("POST appointments/disdici", "Bearer scaduto + cookie ok", d.stato, [401], d.nota);

  // --- 3. cancellazione col Bearer, fino al database --------------------
  console.log("");
  const r = await fetch(`${BASE}/api/account/cancellazione`, {
    method: "POST",
    headers: { authorization: `Bearer ${B.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  esito("POST account/cancellazione", "Bearer valido + password", r.status, [200], JSON.stringify(await r.json().catch(() => null)));
  const { data: richiesta } = await admin.from("account_deletion_requests").select("user_id").eq("user_id", reg.userId).maybeSingle();
  esito("account_deletion_requests", "riga creata dalla route", richiesta ? 1 : 0, [1]);

  const ieri = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await admin.from("account_deletion_requests").update({ scheduled_for: ieri }).eq("user_id", reg.userId);
  const { data: coda } = await admin.from("account_deletion_requests").select("user_id").lte("scheduled_for", new Date().toISOString());
  if ((coda ?? []).length !== 1 || coda[0].user_id !== reg.userId) throw new Error("in coda c'e' qualcosa che non e' la prova: il cron NON parte");
  const c = await fetch(`${BASE}/api/cron/cancella-account`, { headers: { authorization: `Bearer ${segreto}` } });
  esito("GET cron/cancella-account", "una scaduta, la prova", c.status, [200], JSON.stringify(await c.json().catch(() => null)));

  const inAuth = (await admin.auth.admin.getUserById(reg.userId)).data?.user ? 1 : 0;
  const conta = async (t, col) => (await admin.from(t).select(col, { count: "exact", head: true }).eq(col, reg.userId)).count ?? -1;
  esito("database", "auth.users", inAuth, [0]);
  esito("database", "public.users", await conta("users", "id"), [0]);
  esito("database", "profiles", await conta("profiles", "user_id"), [0]);
  esito("database", "account_deletion_requests", await conta("account_deletion_requests", "user_id"), [0]);
}

const soloPulizia = process.argv.includes("--pulisci");
let codice = 1;
try {
  if (soloPulizia) reg = fs.existsSync(REGISTRO) ? JSON.parse(fs.readFileSync(REGISTRO, "utf8")) : reg;
  else { await prova(); codice = esiti.every(Boolean) ? 0 : 1; }
} catch (err) {
  console.error(`errore: ${err?.message ?? "sconosciuto"}`);
} finally {
  const ok = await pulisci(soloPulizia ? "--pulisci" : "fine della prova");
  if (soloPulizia) codice = ok ? 0 : 1;
  else console.log(`\n${codice === 0 && ok ? `TUTTO COME ATTESO (${esiti.length} controlli)` : "FALLITO o INCOMPLETO"}`);
  process.exit(codice === 0 && ok ? 0 : 1);
}
