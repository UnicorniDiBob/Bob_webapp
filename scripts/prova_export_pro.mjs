// Prova dal vivo dell'export del professionista (17/10, finding del 29/09).
//
//   npm run build
//   node scripts/prova_export_pro.mjs            la prova
//   node scripts/prova_export_pro.mjs --pulisci  toglie cio' che un giro interrotto ha lasciato
//
// UTENTI USA-E-GETTA, creati qui, mai account reali o demo:
// - P (prova.exportpro.pro@bobapp.it): un professionista is_test_fixture,
//   spento subito dopo i due caricamenti, con servizio, orari, un giorno bloccato, verifica (esaminata da
//   uno «staff» con un nome che NON deve uscire), un documento e una foto di
//   portfolio caricati dalla rotta vera /api/upload/immagine.
// - C1 (accettato): una richiesta con appuntamento CONFERMATO, indirizzo,
//   chat, recensione. Il suo indirizzo DEVE uscire (controllo positivo).
// - C2 (non accettato): una richiesta aperta, con indirizzo esatto e un
//   brief con una foto. Il riassunto e la foto DEVONO uscire (li mostra
//   request-summary); l'indirizzo NO. Piu' un secondo brief di C2 che cita
//   una foto che C1 citava gia' prima (lo strato di FOTO1): NON deve uscire.
// - C3: una richiesta CHIUSA con un brief e una foto: non deve uscire niente
//   del brief.
// Di nessun cliente devono uscire email, telefono, id, nome dal profilo.
//
// Lo ZIP si salva in --zip <file> (facoltativo) per aprirlo con unzip vero.
// La pulizia gira in finally e su SIGINT/SIGTERM, dal registro su disco, e
// VERIFICA che utenti, righe e file non ci siano piu'.

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const PORTA = 3128;
const BASE = `http://localhost:${PORTA}`;
const EMAIL = {
  pro: "prova.exportpro.pro@bobapp.it",
  c1: "prova.exportpro.c1@bobapp.it",
  c2: "prova.exportpro.c2@bobapp.it",
  c3: "prova.exportpro.c3@bobapp.it",
};
const REGISTRO = path.join(process.env.TMPDIR ?? "/tmp", "prova_export_pro_registro.json");
const iZip = process.argv.indexOf("--zip");
const FILE_ZIP = iZip > 0 ? process.argv[iZip + 1] : null;

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
const vuoto = () => ({ utenti: [], brief: [], fileChat: [] });
const leggiRegistro = () => (fs.existsSync(REGISTRO) ? { ...vuoto(), ...JSON.parse(fs.readFileSync(REGISTRO, "utf8")) } : vuoto());
let reg = vuoto();
const annota = () => fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 2));
const registroVuoto = (r) => !r.utenti.length && !r.brief.length && !r.fileChat.length;
let server = null;
let esitoPulizia = null;

async function fileIn(bucket, cartella) {
  const { data } = await admin.storage.from(bucket).list(cartella, { limit: 1000 });
  return (data ?? []).filter((f) => f.id).map((f) => `${cartella}/${f.name}`);
}
async function esisteChat(p) {
  const { data } = await admin.storage.from("brief-photos").list("chat", { search: p.slice(5) });
  return (data ?? []).some((f) => `chat/${f.name}` === p);
}

async function pulisci(motivo) {
  if (esitoPulizia !== null) return esitoPulizia;
  console.log(`\n== pulizia (${motivo}) ==`);
  if (server) { server.kill("SIGTERM"); server = null; }
  if (reg.utenti.length) {
    const { data } = await admin.from("job_briefs").select("id").in("user_id", reg.utenti);
    for (const { id } of data ?? []) if (!reg.brief.includes(id)) reg.brief.push(id);
    annota();
  }
  if (reg.brief.length) await admin.from("job_briefs").delete().in("id", reg.brief);
  if (reg.fileChat.length) await admin.storage.from("brief-photos").remove(reg.fileChat);
  for (const id of reg.utenti) {
    for (const b of ["verifica-documenti", "portfolio", "brief-photos"]) {
      const f = await fileIn(b, id);
      if (f.length) await admin.storage.from(b).remove(f);
    }
  }
  const problemi = [];
  for (const id of reg.utenti) {
    if ((await admin.auth.admin.getUserById(id)).data?.user) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) problemi.push(`utente ${id.slice(0, 8)}: ${error.message}`);
    }
  }
  if (reg.utenti.length) await admin.from("rate_limit_counters").delete().in("actor_key", reg.utenti.map((id) => `user:${id}`));

  for (const id of reg.utenti) {
    if ((await admin.auth.admin.getUserById(id)).data?.user) problemi.push(`l'utente ${id.slice(0, 8)} esiste ancora`);
    for (const b of ["verifica-documenti", "portfolio", "brief-photos"]) {
      if ((await fileIn(b, id)).length) problemi.push(`file rimasti in ${b}/${id.slice(0, 8)}`);
    }
  }
  for (const p of reg.fileChat) if (await esisteChat(p)) problemi.push(`file rimasto: brief-photos/${p}`);
  const conta = async (tabella, colonna, valori) => {
    if (!valori.length) return;
    const { count } = await admin.from(tabella).select("*", { count: "exact", head: true }).in(colonna, valori);
    if (count) problemi.push(`${count} righe rimaste in ${tabella}`);
  };
  await conta("job_briefs", "id", reg.brief);
  await conta("professionals", "user_id", reg.utenti);
  await conta("requests", "customer_id", reg.utenti);
  await conta("profiles", "user_id", reg.utenti);
  await conta("rate_limit_counters", "actor_key", reg.utenti.map((id) => `user:${id}`));
  if (problemi.length) {
    console.log(`PULIZIA INCOMPLETA: ${problemi.join("; ")}. Registro in ${REGISTRO}: rilanciare con --pulisci.`);
    return (esitoPulizia = false);
  }
  if (!registroVuoto(reg)) fs.rmSync(REGISTRO, { force: true });
  console.log(`pulizia verificata: ${reg.utenti.length} utenti, ${reg.brief.length} brief, ${reg.fileChat.length} foto di chat e le cartelle dei file non ci sono piu'`);
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
const bearer = (s) => ({ authorization: `Bearer ${s.access_token}` });

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

async function avviaServer() {
  server = spawn("npx", ["next", "start", "-p", String(PORTA)], { env: { ...process.env }, stdio: ["ignore", "ignore", "inherit"] });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/`); return; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error("il server locale non parte");
}

const jpeg = (colore) => sharp({ create: { width: 48, height: 48, channels: 3, background: colore } }).jpeg().toBuffer();
async function carica(sessione, bucket, buf) {
  const form = new FormData();
  form.append("bucket", bucket);
  form.append("file", new Blob([buf], { type: "image/jpeg" }), "foto.jpg");
  const r = await fetch(`${BASE}/api/upload/immagine`, { method: "POST", headers: bearer(sessione), body: form });
  const corpo = await r.json().catch(() => null);
  if (!r.ok || !corpo?.path) throw new Error(`upload ${bucket}: HTTP ${r.status} ${JSON.stringify(corpo)}`);
  return corpo;
}
async function fotoChat(colore) {
  const p = `chat/${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
  reg.fileChat.push(p); annota();
  const buf = await jpeg(colore);
  const { error } = await admin.storage.from("brief-photos").upload(p, buf, { contentType: "image/jpeg" });
  if (error) throw new Error(`upload chat: ${error.message}`);
  return { p, buf };
}
async function brief(userId, testo, percorso, quando) {
  const id = randomUUID();
  reg.brief.push(id); annota();
  await scrivi("job_briefs", { id, user_id: userId, summary: testo, photos: percorso ? [{ storagePath: percorso, aiCaption: "foto di prova" }] : [], source: "rules", ...(quando ? { created_at: quando } : {}) });
  return id;
}

// --- la prova --------------------------------------------------------------
async function prova() {
  if (!registroVuoto(leggiRegistro())) throw new Error(`c'e' un registro di un giro interrotto (${REGISTRO}): prima --pulisci`);
  const { data: esistenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const email of Object.values(EMAIL)) {
    if ((esistenti?.users ?? []).some((u) => u.email === email)) throw new Error(`${email} esiste gia': non lo tocco`);
  }

  const P = await nuovoUtente(EMAIL.pro, "professional");
  const C1 = await nuovoUtente(EMAIL.c1, "customer");
  const C2 = await nuovoUtente(EMAIL.c2, "customer");
  const C3 = await nuovoUtente(EMAIL.c3, "customer");
  console.log(`utenti di prova: P ${P.id}, C1 ${C1.id}, C2 ${C2.id}, C3 ${C3.id}`);

  // I segreti dei clienti: nessuno deve comparire nello ZIP del pro.
  const segreti = {
    "email C1": EMAIL.c1, "email C2": EMAIL.c2, "email C3": EMAIL.c3,
    "id C1": C1.id, "id C2": C2.id, "id C3": C3.id,
    "telefono C1": "+393331110001", "telefono C2": "+393331110002",
    "cognome C1 dal profilo": "Riservatissimo", "cognome C2 dal profilo": "Nascostissimo",
    "indirizzo C2 (non accettato)": "Via Segreta Cliente Due 77",
    "riassunto brief C3 (richiesta chiusa)": "BRIEF-CHIUSO-C3",
    "nome dello staff": "Ispettrice Staffina",
  };
  for (const [u, tel, cognome] of [[C1, segreti["telefono C1"], "Riservatissimo"], [C2, segreti["telefono C2"], "Nascostissimo"]]) {
    await admin.from("profile_phone").upsert({ user_id: u.id, phone: tel });
    await admin.from("profiles").update({ full_name: `Mario ${cognome}`, last_name: cognome }).eq("user_id", u.id);
  }
  await admin.from("profile_phone").upsert({ user_id: P.id, phone: "+393339990000" });

  const { data: milano } = await admin.from("cities").select("id").eq("slug", "milano").single();
  const { data: sub } = await admin.from("subservices").select("id, service_id").limit(1).single();
  const pro = await scrivi("professionals", {
    user_id: P.id, city_id: milano.id, business_name: "Prova Export Pro srl", headline: "Idraulico di prova",
    is_test_fixture: true,
  });
  await scrivi("professional_services", { professional_id: pro.id, service_id: sub.service_id, subservice_id: sub.id, city_id: milano.id, min_price: 50, max_price: 90 });
  await scrivi("professional_availability", { professional_id: pro.id, weekday: 1, start_time: "09:00", end_time: "13:00" });
  await scrivi("professional_availability_blocks", { professional_id: pro.id, starts_at: "2026-12-24T00:00:00Z", ends_at: "2026-12-27T00:00:00Z", reason: "ferie di prova" });
  await admin.from("professional_verification").upsert({ professional_id: pro.id, vat_number: "01234567890", vat_reviewed_by_name: segreti["nome dello staff"], declared_business_name: "Prova Export Pro srl" });
  await scrivi("verification_events", { professional_id: pro.id, event: "vat_submitted", actor_user_id: P.id, actor_role: "professional" });
  await scrivi("verification_events", { professional_id: pro.id, event: "documents_requested", actor_name: segreti["nome dello staff"], actor_role: "admin", note: "serve la visura" });

  await avviaServer();
  console.log(`server locale pronto su ${BASE}\n`);

  // File del pro dalla rotta vera.
  const doc = await carica(P.sessione, "verifica-documenti", await jpeg("#a33"));
  await scrivi("verification_documents", { professional_id: pro.id, uploaded_by: P.id, storage_path: doc.path, file_name: "visura.jpg", doc_type: "visura" });
  const port = await carica(P.sessione, "portfolio", await jpeg("#36c"));
  await scrivi("portfolio_items", { professional_id: pro.id, title: "Bagno rifatto", image_url: port.publicUrl });
  // Acceso solo per i due caricamenti (un profilo spento non carica): ora si spegne.
  await admin.from("professionals").update({ deactivated_at: new Date().toISOString() }).eq("id", pro.id);

  // C1: accettato, con appuntamento confermato.
  const r1 = await scrivi("requests", { customer_id: C1.id, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id, status: "sent", problem_description: "Prova export: perdita in bagno", urgency: "media" });
  await scrivi("request_professionals", { request_id: r1.id, professional_id: pro.id, status: "contacted" });
  await scrivi("request_addresses", { request_id: r1.id, address_line: "Via Accettata Uno 5", city_name: "Milano" });
  await scrivi("request_messages", { request_id: r1.id, professional_id: pro.id, sender_type: "customer", sender_id: C1.id, message: "Buongiorno, mi serve aiuto" });
  await scrivi("request_messages", { request_id: r1.id, professional_id: pro.id, sender_type: "professional", sender_id: P.id, message: "Certo, passo giovedi'" });
  await scrivi("appointments", { professional_id: pro.id, request_id: r1.id, customer_name: "Mario", title: "Sopralluogo", starts_at: "2026-12-03T09:00:00Z", duration_minutes: 60, status: "confirmed", proposed_by: "professional", source: "pro" });
  await scrivi("ratings", { professional_id: pro.id, customer_id: C1.id, request_id: r1.id, score: 5, comment: "Bravissimo (prova)" });

  // C2: non accettato, richiesta aperta con brief e foto, indirizzo esatto.
  const fotoC2 = await fotoChat("#2a6");
  const fotoDiC1 = await fotoChat("#c62");
  await brief(C1.id, "brief di C1 che cita la sua foto", fotoDiC1.p, "2026-10-01T10:00:00Z");
  const b2 = await brief(C2.id, "Perdita sotto il lavello (brief C2)", fotoC2.p);
  const b2altrui = await brief(C2.id, "Brief di C2 con la foto di C1", fotoDiC1.p);
  const r2 = await scrivi("requests", { customer_id: C2.id, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id, status: "sent", problem_description: "Prova export: lavello, indirizzo: Via Segreta Cliente Due 77", brief_id: b2 });
  await scrivi("request_professionals", { request_id: r2.id, professional_id: pro.id, status: "suggested" });
  await scrivi("request_addresses", { request_id: r2.id, address_line: segreti["indirizzo C2 (non accettato)"], city_name: "Milano" });
  const r2bis = await scrivi("requests", { customer_id: C2.id, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id, status: "sent", problem_description: "Prova export: seconda richiesta di C2", brief_id: b2altrui });
  await scrivi("request_professionals", { request_id: r2bis.id, professional_id: pro.id, status: "suggested" });

  // C3: richiesta chiusa con brief e foto.
  const fotoC3 = await fotoChat("#999");
  const b3 = await brief(C3.id, segreti["riassunto brief C3 (richiesta chiusa)"], fotoC3.p);
  const r3 = await scrivi("requests", { customer_id: C3.id, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id, status: "sent", problem_description: "Prova export: richiesta di C3", brief_id: b3 });
  await scrivi("request_professionals", { request_id: r3.id, professional_id: pro.id, status: "suggested" });
  const { error: eChiudi } = await admin.from("requests").update({ status: "closed" }).eq("id", r3.id);
  if (eChiudi) throw new Error(`chiusura r3: ${eChiudi.message}`);

  // --- l'export --------------------------------------------------------------
  await admin.from("profile_private").update({ last_export_at: null }).eq("user_id", P.id);
  const r = await fetch(`${BASE}/api/account/esporta`, { headers: bearer(P.sessione) });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(`GET /api/account/esporta (P, Bearer) -> HTTP ${r.status}, ${r.headers.get("content-type")}, ${buf.length} byte`);
  ok("il professionista riceve lo ZIP (prima: 409)", r.status === 200 && r.headers.get("content-type") === "application/zip", r.status !== 200 ? buf.toString().slice(0, 200) : "");
  if (r.status !== 200) return;
  if (FILE_ZIP) fs.writeFileSync(FILE_ZIP, buf);
  const zip = leggiZip(buf);
  const doc_ = JSON.parse(zip["dati.json"].toString("utf8"));
  const lav = doc_.attivita_da_professionista;

  console.log("\nCONTENUTO DELLO ZIP");
  for (const [nome, dati] of Object.entries(zip)) console.log(`  ${nome}  (${dati.length} byte)`);
  console.log("\nSEZIONI DI dati.json");
  for (const [k, v] of Object.entries(doc_)) if (k !== "attivita_da_professionista") console.log(`  ${k}: ${Array.isArray(v) ? `${v.length} voci` : v === null ? "null" : typeof v}`);
  for (const [k, v] of Object.entries(lav ?? {})) console.log(`  attivita_da_professionista.${k}: ${Array.isArray(v) ? `${v.length} voci` : v === null ? "null" : typeof v}`);
  console.log("");

  // Il lavoro c'e' tutto.
  ok("profilo, azienda, servizi, orari, giorni bloccati", lav?.profilo_professionale?.business_name === "Prova Export Pro srl" && lav.servizi_e_prezzi.length === 1 && lav.orari_settimanali.length === 1 && lav.giorni_bloccati.length === 1);
  ok("verifica con P.IVA e storico (2 eventi)", lav?.verifica?.vat_number === "01234567890" && lav.storico_della_verifica.length === 2, JSON.stringify(lav?.storico_della_verifica?.map((e) => e.autore)));
  const fileDoc = lav?.documenti_di_verifica?.[0]?.nel_file;
  const docOriginale = Buffer.from(await (await admin.storage.from("verifica-documenti").download(doc.path)).data.arrayBuffer());
  ok("documento di verifica nello ZIP, byte per byte", !!fileDoc && !!zip[fileDoc] && zip[fileDoc].equals(docOriginale), fileDoc);
  const filePort = lav?.portfolio?.[0]?.nel_file;
  ok("foto del portfolio nello ZIP", !!filePort && !!zip[filePort], filePort);
  ok("quattro richieste ricevute, chat, appuntamento, recensione", lav?.richieste_ricevute?.length === 4 && lav.richieste_ricevute.find((x) => x.id === r1.id)?.conversazione?.length === 2 && lav.appuntamenti.length === 1 && lav.recensioni_ricevute.length === 1, `richieste: ${lav?.richieste_ricevute?.length}`);
  ok("consensi e termini (sezioni presenti)", Array.isArray(doc_.consensi_alle_comunicazioni) && Array.isArray(doc_.termini_accettati));
  const rq = (id) => lav?.richieste_ricevute?.find((x) => x.id === id);

  // I clienti: solo quello che il pro vede.
  ok("CONTROLLO: l'indirizzo di C1 (appuntamento confermato) c'e'", rq(r1.id)?.indirizzo_esatto?.indirizzo === "Via Accettata Uno 5");
  ok("l'indirizzo di C2 (non accettato) NON c'e'", rq(r2.id)?.indirizzo_esatto === null);
  const fotoR2 = rq(r2.id)?.scheda_di_bob?.foto?.[0]?.nel_file;
  ok("CONTROLLO: brief e foto della richiesta aperta di C2 ci sono, come in request-summary", rq(r2.id)?.scheda_di_bob?.riassunto?.includes("brief C2") && !!fotoR2 && zip[fotoR2]?.equals(fotoC2.buf), fotoR2);
  ok("FOTO1: il brief di C2 che cita la foto di C1 non la consegna", (rq(r2bis.id)?.scheda_di_bob?.foto ?? []).length === 0 && !Object.values(zip).some((d) => d.equals(fotoDiC1.buf)));
  ok("la richiesta chiusa di C3: niente brief, niente foto", rq(r3.id)?.scheda_di_bob === null && !Object.values(zip).some((d) => d.equals(fotoC3.buf)));
  const tutto = Object.values(zip).map((d) => d.toString("latin1")).join("\n");
  const trapelati = Object.entries(segreti).filter(([, v]) => tutto.includes(v));
  ok("nessun segreto dei clienti o dello staff nello ZIP (email, telefoni, id, cognomi, indirizzo non accettato, brief chiuso, nome staff)", trapelati.length === 0, trapelati.map(([n]) => n).join(", "));
  ok("nessuna customer_id / sender_id nel JSON", !/"(customer_id|sender_id|autore_id|actor_user_id|vat_reviewed_by)"/.test(zip["dati.json"].toString("utf8")));

  // Il limite di 24 ore vale anche per il pro.
  const r2do = await fetch(`${BASE}/api/account/esporta`, { headers: bearer(P.sessione) });
  const corpo2 = Buffer.from(await r2do.arrayBuffer());
  // Prima del 17/10 passava: la lettura di last_export_at veniva dalla cache
  // di Next (fetchCache in route.ts).
  ok("secondo export entro 24 ore: 429", r2do.status === 429, `HTTP ${r2do.status} ${corpo2.toString().slice(0, 120)}`);

  // Il cliente continua a funzionare, e ora ha anche le risposte alla registrazione.
  await admin.from("profile_private").update({ last_export_at: null }).eq("user_id", C1.id);
  const rc = await fetch(`${BASE}/api/account/esporta`, { headers: bearer(C1.sessione) });
  const zc = rc.status === 200 ? leggiZip(Buffer.from(await rc.arrayBuffer())) : {};
  const dc = zc["dati.json"] ? JSON.parse(zc["dati.json"].toString("utf8")) : {};
  const rc2 = await fetch(`${BASE}/api/account/esporta`, { headers: bearer(C1.sessione) });
  ok("e anche per il cliente il secondo export entro 24 ore e' 429 (prima della correzione: 200)", rc2.status === 429, `HTTP ${rc2.status}`);
  ok("l'export del cliente C1 continua a funzionare, senza blocco pro", rc.status === 200 && Array.isArray(dc.risposte_alla_registrazione) && !("attivita_da_professionista" in dc), `HTTP ${rc.status}`);
}

const soloPulizia = process.argv.includes("--pulisci");
let esito = 1;
try {
  if (soloPulizia) {
    reg = leggiRegistro();
    esito = 0;
  } else {
    await prova();
    esito = controlli.length && controlli.every(Boolean) ? 0 : 1;
  }
} catch (e) {
  console.error(`errore: ${e?.message ?? "sconosciuto"}`);
} finally {
  const puliziaOk = await pulisci(soloPulizia ? "--pulisci" : "fine della prova");
  if (!soloPulizia) console.log(`\n${esito === 0 && puliziaOk ? `TUTTO COME ATTESO (${controlli.length} controlli)` : "FALLITO o INCOMPLETO"}`);
  process.exit(esito === 0 && puliziaOk ? 0 : 1);
}
