"use client";

// UNA RIGA DELLA LISTA DEI MESSAGGI CHE SI SCORRE, COME SU WHATSAPP (15/10).
//
// A destra «Da leggere» / «Letto», a sinistra «Archivia» (solo dove la pagina
// lo permette). Le decisioni stanno in lib/scorri.ts; qui c'e' solo il dito:
//   - il gesto e' nostro solo dopo ~10px e solo se e' chiaramente
//     orizzontale; touch-action: pan-y lascia lo scorrimento verticale al
//     browser, che non si inceppa;
//   - un gesto che parte entro 24px dal bordo sinistro e' il «torna indietro»
//     di Safari, e si lascia a lui;
//   - la riga segue il dito e scopre l'azione dietro; al rilascio scatta
//     oltre il 35% della riga o con un colpo veloce, altrimenti torna;
//   - con meno movimento (prefers-reduced-motion) niente molla: va e torna;
//   - niente vibrazione: sul web non c'e', e fingerla non serve.
// Solo dito e penna: col mouse la riga si clicca e basta, e le stesse azioni
// stanno nel «⋯» (che compare al passaggio e al fuoco) e nel tasto destro.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { MenuConversazione, type VoceMenu } from "@/components/MenuConversazione";
import {
  azioneAlRilascio,
  bloccoDirezione,
  partenzaIgnorata,
  spostamentoVisibile,
  type Direzione,
} from "@/lib/scorri";

export function RigaConversazione({
  children,
  attiva,
  onApri,
  destra,
  sinistra,
  voci,
  testid,
  chiave,
}: {
  children: ReactNode;
  attiva: boolean;
  onApri: (e: React.MouseEvent) => void;
  /** Lo scorrimento a destra: «Da leggere» o «Letto». null = non c'e'. */
  destra: { etichetta: string; azione: () => void } | null;
  /** Lo scorrimento a sinistra: «Archivia». null = non c'e'. */
  sinistra: { etichetta: string; azione: () => void } | null;
  /** Le voci del «⋯» e del tasto destro. */
  voci: VoceMenu[];
  testid: string;
  /** «richiesta::pro»: identifica la riga anche quando una richiesta ne ha piu' d'una. */
  chiave?: string;
}) {
  const [dx, setDx] = useState(0);
  const [animata, setAnimata] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const riga = useRef<HTMLDivElement>(null);
  const principale = useRef<HTMLButtonElement>(null);
  const gesto = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    dir: Direzione;
    mosso: boolean;
  } | null>(null);
  const appenaScorsa = useRef(false);
  const [piano, setPiano] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPiano(mq.matches);
    const cambia = () => setPiano(mq.matches);
    mq.addEventListener("change", cambia);
    return () => mq.removeEventListener("change", cambia);
  }, []);

  const puoDestra = Boolean(destra);
  const puoSinistra = Boolean(sinistra);

  function giu(e: React.PointerEvent) {
    // Un gesto nuovo: il «non e' un tocco» dello scorrimento di prima non vale
    // piu'. Uno scorrimento col dito non genera un click, e senza questa riga
    // il tocco SUCCESSIVO veniva ingoiato (provato il 15/10).
    appenaScorsa.current = false;
    if (e.pointerType === "mouse" || (!puoDestra && !puoSinistra)) return;
    if (partenzaIgnorata(e.clientX)) return;
    gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dir: null, mosso: false };
    setAnimata(false);
  }

  function muovi(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.dir) {
      g.dir = bloccoDirezione(mx, my);
      if (g.dir === "verticale") {
        gesto.current = null;
        return;
      }
      if (g.dir === "orizzontale") riga.current?.setPointerCapture(e.pointerId);
    }
    if (g.dir === "orizzontale") {
      g.mosso = true;
      setDx(spostamentoVisibile(mx, puoDestra, puoSinistra));
    }
  }

  function su(e: React.PointerEvent) {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.id !== e.pointerId || g.dir !== "orizzontale") return;
    appenaScorsa.current = g.mosso;
    const larghezza = riga.current?.getBoundingClientRect().width ?? 360;
    const azione = azioneAlRilascio({
      dx: e.clientX - g.x,
      larghezza,
      durataMs: performance.now() - g.t,
      destra: puoDestra,
      sinistra: puoSinistra,
    });
    setAnimata(!piano);
    if (azione === "sinistra" && sinistra) {
      // La riga esce dalla sua parte; la pagina la toglie e mostra «Annulla».
      setDx(-larghezza);
      window.setTimeout(() => sinistra.azione(), piano ? 0 : 180);
      return;
    }
    setDx(0);
    if (azione === "destra" && destra) destra.azione();
  }

  function annullaGesto() {
    gesto.current = null;
    setAnimata(!piano);
    setDx(0);
  }

  function apriMenu(punto: { x: number; y: number }) {
    setMenu(punto);
  }

  return (
    <div className="relative overflow-hidden" data-testid={testid} data-chiave={chiave}>
      {/* Le azioni dietro la riga: si vedono solo mentre il dito la sposta. */}
      {dx !== 0 && (
        <div aria-hidden="true" className="absolute inset-0 flex text-sm font-semibold text-white">
          {dx > 0 && destra && (
            <div className="flex flex-1 items-center bg-bob-indigo pl-5" data-testid="scorri-destra">
              {destra.etichetta}
            </div>
          )}
          {dx < 0 && sinistra && (
            <div className="flex flex-1 items-center justify-end bg-amber-600 pr-5" data-testid="scorri-sinistra">
              {sinistra.etichetta}
            </div>
          )}
        </div>
      )}
      <div
        ref={riga}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={annullaGesto}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          touchAction: "pan-y",
          transition: animata ? "transform 180ms ease-out" : "none",
        }}
        // Lo sfondo della riga attiva solo da md in su, dove la conversazione
        // si vede accanto alla lista (16/10): sul telefono si vede solo la
        // lista, e la riga scelta da sola sembrava gia' aperta.
        className={`group relative ${attiva ? "bg-white md:bg-bob-indigo-50" : "bg-white"}`}
      >
        <button
          ref={principale}
          type="button"
          onClick={(e) => {
            // Uno scorrimento non e' anche un tocco.
            if (appenaScorsa.current) {
              appenaScorsa.current = false;
              e.preventDefault();
              return;
            }
            onApri(e);
          }}
          onContextMenu={(e) => {
            if (voci.length === 0) return;
            e.preventDefault();
            apriMenu({ x: e.clientX || e.currentTarget.getBoundingClientRect().left + 16, y: e.clientY || e.currentTarget.getBoundingClientRect().bottom });
          }}
          className={`flex min-h-[64px] w-full flex-col justify-center gap-0.5 py-3 pl-4 pr-12 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bob-indigo/40 ${
            attiva ? "" : "hover:bg-black/[0.02]"
          }`}
          aria-current={attiva ? "true" : undefined}
          data-testid={`${testid}-apri`}
        >
          {children}
        </button>
        {voci.length > 0 && (
          <button
            type="button"
            aria-label="Altre azioni"
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              apriMenu({ x: r.right - 224, y: r.bottom });
            }}
            // Sui touch non c'e' il passaggio del cursore: un «⋯» invisibile ma
            // toccabile aprirebbe un menu a chi tocca il bordo della riga. Li'
            // ci sono lo scorrimento e il menu dell'intestazione della chat.
            className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-bob-ink/65 opacity-0 transition hover:bg-black/[0.05] hover:text-bob-ink focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-bob-indigo/40 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:hidden"
            data-testid={`${testid}-altro`}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {menu && (
        <MenuConversazione
          voci={voci}
          punto={menu}
          onChiudi={() => {
            setMenu(null);
            principale.current?.focus();
          }}
        />
      )}
    </div>
  );
}
