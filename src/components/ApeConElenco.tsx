import { BobApe } from "./BobApe";

/**
 * L'ape che festeggia, accanto a un telefono con l'elenco dei professionisti.
 *
 * DAL 17/10 (PR 2 del brief docs/BRIEF_logo_mascotte_bee.md) c'e' l'ape al
 * posto di Bob che teneva il telefono in mano. Dal ritocco dello stesso giorno
 * (André) la posa e' «successo» e non piu' «sceglie lo strumento»: l'elenco e'
 * la risposta, non la domanda. E' una carta su fondo bianco e la fascia e'
 * indaco: va in tondo, un medaglione (vedi BobApe). Il telefono non e'
 * impugnato e sta di fianco, senza toccarla; un'ape col telefono in mano e'
 * nell'elenco delle pose da fare (docs/MASCOTTE_pose_mancanti.md).
 *
 * LE MISURE. La scena ha un rapporto fisso (520/360) e dentro tutto e' in
 * percentuale: il medaglione al 56% a sinistra (al 60% sul telefono vero
 * toccava il bordo del telefono), il telefono al 36% a destra, 40%
 * sotto i 640px. Il telefono sale al 40% sul telefono vero perche' li' la
 * scena e' larga ~350px e al 36% scenderebbe sotto i 130px: il testo dentro e'
 * a misura fissa e sotto quella larghezza le righe traboccano (misurato il
 * 12/09, non a occhio).
 *
 * LA RIGA E' SU DUE LINEE, e non e' estetica: nome + voto + prezzo in
 * orizzontale dentro un telefono di 170px tagliava i nomi («Idr…»). Il testo
 * qui e' a misura fissa mentre il contenitore e' in percentuale: meno roba per
 * riga e nomi corti.
 *
 * L'ELENCO SCORRE IN CSS: nessun JavaScript spedito al browser. Le righe sono
 * duplicate e la corsa si ferma a meta', cosi' il ritorno a capo cade dove
 * l'elenco ricomincia. Chi ha chiesto meno movimento lo vede fermo — la regola
 * sta in globals.css accanto ai fotogrammi.
 *
 * IL CONTENITORE DEVE ESSERE LARGO. Ogni misura qui e' una percentuale della
 * scena: se la scena si restringe si restringe tutto, testo compreso, e il
 * testo non rimpicciolisce, si taglia. E' successo il 12 settembre con un
 * `justify-self-center` che stringeva la cella al contenuto. Chi usa questo
 * componente gli deve dare una larghezza vera.
 *
 * I NOMI SONO FINTI di proposito: stampare i professionisti veri li mette in
 * prima pagina senza che l'abbiano chiesto, e cambierebbe da solo coi dati.
 */

const RIGHE = [
  { nome: "Idraulico", prezzo: "€ 60–90", stelle: "4.8" },
  { nome: "Elettricista", prezzo: "€ 45/h", stelle: "4.9" },
  { nome: "Pulizie", prezzo: "€ 22/h", stelle: "4.7" },
  { nome: "Imbianchino", prezzo: "€ 35–50", stelle: "4.6" },
  { nome: "Fabbro", prezzo: "€ 80–120", stelle: "4.8" },
];

export function ApeConElenco({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative mx-auto aspect-[520/360] w-full max-w-[520px] ${className}`}
      data-testid="scena-elenco"
    >
      <BobApe
        posa="successo"
        alt="Bob, l'ape di BOB BEE, festeggia accanto all'elenco dei professionisti"
        sizes="(min-width: 640px) 292px, 56vw"
        className="absolute bottom-[3%] left-0 w-[56%] rounded-full"
      />
      <div className="absolute right-[1%] top-[4%] w-[40%] rounded-[14%/8%] bg-bob-ink p-[4%] shadow-card-hover sm:w-[36%]">
        <div className="overflow-hidden rounded-[11%/6%] bg-white">
          {/* L'elenco mescola mestieri: il titolo dice «professionisti», non
              «idraulici» (17/10). Su due righe, perche' «Professionisti ·
              Milano» su una non ci sta: misurato, servono 151px dove ce ne
              sono 130, e si leggeva «… MIL…». Sul telefono vero solo
              «Professionisti», come prima solo il mestiere; li' ci stava per
              1px, e il margine laterale passa da px-2 a px-1.5. */}
          <div className="bg-bob-indigo-50 px-1.5 py-2 sm:px-2">
            <p className="text-center text-2xs font-bold uppercase leading-tight text-bob-indigo">
              <span className="block truncate">Professionisti</span>
              <span className="hidden truncate sm:block">Milano</span>
            </p>
          </div>
          {/* Rapporto fisso: l'altezza della finestra segue la larghezza. */}
          <div className="aspect-[10/14] overflow-hidden">
            <ul className="elenco-scorre">
              {[...RIGHE, ...RIGHE].map((r, i) => (
                <li key={i} className="border-b border-black/5 px-2.5 py-2">
                  <span className="block truncate text-2xs font-semibold text-bob-ink">
                    {r.nome}
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-1">
                    <span className="shrink-0 whitespace-nowrap text-2xs text-bob-ink/65">
                      ★ {r.stelle}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-2xs font-bold tabular-nums text-bob-ink">
                      {r.prezzo}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
