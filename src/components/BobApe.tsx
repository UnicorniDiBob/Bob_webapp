/**
 * Bob, l'ape di BOB BEE (17/10, PR 2 del brief docs/BRIEF_logo_mascotte_bee.md).
 *
 * Un <picture> con AVIF, poi WebP, poi PNG: il browser prende il primo formato
 * che sa leggere e, fra le larghezze dichiarate, quella che gli serve per
 * `sizes`. Si scarica UNA sola immagine; i PNG pesanti ci sono solo per chi
 * non legge nessuno dei due formati moderni. Parte dallo snippet del
 * pacchetto (component/bob-mascot.html); i file in public/mascotte/ sono
 * quelli del pacchetto con il loro nome, copiati solo se usati.
 *
 * DUE FAMIGLIE DI FILE, e non e' un dettaglio:
 * - «sceglie-strumento» e' trasparente (1070x1096): sta su qualunque fondo;
 * - le altre pose sono CARTE QUADRATE (960x960) su un fondo quasi bianco
 *   (253,253,251), non trasparenti. Su un fondo colorato si vedrebbe il
 *   quadrato. Chi le mette su un fondo non bianco le ritaglia in tondo
 *   (`rounded-full` in className): l'ape ci sta dentro intera, antenne e piedi
 *   compresi — misurato, l'inchiostro arriva al 90-94% del raggio. Fa
 *   eccezione «giardinaggio» (111%): non va ritagliata.
 *   Provato anche mix-blend-mode: multiply per far sparire il fondo: lascia un
 *   rettangolo appena piu' scuro dove la carta copre la mezzaluna del Cerchio,
 *   perche' il fondo della carta non e' bianco uniforme. Scartato.
 *
 * SEMPRE width E height: il browser riserva lo spazio prima di avere
 * l'immagine, e la pagina non salta quando arriva.
 *
 * `priorita` solo per l'eroe della home, l'unica che sta nella prima
 * schermata: carica subito e con precedenza alta. Tutte le altre aspettano di
 * avvicinarsi allo schermo (loading="lazy").
 *
 * `className` va sull'<img>: <picture> resta un contenitore in linea senza
 * posizione, quindi un `absolute` sull'immagine si appoggia al primo antenato
 * posizionato (il Cerchio), come prima faceva il Bob disegnato.
 */

/**
 * Le pose usate oggi. Il brief ne ammette anche una settima,
 * «nessun-risultato»: i suoi file si copiano dal pacchetto il giorno che serve
 * (mai file che nessuno carica).
 */
export type PosaApe =
  | "sceglie-strumento"
  | "benvenuto"
  | "successo"
  | "elettricista"
  | "pulizie"
  | "giardinaggio";

type Serie = { larghezze: number[]; w: number; h: number; ripiego: number };

const MASCOTTE: Serie = { larghezze: [320, 640, 960, 1070], w: 1070, h: 1096, ripiego: 640 };
const CARTA: Serie = { larghezze: [480, 960], w: 960, h: 960, ripiego: 480 };

function serie(posa: PosaApe): Serie {
  return posa === "sceglie-strumento" ? MASCOTTE : CARTA;
}

function srcset(posa: PosaApe, formato: "avif" | "webp" | "png"): string {
  return serie(posa)
    .larghezze.map((l) => `/mascotte/bob-${posa}-${l}.${formato} ${l}w`)
    .join(", ");
}

export function BobApe({
  posa,
  alt,
  className = "",
  sizes = "(max-width: 640px) calc(100vw - 32px), 520px",
  priorita = false,
  testid,
}: {
  posa: PosaApe;
  /** In italiano, descrive l'ape. Vuoto solo se e' decorativa. */
  alt: string;
  className?: string;
  /** Quanto e' larga davvero sullo schermo: decide quale file si scarica. */
  sizes?: string;
  /** Solo per l'eroe della home. */
  priorita?: boolean;
  testid?: string;
}) {
  const s = serie(posa);
  return (
    <picture>
      <source type="image/avif" srcSet={srcset(posa, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcset(posa, "webp")} sizes={sizes} />
      {/* <picture> con AVIF e WebP: next/image non lo fa, e il pacchetto e'
          gia' ottimizzato. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/mascotte/bob-${posa}-${s.ripiego}.png`}
        srcSet={srcset(posa, "png")}
        sizes={sizes}
        width={s.w}
        height={s.h}
        alt={alt}
        loading={priorita ? "eager" : "lazy"}
        fetchPriority={priorita ? "high" : undefined}
        decoding="async"
        className={className}
        data-testid={testid}
      />
    </picture>
  );
}
