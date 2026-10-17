// Guasto simulato per scripts/prova_cancellazione.mjs (17/10): si carica SOLO
// nel server di prova, con NODE_OPTIONS=--require, mai in produzione.
//
// Fa fallire con un 500 la remove di brief-photos quando tocca percorsi chat/
// (DELETE /storage/v1/object/brief-photos con "chat/" nel corpo), cioe' solo
// il passo delle foto della chat di svuotaFileUtente. Tutto il resto passa.
// Ogni volta che scatta scrive una riga in GUASTO_SEGNO, cosi' la prova sa che
// il guasto c'e' stato davvero e non passa per caso.

const fs = require("node:fs");

const originale = globalThis.fetch;
globalThis.fetch = async function fetchConGuasto(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const metodo = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
  const corpo = typeof init?.body === "string" ? init.body : "";
  if (metodo === "DELETE" && /\/storage\/v1\/object\/brief-photos\/?$/.test(url) && corpo.includes('"chat/')) {
    if (process.env.GUASTO_SEGNO) fs.appendFileSync(process.env.GUASTO_SEGNO, `${new Date().toISOString()} ${corpo}\n`);
    return new Response(JSON.stringify({ statusCode: "500", error: "guasto simulato", message: "guasto simulato" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return originale(input, init);
};
