// svuotaFileUtente con uno storage e un job_briefs finti: cosa toglie, cosa
// tiene, e che non tocca mai un file che appartiene anche a qualcun altro.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { percorsoChatValido, svuotaFileUtente } from "./fileUtente";

const IO = "11111111-1111-1111-1111-111111111111";
const ALTRO = "22222222-2222-2222-2222-222222222222";

type Brief = { id: string; user_id: string | null; photos: { storagePath: string }[] };

function finto(file: Record<string, string[]>, brief: Brief[], rotto: string[] = []) {
  const bucket = Object.fromEntries(Object.entries(file).map(([b, ps]) => [b, new Set(ps)]));
  const chiamateList: { bucket: string; offset: number }[] = [];
  const storage = {
    from: (b: string) => ({
      list: async (cartella: string, o: { limit: number; offset: number }) => {
        chiamateList.push({ bucket: b, offset: o.offset });
        if (rotto.includes(b)) return { data: null, error: { message: "giu'" } };
        const nomi = Array.from(bucket[b] ?? []).filter((p) => p.startsWith(`${cartella}/`)).map((p) => p.slice(cartella.length + 1)).sort();
        return { data: nomi.slice(o.offset, o.offset + o.limit).map((name) => ({ id: `id-${name}`, name })), error: null };
      },
      remove: async (ps: string[]) => {
        const tolti = ps.filter((p) => bucket[b]?.delete(p));
        return { data: tolti.map((name) => ({ name })), error: null };
      },
    }),
  };
  const from = (tabella: string) => {
    expect(tabella).toBe("job_briefs");
    let righe = brief;
    let contare = false;
    const q = {
      select: (_c: string, o?: { count?: string; head?: boolean }) => { contare = !!o?.head; return q; },
      eq: (_c: string, v: string) => { righe = righe.filter((r) => r.user_id === v); return q; },
      // Come PostgREST su una colonna jsonb: il valore di cs deve essere JSON
      // come testo. Un array JS (cio' che manda .contains()) e' un errore.
      filter: (_c: string, op: string, v: unknown) => {
        if (op !== "cs" || typeof v !== "string") throw new Error("cs su jsonb vuole JSON come testo");
        const cercato = (JSON.parse(v) as { storagePath: string }[])[0].storagePath;
        righe = righe.filter((r) => r.photos.some((f) => f.storagePath === cercato));
        return q;
      },
      contains: () => { throw new Error("contains() su jsonb manda un array Postgres, non JSON"); },
      or: (f: string) => { const id = f.split("user_id.neq.")[1]; righe = righe.filter((r) => r.user_id === null || r.user_id !== id); return q; },
      update: (val: { photos: [] }) => ({
        eq: async (_c: string, v: string) => { for (const r of brief) if (r.user_id === v) r.photos = val.photos; return { error: null }; },
      }),
      then: (ok: (x: unknown) => unknown) => ok(contare ? { count: righe.length, error: null } : { data: righe, error: null }),
    };
    return q;
  };
  return { admin: { storage, from } as unknown as SupabaseClient, bucket, brief, chiamateList };
}

describe("svuotaFileUtente", () => {
  it("svuota le tre cartelle dell'utente, e solo le sue", async () => {
    const f = finto(
      {
        "verifica-documenti": [`${IO}/a.pdf`, `${ALTRO}/b.pdf`],
        portfolio: [`${IO}/1.jpg`, `${IO}/2.jpg`, `${ALTRO}/3.jpg`],
        "brief-photos": [`${IO}/x.jpg`],
      },
      []
    );
    const e = await svuotaFileUtente(f.admin, IO);
    expect(e.errori).toEqual([]);
    expect(e.rimossi).toEqual({ "verifica-documenti": 1, portfolio: 2, "brief-photos": 1 });
    expect(Array.from(f.bucket.portfolio)).toEqual([`${ALTRO}/3.jpg`]);
    expect(Array.from(f.bucket["verifica-documenti"])).toEqual([`${ALTRO}/b.pdf`]);
  });

  it("oltre i 100 file: legge tutte le pagine, non solo la prima", async () => {
    const tanti = Array.from({ length: 2500 }, (_, i) => `${IO}/f${String(i).padStart(4, "0")}.jpg`);
    const f = finto({ portfolio: tanti }, []);
    const e = await svuotaFileUtente(f.admin, IO);
    expect(e.rimossi.portfolio).toBe(2500);
    expect(f.bucket.portfolio.size).toBe(0);
    expect(f.chiamateList.filter((c) => c.bucket === "portfolio").map((c) => c.offset)).toEqual([0, 1000, 2000]);
  });

  it("toglie le foto della chat citate nei suoi brief, poi azzera photos", async () => {
    const f = finto(
      { "brief-photos": ["chat/1-aaa.jpg", "chat/2-bbb.jpg", "chat/3-ccc.jpg"] },
      [
        { id: "b1", user_id: IO, photos: [{ storagePath: "chat/1-aaa.jpg" }, { storagePath: "chat/2-bbb.jpg" }] },
        { id: "b2", user_id: ALTRO, photos: [{ storagePath: "chat/3-ccc.jpg" }] },
      ]
    );
    const e = await svuotaFileUtente(f.admin, IO);
    expect(e.rimossi["brief-photos"]).toBe(2);
    expect(Array.from(f.bucket["brief-photos"])).toEqual(["chat/3-ccc.jpg"]);
    expect(f.brief.find((b) => b.id === "b1")!.photos).toEqual([]);
    expect(f.brief.find((b) => b.id === "b2")!.photos).toHaveLength(1);
  });

  it("un percorso citato anche dal brief di un altro (o da uno anonimo) NON si cancella", async () => {
    const f = finto(
      { "brief-photos": ["chat/sua.jpg", "chat/anonima.jpg"] },
      [
        { id: "mio", user_id: IO, photos: [{ storagePath: "chat/sua.jpg" }, { storagePath: "chat/anonima.jpg" }] },
        { id: "suo", user_id: ALTRO, photos: [{ storagePath: "chat/sua.jpg" }] },
        { id: "anon", user_id: null, photos: [{ storagePath: "chat/anonima.jpg" }] },
      ]
    );
    const e = await svuotaFileUtente(f.admin, IO);
    expect(e.tenuti).toBe(2);
    expect(f.bucket["brief-photos"].size).toBe(2);
  });

  it("percorsi di brief fuori da chat/ o con salti di cartella non si toccano", async () => {
    expect(percorsoChatValido("chat/1-abc.jpg")).toBe(true);
    for (const p of [`${ALTRO}/foto.jpg`, "chat/../x.jpg", "chat/a/b.jpg", "../chat/x", "", 42]) {
      expect(percorsoChatValido(p)).toBe(false);
    }
    const f = finto({ "brief-photos": [`${ALTRO}/foto.jpg`] }, [{ id: "b", user_id: IO, photos: [{ storagePath: `${ALTRO}/foto.jpg` }] }]);
    await svuotaFileUtente(f.admin, IO);
    expect(f.bucket["brief-photos"].has(`${ALTRO}/foto.jpg`)).toBe(true);
  });

  it("un bucket che non risponde non ferma gli altri, e lo dice", async () => {
    const f = finto({ portfolio: [`${IO}/1.jpg`], "verifica-documenti": [`${IO}/a.pdf`] }, [], ["verifica-documenti"]);
    const e = await svuotaFileUtente(f.admin, IO);
    expect(e.errori).toHaveLength(1);
    expect(e.errori[0]).toMatch(/verifica-documenti/);
    expect(f.bucket.portfolio.size).toBe(0);
  });
});
