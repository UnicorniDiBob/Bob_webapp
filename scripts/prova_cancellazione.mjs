// Prova dal vivo del cron cancella-account con i file (16/10, cron-cancella-foto).
//
//   npx next build
//   node scripts/prova_cancellazione.mjs            la prova
//   node scripts/prova_cancellazione.mjs --pulisci  toglie cio' che un giro interrotto ha lasciato
//
// Crea un utente usa-e-getta, gli mette un file in ciascuna delle tre cartelle
// e due foto in brief-photos/chat/, un suo brief che le cita entrambe e un
// brief ANONIMO che cita una delle due (quella deve restare). Poi una richiesta
// di cancellazione gia' scaduta, e chiama il cron su un server locale che lo
// script avvia da se', con un CRON_SECRET generato qui e mai scritto.
//
// SCRITTO PER NON LASCIARE NIENTE IN GIRO
// - Ogni cosa creata si annota SUBITO nel registro (REGISTRO, solo id e
//   percorsi, nessun segreto). Se il processo muore, --pulisci lo rilegge.
// - La pulizia gira in finally, su SIGINT/SIGTERM e su qualunque errore, e alla
//   fine VERIFICA che utente, file e righe non ci siano piu'.
// - La coda delle cancellazioni si ricontrolla SUBITO prima del cron: se c'e'
//   una cancellazione scaduta che non e' quella di prova, il cron non parte.
//   Dopo, la riga di system_job_runs deve dire scadute: 1.

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const PORTA = 3125;
const EMAIL = "prova.cancellazione@bobapp.it";
const REGISTRO = process.env.REGISTRO_PROVA ?? path.join(process.env.TMPDIR ?? "/tmp", "prova_cancellazione_registro.json");

const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: class WsFinta {} },
});

// --- il registro della pulizia -------------------------------------------
const vuoto = () => ({ userId: null, file: [], brief: [] });
const leggiRegistro = () => (fs.existsSync(REGISTRO) ? JSON.parse(fs.readFileSync(REGISTRO, "utf8")) : vuoto());
let reg = vuoto();
const annota = () => fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 2));

let server = null;
let esitoPulizia = null;

async function pulisci(motivo) {
  if (esitoPulizia !== null) return esitoPulizia;
  esitoPulizia = await pulisciUnaVolta(motivo);
  return esitoPulizia;
}

async function pulisciUnaVolta(motivo) {
  console.log(`\n== pulizia (${motivo}) ==`);
  if (server) { server.kill("SIGTERM"); server = null; }
  const problemi = [];
  if (reg.userId) {
    const { data } = await admin.auth.admin.getUserById(reg.userId);
    if (data?.user) {
      const { error } = await admin.auth.admin.deleteUser(reg.userId);
      if (error) problemi.push(`utente: ${error.message}`);
      else console.log("utente di prova cancellato dalla pulizia");
    }
  }
  for (const { bucket, path: p } of reg.file) await admin.storage.from(bucket).remove([p]);
  if (reg.brief.length) await admin.from("job_briefs").delete().in("id", reg.brief);

  // Verifica: niente deve restare.
  if (reg.userId && (await admin.auth.admin.getUserById(reg.userId)).data?.user) problemi.push("l'utente esiste ancora");
  for (const { bucket, path: p } of reg.file) {
    const cartella = p.slice(0, p.lastIndexOf("/")), nome = p.slice(p.lastIndexOf("/") + 1);
    const { data } = await admin.storage.from(bucket).list(cartella, { search: nome });
    if ((data ?? []).some((f) => f.name === nome)) problemi.push(`file rimasto: ${bucket}/${p}`);
  }
  if (reg.brief.length) {
    const { count } = await admin.from("job_briefs").select("id", { count: "exact", head: true }).in("id", reg.brief);
    if (count) problemi.push(`${count} brief rimasti`);
  }
  if (reg.userId) {
    const { count } = await admin.from("account_deletion_requests").select("user_id", { count: "exact", head: true }).eq("user_id", reg.userId);
    if (count) problemi.push("richiesta di cancellazione rimasta");
  }
  if (problemi.length) {
    console.log(`PULIZIA INCOMPLETA: ${problemi.join("; ")}. Il registro resta in ${REGISTRO}: rilanciare con --pulisci.`);
    return false;
  }
  // Un registro vuoto non e' mio: puo' essere quello di un giro interrotto,
  // l'unica traccia di cosa va tolto. Lo cancello solo se ho pulito io.
  if (reg.userId || reg.file.length || reg.brief.length) fs.rmSync(REGISTRO, { force: true });
  console.log(`pulizia verificata: utente, ${reg.file.length} file e ${reg.brief.length} brief di prova non ci sono piu'`);
  return true;
}

for (const segnale of ["SIGINT", "SIGTERM"]) {
  process.on(segnale, async () => { await pulisci(segnale); process.exit(130); });
}

// --- la prova --------------------------------------------------------------
const controlli = [];
const ok = (nome, vero, dettaglio = "") => {
  controlli.push(vero);
  console.log(`${vero ? "OK " : "NO "} ${nome}${dettaglio ? `  — ${dettaglio}` : ""}`);
};

async function scadute() {
  const { data, error } = await admin.from("account_deletion_requests").select("user_id").lte("scheduled_for", new Date().toISOString());
  if (error) throw new Error(`coda: ${error.message}`);
  return (data ?? []).map((r) => r.user_id);
}

async function avviaServer(segreto) {
  server = spawn("npx", ["next", "start", "-p", String(PORTA)], {
    env: { ...process.env, CRON_SECRET: segreto },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://localhost:${PORTA}/`); return; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error("il server locale non parte");
}

async function prova() {
  // 0. Nessun residuo di un giro precedente, e la coda e' quella che pensiamo.
  const residuo = leggiRegistro();
  if (residuo.userId || residuo.file.length || residuo.brief.length) {
    throw new Error(`c'e' un registro di un giro interrotto (${REGISTRO}): prima node scripts/prova_cancellazione.mjs --pulisci`);
  }
  const { data: esistenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if ((esistenti?.users ?? []).some((u) => u.email === EMAIL)) throw new Error(`${EMAIL} esiste gia': non lo tocco`);
  const primaDellaProva = await scadute();
  console.log(`coda all'inizio: ${primaDellaProva.length} cancellazioni scadute`);
  if (primaDellaProva.length) throw new Error("la coda NON e' vuota: il cron cancellerebbe account veri. Mi fermo.");

  // 1. L'utente usa-e-getta.
  const { data: nuovo, error: e1 } = await admin.auth.admin.createUser({ email: EMAIL, password: randomBytes(24).toString("base64url"), email_confirm: true });
  if (e1 || !nuovo.user) throw new Error(`createUser: ${e1?.message}`);
  reg.userId = nuovo.user.id; annota();
  const uid = reg.userId;
  console.log(`utente di prova creato: ${uid}`);

  // 2. I file: uno per cartella, due foto di chat.
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#36c" } }).jpeg().toBuffer();
  const tag = randomUUID().slice(0, 8);
  const fileUtente = [
    { bucket: "verifica-documenti", path: `${uid}/doc-${tag}.jpg` },
    { bucket: "portfolio", path: `${uid}/lavoro-${tag}.jpg` },
    { bucket: "brief-photos", path: `${uid}/foto-${tag}.jpg` },
  ];
  const chatSua = { bucket: "brief-photos", path: `chat/prova-sua-${tag}.jpg` };
  const chatCondivisa = { bucket: "brief-photos", path: `chat/prova-condivisa-${tag}.jpg` };
  for (const f of [...fileUtente, chatSua, chatCondivisa]) {
    reg.file.push(f); annota();
    const { error } = await admin.storage.from(f.bucket).upload(f.path, jpeg, { contentType: "image/jpeg" });
    if (error) throw new Error(`upload ${f.bucket}/${f.path}: ${error.message}`);
  }

  // 3. I brief: il suo cita le due foto di chat, uno anonimo cita la condivisa.
  for (const b of [
    { user_id: uid, photos: [{ storagePath: chatSua.path, aiCaption: null }, { storagePath: chatCondivisa.path, aiCaption: null }], source: "rules" },
    { user_id: null, photos: [{ storagePath: chatCondivisa.path, aiCaption: null }], source: "rules" },
  ]) {
    const id = randomUUID();
    reg.brief.push(id); annota();
    const { error } = await admin.from("job_briefs").insert({ id, ...b });
    if (error) throw new Error(`job_briefs: ${error.message}`);
  }
  const [briefSuo, briefAnonimo] = reg.brief;

  // 4. La richiesta di cancellazione, gia' scaduta.
  const ieri = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { error: e4 } = await admin.from("account_deletion_requests").insert({ user_id: uid, requested_at: ieri, scheduled_for: ieri });
  if (e4) throw new Error(`account_deletion_requests: ${e4.message}`);

  // 5. Il cron, dopo aver RICONTROLLATO la coda.
  const segreto = randomBytes(32).toString("base64url");
  await avviaServer(segreto);
  const coda = await scadute();
  console.log(`coda subito prima del cron: ${JSON.stringify(coda)}`);
  if (coda.length !== 1 || coda[0] !== uid) throw new Error("in coda c'e' qualcosa che non e' la prova: il cron NON parte");
  const inizio = new Date().toISOString();
  const r = await fetch(`http://localhost:${PORTA}/api/cron/cancella-account`, { headers: { authorization: `Bearer ${segreto}` } });
  console.log(`GET /api/cron/cancella-account -> HTTP ${r.status} ${JSON.stringify(await r.json().catch(() => null))}`);

  // 6. Cosa e' successo davvero.
  console.log("\n== verifica ==");
  ok("l'utente non esiste piu'", !(await admin.auth.admin.getUserById(uid)).data?.user);
  for (const f of fileUtente) {
    const { data } = await admin.storage.from(f.bucket).list(uid);
    ok(`${f.bucket}/<uid>/ vuota`, (data ?? []).filter((x) => x.id).length === 0);
  }
  const esiste = async (f) => {
    const nome = f.path.split("/")[1];
    const { data } = await admin.storage.from(f.bucket).list("chat", { search: nome });
    return (data ?? []).some((x) => x.name === nome);
  };
  ok("la foto di chat sua e' stata tolta", !(await esiste(chatSua)));
  ok("la foto di chat citata anche dal brief anonimo e' rimasta", await esiste(chatCondivisa));
  const { data: righe } = await admin.from("job_briefs").select("id, user_id, photos").in("id", [briefSuo, briefAnonimo]);
  const suo = (righe ?? []).find((b) => b.id === briefSuo);
  const anon = (righe ?? []).find((b) => b.id === briefAnonimo);
  ok("il suo brief resta anonimo con photos vuoto", !!suo && suo.user_id === null && Array.isArray(suo.photos) && suo.photos.length === 0);
  ok("il brief anonimo non e' stato toccato", !!anon && anon.photos.length === 1);
  const { data: giri } = await admin.from("system_job_runs").select("started_at, ok, outcome").eq("job", "cancella-account").gte("started_at", inizio).order("started_at", { ascending: false }).limit(1);
  const giro = giri?.[0];
  ok("system_job_runs: un giro, scadute 1, cancellati 1, file_rimossi 4", !!giro && giro.outcome?.scadute === 1 && giro.outcome?.cancellati === 1 && giro.outcome?.file_rimossi === 4, JSON.stringify(giro?.outcome ?? null));
}

const soloPulizia = process.argv.includes("--pulisci");
let esito = 1;
try {
  if (soloPulizia) {
    reg = leggiRegistro();
    esito = (await pulisci("--pulisci")) ? 0 : 1;
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
