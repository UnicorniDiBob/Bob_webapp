"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  fullName: string | null;
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
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from("users").select("role").eq("id", userId).maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    setRole((u?.role as UserRole) ?? "customer");
    setFullName(p?.full_name ?? null);
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

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    setFullName(null);
  }

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    role,
    fullName,
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
