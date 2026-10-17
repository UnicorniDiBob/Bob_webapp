// Prova dal vivo di POST /api/appointments/[id]/conferma e /rifiuta (17/10,
// appuntamento-una-strada).
//
//   npm run build
//   TZ=Europe/Rome node scripts/prova_risposta_proposta.mjs
//
// Sui dati di prova «PROVA-APP casa-cliente» di cliente.demo, mai su clienti
// veri. La proposta del pro (ID_PROPOSTA) viene confermata e rifiutata piu'
// volte; fra un giro e l'altro torna com'era (service role) e quello che il
// giro ha scritto si cancella, per id. Alla fine la riga, lo storico e le analisi
// tornano esattamente come prima, e la prova lo VERIFICA.
//
// 1. IL SITO DI PRIMA DELLA #205: gli stessi passi che faceva
//    useRispostaAppuntamento nel browser, con la sessione del cliente — update
//    dello stato, messaggio in chat con fmtDayParts nel fuso del browser
//    (per questo TZ=Europe/Rome), POST /api/notify. Per conferma e rifiuto.
// 2. LE ROUTE: conferma col cookie del sito, rifiuto col Bearer dell'app.
//    Riga, messaggio, storico (appointment_events, da cui nasce la
//    campanella del pro) e analisi (professional_work_events) devono essere
//    uguali a quelli del giro 1, a meno di id e orari.
// 3. Ripetere: la stessa risposta due volte -> 200 giaFatto, niente di nuovo.
//    Due conferme insieme -> un messaggio solo. Rifiuto dopo una conferma ->
//    409.
// 4. I no: senza login 401, il pro della proposta 403, la proposta fatta dal
//    cliente 409 «proposta_tua», un id che non e' uuid 404, un uuid che non
//    c'e' 404.
// 5. Conversazione archiviata (dalla 132): 409 «archiviata», niente scritto,
//    nemmeno lo stato.
//
// La pulizia cancella SOLO le righe con un id nato nel giro (messaggi,
// storico, analisi), mai per data.
//
// Le sessioni nascono da un magic link generato dall'admin: nessuna email
// parte, nessuna password passa di qui. I token non si stampano.

import fs from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const PORTA = 3127;
const BASE = `http://localhost:${PORTA}`;
const CLIENTE = "cliente.demo@bobapp.it";
const PRO = "idromilano@bobapp.it";
const ID_PROPOSTA = "ede92c0b-388e-42a5-b641-27a80295ed5e"; // del pro, PROVA-APP
const FOTO = `${process.env.TMPDIR ?? "/tmp"}/prova_risposta_proposta_foto.json`;
const ID_PROPOSTA_CLIENTE = "9ce24171-593c-473e-b00a-3dce90464154"; // del cliente, PROVA-APP

if (Intl.DateTimeFormat().resolvedOptions().timeZone !== "Europe/Rome") {
  console.error("Lanciala con TZ=Europe/Rome: il giro 1 rifa' il browser di un cliente italiano.");
  process.exit(2);
}

const env = {};
for (const riga of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(riga.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const opz = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: class WsFinta {} } };
const admin = createClient(URL_SB, env.SUPABASE_SERVICE_ROLE_KEY, opz);

let server = null;
let foto = null; // lo stato di partenza, da rimettere
let archiviata = null; // la coppia archiviata dal caso 5, finche' non torna com'era
const sessioni = [];

async function sessione(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const r = await fetch(`${URL_SB}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: data.properties.hashed_token }),
  });
  const s = await r.json().catch(() => ({}));
  if (!r.ok || !s.access_token) throw new Error(`verify(${email}): ${r.status}`);
  sessioni.push(s);
  return s;
}

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

const comeUtente = (s) =>
  createClient(URL_SB, ANON, { ...opz, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

// --- fotografie ----------------------------------------------------------

const COLONNE = "*";
async function riga(id) {
  const { data, error } = await admin.from("appointments").select(COLONNE).eq("id", id).single();
  if (error) throw new Error(`riga ${id}: ${error.message}`);
  return data;
}
async function lavoro(id) {
  const { data } = await admin.from("professional_work_events").select("*").eq("rif", id).order("evento");
  return data ?? [];
}
// Cosa conta nel confronto: niente id, niente orari di scrittura.
const VIA = new Set(["id", "created_at", "updated_at", "read_at", "avvenuto_al"]);
const pulisci = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !VIA.has(k)).sort(([a], [b]) => a.localeCompare(b)));
const forma = (g) => ({
  riga: pulisci(g.riga),
  messaggi: g.messaggi.map(pulisci),
  eventi: g.eventi.map(pulisci),
  lavoro: g.lavoro.map(pulisci),
});

// Gli id che c'erano prima di un giro: alla fine si cancellano SOLO le righe
// con un id nuovo, mai per data (una riga di qualcun altro scritta nello
// stesso minuto resterebbe intatta).
async function idPresenti(a) {
  const [m, e] = await Promise.all([
    admin.from("request_messages").select("id").eq("request_id", a.request_id),
    admin.from("appointment_events").select("id").eq("appointment_id", a.id),
  ]);
  if (m.error || e.error) throw new Error(`idPresenti: ${(m.error ?? e.error).message}`);
  return { m: new Set(m.data.map((x) => x.id)), e: new Set(e.data.map((x) => x.id)) };
}
async function scrittoDopo(prima, a) {
  const [m, e] = await Promise.all([
    admin.from("request_messages").select("*").eq("request_id", a.request_id).order("created_at"),
    admin.from("appointment_events").select("*").eq("appointment_id", a.id).order("created_at"),
  ]);
  return {
    messaggi: (m.data ?? []).filter((x) => !prima.m.has(x.id)),
    eventi: (e.data ?? []).filter((x) => !prima.e.has(x.id)),
  };
}

// Rimette la proposta com'era e cancella, per id, solo cio' che il giro ha
// scritto. Le righe di analisi di prima che un trigger ha tolto tornano.
async function rimetti(prima) {
  const { id, request_id, created_at, updated_at, customer_id, ...campi } = foto.riga;
  const { error } = await admin.from("appointments").update(campi).eq("id", id);
  if (error) throw new Error(`rimetti: ${error.message}`);
  const nuove = await scrittoDopo(prima, foto.riga);
  const idMsg = nuove.messaggi.map((x) => x.id);
  const idEv = nuove.eventi.map((x) => x.id);
  if (idMsg.length) await admin.from("request_messages").delete().in("id", idMsg);
  if (idEv.length) await admin.from("appointment_events").delete().in("id", idEv);
  const ora = await lavoro(id);
  const idLavoroFoto = new Set(foto.lavoro.map((x) => x.id));
  const lavoroNuovo = ora.filter((x) => !idLavoroFoto.has(x.id)).map((x) => x.id);
  if (lavoroNuovo.length) await admin.from("professional_work_events").delete().in("id", lavoroNuovo);
  const idOra = new Set(ora.map((x) => x.id));
  // id e' una identity «always»: una riga tolta si reinserisce senza.
  const tolte = foto.lavoro.filter((x) => !idOra.has(x.id)).map(({ id: _id, ...resto }) => resto);
  if (tolte.length) {
    const { error: e2 } = await admin.from("professional_work_events").insert(tolte);
    if (e2) throw new Error(`rimetti lavoro: ${e2.message}`);
  }
}
async function giro(nome, fai) {
  const prima = await idPresenti(foto.riga);
  const esito = await fai();
  await dorme(300);
  const r = await riga(ID_PROPOSTA);
  const scritto = await scrittoDopo(prima, r);
  const g = { nome, esito, riga: r, ...scritto, lavoro: await lavoro(ID_PROPOSTA) };
  await rimetti(prima);
  return g;
}

// --- 1. il sito di oggi, passo per passo ---------------------------------

function fmtDayParts(d) {
  const date = new Date(d);
  return {
    dow: date.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", ""),
    day: date.getDate(),
    time: date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
}
async function comeIlSito(s, cookie, ok) {
  const supabase = comeUtente(s);
  const a = foto.riga;
  const { error } = await supabase.from("appointments").update({ status: ok ? "confirmed" : "declined" }).eq("id", a.id);
  if (error) return { error: error.message };
  const { dow, day, time } = fmtDayParts(a.starts_at);
  const { error: errMsg } = await supabase.from("request_messages").insert({
    request_id: a.request_id,
    professional_id: a.professional_id,
    sender_id: s.user.id,
    sender_type: "customer",
    message: ok
      ? `Ho confermato l'appuntamento di ${dow} ${day} alle ${time}.`
      : `Non posso ${dow} ${day} alle ${time}: proponi un altro orario?`,
    kind: "text",
    appointment_id: null,
  });
  const n = await fetch(`${BASE}/api/notify`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ event: ok ? "appointment_confirmed" : "appointment_declined", requestId: a.request_id, professionalId: a.professional_id }),
  });
  return { messaggio: errMsg?.message ?? "ok", notify: `${n.status} ${await n.text()}` };
}

// --- 2. le route ----------------------------------------------------------

async function rotta(azione, id, headers) {
  const r = await fetch(`${BASE}/api/appointments/${id}/${azione}`, { method: "POST", headers });
  return { stato: r.status, corpo: await r.json().catch(() => null) };
}

// --- esiti ----------------------------------------------------------------

const esiti = [];
function controlla(caso, ok, nota = "") {
  esiti.push({ caso, ok });
  console.log(`${ok ? "OK  " : "NO  "} ${caso}${nota ? ` — ${nota}` : ""}`);
}
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function differenze(a, b, pre = "") {
  if (uguali(a, b)) return [];
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return [`${pre}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`];
  const chiavi = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...chiavi].flatMap((k) => differenze(a[k], b[k], pre ? `${pre}.${k}` : k));
}

async function avviaServer() {
  server = spawn("npx", ["next", "start", "-p", String(PORTA)], { env: process.env, stdio: ["ignore", "ignore", "inherit"] });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/`); return; } catch { await dorme(1000); }
  }
  throw new Error("il server locale non risponde");
}

async function prova() {
  const r0 = await riga(ID_PROPOSTA);
  if (r0.status !== "proposed" || r0.proposed_by !== "professional" || !String(r0.notes).includes("PROVA-APP")) {
    throw new Error(`la proposta di prova non e' una proposta del pro aperta (${r0.status}/${r0.proposed_by}): non tocco niente`);
  }
  foto = { riga: r0, lavoro: await lavoro(ID_PROPOSTA) };
  // Se la prova si rompe a meta', qui c'e' lo stato da rimettere a mano.
  fs.writeFileSync(FOTO, JSON.stringify(foto, null, 2));
  console.log(`proposta di prova ${ID_PROPOSTA}: ${r0.starts_at}, ${foto.lavoro.length} righe di analisi`);

  await avviaServer();
  const cliente = await sessione(CLIENTE);
  const pro = await sessione(PRO);
  const cookie = await cookieDelSito(cliente);
  const bearer = { authorization: `Bearer ${cliente.access_token}` };

  // 1 e 2: sito contro route.
  const sitoSi = await giro("sito conferma", () => comeIlSito(cliente, cookie, true));
  const rottaSi = await giro("route conferma (cookie)", () => rotta("conferma", ID_PROPOSTA, { cookie }));
  const sitoNo = await giro("sito rifiuta", () => comeIlSito(cliente, cookie, false));
  const rottaNo = await giro("route rifiuta (Bearer)", () => rotta("rifiuta", ID_PROPOSTA, bearer));

  for (const [s, r] of [[sitoSi, rottaSi], [sitoNo, rottaNo]]) {
    console.log(`\n-- ${s.nome} / ${r.nome}`);
    console.log(`   sito:  ${JSON.stringify(s.esito)}`);
    console.log(`   route: ${JSON.stringify(r.esito)}`);
    console.log(`   stato ${r.riga.status}; messaggi ${r.messaggi.map((m) => `«${m.message}»`).join(", ") || "nessuno"}`);
    console.log(`   storico ${r.eventi.map((e) => `${e.tipo}/${e.autore}`).join(", ") || "vuoto"}; analisi ${r.lavoro.map((l) => l.evento).join(", ")}`);
    const d = differenze(forma(s), forma(r));
    controlla(`${r.nome}: 200`, r.esito.stato === 200, JSON.stringify(r.esito.corpo));
    controlla(`${r.nome}: riga, messaggio, storico e analisi uguali al sito`, d.length === 0, d.join("; "));
    controlla(`${r.nome}: un messaggio, un evento`, r.messaggi.length === 1 && r.eventi.length === 1);
  }

  // 3. Ripetere.
  const due = await giro("conferma due volte", async () => [
    await rotta("conferma", ID_PROPOSTA, { cookie }),
    await rotta("conferma", ID_PROPOSTA, bearer),
    await rotta("rifiuta", ID_PROPOSTA, bearer),
  ]);
  controlla("seconda conferma: 200 giaFatto", due.esito[1].stato === 200 && due.esito[1].corpo?.giaFatto === true, JSON.stringify(due.esito[1].corpo));
  controlla("rifiuto dopo la conferma: 409", due.esito[2].stato === 409, JSON.stringify(due.esito[2].corpo));
  controlla("conferma due volte: un messaggio, un evento, resta confermato", due.messaggi.length === 1 && due.eventi.length === 1 && due.riga.status === "confirmed");

  const insieme = await giro("due conferme insieme", () =>
    Promise.all([rotta("conferma", ID_PROPOSTA, { cookie }), rotta("conferma", ID_PROPOSTA, bearer)])
  );
  const nuove = insieme.esito.filter((x) => x.stato === 200 && x.corpo?.giaFatto === false).length;
  controlla("due conferme insieme: una sola scrive", nuove === 1 && insieme.messaggi.length === 1 && insieme.eventi.length === 1,
    `${insieme.esito.map((x) => `${x.stato}/${x.corpo?.giaFatto}`).join(" ")}, ${insieme.messaggi.length} messaggi`);

  const dueNo = await giro("rifiuta due volte", async () => [
    await rotta("rifiuta", ID_PROPOSTA, bearer),
    await rotta("rifiuta", ID_PROPOSTA, { cookie }),
  ]);
  controlla("rifiuta due volte: un messaggio", dueNo.esito[1].corpo?.giaFatto === true && dueNo.messaggi.length === 1);

  // 4. I no.
  const no = await giro("i no", async () => ({
    anonimo: await rotta("conferma", ID_PROPOSTA, {}),
    pro: await rotta("conferma", ID_PROPOSTA, { authorization: `Bearer ${pro.access_token}` }),
    propostaTua: await rotta("conferma", ID_PROPOSTA_CLIENTE, bearer),
    nonUuid: await rotta("conferma", "abc", bearer),
    inesistente: await rotta("rifiuta", randomUUID(), bearer),
  }));
  controlla("senza login: 401", no.esito.anonimo.stato === 401);
  controlla("il pro della proposta: 403", no.esito.pro.stato === 403, JSON.stringify(no.esito.pro.corpo));
  controlla("proposta del cliente: 409 proposta_tua", no.esito.propostaTua.stato === 409 && no.esito.propostaTua.corpo?.motivo === "proposta_tua");
  controlla("id non uuid: 404", no.esito.nonUuid.stato === 404);
  controlla("uuid inesistente: 404", no.esito.inesistente.stato === 404);
  controlla("i no non scrivono niente", no.messaggi.length === 0 && no.eventi.length === 0 && no.riga.status === "proposed");
  const altra = await riga(ID_PROPOSTA_CLIENTE);
  controlla("la proposta del cliente resta com'era", altra.status === "proposed" && altra.proposed_by === "customer");

  // 5. Conversazione archiviata (132): il cliente l'ha archiviata ma la
  // proposta e' ancora aperta (il pro l'ha riproposta dopo, o la risposta
  // e' partita mentre si archiviava). La RLS non lascia scrivere il messaggio:
  // con la RPC non deve cambiare NIENTE, nemmeno lo stato.
  const coppia = { request_id: foto.riga.request_id, professional_id: foto.riga.professional_id };
  const { data: rp } = await admin.from("request_professionals").select("archived_at").match(coppia).single();
  if (rp.archived_at !== null) throw new Error("la conversazione di prova e' gia' archiviata: non tocco niente");
  archiviata = coppia;
  await admin.from("request_professionals").update({ archived_at: new Date().toISOString() }).match(coppia);
  const arch = await giro("conversazione archiviata", () => rotta("conferma", ID_PROPOSTA, bearer));
  await admin.from("request_professionals").update({ archived_at: null }).match(coppia);
  archiviata = null;
  console.log(`   archiviata: ${arch.esito.stato} ${JSON.stringify(arch.esito.corpo)}`);
  controlla("archiviata: niente scritto, resta proposta", arch.riga.status === "proposed" && arch.messaggi.length === 0 && arch.eventi.length === 0);
  controlla("archiviata: 409 «archiviata» con il testo per riaprirla",
    arch.esito.stato === 409 && arch.esito.corpo?.motivo === "archiviata" && /riaprila dalla pagina della richiesta/.test(arch.esito.corpo?.error ?? ""));
}

async function chiudi() {
  if (server) { server.kill("SIGTERM"); server = null; }
  if (archiviata) {
    await admin.from("request_professionals").update({ archived_at: null }).match(archiviata);
    console.log("conversazione di prova riaperta dalla pulizia");
  }
  for (const s of sessioni) {
    await fetch(`${URL_SB}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${s.access_token}` } }).catch(() => {});
  }
  if (foto) {
    const r = await riga(ID_PROPOSTA);
    const l = await lavoro(ID_PROPOSTA);
    const d = differenze(pulisci(foto.riga), pulisci(r));
    controlla("la proposta di prova e' tornata com'era", d.length === 0, d.join("; "));
    controlla("le analisi sono tornate com'erano", uguali(foto.lavoro.map(pulisci), l.map(pulisci)));
  }
}

try {
  await prova();
} catch (e) {
  console.error(`\nINTERROTTA: ${e.message}`);
  esiti.push({ caso: "giro completo", ok: false });
} finally {
  await chiudi();
}
const falliti = esiti.filter((e) => !e.ok);
console.log(`\n${esiti.length - falliti.length}/${esiti.length} ok`);
process.exit(falliti.length ? 1 : 0);
