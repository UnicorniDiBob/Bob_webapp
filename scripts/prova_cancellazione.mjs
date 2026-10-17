// Prova dal vivo del cron cancella-account (16/10 il caso semplice, 17/10 CANC2).
//
//   npm run build
//   node scripts/prova_cancellazione.mjs            la prova
//   node scripts/prova_cancellazione.mjs --pulisci  toglie cio' che un giro interrotto ha lasciato
//
// DUE UTENTI USA-E-GETTA, creati qui, mai account reali o demo:
// - un PROFESSIONISTA (prova.cancellazione.pro@bobapp.it): professionals
//   (is_test_fixture, spento), un servizio, la verifica, una zona di
//   copertura, un'immagine di portfolio; un file in verifica-documenti e uno
//   in portfolio;
// - un CLIENTE (prova.cancellazione.cliente@bobapp.it): una richiesta
//   collegata al pro e con il pro scelto, messaggi dei due e una proposta,
//   un appuntamento confermato futuro e uno concluso passato; il suo brief con
//   due foto di chat e i contatti nel testo libero, e un brief ANONIMO che ne
//   cita una (quella deve restare), un file in brief-photos. Dopo il cron il
//   brief del cliente NON deve esistere piu' (decisione del 17/10: si cancella
//   per intero, docs/legal/DECISIONE_conservazione_garanzia.md).
// - poi un TERZO utente, un cliente (prova.cancellazione.guasto@bobapp.it) con
//   un brief e una foto di chat, cancellato con lo storage GUASTO: il server
//   parte con scripts/prova_cancellazione_guasto.cjs, che fa fallire solo la
//   remove delle foto chat/. Atteso: falliti 1 col motivo foto-chat, e brief,
//   foto e account intatti. Poi lo stesso cron senza guasto (la «notte dopo»):
//   cancellati 1, e brief e foto spariti.
//
// PERCHE' COSI' (CANC2): dei 14 trigger SECURITY INVOKER sulle tabelle che la
// cancellazione tocca, la cascata ne fa partire solo tre — un trigger
// «UPDATE OF colonne» scatta solo se il SET NULL tocca proprio quelle colonne.
// proteggi_appuntamento_cliente (DELETE degli appuntamenti del pro),
// valida_scelta_professionista (requests.chosen_professional_id a NULL) e
// request_messages_appointment_guard (professional_id e appointment_id a
// NULL). Partono tutti e tre solo se il PRO va via per primo, mentre il
// cliente, la sua richiesta e l'appuntamento confermato ci sono ancora: la
// sua cancellazione e' scaduta da due giorni, quella del cliente da uno, e il
// cron le prende in quell'ordine.
//
// SCRITTO PER NON LASCIARE NIENTE IN GIRO
// - Ogni cosa creata si annota SUBITO nel registro (REGISTRO, solo id e
//   percorsi, nessun segreto). Se il processo muore, --pulisci lo rilegge.
// - La pulizia gira in finally, su SIGINT/SIGTERM e su qualunque errore, e alla
//   fine VERIFICA che utenti, file e righe non ci siano piu'.
// - La coda delle cancellazioni deve essere vuota all'inizio e contenere solo
//   i due di prova subito prima del cron, altrimenti il cron non parte.
// - Alla fine stampa gli id: la ricerca su TUTTE le colonne uuid di public
//   (righe di analisi comprese) si fa da li', fuori dallo script.

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const PORTA = 3125;
const EMAIL_PRO = "prova.cancellazione.pro@bobapp.it";
const EMAIL_CLIENTE = "prova.cancellazione.cliente@bobapp.it";
const EMAIL_GUASTO = "prova.cancellazione.guasto@bobapp.it";
const PRELOAD_GUASTO = path.resolve("scripts/prova_cancellazione_guasto.cjs");
const SEGNO_GUASTO = path.join(process.env.TMPDIR ?? "/tmp", "prova_cancellazione_guasto_segno.txt");
const TELEFONO_FINTO = "+39 333 000 0000";
const EMAIL_FINTA = "contatto.prova@example.com";
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
const vuoto = () => ({ utenti: [], file: [], brief: [] });
const leggiRegistro = () => (fs.existsSync(REGISTRO) ? { ...vuoto(), ...JSON.parse(fs.readFileSync(REGISTRO, "utf8")) } : vuoto());
let reg = vuoto();
const annota = () => fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 2));
const registroVuoto = (r) => !r.utenti.length && !r.file.length && !r.brief.length && !r.userId;

let server = null;
let esitoPulizia = null;

async function pulisci(motivo) {
  if (esitoPulizia !== null) return esitoPulizia;
  esitoPulizia = await pulisciUnaVolta(motivo);
  return esitoPulizia;
}

async function esisteFile({ bucket, path: p }) {
  const cartella = p.slice(0, p.lastIndexOf("/")), nome = p.slice(p.lastIndexOf("/") + 1);
  const { data } = await admin.storage.from(bucket).list(cartella, { search: nome });
  return (data ?? []).some((f) => f.name === nome);
}

async function pulisciUnaVolta(motivo) {
  console.log(`\n== pulizia (${motivo}) ==`);
  if (server) { server.kill("SIGTERM"); server = null; }
  // Il registro del 16/10 aveva un solo userId.
  const utenti = [...reg.utenti, ...(reg.userId ? [reg.userId] : [])];
  const problemi = [];
  for (const id of utenti) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data?.user) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) problemi.push(`utente ${id.slice(0, 8)}: ${error.message}`);
      else console.log(`utente di prova ${id.slice(0, 8)} cancellato dalla pulizia`);
    }
  }
  for (const { bucket, path: p } of reg.file) await admin.storage.from(bucket).remove([p]);
  if (reg.brief.length) await admin.from("job_briefs").delete().in("id", reg.brief);
  if (utenti.length) await admin.from("account_deletion_requests").delete().in("user_id", utenti);

  // Verifica: niente deve restare.
  for (const id of utenti) if ((await admin.auth.admin.getUserById(id)).data?.user) problemi.push(`l'utente ${id.slice(0, 8)} esiste ancora`);
  for (const f of reg.file) if (await esisteFile(f)) problemi.push(`file rimasto: ${f.bucket}/${f.path}`);
  if (reg.brief.length) {
    const { count } = await admin.from("job_briefs").select("id", { count: "exact", head: true }).in("id", reg.brief);
    if (count) problemi.push(`${count} brief rimasti`);
  }
  if (utenti.length) {
    const { count } = await admin.from("account_deletion_requests").select("user_id", { count: "exact", head: true }).in("user_id", utenti);
    if (count) problemi.push("richieste di cancellazione rimaste");
  }
  if (problemi.length) {
    console.log(`PULIZIA INCOMPLETA: ${problemi.join("; ")}. Il registro resta in ${REGISTRO}: rilanciare con --pulisci.`);
    return false;
  }
  // Un registro vuoto non e' mio: puo' essere quello di un giro interrotto,
  // l'unica traccia di cosa va tolto. Lo cancello solo se ho pulito io.
  if (!registroVuoto(reg)) fs.rmSync(REGISTRO, { force: true });
  console.log(`pulizia verificata: ${utenti.length} utenti, ${reg.file.length} file e ${reg.brief.length} brief di prova non ci sono piu'`);
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
const scrivi = async (tabella, riga) => {
  const { data, error } = await admin.from(tabella).insert(riga).select().single();
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return data;
};
const aggiorna = async (tabella, campi, col, val) => {
  const { error } = await admin.from(tabella).update(campi).eq(col, val);
  if (error) throw new Error(`${tabella} update: ${error.message}`);
};

async function scadute() {
  const { data, error } = await admin.from("account_deletion_requests").select("user_id").lte("scheduled_for", new Date().toISOString());
  if (error) throw new Error(`coda: ${error.message}`);
  return (data ?? []).map((r) => r.user_id);
}

async function avviaServer(segreto, porta = PORTA, envExtra = {}) {
  server = spawn("npx", ["next", "start", "-p", String(porta)], {
    env: { ...process.env, CRON_SECRET: segreto, ...envExtra },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://localhost:${porta}/`); return; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error("il server locale non parte");
}

async function nuovoUtente(email, ruolo) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { role: ruolo },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  reg.utenti.push(data.user.id); annota();
  return data.user.id;
}

async function carica(f, jpeg) {
  reg.file.push(f); annota();
  const { error } = await admin.storage.from(f.bucket).upload(f.path, jpeg, { contentType: "image/jpeg" });
  if (error) throw new Error(`upload ${f.bucket}/${f.path}: ${error.message}`);
}

async function prova() {
  // 0. Nessun residuo di un giro precedente, e la coda e' quella che pensiamo.
  if (!registroVuoto(leggiRegistro())) {
    throw new Error(`c'e' un registro di un giro interrotto (${REGISTRO}): prima node scripts/prova_cancellazione.mjs --pulisci`);
  }
  const { data: esistenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const email of [EMAIL_PRO, EMAIL_CLIENTE, EMAIL_GUASTO]) {
    if ((esistenti?.users ?? []).some((u) => u.email === email)) throw new Error(`${email} esiste gia': non lo tocco`);
  }
  const primaDellaProva = await scadute();
  console.log(`coda all'inizio: ${primaDellaProva.length} cancellazioni scadute`);
  if (primaDellaProva.length) throw new Error("la coda NON e' vuota: il cron cancellerebbe account veri. Mi fermo.");

  const { data: milano } = await admin.from("cities").select("id").eq("slug", "milano").single();
  const { data: sub } = await admin.from("subservices").select("id, service_id").limit(1).single();
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#36c" } }).jpeg().toBuffer();
  const tag = randomUUID().slice(0, 8);
  const ids = {};

  // 1. Il professionista.
  const proUid = await nuovoUtente(EMAIL_PRO, "professional");
  ids.proUser = proUid;
  const pro = await scrivi("professionals", {
    user_id: proUid, city_id: milano.id, business_name: "Prova cancellazione",
    is_test_fixture: true, deactivated_at: new Date().toISOString(),
  });
  ids.pro = pro.id;
  const servizio = await scrivi("professional_services", {
    professional_id: pro.id, service_id: sub.service_id, subservice_id: sub.id, city_id: milano.id, min_price: 50, max_price: 100,
  });
  ids.servizio = servizio.id;
  // La riga di verifica la crea il trigger alla nascita del professionista.
  await aggiorna("professional_verification", { vat_review_state: "pending", declared_business_name: "Prova cancellazione" }, "professional_id", pro.id);
  await scrivi("professional_coverage", { professional_id: pro.id, scope: "zones", mode: "zones", city_id: milano.id, zone_slugs: ["brera"] });
  const fileVerifica = { bucket: "verifica-documenti", path: `${proUid}/doc-${tag}.jpg` };
  const filePortfolio = { bucket: "portfolio", path: `${proUid}/lavoro-${tag}.jpg` };
  await carica(fileVerifica, jpeg);
  await carica(filePortfolio, jpeg);
  await scrivi("portfolio_items", { professional_id: pro.id, title: "Prova", image_url: filePortfolio.path });
  console.log(`professionista di prova: utente ${proUid}, professionals ${pro.id}`);

  // 2. Il cliente.
  const cliUid = await nuovoUtente(EMAIL_CLIENTE, "customer");
  ids.cliente = cliUid;
  const fileCliente = { bucket: "brief-photos", path: `${cliUid}/foto-${tag}.jpg` };
  const chatSua = { bucket: "brief-photos", path: `chat/prova-sua-${tag}.jpg` };
  const chatCondivisa = { bucket: "brief-photos", path: `chat/prova-condivisa-${tag}.jpg` };
  for (const f of [fileCliente, chatSua, chatCondivisa]) await carica(f, jpeg);
  for (const b of [
    // Il testo come lo scriverebbe un cliente vero, con i contatti dentro: e'
    // quello che non deve sopravvivere al cron (numero e indirizzo finti).
    {
      user_id: cliUid, photos: [{ storagePath: chatSua.path, aiCaption: null }, { storagePath: chatCondivisa.path, aiCaption: null }], source: "rules",
      summary: "Presa che scintilla in cucina", zone: "Brera", budget_min: 80, budget_max: 150,
      timing_availability: `Dopo le 18, se no chiamate il ${TELEFONO_FINTO}`,
      access_notes: `Citofono Prova, terzo piano. Chiamatemi al ${TELEFONO_FINTO} o scrivete a ${EMAIL_FINTA}`,
    },
    { user_id: null, photos: [{ storagePath: chatCondivisa.path, aiCaption: null }], source: "rules" },
  ]) {
    const id = randomUUID();
    reg.brief.push(id); annota();
    await scrivi("job_briefs", { id, ...b });
  }
  const [briefSuo, briefAnonimo] = reg.brief;

  const richiesta = await scrivi("requests", {
    customer_id: cliUid, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id,
    status: "matched", problem_description: "Prova di cancellazione (CANC2)", brief_id: briefSuo,
  });
  ids.richiesta = richiesta.id;
  await scrivi("request_professionals", { request_id: richiesta.id, professional_id: pro.id });
  const fra3giorni = new Date(Date.now() + 3 * 86400_000).toISOString();
  const settimanaScorsa = new Date(Date.now() - 7 * 86400_000).toISOString();
  const confermato = await scrivi("appointments", {
    professional_id: pro.id, request_id: richiesta.id, customer_id: cliUid, customer_name: "Prova",
    title: "Prova confermata", starts_at: fra3giorni, duration_minutes: 60, status: "confirmed", proposed_by: "professional",
    professional_service_id: servizio.id,
  });
  const passato = await scrivi("appointments", {
    professional_id: pro.id, request_id: richiesta.id, customer_id: cliUid, customer_name: "Prova",
    title: "Prova conclusa", starts_at: settimanaScorsa, duration_minutes: 60, status: "completed", proposed_by: "professional",
    completed_at: new Date(Date.now() - 6 * 86400_000).toISOString(),
  });
  ids.appuntamenti = [confermato.id, passato.id];
  await scrivi("request_messages", { request_id: richiesta.id, professional_id: pro.id, sender_type: "customer", sender_id: cliUid, message: "Ciao, e' una prova." });
  await scrivi("request_messages", { request_id: richiesta.id, professional_id: pro.id, sender_type: "professional", sender_id: proUid, message: "Ricevuto, prova." });
  await scrivi("request_messages", {
    request_id: richiesta.id, professional_id: pro.id, sender_type: "professional", sender_id: proUid,
    message: "Proposta di prova", kind: "appointment_proposal", appointment_id: confermato.id,
  });
  // Il cliente sceglie il pro: e' la colonna che il SET NULL del pro tocca.
  await aggiorna("requests", { chosen_professional_id: pro.id, chosen_at: new Date().toISOString() }, "id", richiesta.id);
  console.log(`cliente di prova: utente ${cliUid}, richiesta ${richiesta.id}, appuntamenti ${ids.appuntamenti.join(", ")}`);

  // 3. Le due richieste di cancellazione, gia' scadute: prima il pro.
  const fa = (giorni) => new Date(Date.now() - giorni * 86400_000).toISOString();
  for (const [uid, giorni] of [[proUid, 2], [cliUid, 1]]) {
    const { error } = await admin.from("account_deletion_requests").insert({ user_id: uid, requested_at: fa(giorni), scheduled_for: fa(giorni) });
    if (error) throw new Error(`account_deletion_requests: ${error.message}`);
  }

  // 4. Il cron, dopo aver RICONTROLLATO la coda.
  const segreto = randomBytes(32).toString("base64url");
  await avviaServer(segreto);
  const coda = await scadute();
  console.log(`coda subito prima del cron: ${coda.length} scadute`);
  if (coda.length !== 2 || !coda.includes(proUid) || !coda.includes(cliUid)) throw new Error("in coda c'e' qualcosa che non e' la prova: il cron NON parte");
  const inizio = new Date().toISOString();
  const r = await fetch(`http://localhost:${PORTA}/api/cron/cancella-account`, { headers: { authorization: `Bearer ${segreto}` } });
  console.log(`GET /api/cron/cancella-account -> HTTP ${r.status} ${JSON.stringify(await r.json().catch(() => null))}`);

  // 5. Cosa e' successo davvero.
  console.log("\n== verifica ==");
  const { data: giri } = await admin.from("system_job_runs").select("started_at, ok, outcome, error").eq("job", "cancella-account").gte("started_at", inizio).order("started_at", { ascending: false }).limit(1);
  const giro = giri?.[0];
  ok("system_job_runs: scadute 2, cancellati 2, falliti 0", !!giro && giro.outcome?.scadute === 2 && giro.outcome?.cancellati === 2 && giro.outcome?.falliti === 0, JSON.stringify({ ok: giro?.ok, outcome: giro?.outcome, error: giro?.error }));
  for (const [nome, uid] of [["pro", proUid], ["cliente", cliUid]]) {
    ok(`auth.users: il ${nome} non esiste piu'`, !(await admin.auth.admin.getUserById(uid)).data?.user);
  }
  const conta = async (tabella, col, val) => {
    const q = admin.from(tabella).select(col, { count: "exact", head: true });
    const { count, error } = await (Array.isArray(val) ? q.in(col, val) : q.eq(col, val));
    return error ? `errore: ${error.message}` : count;
  };
  const righe = [
    ["users", "id", [proUid, cliUid]], ["profiles", "user_id", [proUid, cliUid]], ["profile_private", "user_id", [proUid, cliUid]],
    ["professionals", "id", pro.id], ["professional_services", "professional_id", pro.id], ["professional_verification", "professional_id", pro.id],
    ["professional_coverage", "professional_id", pro.id], ["professional_coverage_public", "professional_id", pro.id], ["portfolio_items", "professional_id", pro.id],
    ["requests", "id", richiesta.id], ["request_professionals", "request_id", richiesta.id], ["request_messages", "request_id", richiesta.id],
    ["appointments", "id", ids.appuntamenti], ["account_deletion_requests", "user_id", [proUid, cliUid]],
  ];
  for (const [t, c, v] of righe) {
    const n = await conta(t, c, v);
    ok(`${t}: nessuna riga`, n === 0, n === 0 ? "" : String(n));
  }
  for (const f of [fileVerifica, filePortfolio, fileCliente, chatSua]) ok(`storage: ${f.bucket}/${f.path.replace(/^[0-9a-f-]{36}/, "<uid>")} tolto`, !(await esisteFile(f)));
  ok("storage: la foto di chat citata anche dal brief anonimo e' rimasta", await esisteFile(chatCondivisa));
  const { data: brief } = await admin.from("job_briefs").select("id, user_id, photos").in("id", [briefSuo, briefAnonimo]);
  ok("job_briefs: zero brief del cliente (cancellato per intero, non de-identificato)", !(brief ?? []).some((b) => b.id === briefSuo));
  const anon = (brief ?? []).find((b) => b.id === briefAnonimo);
  ok("il brief anonimo non e' stato toccato", !!anon && anon.photos.length === 1);

  await provaGuasto(jpeg, tag, milano, sub, ids);

  console.log(`\nid per la ricerca su tutte le colonne uuid: ${JSON.stringify(ids)}`);
}

// LO STORAGE CHE NON RISPONDE SULLE FOTO DELLA CHAT (17/10). Le foto della
// chat si ritrovano solo dai brief: se non vanno via, il cron non deve
// cancellare ne' i brief ne' l'account, e la notte dopo deve riuscirci.
async function provaGuasto(jpeg, tag, milano, sub, ids) {
  console.log("\n== storage guasto sulle foto della chat ==");
  if (server) { server.kill("SIGTERM"); server = null; }
  if ((await scadute()).length) throw new Error("la coda NON e' vuota prima del caso del guasto: mi fermo");
  fs.rmSync(SEGNO_GUASTO, { force: true });

  const uid = await nuovoUtente(EMAIL_GUASTO, "customer");
  ids.guasto = uid;
  const chat = { bucket: "brief-photos", path: `chat/prova-guasto-${tag}.jpg` };
  await carica(chat, jpeg);
  const briefId = randomUUID();
  reg.brief.push(briefId); annota();
  await scrivi("job_briefs", {
    id: briefId, user_id: uid, photos: [{ storagePath: chat.path, aiCaption: null }], source: "rules",
    summary: "Prova del guasto", zone: "Brera", access_notes: `Chiamatemi al ${TELEFONO_FINTO}`,
  });
  ids.briefGuasto = briefId;
  const richiesta = await scrivi("requests", {
    customer_id: uid, city_id: milano.id, service_id: sub.service_id, subservice_id: sub.id,
    status: "matched", problem_description: "Prova del guasto", brief_id: briefId,
  });
  ids.richiestaGuasto = richiesta.id;
  const ieri = new Date(Date.now() - 86400_000).toISOString();
  const { error } = await admin.from("account_deletion_requests").insert({ user_id: uid, requested_at: ieri, scheduled_for: ieri });
  if (error) throw new Error(`account_deletion_requests: ${error.message}`);

  const giro = async (porta, envExtra) => {
    const segreto = randomBytes(32).toString("base64url");
    await avviaServer(segreto, porta, envExtra);
    const coda = await scadute();
    if (coda.length !== 1 || coda[0] !== uid) throw new Error("in coda c'e' qualcosa che non e' la prova del guasto: il cron NON parte");
    const inizio = new Date().toISOString();
    const r = await fetch(`http://localhost:${porta}/api/cron/cancella-account`, { headers: { authorization: `Bearer ${segreto}` } });
    console.log(`GET /api/cron/cancella-account -> HTTP ${r.status} ${JSON.stringify(await r.json().catch(() => null))}`);
    server.kill("SIGTERM"); server = null;
    const { data } = await admin.from("system_job_runs").select("ok, outcome, error").eq("job", "cancella-account").gte("started_at", inizio).order("started_at", { ascending: false }).limit(1);
    return data?.[0];
  };
  const leggiBrief = async () => (await admin.from("job_briefs").select("id, user_id, photos, access_notes").eq("id", briefId).maybeSingle()).data;

  // La notte del guasto.
  const g1 = await giro(PORTA + 1, { NODE_OPTIONS: `--require ${PRELOAD_GUASTO}`, GUASTO_SEGNO: SEGNO_GUASTO });
  ok("guasto: il guasto e' scattato davvero (remove di chat/ rifiutata)", fs.existsSync(SEGNO_GUASTO) && fs.readFileSync(SEGNO_GUASTO, "utf8").includes(chat.path));
  ok("guasto: system_job_runs scadute 1, cancellati 0, falliti 1, motivo foto-chat", !!g1 && g1.ok === false && g1.outcome?.scadute === 1 && g1.outcome?.cancellati === 0 && g1.outcome?.falliti === 1 && String(g1.error).includes(`foto-chat:${uid.slice(0, 8)}`), JSON.stringify(g1));
  ok("guasto: l'account esiste ancora", !!(await admin.auth.admin.getUserById(uid)).data?.user);
  const b1 = await leggiBrief();
  ok("guasto: il brief e' intatto (suo, con la foto e il testo)", !!b1 && b1.user_id === uid && b1.photos.length === 1 && b1.photos[0].storagePath === chat.path && !!b1.access_notes);
  ok("guasto: la foto della chat e' ancora nello storage", await esisteFile(chat));
  const { count: inCoda } = await admin.from("account_deletion_requests").select("user_id", { count: "exact", head: true }).eq("user_id", uid);
  ok("guasto: la richiesta di cancellazione e' ancora in coda", inCoda === 1);

  // La notte dopo, storage sano.
  const g2 = await giro(PORTA + 2, {});
  ok("notte dopo: system_job_runs scadute 1, cancellati 1, falliti 0", !!g2 && g2.ok === true && g2.outcome?.cancellati === 1 && g2.outcome?.falliti === 0, JSON.stringify(g2));
  ok("notte dopo: l'account non esiste piu'", !(await admin.auth.admin.getUserById(uid)).data?.user);
  ok("notte dopo: il brief non esiste piu'", !(await leggiBrief()));
  ok("notte dopo: la foto della chat e' stata tolta", !(await esisteFile(chat)));
  fs.rmSync(SEGNO_GUASTO, { force: true });
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
