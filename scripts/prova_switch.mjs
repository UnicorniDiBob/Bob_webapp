// Prova dal vivo di strip-exif-client-switch, su un server locale:
//
//   npx next build && npx next start -p 3124
//   node scripts/prova_switch.mjs http://localhost:3124
//
// Un caricamento vero da ciascuno dei tre punti, con LA STESSA richiesta che
// fa il componente, e poi il file riscaricato DALLO STORAGE e letto con sharp:
//
// 1. /api/bob/chat, anonimo: foto con GPS e orientamento 6 nel JSON, cosi'
//    come la manderebbe un'app nativa (senza il canvas di BobChat).
// 2. portfolio (ProPortfolio): riscaricata dall'URL PUBBLICO — quello che
//    vede chiunque — poi cancellata col token del pro, come il rollback.
// 3. verifica-documenti (VerificationDocuments): una foto, un PDF (byte
//    identici all'arrivo) e un PDF oltre 4 MB (413).
// In piu': cliente.prova su portfolio deve prendere 403.
//
// Credenziali da .env.local: BOB_TEST_EMAIL/PASSWORD (cliente),
// BOB_TEST_PRO_EMAIL/PASSWORD (professionista di prova), service role per
// riscaricare e cancellare. I token restano in memoria e passano a curl da
// stdin; si stampano solo stati, percorsi ed esiti.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3124";
const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVIZIO = env.SUPABASE_SERVICE_ROLE_KEY;
const mancanti = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "BOB_TEST_EMAIL", "BOB_TEST_PASSWORD", "BOB_TEST_PRO_EMAIL", "BOB_TEST_PRO_PASSWORD"].filter((k) => !env[k]);
if (mancanti.length) {
  console.error(`Mancano in .env.local: ${mancanti.join(", ")}`);
  process.exit(2);
}

// Node 20 non ha WebSocket nativo e qui il realtime non serve: trasporto finto.
const opzioni = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: class WsFinta {} } };
const admin = createClient(URL_SB, SERVIZIO, opzioni);
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), "prova-switch-"));
const esiti = [];
const ok = (nome, vero, dettaglio = "") => {
  esiti.push({ nome, vero });
  console.log(`${vero ? "OK  " : "NO  "} ${nome}${dettaglio ? `  — ${dettaglio}` : ""}`);
};

async function fotoConGps() {
  const w = 40, h = 20, raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) raw.set(i % w < w / 2 ? [255, 0, 0] : [0, 0, 255], i * 3);
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .jpeg()
    .withExif({ IFD0: { Make: "TelefonoProva", Model: "X1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "45/1 28/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "9/1 11/1 0/1" } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

async function descrivi(buf) {
  const m = await sharp(buf).metadata();
  const pulita = !m.exif && m.orientation === undefined && !buf.includes("TelefonoProva") && m.width === 20 && m.height === 40;
  return { pulita, testo: `${m.format} ${m.width}x${m.height}, exif ${m.exif ? "PRESENTE" : "assente"}, orientamento ${m.orientation ?? "assente"}, marca ${buf.includes("TelefonoProva") ? "PRESENTE" : "assente"}` };
}

async function login(email, password) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const c = await r.json().catch(() => ({}));
  if (!r.ok || !c.access_token) throw new Error(`login rifiutato per ${email} (${r.status}): ${c.error_description ?? c.msg ?? "?"}`);
  return c;
}

const revoca = (s) =>
  fetch(`${URL_SB}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${s.access_token}` } })
    .then((r) => r.ok || r.status === 204)
    .catch(() => false);

/** La stessa POST di src/lib/caricaFile.ts, fatta con curl. Il token entra da stdin. */
function carica(bucket, file, tipo, token) {
  const r = spawnSync(
    "curl",
    ["-sS", "-K", "-", "-w", "\n%{http_code}", "-F", `bucket=${bucket}`, "-F", `file=@${file};type=${tipo}`, `${BASE}/api/upload/immagine`],
    { input: token ? `header = "Authorization: Bearer ${token}"\n` : "", encoding: "utf8" }
  );
  const righe = r.stdout.trimEnd().split("\n");
  const stato = Number(righe.pop());
  let corpo = null;
  try { corpo = JSON.parse(righe.join("\n")); } catch { /* corpo non JSON */ }
  console.log(`\n$ curl -F bucket=${bucket} -F file=@${path.basename(file)};type=${tipo} ${BASE}/api/upload/immagine\nHTTP ${stato}  ${JSON.stringify(corpo)}`);
  return { stato, corpo };
}

async function scarica(bucket, p) {
  const { data, error } = await admin.storage.from(bucket).download(p);
  if (error || !data) throw new Error(`download ${bucket}/${p}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function esiste(bucket, p) {
  const [cart, nome] = [p.slice(0, p.lastIndexOf("/")), p.slice(p.lastIndexOf("/") + 1)];
  const { data } = await admin.storage.from(bucket).list(cart, { search: nome });
  return (data ?? []).some((f) => f.name === nome);
}

async function main() {
  const foto = path.join(cartella, "foto.jpg");
  fs.writeFileSync(foto, await fotoConGps());
  const pdf = path.join(cartella, "visura.pdf");
  fs.writeFileSync(pdf, "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  const pdfGrande = path.join(cartella, "grande.pdf");
  fs.writeFileSync(pdfGrande, Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(4 * 1024 * 1024)]));
  console.log(`ingresso: ${(await descrivi(fs.readFileSync(foto))).testo}`);

  // --- 1. /api/bob/chat, anonimo ---
  console.log("\n== 1. /api/bob/chat (anonimo, foto nel JSON come da app nativa) ==");
  const prima = new Date();
  const r = await fetch(`${BASE}/api/bob/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Perde il rubinetto della cucina", imageBase64: fs.readFileSync(foto).toString("base64"), imageMediaType: "image/jpeg" }] }),
  });
  console.log(`POST /api/bob/chat -> HTTP ${r.status}`);
  // Senza chiave Anthropic in locale risponde a regole: l'upload parte lo stesso,
  // ma il percorso non torna nella risposta. Lo si cerca nel bucket.
  let nuovo = null;
  for (let i = 0; i < 10 && !nuovo; i++) {
    await new Promise((res) => setTimeout(res, 500));
    const { data } = await admin.storage.from("brief-photos").list("chat", { sortBy: { column: "created_at", order: "desc" }, limit: 5 });
    nuovo = (data ?? []).find((f) => new Date(f.created_at) >= new Date(prima.getTime() - 2000));
  }
  if (!nuovo) ok("chat: foto arrivata in brief-photos/chat/", false, "nessun file nuovo");
  else {
    const p = `chat/${nuovo.name}`;
    const d = await descrivi(await scarica("brief-photos", p));
    ok("chat: file in brief-photos senza metadati e ruotato", d.pulita, `${p}: ${d.testo}`);
    await admin.storage.from("brief-photos").remove([p]);
    ok("chat: file di prova cancellato", !(await esiste("brief-photos", p)));
  }

  const cliente = await login(env.BOB_TEST_EMAIL, env.BOB_TEST_PASSWORD);
  const pro = await login(env.BOB_TEST_PRO_EMAIL, env.BOB_TEST_PRO_PASSWORD);
  try {
    // --- 2. portfolio ---
    console.log("\n== 2. portfolio (ProPortfolio) ==");
    ok("cliente su portfolio: 403", carica("portfolio", foto, "image/jpeg", cliente.access_token).stato === 403);
    const pf = carica("portfolio", foto, "image/jpeg", pro.access_token);
    ok("pro su portfolio: 200 con publicUrl", pf.stato === 200 && !!pf.corpo?.publicUrl);
    if (pf.corpo?.publicUrl) {
      const pubblica = Buffer.from(await (await fetch(pf.corpo.publicUrl)).arrayBuffer());
      const d = await descrivi(pubblica);
      ok("portfolio: l'URL pubblico serve un file senza metadati", d.pulita, d.testo);
      // Il rollback di ProPortfolio: remove() col client del pro, sotto la policy.
      const comePro = createClient(URL_SB, ANON, { ...opzioni, global: { headers: { Authorization: `Bearer ${pro.access_token}` } } });
      const { data: tolti, error } = await comePro.storage.from("portfolio").remove([pf.corpo.path]);
      ok("portfolio: il rollback col token del pro cancella il file", !error && (tolti ?? []).length === 1 && !(await esiste("portfolio", pf.corpo.path)), error?.message ?? `${(tolti ?? []).length} file tolti`);
    }

    // --- 3. verifica-documenti ---
    console.log("\n== 3. verifica-documenti (VerificationDocuments) ==");
    const vf = carica("verifica-documenti", foto, "image/jpeg", pro.access_token);
    if (vf.stato === 200) {
      const d = await descrivi(await scarica("verifica-documenti", vf.corpo.path));
      ok("verifica: foto senza metadati", d.pulita, d.testo);
      await admin.storage.from("verifica-documenti").remove([vf.corpo.path]);
    } else ok("verifica: foto 200", false, `HTTP ${vf.stato}`);
    const vp = carica("verifica-documenti", pdf, "application/pdf", pro.access_token);
    if (vp.stato === 200) {
      const salvato = await scarica("verifica-documenti", vp.corpo.path);
      ok("verifica: PDF salvato com'e' arrivato (.pdf, byte identici)", vp.corpo.path.endsWith(".pdf") && salvato.equals(fs.readFileSync(pdf)));
      await admin.storage.from("verifica-documenti").remove([vp.corpo.path]);
    } else ok("verifica: PDF 200", false, `HTTP ${vp.stato}`);
    ok("verifica: PDF oltre 4 MB -> 413", carica("verifica-documenti", pdfGrande, "application/pdf", pro.access_token).stato === 413);
    ok("brief-photos: un PDF resta 415", carica("brief-photos", pdf, "application/pdf", cliente.access_token).stato === 415);
  } finally {
    console.log(`\nsessioni di prova revocate: cliente ${(await revoca(cliente)) ? "si" : "NO"}, pro ${(await revoca(pro)) ? "si" : "NO"}`);
    fs.rmSync(cartella, { recursive: true, force: true });
  }

  const falliti = esiti.filter((e) => !e.vero);
  console.log(`\n${falliti.length ? `FALLITO: ${falliti.map((e) => e.nome).join("; ")}` : `TUTTI COME ATTESO (${esiti.length} controlli)`}`);
  process.exit(falliti.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`errore: ${e?.message ?? "sconosciuto"}`);
  fs.rmSync(cartella, { recursive: true, force: true });
  process.exit(1);
});
