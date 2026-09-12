// La tabella di confronto dei piani.
//
// PERCHE' UNA TABELLA E NON TRE ELENCHI (12/09, scelta di Lucio)
// Tre elenchi puntati affiancati rispondono bene a "cosa c'e' nel Business" e
// male alla domanda che si fa davvero chi sceglie: "questa cosa, nel Free,
// ce l'ho o no?". Con tre elenchi l'assenza non si vede — bisogna scorrere
// l'altro elenco e accorgersi che manca. In tabella l'assenza e' una casella
// vuota alla stessa altezza della spunta, e si legge in orizzontale.
//
// LE RIGHE NON STANNO QUI. Stanno in `src/lib/piani.ts`, con i piani: qui c'e'
// solo come si disegnano. Il giorno che una funzione cambia piano si tocca un
// file solo e cambiano insieme tabella, elenchi e pagina del piano.
//
// TRE STATI, NON DUE. Oltre a "c'e'" e "non c'e'" esiste "in arrivo", perche'
// meta' di quello che il listino prometteva non era ancora costruito e
// segnarlo con una spunta e' una promessa che il prodotto non mantiene. La
// casella gialla lo dice e si distingue a colpo d'occhio dalla spunta.
//
// A 390px NON SI SCORRE DI LATO. Colonne a larghezza fissa in percentuale e
// nomi che vanno a capo: una tabella dei prezzi che scappa a destra sul
// telefono e' una tabella che nessuno legge fino in fondo.

import { Fragment } from "react";
import Link from "next/link";
import { Check, Clock3, Minus } from "lucide-react";
import {
  type Cella,
  type ScontiPerPiano,
  FUNZIONI,
  GRUPPI,
  NESSUNO_SCONTO,
  ORDINE,
  PIANI,
  etichettaPrezzo,
} from "@/lib/piani";
import type { SubscriptionTier } from "@/lib/supabase/types";

function Casella({ cella }: { cella: Cella }) {
  if (cella.tipo === "si") {
    return (
      <>
        <span className="sr-only">Incluso</span>
        <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-bob-indigo text-white">
          <Check className="h-4 w-4" aria-hidden="true" strokeWidth={3} />
        </span>
      </>
    );
  }
  if (cella.tipo === "no") {
    return (
      <>
        <span className="sr-only">Non incluso</span>
        <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.04] text-bob-ink/25">
          <Minus className="h-4 w-4" aria-hidden="true" strokeWidth={3} />
        </span>
      </>
    );
  }
  if (cella.tipo === "arrivo") {
    return (
      <span className="mx-auto inline-flex items-center gap-1 rounded-full bg-bob-yellow/25 px-2 py-0.5 text-[11px] font-semibold text-bob-ink/75 ring-1 ring-bob-yellow">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        In arrivo
      </span>
    );
  }
  return (
    <span className="text-[13px] font-semibold text-bob-indigo">
      {cella.testo}
    </span>
  );
}

export function TabellaPiani({
  evidenzia = "pro",
  sconti = NESSUNO_SCONTO,
  ctaHref,
}: {
  /** La colonna che si vuole far scegliere. */
  evidenzia?: SubscriptionTier;
  sconti?: ScontiPerPiano;
  /** Se c'e', sotto a ogni colonna compare il bottone che porta qui. */
  ctaHref?: string;
}) {
  // La colonna in evidenza e' tinta per tutta la sua altezza: il colore tiene
  // insieme intestazione e caselle anche quando la riga e' lunga.
  const colonna = (id: SubscriptionTier) =>
    id === evidenzia ? "bg-bob-indigo-50/70" : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-bob-indigo/15 bg-white shadow-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">
          Confronto dei piani per i professionisti: cosa include ciascun piano
        </caption>
        <colgroup>
          <col className="w-[40%] sm:w-[46%]" />
          <col className="w-[20%] sm:w-[18%]" />
          <col className="w-[20%] sm:w-[18%]" />
          <col className="w-[20%] sm:w-[18%]" />
        </colgroup>

        <thead>
          <tr className="align-top">
            <th
              scope="col"
              className="bg-bob-indigo px-3 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/80 sm:px-5"
            >
              {"Cosa c'è dentro"}
            </th>
            {PIANI.map((p) => {
              const et = etichettaPrezzo(p, sconti);
              const forte = p.id === evidenzia;
              return (
                <th
                  key={p.id}
                  scope="col"
                  className={`px-2 py-4 text-center align-top sm:px-3 ${
                    forte ? "bg-bob-indigo-600" : "bg-bob-indigo"
                  } text-white`}
                  data-testid={`colonna-${p.id}`}
                >
                  <span className="block text-sm font-bold sm:text-base">
                    {p.nome}
                  </span>
                  <span className="mt-1 block text-lg font-extrabold sm:text-xl">
                    {et.attuale}
                  </span>
                  {et.listino && (
                    <span className="block text-[11px] text-white/60 line-through">
                      {et.listino}
                    </span>
                  )}
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/70">
                    {p.prezzoMensile === 0 ? "per sempre" : "al mese"}
                  </span>
                  {forte && (
                    <span className="mt-2 inline-block rounded-full bg-bob-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bob-ink">
                      Consigliato
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {GRUPPI.map((gruppo) => {
            const righe = FUNZIONI.filter((f) => f.gruppo === gruppo);
            if (righe.length === 0) return null;
            return (
              <Fragment key={gruppo}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="bg-bob-indigo-100 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-bob-indigo sm:px-5"
                  >
                    {gruppo}
                  </th>
                </tr>
                {righe.map((f) => (
                  <tr
                    key={f.nome}
                    className="border-t border-black/5"
                    data-testid={`riga-${f.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <th
                      scope="row"
                      className="px-3 py-3 align-middle text-[13px] font-medium leading-snug text-bob-ink sm:px-5 sm:text-sm"
                    >
                      {f.nome}
                      {f.nota && (
                        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-bob-ink/55">
                          {f.nota}
                        </span>
                      )}
                    </th>
                    {ORDINE.map((id) => (
                      <td
                        key={id}
                        className={`px-1 py-3 text-center align-middle ${colonna(id)}`}
                      >
                        <Casella cella={f.celle[id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>

        {ctaHref && (
          <tfoot>
            <tr className="border-t border-black/5">
              <td className="px-3 py-4 sm:px-5" />
              {PIANI.map((p) => (
                <td
                  key={p.id}
                  className={`px-1.5 py-4 text-center align-middle ${colonna(p.id)}`}
                >
                  <Link
                    href={ctaHref}
                    className={`inline-block w-full rounded-xl px-2 py-2 text-[12px] font-semibold leading-tight transition ${
                      p.id === evidenzia
                        ? "bg-bob-indigo text-white hover:bg-bob-indigo-600"
                        : "border border-bob-indigo/25 text-bob-indigo hover:bg-bob-indigo-50"
                    }`}
                    data-testid={`cta-${p.id}`}
                  >
                    {p.id === "free" ? "Inizia gratis" : "Scegli"}
                  </Link>
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>

      <p className="border-t border-black/5 bg-white px-3 py-3 text-[11px] leading-relaxed text-bob-ink/55 sm:px-5">
        {
          "«In arrivo» vuol dire che la funzione è decisa ma non è ancora nel prodotto: la trovi qui perché il listino dica la verità anche quando la verità è «non ancora»."
        }
      </p>
    </div>
  );
}
