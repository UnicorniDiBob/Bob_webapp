import { describe, expect, it } from "vitest";
import { extractClientIp, readBodyWithLimit } from "./rate-limit";

describe("extractClientIp", () => {
  it("prende il primo indirizzo di x-forwarded-for", () => {
    const req = new Request("http://localhost/api/bob/chat", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" },
    });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });

  it("toglie gli spazi attorno al primo indirizzo", () => {
    const req = new Request("http://localhost/api/bob/chat", {
      headers: { "x-forwarded-for": "  1.2.3.4  ,10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });

  it("usa x-real-ip se x-forwarded-for manca", () => {
    const req = new Request("http://localhost/api/bob/chat", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(extractClientIp(req)).toBe("9.9.9.9");
  });

  it("torna 'unknown' senza nessuno dei due header (es. dev locale)", () => {
    const req = new Request("http://localhost/api/bob/chat");
    expect(extractClientIp(req)).toBe("unknown");
  });

  it("un x-forwarded-for vuoto non vince su un x-real-ip valido", () => {
    const req = new Request("http://localhost/api/bob/chat", {
      headers: { "x-forwarded-for": "", "x-real-ip": "9.9.9.9" },
    });
    expect(extractClientIp(req)).toBe("9.9.9.9");
  });
});

describe("readBodyWithLimit", () => {
  it("accetta un corpo sotto il tetto", async () => {
    const body = JSON.stringify({ hello: "world" });
    const req = new Request("http://localhost/api/bob/chat", {
      method: "POST",
      body,
    });
    const res = await readBodyWithLimit(req, 1024);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.text).toBe(body);
  });

  it("respinge in base a Content-Length dichiarato, senza leggere il corpo", async () => {
    // Content-Length che mente per difetto rispetto al corpo vero non è il
    // caso che questo test copre - qui verifichiamo il taglio rapido
    // quando l'header dichiara onestamente un corpo troppo grande.
    const big = "x".repeat(2000);
    const req = new Request("http://localhost/api/bob/chat", {
      method: "POST",
      body: big,
      headers: { "content-length": String(big.length) },
    });
    const res = await readBodyWithLimit(req, 1024);
    expect(res.ok).toBe(false);
  });

  it("respinge quando il corpo vero supera il tetto anche senza Content-Length affidabile", async () => {
    const big = "x".repeat(2000);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const req = new Request("http://localhost/api/bob/chat", {
      method: "POST",
      body: stream,
      // @ts-expect-error - richiesto da undici per un body streaming
      duplex: "half",
    });
    const res = await readBodyWithLimit(req, 1024);
    expect(res.ok).toBe(false);
  });

  it("accetta un corpo esattamente al tetto", async () => {
    const exact = "x".repeat(1024);
    const req = new Request("http://localhost/api/bob/chat", {
      method: "POST",
      body: exact,
    });
    const res = await readBodyWithLimit(req, 1024);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.text).toBe(exact);
  });

  it("un corpo assente è ok e vuoto (JSON.parse fallirà a valle, comportamento invariato)", async () => {
    const req = new Request("http://localhost/api/bob/chat");
    const res = await readBodyWithLimit(req, 1024);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.text).toBe("");
  });
});
