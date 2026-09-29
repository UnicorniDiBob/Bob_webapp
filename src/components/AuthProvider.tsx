"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import type { VerificationLevel } from "@/lib/vat";
import { ascoltaSegnali, esciAccount } from "@/lib/sessioni/client";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  fullName: string | null;
  /** Livello di verifica del professionista: serve all'etichetta nell'header. */
  verificationLevel: VerificationLevel | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [verificationLevel, setVerificationLevel] =
    useState<VerificationLevel | null>(null);
  const [loading, setLoading] = useState(true);
  // L'utente che questa scheda ha in memoria: serve a scoprire, quando la
  // scheda torna in primo piano, che nei cookie c'e' ormai un altro account.
  const utenteInMemoria = useRef<string | null>(null);
  useEffect(() => {
    utenteInMemoria.current = session?.user?.id ?? null;
  }, [session]);

  async function loadProfile(userId: string) {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from("users").select("role").eq("id", userId).maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const ruolo = (u?.role as UserRole) ?? "customer";
    setRole(ruolo);
    setFullName(p?.full_name ?? null);

    // Solo per i professionisti, e una volta sola per sessione: il livello
    // serve a mostrare in alto che il profilo è verificato, senza costringere
    // a entrare nel profilo per scoprirlo.
    if (ruolo === "professional") {
      const { data: pro } = await supabase
        .from("professionals")
        .select("verification_level")
        .eq("user_id", userId)
        .maybeSingle();
      setVerificationLevel(
        ((pro as { verification_level?: VerificationLevel } | null)
          ?.verification_level as VerificationLevel) ?? "none"
      );
    } else {
      setVerificationLevel(null);
    }
  }

  async function refresh() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSession(session);
    if (session?.user) await loadProfile(session.user.id);
    else {
      setRole(null);
      setFullName(null);
      setVerificationLevel(null);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      else {
        setRole(null);
        setFullName(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SESSIONI MULTIPLE (29/09): un account attivo per browser, non per scheda.
  // Quando un'altra scheda scambia o esce, questa deve smettere di rinnovare
  // (se no ruoterebbe il refresh token che sta andando in attesa) e poi
  // ricaricarsi (se no resterebbe sull'account di prima, con un token ancora
  // valido). Rete in piu': al ritorno in primo piano, se nei cookie c'e' un
  // account diverso da quello in memoria, si ricarica. Vedi lib/sessioni/client.
  useEffect(() => {
    const smetti = ascoltaSegnali((s) => {
      if (s === "inizio") supabase.auth.stopAutoRefresh();
      else if (s === "annullato") supabase.auth.startAutoRefresh();
      else window.location.reload();
    });
    const alRitorno = async () => {
      if (document.visibilityState !== "visible") return;
      const {
        data: { session: neiCookie },
      } = await supabase.auth.getSession();
      if ((neiCookie?.user?.id ?? null) !== utenteInMemoria.current) window.location.reload();
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => {
      smetti();
      document.removeEventListener("visibilitychange", alRitorno);
    };
  }, [supabase]);

  // «Esci» (il pulsante in alto) = ESCI DA TUTTI gli account di questo
  // browser, e SOLO in questo browser (scope local, 29/09). Prima era
  // supabase.auth.signOut() con lo scope predefinito, globale: uscire dal
  // portatile chiudeva anche il telefono. «Esci da questo account», che
  // passa all'altro, sta in /impostazioni/accesso. Vedi NOTE_E_DECISIONI 29/09.
  async function signOut() {
    const ok = await esciAccount(supabase, "tutti");
    if (!ok) {
      // La route non ha risposto: si esce almeno in locale, cosi' il pulsante
      // non resta senza effetto. Scope local anche qui, mai globale.
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace("/");
    }
    setSession(null);
    setRole(null);
    setFullName(null);
  }

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    role,
    fullName,
    verificationLevel,
    loading,
    signOut,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
