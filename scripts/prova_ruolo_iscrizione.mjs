// Prova dal vivo della migrazione 130 (17/10): il ruolo non si sceglie da soli.
//
//   npm run build
//   node scripts/prova_ruolo_iscrizione.mjs             la prova
//   node scripts/prova_ruolo_iscrizione.mjs --pulisci   toglie gli utenti di un giro interrotto
//
// Cosa prova, sul database di PRODUZIONE e con un server locale (next start):
// 1. invito staff da POST /api/admin/staff con role "cs" → users.role = cs
//    (manda una mail VERA a INVITO, se il mailer la accetta; se la rifiuta la
//    prova lo dice e non insiste);
// 2. iscrizione con la chiave pubblica (signUp) e data.role "admin" → customer,
//    "cs" → customer, "professional" → professional. Se il mailer rifiuta il
//    signUp si ripiega su auth.admin.createUser con lo stesso metadata, che
//    passa dallo stesso trigger handle_new_user, e lo si scrive;
// 3. account cs creato da POST /api/admin/cs → cs; quel cs, col proprio JWT,
//    prova a cambiarsi il ruolo in admin e a cambiare quello di un altro →
//    rifiutato (42501, trg_guard_users_role); un admin che cambia il ruolo di
//    un altro → accettato (controllo positivo: il trigger non blocca tutto).
//
// L'admin di prova lo crea il service role (non e' la falla): serve solo a
// chiamare le route admin. Tutti gli utenti di prova si cancellano in finally,
// e alla fine si controlla che gli admin siano solo ADMIN_ATTESI e i cs zero.

import fs from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const PORTA = 3130;
const BASE = `http://localhost:${PORTA}`;
const INVITO = "lucio@unicorni.eu";
const EMAIL = {
  admin: "prova.ruolo.admin-staff@bobapp.it",
  suAdmin: "prova.ruolo.iscrizione-admin@bobapp.it",
  suCs: "prova.ruolo.iscrizione-cs@bobapp.it",
  suPro: "prova.ruolo.iscrizione-pro@bobapp.it",
  cs: "prova.ruolo.cs-route@bobapp.it",
};
// Gli admin al 17/10/2026, prima della prova.
const ADMIN_ATTESI = [
  "653855b0-5479-4c1d-a23d-67fc5b808a19",
  "a1000000-0000-0000-0000-000000000002",
  "c8f856eb-bd0c-40ff-87e2-48a4358f9d3b",
].sort();

const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = riga.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
// Node 20 non ha WebSocket: realtime non serve, gli si da' un trasporto finto.
const OPZ = { auth: { persistSession: false }, realtime: { transport: class WsFinta {} } };
const admin = createClient(URL_SB, env.SUPABASE_SERVICE_ROLE_KEY, OPZ);
const anonimo = () => createClient(URL_SB, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, OPZ);

let falliti = 0;
function ok(nome, cond, dettaglio = "") {
  if (!cond) falliti++;
  console.log(`${cond ? "OK  " : "NO  "} ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const password = () => `Pr0va-${randomBytes(12).toString("hex")}`;
const ruolo = async (id) => (await admin.from("users").select("role").eq("id", id).maybeSingle()).data?.role ?? null;

async function cerca(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u || data.users.length < 1000) return u ?? null;
  }
}

async function pulisci() {
  for (const email of [...Object.values(EMAIL), INVITO]) {
    const u = await cerca(email);
    if (!u) continue;
    // INVITO e' un indirizzo vero: lo si cancella solo se e' l'invito di questa prova.
    if (email === INVITO && u.last_sign_in_at) { console.log(`${email} ha gia' fatto login: NON lo cancello`); continue; }
    const { error } = await admin.auth.admin.deleteUser(u.id);
    console.log(`cancellato ${email} ${u.id}${error ? ` ERRORE ${error.message}` : ""}`);
  }
}

// Cookie di sessione come li scrive il browser, con @supabase/ssr.
async function cookieDi(email, pw) {
  const vaso = new Map();
  const sb = createServerClient(URL_SB, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    realtime: OPZ.realtime,
    cookies: {
      getAll: () => [...vaso].map(([name, value]) => ({ name, value })),
      setAll: (lista) => lista.forEach(({ name, value }) => (value ? vaso.set(name, value) : vaso.delete(name))),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return [...vaso].map(([n, v]) => `${n}=${v}`).join("; ");
}

let server;
async function avviaServer() {
  server = spawn("npx", ["next", "start", "-p", String(PORTA)], { env: { ...process.env }, stdio: ["ignore", "ignore", "inherit"] });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/`); return; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error("il server locale non parte");
}

async function iscrivi(email, ruoloChiesto) {
  const meta = { role: ruoloChiesto, first_name: "Prova", last_name: "Ruolo", full_name: "Prova Ruolo" };
  const pw = password();
  const { data, error } = await anonimo().auth.signUp({ email, password: pw, options: { data: meta } });
  if (!error && data.user) return { id: data.user.id, via: "signUp (chiave pubblica)" };
  const motivo = error?.message ?? "nessun utente";
  const r = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: meta });
  if (r.error) throw new Error(`createUser ${email}: ${r.error.message}`);
  return { id: r.data.user.id, via: `auth.admin.createUser (signUp rifiutato: ${motivo})` };
}

async function prova() {
  for (const email of [...Object.values(EMAIL), INVITO]) {
    if (await cerca(email)) throw new Error(`${email} esiste gia': prima --pulisci (o non e' un utente di prova)`);
  }

  // Admin di prova, creato dal service role: e' il chiamante delle route admin.
  const pwAdmin = password();
  const a = await admin.auth.admin.createUser({ email: EMAIL.admin, password: pwAdmin, email_confirm: true, user_metadata: { role: "admin" } });
  if (a.error) throw new Error(`admin di prova: ${a.error.message}`);
  ok("metadata role admin via createUser → customer (handle_new_user)", (await ruolo(a.data.user.id)) === "customer", await ruolo(a.data.user.id));
  const { error: promErr } = await admin.from("users").update({ role: "admin" }).eq("id", a.data.user.id);
  ok("il service role puo' impostare admin", !promErr && (await ruolo(a.data.user.id)) === "admin", promErr?.message);
  const cookieAdmin = await cookieDi(EMAIL.admin, pwAdmin);

  // 1. Invito staff, per primo: il mailer integrato fa 2 email all'ora.
  const rInv = await fetch(`${BASE}/api/admin/staff`, {
    method: "POST", headers: { cookie: cookieAdmin, "content-type": "application/json" },
    body: JSON.stringify({ email: INVITO, fullName: "Prova Invito Staff", role: "cs" }),
  });
  const cInv = await rInv.json().catch(() => null);
  if (rInv.ok && cInv?.userId) {
    ok("invito staff dalla route → cs", (await ruolo(cInv.userId)) === "cs", `HTTP ${rInv.status}, ${await ruolo(cInv.userId)}`);
  } else {
    console.log(`INVITO NON PROVATO: HTTP ${rInv.status} ${JSON.stringify(cInv)}`);
    ok("invito rifiutato senza lasciare account", !(await cerca(INVITO)));
  }

  // 2. Iscrizioni con la chiave pubblica.
  const attesi = [[EMAIL.suAdmin, "admin", "customer"], [EMAIL.suCs, "cs", "customer"], [EMAIL.suPro, "professional", "professional"]];
  const iscritti = {};
  for (const [email, chiesto, atteso] of attesi) {
    const u = await iscrivi(email, chiesto);
    iscritti[chiesto] = u.id;
    const r = await ruolo(u.id);
    ok(`iscrizione con role "${chiesto}" → ${atteso}`, r === atteso, `${r}, via ${u.via}`);
  }

  // 3. cs dalla route /api/admin/cs, poi prova a promuoversi.
  const pwCs = password();
  const rCs = await fetch(`${BASE}/api/admin/cs`, {
    method: "POST", headers: { cookie: cookieAdmin, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL.cs, password: pwCs, fullName: "Prova CS Route" }),
  });
  const cCs = await rCs.json().catch(() => null);
  ok("account cs da /api/admin/cs → cs", rCs.ok && (await ruolo(cCs?.userId)) === "cs", `HTTP ${rCs.status} ${JSON.stringify(cCs)}`);

  const sbCs = anonimo();
  const { error: loginCs } = await sbCs.auth.signInWithPassword({ email: EMAIL.cs, password: pwCs });
  if (loginCs) throw new Error(`login cs: ${loginCs.message}`);
  const self = await sbCs.from("users").update({ role: "admin" }).eq("id", cCs.userId).select("role");
  ok("il cs che si cambia il ruolo in admin → rifiutato", self.error?.code === "42501" && (await ruolo(cCs.userId)) === "cs", `${self.error?.code} ${self.error?.message ?? JSON.stringify(self.data)}`);
  const altro = await sbCs.from("users").update({ role: "admin" }).eq("id", iscritti.professional).select("role");
  ok("il cs che cambia il ruolo di un altro → rifiutato", altro.error?.code === "42501" && (await ruolo(iscritti.professional)) === "professional", `${altro.error?.code} ${altro.error?.message ?? JSON.stringify(altro.data)}`);

  const sbAdmin = anonimo();
  await sbAdmin.auth.signInWithPassword({ email: EMAIL.admin, password: pwAdmin });
  const ctrl = await sbAdmin.from("users").update({ role: "professional" }).eq("id", iscritti.admin).select("role");
  ok("un admin che cambia il ruolo di un altro → accettato", !ctrl.error && (await ruolo(iscritti.admin)) === "professional", ctrl.error?.message ?? JSON.stringify(ctrl.data));
}

async function verificaFinale() {
  const { data } = await admin.from("users").select("id, role").in("role", ["admin", "cs"]);
  const adm = (data ?? []).filter((u) => u.role === "admin").map((u) => u.id).sort();
  const cs = (data ?? []).filter((u) => u.role === "cs");
  ok("admin di nuovo solo i 3 di oggi", JSON.stringify(adm) === JSON.stringify(ADMIN_ATTESI), adm.join(", "));
  ok("nessun cs", cs.length === 0, cs.map((u) => u.id).join(", "));
  for (const email of [...Object.values(EMAIL), INVITO]) ok(`${email} non esiste piu'`, !(await cerca(email)));
}

if (process.argv.includes("--pulisci")) {
  await pulisci();
  await verificaFinale();
  process.exit(falliti ? 1 : 0);
}

const fine = async () => { server?.kill(); await pulisci(); };
process.on("SIGINT", async () => { await fine(); process.exit(130); });
try {
  await avviaServer();
  await prova();
} catch (e) {
  falliti++;
  console.log(`ERRORE ${e.message}`);
} finally {
  await fine();
  await verificaFinale();
  console.log(falliti ? `\n${falliti} controlli falliti` : "\ntutti i controlli passati");
  process.exit(falliti ? 1 : 0);
}
