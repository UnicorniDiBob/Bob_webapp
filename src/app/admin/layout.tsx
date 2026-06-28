// Layout condiviso per tutte le pagine /admin/*.
// Mostra una sidebar con navigazione e protegge le rotte lato server.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = userRow?.role;
  if (role !== "admin" && role !== "cs") redirect("/");

  const isAdmin = role === "admin";

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-black/5 bg-white lg:block">
        <div className="sticky top-16 p-4">
          <div className="mb-4 px-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-bob-ink/40">
              Admin
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            <SidebarLink href="/admin" label="Dashboard" icon="📊" exact />
            <SidebarLink href="/admin/professionals" label="Verifiche" icon="🪪" />
            <SidebarLink href="/admin/users" label="Utenti" icon="👥" />
            {isAdmin && (
              <SidebarLink href="/admin/cs" label="Customer Service" icon="🎧" />
            )}
          </nav>
          <div className="mt-6 border-t border-black/5 pt-4 px-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isAdmin
                ? "bg-bob-indigo text-white"
                : "bg-bob-indigo-50 text-bob-indigo"
            }`}>
              {isAdmin ? "Admin" : "Customer Service"}
            </span>
          </div>
        </div>
      </aside>

      {/* Contenuto principale */}
      <main className="flex-1 bg-black/[0.02] p-6 lg:p-8">
        {/* Nav mobile */}
        <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
          <MobileLink href="/admin" label="Dashboard" />
          <MobileLink href="/admin/professionals" label="Verifiche" />
          <MobileLink href="/admin/users" label="Utenti" />
          {isAdmin && <MobileLink href="/admin/cs" label="CS" />}
        </div>
        {children}
      </main>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  exact,
}: {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-bob-ink/70 transition hover:bg-bob-indigo-50 hover:text-bob-indigo"
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}

function MobileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-bob-ink/70 hover:border-bob-indigo/30 hover:text-bob-indigo"
    >
      {label}
    </Link>
  );
}
