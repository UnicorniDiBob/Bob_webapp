import { Bob } from "./Bob";

/**
 * Bob che tiene in mano un telefono con l'elenco dei professionisti.
 *
 * LE PROPORZIONI. Bob occupa il 78% della scena e il telefono il 34%: il
 * protagonista e' lui, il telefono e' quello che mostra. Al primo tentativo era
 * 64/42 e sembrava un uomo aggrappato a un tablet.
 * Sotto i 640px il telefono sale al 40%, perche' li' la scena e' larga 346px e
 * al 34% il telefono scendeva a 118px: il testo dentro e' a misura fissa e non
 * ci stava piu'. Misurato, non a occhio — sotto i 130px di telefono le righe
 * traboccano.
 *
 * COME STA IN MANO. Il telefono e' disegnato PRIMA di Bob nel DOM, quindi la
 * mano gli finisce sopra invece che sotto: e' quello che lo fa sembrare
 * impugnato. Il braccio destro e' forzato a -32 gradi perche' nessuna posa
 * standard alza la mano quel tanto senza disegnare anche un telefono suo. La
 * posizione del telefono non e' a occhio: con quell'angolo la mano cade al
 * 79% della larghezza di Bob e al 75% della sua altezza, e il telefono e'
 * messo perche' il suo bordo sinistro basso ci capiti sopra.
 *
 * LA RIGA E' SU DUE LINEE, e non e' estetica. Prima era nome + voto + prezzo
 * tutto in orizzontale: dentro un telefono largo 170px i nomi si tagliavano
 * («Idr…», «Elett…») e il voto andava a capo per conto suo. Il testo qui e' a
 * misura fissa mentre il contenitore e' in percentuale, quindi la larghezza non
 * si puo' dare per scontata: meno roba per riga e nomi corti.
 *
 * L'ELENCO SCORRE IN CSS: nessun JavaScript spedito al browser. Le righe sono
 * duplicate e la corsa si ferma a meta', cosi' il ritorno a capo cade dove
 * l'elenco ricomincia e non si vede. Chi ha chiesto meno movimento lo vede
 * fermo — la regola sta in globals.css accanto ai fotogrammi.
 *
 * IL CONTENITORE DEVE ESSERE LARGO. Ogni misura qui dentro e' una percentuale
 * della scena, quindi se la scena si restringe si restringe tutto, testo
 * compreso — e il testo non rimpicciolisce, si taglia. E' successo in
 * produzione il 12 settembre: il contenitore nella home aveva
 * `justify-self-center` senza lo `stretch` sul desktop, la cella della griglia
 * si e' ridotta al contenuto (300px invece di 520), il telefono e' finito a
 * 102px e l'intestazione si leggeva «IDRAULI…». Chi usa questo componente gli
 * deve dare una larghezza vera, non lasciarlo dimensionare dal contenuto.
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

export function BobConElenco({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto w-full max-w-[520px] ${className}`}>
      {/* Il telefono viene prima: la mano di Bob deve passargli sopra. */}
      <div className="absolute left-[54.7%] top-[29%] w-[40%] rounded-[14%/8%] bg-bob-ink p-[4%] shadow-card-hover sm:left-[58%] sm:w-[34%]">
        <div className="overflow-hidden rounded-[11%/6%] bg-white">
          <div className="bg-bob-indigo-50 px-2 py-2">
            <p className="truncate text-center text-2xs font-bold uppercase text-bob-indigo">
              Idraulici<span className="hidden sm:inline"> · Milano</span>
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

      <Bob
        posa="neutro"
        gradiBraccioDestro={-32}
        alt="Bob mostra l'elenco dei professionisti sul telefono"
        className="relative w-[78%]"
      />
    </div>
  );
}
