"use client";

// Il contenitore delle notifiche di servizio: una lettura sola per tutta
// l'applicazione, condivisa da campanella e pagina.
//
// PERCHE' UN PROVIDER E NON UNA FETCH PER COMPONENTE. La campanella sta
// nell'header (quindi su ogni pagina) e /notifiche mostra le stesse voci: due
// letture indipendenti vorrebbero dire due verita' che divergono di mezzo
// minuto, e il pallino acceso su una pagina che non elenca nulla. Una lettura,
// un elenco.
//
// Il polling e' lento apposta: 90 secondi contro i 30 dei messaggi. Le
// notifiche di servizio nascono da un intervento umano (uno di noi risponde a
// un ticket) o da un'azione dell'utente stesso: nessuna di queste cose ha
// bisogno di essere vista entro mezzo minuto, e ogni giro sono quattro query.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  caricaNotifiche,
  daVedere,
  EVENTO_NOTIFICHE,
  leggiViste,
  segnaViste,
  type Notifica,
} from "@/lib/notifiche";

interface StatoNotifiche {
  notifiche: Notifica[];
  /** Quante meritano il pallino: notizie nuove + cose ancora da fare. */
  daContare: number;
  caricate: boolean;
  ricarica: () => Promise<void>;
  segnaLette: () => void;
}

const Contesto = createContext<StatoNotifiche>({
  notifiche: [],
  daContare: 0,
  caricate: false,
  ricarica: async () => {},
  segnaLette: () => {},
});

const POLL_MS = 90_000;

export function NotificheProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { user, role, loading } = useAuth();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [caricate, setCaricate] = useState(false);
  const [viste, setViste] = useState<string | null>(null);
  const ctxRef = useRef<{ userId: string; role: string | null } | null>(null);

  const ricarica = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) {
      setNotifiche([]);
      setCaricate(true);
      return;
    }
    try {
      const n = await caricaNotifiche(supabase, ctx);
      setNotifiche(n);
    } catch {
      // Silenzioso: l'elenco resta quello di prima, la pagina non si rompe.
    } finally {
      setCaricate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setViste(leggiViste());
    const aggiorna = () => setViste(leggiViste());
    window.addEventListener(EVENTO_NOTIFICHE, aggiorna);
    return () => window.removeEventListener(EVENTO_NOTIFICHE, aggiorna);
  }, []);

  useEffect(() => {
    if (loading) return;
    // Lo staff non ha notifiche di servizio: le sue cose stanno in /admin.
    if (!user || role === "admin" || role === "cs") {
      ctxRef.current = null;
      setNotifiche([]);
      setCaricate(true);
      return;
    }
    ctxRef.current = { userId: user.id, role };
    ricarica();
    const id = setInterval(ricarica, POLL_MS);
    return () => clearInterval(id);
  }, [user, role, loading, ricarica]);

  const segnaLette = useCallback(() => {
    segnaViste();
    setViste(leggiViste());
  }, []);

  const daContare = notifiche.filter((n) => daVedere(n, viste)).length;

  return (
    <Contesto.Provider
      value={{ notifiche, daContare, caricate, ricarica, segnaLette }}
    >
      {children}
    </Contesto.Provider>
  );
}

export function useNotifiche() {
  return useContext(Contesto);
}
