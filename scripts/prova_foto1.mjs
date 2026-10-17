// Prova dal vivo di FOTO1 (17/10): un cliente non si fa dare la foto di un altro.
//
//   npm run build
//   node scripts/prova_foto1.mjs            la prova
//   node scripts/prova_foto1.mjs --pulisci  toglie cio' che un giro interrotto ha lasciato
//
// TRE UTENTI USA-E-GETTA, creati qui, mai account reali o demo:
// - A (prova.foto1.a@bobapp.it): carica una foto in /api/bob/chat col BEARER
//   (la strada dell'app) e salva il brief col COOKIE del sito: la stessa
//   attestazione deve valere per tutte e due, perche' l'id e' lo stesso.
// - B (prova.foto1.b@bobapp.it): salva un brief col percorso della foto di A,
//   presentando anche l'attestazione di A (rubata insieme al percorso) e poi
//   senza. In piu' un brief di B scritto direttamente nel db, come lo avrebbe
//   salvato la route prima di oggi: e' lo strato per i brief vecchi.
// - P (prova.foto1.pro@bobapp.it): un professionista is_test_fixture, spento,
//   a cui arrivano tre richieste: quella di A col brief di A (il CONTROLLO
//   POSITIVO: senza, «nessuna foto» non dimostrerebbe niente), quella di B col
//   brief vecchio di B, e una di B che punta direttamente al brief di A
//   (requests.brief_id lo scrive il browser).
//
// CLAUDE FINTO, SE MANCA LA CHIAVE. La foto si aggancia al brief solo nel ramo
// in cui Claude risponde. Senza ANTHROPIC_API_KEY (in .env.local o
// nell'ambiente) lo script alza un /v1/messages finto in locale e ci punta
// l'SDK con ANTHROPIC_BASE_URL: sostituisce SOLO la risposta del modello, e
// controlla che l'immagine gli sia arrivata. Upload, storage, db, route,
// cookie e Bearer restano veri. Lo stampa, perche' si sappia.
//
// La pulizia gira in finally e su SIGINT/SIGTERM, dal registro su disco, e
// VERIFICA che utenti, brief, file e contatori non ci siano piu'. Password e
// token vivono solo in memoria e non si stampano.

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import http from "node:http";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const PORTA = 3127;
const BASE = `http://localhost:${PORTA}`;
const EMAIL = { a: "prova.foto1.a@bobapp.it", b: "prova.foto1.b@bobapp.it", pro: "prova.foto1.pro@bobapp.it" };
const REGISTRO = path.join(process.env.TMPDIR ?? "/tmp", "prova_foto1_registro.json");

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

// --- il registro della pulizia -------------------------------------------
const vuoto = () => ({ utenti: [], file: [], brief: [] });
const leggiRegistro = () => (fs.existsSync(REGISTRO) ? { ...vuoto(), ...JSON.parse(fs.readFileSync(REGISTRO, "utf8")) } : vuoto());
let reg = vuoto();
const annota = () => fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 2));
const registroVuoto = (r) => !r.utenti.length && !r.file.length && !r.brief.length;

let server = null;
let esitoPulizia = null;

async function esisteFile(p) {
  const cartella = p.slice(0, p.lastIndexOf("/")), nome = p.slice(p.lastIndexOf("/") + 1);
  const { data } = await admin.storage.from("brief-photos").list(cartella, { search: nome });
  return (data ?? []).some((f) => f.name === nome);
}

async function pulisci(motivo) {
  if (esitoPulizia !== null) return esitoPulizia;
  console.log(`\n== pulizia (${motivo}) ==`);
  if (server) { server.kill("SIGTERM"); server = null; }
  if (claudeFinto) { claudeFinto.close(); claudeFinto = null; }
  // I brief prima: job_briefs.user_id e' ON DELETE SET NULL, dopo non si
  // ritroverebbero piu' per utente.
  if (reg.utenti.length) {
    const { data } = await admin.from("job_briefs").select("id").in("user_id", reg.utenti);
    for (const { id } of data ?? []) if (!reg.brief.includes(id)) reg.brief.push(id);
    annota();
  }
  if (reg.brief.length) await admin.from("job_briefs").delete().in("id", reg.brief);
  if (reg.file.length) await admin.storage.from("brief-photos").remove(reg.file);
  const problemi = [];
  for (const id of reg.utenti) {
    if ((await admin.auth.admin.getUserById(id)).data?.user) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) problemi.push(`utente ${id.slice(0, 8)}: ${error.message}`);
    }
  }
  if (reg.utenti.length) await admin.from("rate_limit_counters").delete().in("actor_key", reg.utenti.map((id) => `user:${id}`));

  for (const id of reg.utenti) if ((await admin.auth.admin.getUserById(id)).data?.user) problemi.push(`l'utente ${id.slice(0, 8)} esiste ancora`);
  for (const p of reg.file) if (await esisteFile(p)) problemi.push(`file rimasto: brief-photos/${p}`);
  if (reg.brief.length) {
    const { count } = await admin.from("job_briefs").select("id", { count: "exact", head: true }).in("id", reg.brief);
    if (count) problemi.push(`${count} brief rimasti`);
  }
  if (reg.utenti.length) {
    const { count } = await admin.from("rate_limit_counters").select("actor_key", { count: "exact", head: true }).in("actor_key", reg.utenti.map((id) => `user:${id}`));
    if (count) problemi.push(`${count} contatori di frequenza rimasti`);
  }
  if (problemi.length) {
    console.log(`PULIZIA INCOMPLETA: ${problemi.join("; ")}. Registro in ${REGISTRO}: rilanciare con --pulisci.`);
    return (esitoPulizia = false);
  }
  if (!registroVuoto(reg)) fs.rmSync(REGISTRO, { force: true });
  console.log(`pulizia verificata: ${reg.utenti.length} utenti, ${reg.brief.length} brief e ${reg.file.length} file di prova non ci sono piu'`);
  return (esitoPulizia = true);
}
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, async () => { await pulisci(s); process.exit(130); });

// --- strumenti -------------------------------------------------------------
const controlli = [];
const ok = (nome, vero, dettaglio = "") => {
  controlli.push(vero);
  console.log(`${vero ? "OK " : "NO "} ${nome}${dettaglio ? `  — ${dettaglio}` : ""}`);
};
const scrivi = async (tabella, riga) => {
  const { data, error } = await admin.from(tabella).insert(riga).select().single();
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return data;
};

async function nuovoUtente(email, ruolo) {
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: ruolo } });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  reg.utenti.push(data.user.id); annota();
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const sessione = await r.json().catch(() => ({}));
  if (!r.ok || !sessione.access_token) throw new Error(`login ${email} rifiutato (${r.status})`);
  return { id: data.user.id, sessione };
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
  return { cookie: [...b].map(([n, v]) => `${n}=${v}`).join("; ") };
}
const bearer = (s) => ({ authorization: `Bearer ${s.access_token}` });

async function post(rotta, headers, corpo) {
  const r = await fetch(`${BASE}${rotta}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(corpo) });
  return { stato: r.status, corpo: await r.json().catch(() => null) };
}

// Lo ZIP dell'export e' "store" (src/lib/zip.ts): si legge a mano.
function leggiZip(buf) {
  const file = {};
  for (let i = 0; i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50; ) {
    const dim = buf.readUInt32LE(i + 18), lNome = buf.readUInt16LE(i + 26), lExtra = buf.readUInt16LE(i + 28);
    const nome = buf.subarray(i + 30, i + 30 + lNome).toString("utf8");
    const inizio = i + 30 + lNome + lExtra;
    file[nome] = buf.subarray(inizio, inizio + dim);
    i = inizio + dim;
  }
  return file;
}
async function esporta(headers, userId) {
  await admin.from("profile_private").update({ last_export_at: null }).eq("user_id", userId);
  const r = await fetch(`${BASE}/api/account/esporta`, { headers });
  const buf = Buffer.from(await r.arrayBuffer());
  if (r.status !== 200) return { stato: r.status, foto: [], elenco: [], testo: buf.toString().slice(0, 120) };
  const zip = leggiZip(buf);
  const json = Object.entries(zip).find(([n]) => n.endsWith(".json"));
  const doc = json ? JSON.parse(json[1].toString("utf8")) : {};
  return { stato: 200, foto: Object.keys(zip).filter((n) => n.startsWith("foto/")), zip, doc };
}

function elencoFotoDi(doc) {
  // Il nome della sezione non si indovina: si cerca la lista con "nel_file".
  for (const v of Object.values(doc)) {
    if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "nel_file" in x)) return v;
  }
  return [];
}

let claudeFinto = null;
let immaginiAlFinto = 0;
function avviaClaudeFinto() {
  return new Promise((ok) => {
    claudeFinto = http.createServer((req, res) => {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        const msg = JSON.parse(corpo || "{}");
        if (JSON.stringify(msg.messages ?? []).includes('"type":"image"')) immaginiAlFinto++;
        const conTool = Array.isArray(msg.tools) && msg.tools.length > 0;
        const content = conTool
          ? [{ type: "tool_use", id: "toolu_prova", name: msg.tools[0].name, input: { reply: "Vedo la foto.", next: "ask", brief: { photoCaption: "Perdita sotto il lavandino (finta)" } } }]
          : [{ type: "text", text: '{"summary":"Riassunto finto","draftReply":"Bozza finta"}' }];
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "msg_prova", type: "message", role: "assistant", model: msg.model, content, stop_reason: conTool ? "tool_use" : "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }));
      });
    }).listen(0, "127.0.0.1", () => ok(`http://127.0.0.1:${claudeFinto.address().port}`));
  });
}

async function avviaServer() {
  const chiave = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
  const llm = chiave ? {} : { ANTHROPIC_API_KEY: "finta", ANTHROPIC_BASE_URL: await avviaClaudeFinto() };
  console.log(chiave ? "Claude: quello vero" : `Claude: FINTO su ${llm.ANTHROPIC_BASE_URL} (ANTHROPIC_API_KEY vuota in .env.local)`);
  server = spawn("npx", ["next", "start", "-p", String(PORTA)], {
    env: { ...process.env, ...llm, BRIEF_PHOTOS_SECRET: randomBytes(32).toString("base64url") },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/`); return; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error("il server locale non parte");
}

// --- la prova --------------------------------------------------------------
async function prova() {
  if (!registroVuoto(leggiRegistro())) throw new Error(`c'e' un registro di un giro interrotto (${REGISTRO}): prima --pulisci`);
  const { data: esistenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const email of Object.values(EMAIL)) {
    if ((esistenti?.users ?? []).some((u) => u.email === email)) throw new Error(`${email} esiste gia': non lo tocco`);
  }

  const A = await nuovoUtente(EMAIL.a, "customer");
  const B = await nuovoUtente(EMAIL.b, "customer");
  const P = await nuovoUtente(EMAIL.pro, "professional");
  console.log(`utenti di prova: A ${A.id}, B ${B.id}, P ${P.id}`);
  const { data: milano } = await admin.from("cities").select("id").eq("slug", "milano").single();
  const { data: sub } = await admin.from("subservices").select("id, service_id").limit(1).single();
  const pro = await scrivi("professionals", {
    user_id: P.id, city_id: milano.id, business_name: "Prova FOTO1",
    is_test_fixture: true, deactivated_at: new Date().toISOString(),
  });

  await avviaServer();
  console.log(`server locale pronto su ${BASE}\n`);

  // 1. A carica una foto nella chat, col Bearer.
  const foto = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#2a6" } }).jpeg().toBuffer();
  const chat = await post("/api/bob/chat", bearer(A.sessione), {
    messages: [{ role: "user", content: "Ho una perdita sotto il lavandino della cucina, ecco la foto", imageBase64: foto.toString("base64"), imageMediaType: "image/jpeg" }],
  });
  const fotoA = chat.corpo?.brief?.photos?.[0];
  if (fotoA?.storagePath) { reg.file.push(fotoA.storagePath); annota(); }
  console.log(`POST /api/bob/chat (A, Bearer) -> HTTP ${chat.stato}, source ${chat.corpo?.source}, foto ${fotoA?.storagePath ?? "nessuna"}`);
  if (claudeFinto) ok("chat: l'immagine e' arrivata al modello (finto)", immaginiAlFinto === 1);
  ok("chat: la foto di A e' nel bucket e torna con un'attestazione", !!fotoA?.storagePath && typeof fotoA.attestazione === "string" && (await esisteFile(fotoA.storagePath)));
  if (!fotoA?.storagePath) throw new Error("senza la foto di A la prova non ha senso");

  // 2. A salva il brief col cookie del sito.
  const cookieA = await cookieDelSito(A.sessione);
  const briefA = await post("/api/bob/brief", cookieA, { brief: { ...chat.corpo.brief, summary: "Perdita lavandino (prova FOTO1, A)" }, source: "ai" });
  if (briefA.corpo?.id) { reg.brief.push(briefA.corpo.id); annota(); }
  const { data: rigaA } = await admin.from("job_briefs").select("user_id, photos").eq("id", briefA.corpo?.id ?? randomUUID()).maybeSingle();
  ok("brief di A (cookie) salvato con la sua foto, senza l'attestazione", rigaA?.user_id === A.id && rigaA.photos.length === 1 && rigaA.photos[0].storagePath === fotoA.storagePath && !("attestazione" in rigaA.photos[0]), JSON.stringify(rigaA?.photos));

  // 3. B salva un brief col percorso di A: con l'attestazione di A, e senza.
  for (const [caso, f] of [["con l'attestazione di A", fotoA], ["senza attestazione", { storagePath: fotoA.storagePath, aiCaption: fotoA.aiCaption }]]) {
    const r = await post("/api/bob/brief", bearer(B.sessione), { brief: { summary: `Prova FOTO1, B ${caso}`, photos: [f] }, source: "rules" });
    if (r.corpo?.id) { reg.brief.push(r.corpo.id); annota(); }
    const { data: riga } = await admin.from("job_briefs").select("user_id, photos").eq("id", r.corpo?.id ?? randomUUID()).maybeSingle();
    ok(`brief di B ${caso}: salvato SENZA la foto di A`, r.corpo?.saved === true && riga?.user_id === B.id && riga.photos.length === 0, `HTTP ${r.stato}, photos ${JSON.stringify(riga?.photos)}`);
  }

  // 4. Il brief di B come lo avrebbe salvato la route fino a ieri.
  const vecchioB = randomUUID();
  reg.brief.push(vecchioB); annota();
  await scrivi("job_briefs", { id: vecchioB, user_id: B.id, summary: "Prova FOTO1, B, brief di prima di oggi", photos: [{ storagePath: fotoA.storagePath, aiCaption: null }], source: "rules" });

  // 5. Le richieste al pro: A col suo brief, B col brief vecchio, B col brief di A.
  const richiesta = async (cliente, briefId, testo) => {
    const r = await scrivi("requests", { customer_id: cliente, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id, status: "sent", problem_description: testo, brief_id: briefId });
    await scrivi("request_professionals", { request_id: r.id, professional_id: pro.id });
    return r.id;
  };
  const rA = await richiesta(A.id, briefA.corpo.id, "Prova FOTO1: richiesta di A");
  const rB = await richiesta(B.id, vecchioB, "Prova FOTO1: richiesta di B");
  const rBsuA = await richiesta(B.id, briefA.corpo.id, "Prova FOTO1: richiesta di B col brief di A");

  // 6. request-summary, col Bearer del pro.
  console.log("");
  const rs = await fetch(`${BASE}/api/pro/request-summary`, { headers: bearer(P.sessione) });
  const elenco = (await rs.json().catch(() => null))?.requests ?? [];
  const di = (id) => elenco.find((x) => x.id === id);
  console.log(`GET /api/pro/request-summary (P, Bearer) -> HTTP ${rs.status}, ${elenco.length} richieste`);
  ok("CONTROLLO: request-summary della richiesta di A mostra la foto di A", di(rA)?.briefPhotos?.length === 1, `foto: ${di(rA)?.briefPhotos?.length ?? "richiesta assente"}`);
  ok("ESITO 2: request-summary della richiesta di B NON mostra la foto di A", !!di(rB) && di(rB).briefPhotos.length === 0, `foto: ${di(rB)?.briefPhotos?.length ?? "richiesta assente"}, riassunto brief: ${JSON.stringify(di(rB)?.briefSummary)}`);
  ok("in piu': la richiesta di B che punta al brief di A non ne mostra ne' foto ne' riassunto", !!di(rBsuA) && di(rBsuA).briefPhotos.length === 0 && di(rBsuA).briefSummary === null, `foto: ${di(rBsuA)?.briefPhotos?.length ?? "richiesta assente"}, riassunto: ${JSON.stringify(di(rBsuA)?.briefSummary)}`);

  // 7. Gli export: B col Bearer, A col cookie.
  const eB = await esporta(bearer(B.sessione), B.id);
  const elencoB = elencoFotoDi(eB.doc ?? {});
  console.log(`GET /api/account/esporta (B, Bearer) -> HTTP ${eB.stato}, file foto: ${JSON.stringify(eB.foto)}, elenco: ${JSON.stringify(elencoB)}`);
  ok("ESITO 1: l'export di B NON contiene la foto di A", eB.stato === 200 && eB.foto.length === 0 && elencoB.length === 1 && elencoB[0].nel_file === null);
  const eA = await esporta(cookieA, A.id);
  const fotoNelloZip = eA.foto.length === 1 && eA.zip[eA.foto[0]].equals((await (await admin.storage.from("brief-photos").download(fotoA.storagePath)).data.arrayBuffer().then((x) => Buffer.from(x))));
  console.log(`GET /api/account/esporta (A, cookie) -> HTTP ${eA.stato}, file foto: ${JSON.stringify(eA.foto)}`);
  ok("ESITO 4: l'export di A contiene ancora la foto di A, byte per byte", eA.stato === 200 && fotoNelloZip);
  // L'esito 3 e' il passo 3: il brief di B salvato oggi non ha la foto.
}

const soloPulizia = process.argv.includes("--pulisci");
let esito = 1;
try {
  if (soloPulizia) {
    reg = leggiRegistro();
    esito = 0;
  } else {
    await prova();
    esito = controlli.every(Boolean) ? 0 : 1;
  }
} catch (e) {
  console.error(`errore: ${e?.message ?? "sconosciuto"}`);
} finally {
  const puliziaOk = await pulisci(soloPulizia ? "--pulisci" : "fine della prova");
  if (!soloPulizia) console.log(`\n${esito === 0 && puliziaOk ? `TUTTO COME ATTESO (${controlli.length} controlli)` : "FALLITO o INCOMPLETO"}`);
  process.exit(esito === 0 && puliziaOk ? 0 : 1);
}
