// LA PULIZIA DI UN'IMMAGINE PRIMA DELLO STORAGE (16/10, strip-exif-server-endpoint).
//
// Una foto di telefono porta con se' il GPS preciso di dove e' stata
// scattata, marca e modello del dispositivo, data e ora. Fino a oggi la
// toglieva solo il browser (il canvas di BobChat); ProPortfolio e
// VerificationDocuments caricano il file grezzo, e un'app nativa non ha un
// canvas. Qui la pulizia la fa il server, e un file che non passa di qui non
// e' un'immagine che entra nello storage.
//
// Funzione pura su un Buffer: niente rete, niente Supabase. La usa
// /api/upload/immagine, la prova immagini.test.ts.
//
// COSA FA, IN ORDINE, E PERCHE' IN QUEST'ORDINE
// 1. Tetto in byte, prima di guardare dentro: costa niente.
// 2. Tipo dai magic bytes, mai dal content-type dichiarato: un PDF rinominato
//    .jpg dichiara image/jpeg e resta un PDF.
// 3. Dimensioni lette dall'intestazione, SENZA decodificare: una PNG da pochi
//    KB puo' dichiarare 30000x30000 pixel e chiedere gigabyte di memoria
//    quando la si apre (decompression bomb). Si rifiuta prima di aprirla, e
//    limitInputPixels resta comunque come seconda rete.
// 4. rotate() applica l'orientamento EXIF ai pixel PRIMA che i metadati se ne
//    vadano: senza, una foto verticale esce coricata.
// 5. Lato lungo al massimo MAX_LATO, mai ingrandita.
// 6. Ri-codifica sempre. sharp scarta tutti i metadati per default (EXIF,
//    GPS, XMP, IPTC, orientamento): withMetadata/keepExif non si chiamano MAI.

import sharp, { type Metadata } from "sharp";

export const MAX_BYTE = 8 * 1024 * 1024;
export const MAX_PIXEL = 50_000_000;
export const MAX_LATO = 2000;
export const QUALITA_JPEG = 82;

export type TipoImmagine = "jpeg" | "png" | "webp";

export type MotivoRifiuto =
  | "troppo_grande" // oltre MAX_BYTE
  | "tipo_non_ammesso" // i byte non sono jpeg, png o webp
  | "troppi_pixel" // oltre MAX_PIXEL: possibile decompression bomb
  | "illeggibile"; // i magic bytes ci sono ma il file non si decodifica

export class ImmagineRifiutata extends Error {
  constructor(public readonly motivo: MotivoRifiuto) {
    super(`immagine rifiutata: ${motivo}`);
    this.name = "ImmagineRifiutata";
  }
}

export interface ImmaginePulita {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

/** Il tipo vero, dai primi byte. null per tutto il resto (PDF, HEIC, GIF, SVG...). */
export function tipoDaiByte(b: Buffer): TipoImmagine | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "png";
  }
  if (
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function pulisciImmagine(input: Buffer): Promise<ImmaginePulita> {
  if (input.length > MAX_BYTE) throw new ImmagineRifiutata("troppo_grande");

  const tipo = tipoDaiByte(input);
  if (!tipo) throw new ImmagineRifiutata("tipo_non_ammesso");

  const opzioni = { limitInputPixels: MAX_PIXEL };

  let meta: Metadata;
  try {
    meta = await sharp(input, opzioni).metadata();
  } catch (e) {
    throw rifiutoDa(e);
  }
  if (!meta.width || !meta.height) throw new ImmagineRifiutata("illeggibile");
  if (meta.width * meta.height > MAX_PIXEL) throw new ImmagineRifiutata("troppi_pixel");

  // Il PNG resta PNG solo se e' DAVVERO trasparente: un canale alfa tutto
  // opaco (gli screenshot ce l'hanno quasi sempre) diventa JPEG come il resto.
  let tienePng = false;
  if (tipo === "png" && meta.hasAlpha) {
    try {
      tienePng = !(await sharp(input, opzioni).stats()).isOpaque;
    } catch (e) {
      throw rifiutoDa(e);
    }
  }

  const base = sharp(input, opzioni)
    .rotate()
    .resize({ width: MAX_LATO, height: MAX_LATO, fit: "inside", withoutEnlargement: true });

  try {
    const { data, info } = tienePng
      ? await base.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await base
          // Una WebP trasparente diventa JPEG: lo sfondo e' bianco, non il nero di default.
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: QUALITA_JPEG })
          .toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      contentType: tienePng ? "image/png" : "image/jpeg",
      width: info.width,
      height: info.height,
    };
  } catch (e) {
    throw rifiutoDa(e);
  }
}

function rifiutoDa(e: unknown): ImmagineRifiutata {
  if (e instanceof ImmagineRifiutata) return e;
  const msg = e instanceof Error ? e.message : "";
  return new ImmagineRifiutata(/pixel limit/i.test(msg) ? "troppi_pixel" : "illeggibile");
}
