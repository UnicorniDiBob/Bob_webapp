// Prova dal vivo della migrazione 127: un client con sessione normale non
// scrive piu' nei bucket immagini, l'endpoint si'.
//
//   npx next build && npx next start -p 3124
//   node scripts/prova_lockdown.mjs aperto   PRIMA della 127: l'upload diretto RIESCE
//   node scripts/prova_lockdown.mjs chiuso   DOPO la 127: l'upload diretto FALLISCE
//
// Il giro «aperto» esiste perche' la prova possa fallire: se l'upload diretto
// non riuscisse nemmeno prima, il rifiuto di dopo non dimostrerebbe niente
// (potrebbe essere un token sbagliato, un percorso sbagliato, un bucket che
// non esiste). Ogni file scritto si riscarica e si cancella col service role.
//
// Credenziali da .env.local come scripts/prova_switch.mjs: il pro di prova
// (BOB_TEST_PRO_*) e il service role. Token in memoria, mai stampati.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const ATTESO = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:3124";
if (ATTESO !== "aperto" && ATTESO !== "chiuso") {
  console.error("uso: node scripts/prova_lockdown.mjs aperto|chiuso [base-url]");
  process.exit(2);
}

const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const { NEXT_PUBLIC_SUPABASE_URL: URL_SB, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVIZIO, BOB_TEST_PRO_EMAIL: EMAIL, BOB_TEST_PRO_PASSWORD: PASSWORD } = env;
if (!URL_SB || !ANON || !SERVIZIO || !EMAIL || !PASSWORD) {
  console.error("Mancano in .env.local: URL, chiave anon, service role o BOB_TEST_PRO_*.");
  process.exit(2);
}

const opzioni = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: class WsFinta {} } };
const admin = createClient(URL_SB, SERVIZIO, opzioni);
const BUCKET = ["portfolio", "verifica-documenti", "brief-photos"];

async function main() {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const s = await r.json();
  if (!s.access_token) throw new Error(`login rifiutato (${r.status})`);
  const uid = s.user.id;
  const comePro = createClient(URL_SB, ANON, { ...opzioni, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
  const foto = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c33" } }).jpeg().toBuffer();
  const esiti = [];

  try {
    console.log(`== upload DIRETTO su Supabase Storage col token del pro (atteso: ${ATTESO === "aperto" ? "riesce" : "rifiutato"}) ==`);
    for (const b of BUCKET) {
      const p = `${uid}/prova-diretta-${Date.now()}.jpg`;
      const { error } = await comePro.storage.from(b).upload(p, foto, { contentType: "image/jpeg" });
      // brief-photos non ha mai avuto una policy: e' chiuso anche prima.
      const atteso = ATTESO === "aperto" && b !== "brief-photos" ? "riesce" : "rifiutato";
      const visto = error ? "rifiutato" : "riesce";
      console.log(`${visto === atteso ? "OK " : "NO "} ${b.padEnd(19)} ${visto}${error ? `: ${error.message}` : ""}`);
      esiti.push(visto === atteso);
      if (!error) await admin.storage.from(b).remove([p]);
    }

    console.log(`\n== upload VIA ENDPOINT ${BASE}/api/upload/immagine (atteso: 200 in tutti e due i giri) ==`);
    const cartella = fs.mkdtempSync(path.join(os.tmpdir(), "prova-lockdown-"));
    const file = path.join(cartella, "foto.jpg");
    fs.writeFileSync(file, foto);
    for (const b of ["portfolio", "verifica-documenti"]) {
      const c = spawnSync("curl", ["-sS", "-K", "-", "-w", "\n%{http_code}", "-F", `bucket=${b}`, "-F", `file=@${file};type=image/jpeg`, `${BASE}/api/upload/immagine`], {
        input: `header = "Authorization: Bearer ${s.access_token}"\n`,
        encoding: "utf8",
      });
      const righe = c.stdout.trimEnd().split("\n");
      const stato = Number(righe.pop());
      let corpo = null;
      try { corpo = JSON.parse(righe.join("\n")); } catch { /* non JSON */ }
      const scritto = corpo?.path ? (await admin.storage.from(b).list(uid)).data?.some((f) => corpo.path.endsWith(f.name)) : false;
      console.log(`${stato === 200 && scritto ? "OK " : "NO "} ${b.padEnd(19)} HTTP ${stato}${scritto ? ", file presente nel bucket" : ""}`);
      esiti.push(stato === 200 && scritto);
      if (corpo?.path) await admin.storage.from(b).remove([corpo.path]);
    }
    fs.rmSync(cartella, { recursive: true, force: true });

    const resti = await Promise.all(BUCKET.map(async (b) => (await admin.storage.from(b).list(uid)).data?.length ?? 0));
    console.log(`\nfile rimasti nella cartella del pro: ${BUCKET.map((b, i) => `${b} ${resti[i]}`).join(", ")}`);
  } finally {
    const out = await fetch(`${URL_SB}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${s.access_token}` } });
    console.log(`sessione di prova revocata: ${out.ok || out.status === 204 ? "si" : "NO"}`);
  }

  const tutti = esiti.every(Boolean);
  console.log(tutti ? `\nGIRO «${ATTESO}» COME ATTESO (${esiti.length} controlli)` : "\nFALLITO");
  process.exit(tutti ? 0 : 1);
}

main().catch((e) => {
  console.error(`errore: ${e?.message ?? "sconosciuto"}`);
  process.exit(1);
});
