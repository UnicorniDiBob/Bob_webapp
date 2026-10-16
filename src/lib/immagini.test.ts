// LA PULIZIA DI UN'IMMAGINE (16/10). Ogni test costruisce il suo file, ne
// prova PRIMA il difetto (il GPS c'e', l'orientamento e' 6) e poi che
// l'uscita non ce l'ha piu': un test che non vede il GPS nell'ingresso
// passerebbe anche se la pulizia non facesse niente.

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { deflateSync } from "node:zlib";
import {
  ImmagineRifiutata,
  MAX_BYTE,
  MAX_LATO,
  pulisciBase64,
  pulisciImmagine,
  tipoDaiByte,
  type MotivoRifiuto,
} from "./immagini";

const ROSSO = [255, 0, 0];
const BLU = [0, 0, 255];

/** 40x20: meta' sinistra rossa, meta' destra blu. Serve a vedere da che parte ruota. */
function pixelDueColori(w = 40, h = 20): Buffer {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) raw.set(x < w / 2 ? ROSSO : BLU, (y * w + x) * 3);
  }
  return raw;
}

/** Come esce da un telefono: GPS, marca e modello, e orientamento 6 (girata di 90°). */
async function fotoDaTelefono(): Promise<Buffer> {
  return sharp(pixelDueColori(), { raw: { width: 40, height: 20, channels: 3 } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TelefonoProva", Model: "X1" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "45/1 28/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "9/1 11/1 0/1",
      },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

// Il puntatore all'IFD GPS (tag 0x8825), in tutte e due le endianness.
const haPuntatoreGps = (exif: Buffer) =>
  exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]));

async function rifiuto(input: Buffer): Promise<MotivoRifiuto | "accettata"> {
  try {
    await pulisciImmagine(input);
    return "accettata";
  } catch (e) {
    if (e instanceof ImmagineRifiutata) return e.motivo;
    throw e;
  }
}

function crc32(b: Buffer): number {
  let c = ~0;
  for (const byte of b) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(tipo: string, dati: Buffer): Buffer {
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dati]);
  const lung = Buffer.alloc(4);
  lung.writeUInt32BE(dati.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lung, corpo, crc]);
}

/**
 * Una PNG di poche decine di byte che DICHIARA w x h. Dentro c'e' una riga
 * sola: decodificarla per intero chiederebbe w*h*3 byte di memoria.
 */
function pngCheDichiara(w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.alloc(1 + w * 3), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("pulisciImmagine: GPS e metadati se ne vanno, l'orientamento resta nei pixel", () => {
  it("l'ingresso di prova ha davvero GPS, marca e orientamento 6", async () => {
    const m = await sharp(await fotoDaTelefono()).metadata();
    expect(m.orientation).toBe(6);
    expect(m.exif).toBeDefined();
    expect(haPuntatoreGps(m.exif!)).toBe(true);
    expect(m.exif!.includes("TelefonoProva")).toBe(true);
  });

  it("l'uscita non ha piu' exif, ne' GPS, ne' orientamento, ne' altri metadati", async () => {
    const out = await pulisciImmagine(await fotoDaTelefono());
    const m = await sharp(out.buffer).metadata();
    expect(m.exif).toBeUndefined();
    expect(m.orientation).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(m.iptc).toBeUndefined();
    expect(out.buffer.includes("TelefonoProva")).toBe(false);
    expect(out.contentType).toBe("image/jpeg");
    expect(m.format).toBe("jpeg");
  });

  it("l'orientamento e' applicato ai pixel: 40x20 con orientamento 6 esce 20x40, rosso in alto", async () => {
    const out = await pulisciImmagine(await fotoDaTelefono());
    expect([out.width, out.height]).toEqual([20, 40]);
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
    // 90° in senso orario: la colonna di sinistra (rossa) diventa la riga in alto.
    const [rAlto, , bAlto] = px(10, 5);
    const [rBasso, , bBasso] = px(10, 34);
    expect(rAlto).toBeGreaterThan(200);
    expect(bAlto).toBeLessThan(60);
    expect(bBasso).toBeGreaterThan(200);
    expect(rBasso).toBeLessThan(60);
  });
});

describe("pulisciImmagine: il tipo si legge dai byte", () => {
  it("un PDF rinominato .jpg e' rifiutato: il nome e il content-type non contano", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
    expect(tipoDaiByte(pdf)).toBeNull();
    expect(await rifiuto(pdf)).toBe("tipo_non_ammesso");
  });

  it("riconosce jpeg, png e webp; rifiuta gif", async () => {
    const pixel = { create: { width: 4, height: 4, channels: 3 as const, background: "#888" } };
    expect(tipoDaiByte(await sharp(pixel).jpeg().toBuffer())).toBe("jpeg");
    expect(tipoDaiByte(await sharp(pixel).png().toBuffer())).toBe("png");
    expect(tipoDaiByte(await sharp(pixel).webp().toBuffer())).toBe("webp");
    expect(await rifiuto(await sharp(pixel).gif().toBuffer())).toBe("tipo_non_ammesso");
  });

  it("magic bytes giusti ma file rotto: illeggibile, non un 500", async () => {
    expect(await rifiuto(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]))).toBe("illeggibile");
  });
});

describe("pulisciImmagine: i tetti", () => {
  it("sopra 8 MB e' rifiutata prima di guardarci dentro", async () => {
    const grande = Buffer.alloc(MAX_BYTE + 1);
    grande.set([0xff, 0xd8, 0xff]);
    expect(await rifiuto(grande)).toBe("troppo_grande");
  });

  it("una PNG di pochi byte che dichiara 10000x10000 e' rifiutata senza decodificarla", async () => {
    const bomba = pngCheDichiara(10_000, 10_000);
    expect(bomba.length).toBeLessThan(200);
    expect((await sharp(bomba).metadata()).width).toBe(10_000);
    expect(await rifiuto(bomba)).toBe("troppi_pixel");
  });

  it("lato lungo ridotto a 2000px, proporzioni tenute", async () => {
    const out = await pulisciImmagine(
      await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#4a4" } }).jpeg().toBuffer()
    );
    expect([out.width, out.height]).toEqual([MAX_LATO, 1000]);
  });

  it("una foto piccola non viene ingrandita", async () => {
    const out = await pulisciImmagine(
      await sharp({ create: { width: 120, height: 80, channels: 3, background: "#4a4" } }).webp().toBuffer()
    );
    expect([out.width, out.height]).toEqual([120, 80]);
    expect(out.contentType).toBe("image/jpeg");
  });
});

describe("pulisciImmagine: PNG", () => {
  it("una PNG davvero trasparente resta PNG, con la trasparenza", async () => {
    const out = await pulisciImmagine(
      await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.3 } } }).png().toBuffer()
    );
    expect(out.contentType).toBe("image/png");
    const m = await sharp(out.buffer).metadata();
    expect(m.format).toBe("png");
    expect(m.hasAlpha).toBe(true);
  });

  it("una PNG con canale alfa ma tutta opaca diventa JPEG", async () => {
    const out = await pulisciImmagine(
      await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 1 } } }).png().toBuffer()
    );
    expect(out.contentType).toBe("image/jpeg");
  });
});

describe("pulisciBase64: la stessa pulizia per la foto della chat", () => {
  it("una foto con GPS in base64 torna in base64 senza exif, ruotata", async () => {
    const out = await pulisciBase64((await fotoDaTelefono()).toString("base64"));
    expect(out).not.toBeNull();
    expect(out!.mediaType).toBe("image/jpeg");
    const m = await sharp(Buffer.from(out!.base64, "base64")).metadata();
    expect(m.exif).toBeUndefined();
    expect(m.orientation).toBeUndefined();
    expect([m.width, m.height]).toEqual([20, 40]);
  });

  it("un PDF in base64 dichiarato image/jpeg torna null: la chat prosegue senza foto", async () => {
    expect(await pulisciBase64(Buffer.from("%PDF-1.7 finto").toString("base64"))).toBeNull();
  });
});
