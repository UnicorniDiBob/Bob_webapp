// Dashboard admin: panoramica rapida dei numeri chiave.

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Users, Headphones } from "lucide-react";

export const revalidate = 30;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalPros },
    { count: pendingPros },
    { count: unverifiedPros },
    { count: totalUsers },
    { count: totalRequests },
  ] = await Promise.all([
    supabase.from("professionals").select("*", { count: "exact", head: true }),
    supabase
      .from("professionals")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("professionals")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "unverified"),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("requests").select("*", { count: "exact", head: true }),
  ]);

  const needsAction = (pendingPros ?? 0) + (unverifiedPros ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-bob-ink/55">Panoramica del marketplace BOB.</p>
      </div>

      {/* Alert verifiche in attesa */}
      {needsAction > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="font-semibold text-amber-800">
              {needsAction} {needsAction === 1 ? "professionista" : "professionisti"} in attesa di verifica
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              Verifica i profili: il badge dà fiducia ai clienti e priorità nei risultati.
            </p>
          </div>
          <Link
            href="/admin/professionals"
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Vai alle verifiche →
          </Link>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Professionisti totali" value={totalPros ?? 0} />
        <StatCard label="In attesa di verifica" value={needsAction} highlight={needsAction > 0} />
        <StatCard label="Utenti totali" value={totalUsers ?? 0} />
        <StatCard label="Richieste totali" value={totalRequests ?? 0} />
      </div>

      {/* Link rapidi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink
          href="/admin/professionals"
          icon={BadgeCheck}
          title="Gestisci verifiche"
          desc="Approva o rifiuta le iscrizioni dei professionisti."
        />
        <QuickLink
          href="/admin/users"
          icon={Users}
          title="Gestisci utenti"
          desc="Visualizza e modifica i profili di clienti e professionisti."
        />
        <QuickLink
          href="/admin/cs"
          icon={Headphones}
          title="Team Customer Service"
          desc="Crea e gestisci gli account del team CS."
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-5 ${highlight ? "border-amber-200 bg-amber-50" : ""}`}
    >
      <p className={`text-xs font-medium ${highlight ? "text-amber-700" : "text-bob-ink/55"}`}>
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${highlight ? "text-amber-800" : "text-bob-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card flex gap-4 p-5 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bob-indigo-50 text-bob-indigo">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-bob-ink">{title}</p>
        <p className="mt-0.5 text-xs text-bob-ink/60">{desc}</p>
      </div>
    </Link>
  );
}
