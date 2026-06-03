"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { getUnreadCount } from "@/lib/messages";

interface UnreadState {
  unread: number;
  refresh: () => Promise<void>;
}

const UnreadContext = createContext<UnreadState>({
  unread: 0,
  refresh: async () => {},
});

// Ogni quanto ricontrollare i messaggi non letti (ms).
const POLL_MS = 30000;

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const [unread, setUnread] = useState(0);
  const userRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userRef.current) {
      setUnread(0);
      return;
    }
    try {
      const n = await getUnreadCount(userRef.current, role);
      setUnread(n);
    } catch {
      // silenzioso: il badge non deve mai rompere la UI
    }
  }, [role]);

  useEffect(() => {
    userRef.current = user?.id ?? null;
    if (loading) return;
    if (!user) {
      setUnread(0);
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [user, role, loading, refresh]);

  return (
    <UnreadContext.Provider value={{ unread, refresh }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
