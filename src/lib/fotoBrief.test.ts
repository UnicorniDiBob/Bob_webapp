// FOTO1: l'attestazione di /api/bob/chat vale solo per chi ha caricato la foto,
// e senza segreto non entra niente.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attestaFoto, attestazioneValida, fotoAttestate } from "./fotoBrief";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const P = "chat/1760000000000-abcd1234.jpg";

describe("attestazione delle foto della chat", () => {
  beforeEach(() => {
    vi.stubEnv("BRIEF_PHOTOS_SECRET", "segreto-di-prova");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("vale per chi l'ha caricata, non per un altro ne' per un anonimo", () => {
    const att = attestaFoto(P, A);
    expect(attestazioneValida(P, A, att)).toBe(true);
    expect(attestazioneValida(P, B, att)).toBe(false);
    expect(attestazioneValida(P, null, att)).toBe(false);
  });

  it("lega anche il percorso: non si sposta su un'altra foto", () => {
    expect(attestazioneValida("chat/altra.jpg", A, attestaFoto(P, A))).toBe(false);
  });

  it("l'anonimo ha la sua, che non vale per un account", () => {
    const att = attestaFoto(P, null);
    expect(attestazioneValida(P, null, att)).toBe(true);
    expect(attestazioneValida(P, A, att)).toBe(false);
  });

  it("fotoAttestate scarta il percorso di un altro, quello senza firma e quello fuori da chat/", () => {
    const tenute = fotoAttestate(
      [
        { storagePath: P, aiCaption: "mia", attestazione: attestaFoto(P, B) },
        { storagePath: "chat/di-A.jpg", aiCaption: "di A", attestazione: attestaFoto("chat/di-A.jpg", A) },
        { storagePath: "chat/senza.jpg", aiCaption: null },
        { storagePath: `${A}/x.jpg`, aiCaption: null, attestazione: attestaFoto(`${A}/x.jpg`, B) },
      ],
      B
    );
    expect(tenute).toEqual([{ storagePath: P, aiCaption: "mia" }]);
  });

  it("senza segreto non attesta e non fa entrare niente", () => {
    const att = attestaFoto(P, A);
    vi.stubEnv("BRIEF_PHOTOS_SECRET", "");
    expect(attestaFoto(P, A)).toBeNull();
    expect(fotoAttestate([{ storagePath: P, aiCaption: null, attestazione: att }], A)).toEqual([]);
  });
});
