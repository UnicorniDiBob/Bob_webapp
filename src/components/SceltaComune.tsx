"use client";

// «Dove hai la tua base»: regione, comune, CAP.
//
// PERCHÉ NON TRE CAMPI LIBERI
// Il campo «zona» che c'era prima era testo libero, e infatti rispondeva
// «zona 9», «Niguarda», «nord Milano»: tre risposte che non si confrontano con
// niente e da cui non si può inquadrare una mappa. Qui il comune si sceglie da
// un elenco (ISTAT), provincia e regione arrivano da sé, e il CAP è
// obbligatorio ma proposto: chi sta a Sesto ne ha uno solo e se lo trova già
// scritto, chi sta a Milano ne ha quarantadue e sceglie il suo.
//
// SI SCEGLIE DA UN ELENCO, MA SI CERCA SCRIVENDO
// Ottomila comuni in una tendina sono inutilizzabili, e la regione da sola non
// basta (la Lombardia ne ha 1.500). Quindi: si scrive e si filtra, con le
// frecce e Invio per chi non usa il mouse. La regione resta come setaccio, per
// chi il nome esatto non se lo ricorda.
//
// L'ELENCO STA SUL SERVER, NON QUI
// Il file dei comuni pesa 900 KB: spedirlo al browser di chiunque apra
// l'iscrizione, per un campo di ricerca, non ha senso. Si chiede a
// /api/geo/comuni, venti righe per volta, con un ritardo di 200 ms per non
// fare una richiesta a ogni tasto.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

export interface ComuneScelto {
  istat: string;
  nome: string;
  sigla: string;
  provincia: string;
  regione: string;
  cap: string[];
  lat: number | null;
  lng: number | null;
}

interface Props {
  comune: ComuneScelto | null;
  cap: string;
  onComune: (c: ComuneScelto | null) => void;
  onCap: (cap: string) => void;
  errore?: string | null;
}

export default function SceltaComune({ comune, cap, onComune, onCap, errore }: Props) {
  const [regioni, setRegioni] = useState<string[]>([]);
  const [regione, setRegione] = useState("");
  const [testo, setTesto] = useState("");
  const [risultati, setRisultati] = useState<ComuneScelto[]>([]);
  const [aperto, setAperto] = useState(false);
  const [cercando, setCercando] = useState(false);
  const [evidenziato, setEvidenziato] = useState(0);
  const [capLibero, setCapLibero] = useState(false);
  const contenitore = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/geo/comuni?elenco=regioni")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d?.regioni) setRegioni(d.regioni as string[]);
      })
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);

  // IL COMUNE PUÒ ARRIVARE DA FUORI, non solo dalla scelta qui dentro: in
  // /impostazioni/azienda la pagina lo legge dal profilo e lo passa già
  // scelto. Senza questo, il campo resterebbe vuoto davanti a chi il comune
  // l'aveva già detto, e sembrerebbe da rifare.
  const ultimoIstat = useRef<string | null>(null);
  useEffect(() => {
    if (!comune) {
      ultimoIstat.current = null;
      return;
    }
    if (ultimoIstat.current === comune.istat) return;
    ultimoIstat.current = comune.istat;
    setTesto(`${comune.nome} (${comune.sigla})`);
    setRegione(comune.regione);
  }, [comune]);

  // Un clic fuori chiude l'elenco: senza, resta aperto sopra il resto del
  // modulo e copre i campi che vengono dopo.
  useEffect(() => {
    function fuori(e: MouseEvent) {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) {
        setAperto(false);
      }
    }
    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, []);

  const cerca = useCallback(
    async (q: string, reg: string) => {
      if (q.trim().length < 2 && !reg) {
        setRisultati([]);
        return;
      }
      setCercando(true);
      try {
        const url = `/api/geo/comuni?q=${encodeURIComponent(q)}&regione=${encodeURIComponent(reg)}`;
        const r = await fetch(url);
        const d = r.ok ? await r.json() : null;
        setRisultati((d?.comuni as ComuneScelto[] | undefined) ?? []);
        setEvidenziato(0);
      } catch {
        setRisultati([]);
      } finally {
        setCercando(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => cerca(testo, regione), 200);
    return () => clearTimeout(t);
  }, [testo, regione, cerca]);

  function scegli(c: ComuneScelto) {
    onComune(c);
    setTesto(`${c.nome} (${c.sigla})`);
    setAperto(false);
    setRegione(c.regione);
    // Un CAP solo: è già la risposta, non c'è niente da scegliere.
    if (c.cap.length === 1) {
      onCap(c.cap[0]);
      setCapLibero(false);
    } else {
      onCap("");
      setCapLibero(c.cap.length === 0);
    }
  }

  function tasti(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aperto || risultati.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setEvidenziato((i) => Math.min(i + 1, risultati.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setEvidenziato((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      scegli(risultati[evidenziato]);
    } else if (e.key === "Escape") {
      setAperto(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label-bob" htmlFor="regione">
          Regione{" "}
          <span className="font-normal text-bob-ink/65">(per restringere la ricerca)</span>
        </label>
        <select
          id="regione"
          value={regione}
          onChange={(e) => {
            setRegione(e.target.value);
            if (comune && e.target.value !== comune.regione) {
              onComune(null);
              onCap("");
              setTesto("");
            }
          }}
          className="input-bob"
          data-testid="input-regione"
        >
          <option value="">Tutta Italia</option>
          {regioni.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div ref={contenitore}>
        <label className="label-bob" htmlFor="comune">
          Comune
        </label>
        <div className="relative">
          <input
            id="comune"
            type="text"
            role="combobox"
            aria-expanded={aperto}
            aria-controls="elenco-comuni"
            aria-autocomplete="list"
            autoComplete="off"
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value);
              setAperto(true);
              if (comune) onComune(null);
            }}
            onFocus={() => setAperto(true)}
            onKeyDown={tasti}
            className="input-bob"
            placeholder="Scrivi le prime lettere: Mila…"
            data-testid="input-comune"
            required
          />
          {cercando && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-bob-ink/40"
              aria-hidden="true"
            />
          )}

          {aperto && risultati.length > 0 && (
            <ul
              id="elenco-comuni"
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-black/10 bg-white shadow-lg"
            >
              {risultati.map((c, i) => (
                <li key={c.istat} role="option" aria-selected={i === evidenziato}>
                  <button
                    type="button"
                    onMouseEnter={() => setEvidenziato(i)}
                    onClick={() => scegli(c)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${
                      i === evidenziato ? "bg-bob-indigo/10" : ""
                    }`}
                  >
                    <span className="font-medium">{c.nome}</span>
                    <span className="text-xs text-bob-ink/60">
                      {c.provincia} · {c.regione}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {comune && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-bob-ink/65">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {comune.provincia} ({comune.sigla}) · {comune.regione}
          </p>
        )}
      </div>

      <div>
        <label className="label-bob" htmlFor="cap">
          CAP
        </label>

        {comune && comune.cap.length > 1 && !capLibero ? (
          <>
            <select
              id="cap"
              value={cap}
              onChange={(e) => {
                if (e.target.value === "__altro__") {
                  setCapLibero(true);
                  onCap("");
                  return;
                }
                onCap(e.target.value);
              }}
              className="input-bob"
              data-testid="input-cap"
              required
            >
              <option value="">Scegli il tuo CAP…</option>
              {comune.cap.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__altro__">Il mio non è in elenco…</option>
            </select>
            <p className="mt-1 text-xs text-bob-ink/65">
              {comune.nome} ha {comune.cap.length} CAP: scegli quello della tua
              base, è da lì che parte la mappa della tua area di lavoro.
            </p>
          </>
        ) : (
          <>
            <input
              id="cap"
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={cap}
              onChange={(e) => onCap(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="input-bob"
              placeholder="20159"
              data-testid="input-cap"
              required
            />
            {comune && comune.cap.length > 1 && (
              <button
                type="button"
                onClick={() => setCapLibero(false)}
                className="mt-1 text-xs text-bob-indigo hover:underline"
              >
                torna all&apos;elenco dei CAP di {comune.nome}
              </button>
            )}
          </>
        )}

        {errore && <p className="mt-1 text-xs text-red-600">{errore}</p>}
      </div>
    </div>
  );
}
