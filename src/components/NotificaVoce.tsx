"use client";

// Una voce di notifica di servizio. Stessa forma nella tendina e nella pagina:
// se cambia, cambia in un posto solo.
//
// TRE LIVELLI, TRE SEGNALI DIVERSI, nessun rosso sprecato:
// - azione: c'e' qualcosa che tocca a te, e finche' non lo fai resta acceso;
// - avviso: e' successo qualcosa, lo devi sapere, non devi fare niente;
// - fatto: e' andata bene. Un prodotto che parla solo quando c'e' un problema
//   insegna a temere la campanella.

import Link from "next/link";
import {
  AlertTriangle,
  CalendarX2,
  CheckCircle2,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { Notifica } from "@/lib/notifiche";

const STILE: Record<
  Notifica["livello"],
  { icona: LucideIcon; tinta: string; sfondo: string }
> = {
  azione: {
    icona: AlertTriangle,
    tinta: "text-amber-600",
    sfondo: "bg-amber-50",
  },
  avviso: { icona: Info, tinta: "text-bob-indigo", sfondo: "bg-bob-indigo-50" },
  fatto: {
    icona: CheckCircle2,
    tinta: "text-emerald-600",
    sfondo: "bg-emerald-50",
  },
};

function quandoLeggibile(iso: string): string {
  const d = new Date(iso);
  const minuti = Math.round((Date.now() - d.getTime()) / 60_000);
  if (minuti < 1) return "adesso";
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? "ora" : "ore"} fa`;
  const giorni = Math.round(ore / 24);
  if (giorni < 7) return `${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

export function NotificaVoce({
  n,
  nuova,
  compatta = false,
  onNavigato,
}: {
  n: Notifica;
  /** Merita il pallino: notizia non ancora aperta, o cosa ancora da fare. */
  nuova: boolean;
  /** Nella tendina il testo si accorcia; nella pagina si legge tutto. */
  compatta?: boolean;
  onNavigato?: () => void;
}) {
  const s = STILE[n.livello];
  const Icona = s.icona;

  if (n.disdetta) {
    return <VoceDisdetta n={n} nuova={nuova} onNavigato={onNavigato} />;
  }

  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 ${
        nuova ? "bg-black/[0.015]" : ""
      }`}
      data-testid={`notifica-${n.id.split(":")[0]}`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.sfondo}`}
        aria-hidden="true"
      >
        <Icona className={`h-4 w-4 ${s.tinta}`} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-bob-ink">
          <span className="min-w-0">{n.titolo}</span>
          {nuova && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-bob-indigo"
              aria-label="Da vedere"
            />
          )}
        </p>

        <p
          className={`mt-0.5 text-sm leading-relaxed text-bob-ink/65 ${
            compatta ? "line-clamp-2" : ""
          }`}
        >
          {n.testo}
        </p>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-bob-ink/65">
          {n.mittente && <span>{n.mittente}</span>}
          {n.mittente && n.quando && <span aria-hidden="true">·</span>}
          {n.quando && <span>{quandoLeggibile(n.quando)}</span>}
          {/* Il link c'e' solo se c'e' davvero un posto dove andare. Un
              avviso di servizio (071) si legge e basta: mettergli sotto un
              «vai →» che riporta alla pagina in cui sei gia' e' rumore. */}
          {n.href && n.azione && (
            <>
              {(n.mittente || n.quando) && <span aria-hidden="true">·</span>}
              <Link
                href={n.href}
                onClick={onNavigato}
                className="font-semibold text-bob-indigo hover:underline"
                data-testid={`notifica-azione-${n.id.split(":")[0]}`}
              >
                {n.azione} →
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

// LA DISDETTA IN EVIDENZA (07/10, Lucio). Un appuntamento annullato
// dall'altra parte non puo' essere una riga grigia fra un promemoria e una
// verifica: e' un buco nella giornata. Bordo e fondo rossi, l'orario che
// salta barrato, chi ha annullato, il motivo se c'e', e la conversazione a
// un tocco. Uguale nella tendina e nella pagina: qui non si accorcia niente,
// sono quattro righe al massimo.
function VoceDisdetta({
  n,
  nuova,
  onNavigato,
}: {
  n: Notifica;
  nuova: boolean;
  onNavigato?: () => void;
}) {
  const d = n.disdetta!;
  return (
    <li
      className="flex items-start gap-3 border-l-4 border-red-500 bg-red-50/70 px-4 py-3"
      data-testid="notifica-disdetta"
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100"
        aria-hidden="true"
      >
        <CalendarX2 className="h-4 w-4 text-red-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
          <span className="min-w-0">{n.titolo}</span>
          {nuova && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600"
              aria-label="Da vedere"
            />
          )}
        </p>
        <p className="mt-0.5 text-sm text-bob-ink/80">
          <span className="sr-only">Orario annullato: </span>
          <span className="line-through decoration-red-500/70">{d.orario}</span>
        </p>
        <p className="mt-0.5 text-xs text-bob-ink/70">
          Annullato da {d.chi}
          {d.concordatoTelefono ? ", come concordato al telefono" : ""}
          {n.quando ? ` · ${quandoLeggibile(n.quando)}` : ""}
        </p>
        {d.motivo && (
          <p className="mt-1 break-words text-sm text-bob-ink/80">
            Motivo: «{d.motivo}»
          </p>
        )}
        {n.href && (
          <Link
            href={n.href}
            onClick={onNavigato}
            className="mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold text-red-700 hover:underline"
            data-testid="notifica-disdetta-chat"
          >
            {n.azione ?? "Apri la conversazione"} →
          </Link>
        )}
      </div>
    </li>
  );
}
