"use client";

// Bolla messaggi flottante (basso a destra): sostituisce la voce "Messaggi"
// nell'header, che risultava affollato. Mostra il conteggio dei non letti
// (stesso UnreadProvider, polling 30s) e sparisce dove non serve:
// dentro /messaggi stessa e nell'area admin.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useUnread } from "./UnreadProvider";

export function MessagesBubble() {
  const { user, loading } = useAuth();
  const { unread } = useUnread();
  const pathname = usePathname();

  if (loading || !user) return null;
  if (pathname?.startsWith("/messaggi") || pathname?.startsWith("/admin")) {
    return null;
  }

  const label = unread > 9 ? "9+" : String(unread);

  return (
    <Link
      href="/messaggi"
      aria-label={
        unread > 0 ? `Messaggi, ${unread} non letti` : "Apri i messaggi"
      }
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bob-indigo text-white shadow-card-hover transition hover:scale-105 hover:bg-bob-indigo/90"
      data-testid="bubble-messaggi"
      data-tour="messaggi"
    >
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 10.5h8m-8 4h5m6.4-2a8.38 8.38 0 0 1-9.9 8.25 8.5 8.5 0 0 1-2.1-.55L3 21l1.3-3.9a8.38 8.38 0 1 1 15.1-4.6Z"
        />
      </svg>
      {unread > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white"
          data-testid="bubble-unread"
        >
          {label}
        </span>
      )}
    </Link>
  );
}
