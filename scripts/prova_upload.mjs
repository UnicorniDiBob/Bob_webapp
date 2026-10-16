// Prova dal vivo di /api/upload/immagine con curl, su un server locale:
//
//   npx next build && npx next start -p 3124
//   node scripts/prova_upload.mjs http://localhost:3124
//
// Tre richieste vere: senza sessione (401), un PDF rinominato .jpg (415),
// una foto con GPS (200). Dopo il 200 riscarica il file DAL BUCKET e
// controlla con sharp che non abbia exif, GPS ne' orientamento: la prova e'
// quello che e' stato scritto, non la risposta della route. Poi lo cancella e
// revoca la sessione di prova.
//
// Il login lo fa lo script con BOB_TEST_EMAIL/BOB_TEST_PASSWORD di .env.local
// (account cliente: scrive in brief-photos, il bucket privato). Il token
// passa a curl da stdin (`-K -`), mai sulla riga di comando: non compare in
// ps, ne' in un log, ne' in un file. Si stampano solo stato e corpo.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3124";
const ROTTA = `${BASE}/api/upload/immagine`;
const BUCKET = "brief-photos";

const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { NEXT_PUBLIC_SUPABASE_URL: URL_SB, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, BOB_TEST_EMAIL: EMAIL, BOB_TEST_PASSWORD: PASSWORD, SUPABASE_SERVICE_ROLE_KEY: SERVIZIO } = env;
if (!URL_SB || !ANON || !EMAIL || !PASSWORD) {
  console.error("Mancano in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, BOB_TEST_EMAIL, BOB_TEST_PASSWORD.");
  process.exit(2);
}

// I file di prova in una cartella temporanea, cancellata alla fine.
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), "prova-upload-"));
const foto = path.join(cartella, "foto.jpg");
const finto = path.join(cartella, "documento.jpg");

async function preparaFile() {
  const w = 40, h = 20, raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) raw.set(i % w < w / 2 ? [255, 0, 0] : [0, 0, 255], i * 3);
  fs.writeFileSync(
    foto,
    await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
      .jpeg()
      .withExif({ IFD0: { Make: "TelefonoProva", Model: "X1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "45/1 28/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "9/1 11/1 0/1" } })
      .withMetadata({ orientation: 6 })
      .toBuffer()
  );
  // Un PDF vero col nome .jpg: curl dichiarera' image/jpeg.
  fs.writeFileSync(finto, "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  const m = await sharp(foto).metadata();
  console.log(`foto di prova: ${m.width}x${m.height}, orientamento ${m.orientation}, exif ${m.exif ? `${m.exif.length} byte, GPS ${m.exif.includes(Buffer.from([0x88, 0x25])) || m.exif.includes(Buffer.from([0x25, 0x88])) ? "presente" : "assente"}` : "assente"}`);
}

/** curl vero. Il token, se c'e', entra da stdin come file di configurazione. */
function curl(nome, file, tipo, token) {
  const conf = token ? `header = "Authorization: Bearer ${token}"\n` : "";
  const r = spawnSync(
    "curl",
    ["-sS", "-K", "-", "-w", "\n%{http_code}", "-F", `file=@${file};type=${tipo}`, "-F", `bucket=${BUCKET}`, ROTTA],
    { input: conf, encoding: "utf8" }
  );
  const righe = r.stdout.trimEnd().split("\n");
  const stato = Number(righe.pop());
  const corpo = righe.join("\n");
  console.log(`\n$ curl -F file=@${path.basename(file)};type=${tipo} -F bucket=${BUCKET} ${ROTTA}${token ? "   [Authorization: Bearer <token da stdin>]" : ""}`);
  console.log(`HTTP ${stato}  ${corpo}`);
  return { stato, corpo: (() => { try { return JSON.parse(corpo); } catch { return null; } })() };
}

async function login() {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const c = await r.json().catch(() => ({}));
  if (!r.ok || !c.access_token) throw new Error(`login rifiutato (${r.status}): ${c.error_description ?? c.msg ?? "?"}`);
  return c;
}

async function revoca(s) {
  const r = await fetch(`${URL_SB}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${s.access_token}` },
  });
  return r.ok || r.status === 204;
}

async function main() {
  await preparaFile();
  const esiti = {};
  esiti.senzaSessione = curl("senza sessione", foto, "image/jpeg", null).stato;

  const s = await login();
  try {
    esiti.pdf = curl("pdf rinominato", finto, "image/jpeg", s.access_token).stato;
    const ok = curl("foto valida", foto, "image/jpeg", s.access_token);
    esiti.foto = ok.stato;

    if (ok.stato === 200 && ok.corpo?.path) {
      if (!SERVIZIO) {
        console.log("\n(senza SUPABASE_SERVICE_ROLE_KEY lo script non puo' riscaricare ne' cancellare il file: va tolto a mano)");
      } else {
        // Node 20 non ha WebSocket nativo e qui il realtime non serve: trasporto finto.
        const admin = createClient(URL_SB, SERVIZIO, { auth: { persistSession: false }, realtime: { transport: class WsFinta {} } });
        const { data: blob, error } = await admin.storage.from(BUCKET).download(ok.corpo.path);
        if (error || !blob) throw new Error(`download: ${error?.message}`);
        const salvato = Buffer.from(await blob.arrayBuffer());
        const m = await sharp(salvato).metadata();
        console.log(`\nfile nel bucket: ${m.format} ${m.width}x${m.height}, exif ${m.exif ? "PRESENTE" : "assente"}, orientamento ${m.orientation ?? "assente"}, "TelefonoProva" ${salvato.includes("TelefonoProva") ? "PRESENTE" : "assente"}`);
        esiti.pulito = !m.exif && m.orientation === undefined && !salvato.includes("TelefonoProva") && m.width === 20 && m.height === 40;
        const { error: delErr } = await admin.storage.from(BUCKET).remove([ok.corpo.path]);
        console.log(`file di prova cancellato dal bucket: ${delErr ? `NO (${delErr.message})` : "si"}`);
      }
    }
  } finally {
    console.log(`sessione di prova revocata: ${(await revoca(s).catch(() => false)) ? "si" : "NO, chiuderla a mano"}`);
    fs.rmSync(cartella, { recursive: true, force: true });
  }

  const attesi = { senzaSessione: 401, pdf: 415, foto: 200 };
  const falliti = Object.keys(attesi).filter((k) => esiti[k] !== attesi[k]);
  if (esiti.foto === 200 && esiti.pulito === false) falliti.push("file nel bucket non pulito");
  console.log(`\n${falliti.length ? `FALLITO: ${falliti.join(", ")}` : "401 / 415 / 200 COME ATTESO"}`);
  process.exit(falliti.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`errore: ${e?.message ?? "sconosciuto"}`);
  fs.rmSync(cartella, { recursive: true, force: true });
  process.exit(1);
});
