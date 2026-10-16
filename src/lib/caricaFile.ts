// IL LATO BROWSER DI /api/upload/immagine (16/10, strip-exif-client-switch).
//
// ProPortfolio e VerificationDocuments non scrivono piu' nello storage:
// mandano il file a /api/upload/immagine, che toglie i metadati e scrive.
//
// riduciPerInvio NON e' il controllo privacy — quello e' sul server, in
// src/lib/immagini.ts, e vale anche per chi non passa di qui (l'app nativa).
// Serve solo al PESO: una Vercel Function rifiuta corpi oltre 4,5 MB, e una
// foto di telefono ne pesa spesso 3-12. Il canvas la porta a 2000px JPEG
// (lo stesso tetto del server, che cosi' non ridimensiona due volte), e dove
// il browser sa leggere l'HEIC (Safari) lo converte anche. Se il browser non
// sa leggere il file, parte com'e' e risponde il server.

const LATO_MASSIMO = 2000;
const QUALITA = 0.9;

export type BucketCaricamento = "portfolio" | "verifica-documenti" | "brief-photos";

export interface FileCaricato {
  path: string;
  /** Solo per portfolio, l'unico bucket pubblico. */
  publicUrl?: string;
}

export async function riduciPerInvio(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("illeggibile"));
      img.src = url;
    });
    const scala = Math.min(1, LATO_MASSIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITA));
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** POST multipart a /api/upload/immagine. Lancia un Error col messaggio del server. */
export async function caricaFile(
  contenuto: Blob,
  bucket: BucketCaricamento,
  nome = "file"
): Promise<FileCaricato> {
  const form = new FormData();
  form.append("bucket", bucket);
  form.append("file", contenuto, nome);
  const res = await fetch("/api/upload/immagine", { method: "POST", body: form });
  const corpo = (await res.json().catch(() => null)) as
    | (FileCaricato & { error?: string })
    | null;
  if (!res.ok || !corpo?.path) {
    // 413 da Vercel stessa (corpo oltre 4,5 MB) arriva senza il nostro JSON.
    throw new Error(
      corpo?.error ?? (res.status === 413 ? "Il file è troppo grande." : "Caricamento non riuscito.")
    );
  }
  return { path: corpo.path, publicUrl: corpo.publicUrl };
}
