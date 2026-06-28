"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useAuth } from "./AuthProvider";
import { useUnread } from "./UnreadProvider";

const NAV = [
  { href: "/come-funziona", label: "Come funziona" },
  { href: "/citta", label: "Città" },
  { href: "/servizi", label: "Servizi" },
  { href: "/professionisti", label: "Professionisti" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, fullName, role, signOut, loading } = useAuth();
  const { unread } = useUnread();
  const [open, setOpen] = useState(false);
  const unreadLabel = unread > 9 ? "9+" : String(unread);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur-md">
      <div className="container-bob flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center" data-testid="link-home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "text-bob-indigo"
                    : "text-bob-ink/70 hover:text-bob-indigo"
                }`}
                data-testid={`nav-${item.href.slice(1)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {role === "admin" || role === "cs" ? (
            <Link href="/admin" className="btn-ghost text-bob-indigo font-semibold">
              ⚙️ Admin
            </Link>
          ) : (
            <Link href="/per-i-professionisti" className="btn-ghost">
              Per i professionisti
            </Link>
          )}
          {!loading && user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/messaggi"
                className="relative rounded-lg px-3 py-2 text-sm font-medium text-bob-ink/70 transition hover:text-bob-indigo"
                data-testid="link-messaggi"
              >
                Messaggi
                {unread > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bob-indigo px-1 text-[10px] font-bold leading-none text-white"
                    data-testid="badge-unread"
                  >
                    {unreadLabel}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard"
                className="btn-secondary py-2"
                data-testid="link-dashboard"
              >
                {fullName?.split(" ")[0] ?? "Area personale"}
                {role === "professional" ? " · Pro" : ""}
              </Link>
              <button
                onClick={handleSignOut}
                className="btn-ghost"
                data-testid="button-signout"
              >
                Esci
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary py-2" data-testid="link-login">
              Accedi
            </Link>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-bob-ink md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Apri menu"
          data-testid="button-menu"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-black/5 bg-white md:hidden">
          <div className="container-bob flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-bob-ink/80 hover:bg-bob-indigo-50"
              >
                {item.label}
              </Link>
            ))}
            {role === "admin" || role === "cs" ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-bob-indigo hover:bg-bob-indigo-50"
              >
                ⚙️ Admin
              </Link>
            ) : (
              <Link
                href="/per-i-professionisti"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-bob-ink/80 hover:bg-bob-indigo-50"
              >
                Per i professionisti
              </Link>
            )}
            <div className="mt-2 flex gap-2">
              {user ? (
                <>
                  <Link href="/messaggi" onClick={() => setOpen(false)} className="btn-ghost relative flex-1 py-2" data-testid="link-messaggi-mobile">
                    Messaggi
                    {unread > 0 && (
                      <span
                        className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bob-indigo px-1 text-[10px] font-bold leading-none text-white"
                        data-testid="badge-unread-mobile"
                      >
                        {unreadLabel}
                      </span>
                    )}
                  </Link>
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="btn-secondary flex-1 py-2">
                    Area personale
                  </Link>
                  <button onClick={handleSignOut} className="btn-ghost">
                    Esci
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="btn-primary flex-1 py-2">
                  Accedi
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
