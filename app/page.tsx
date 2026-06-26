"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadData, saveData, totalQuestions } from "@/lib/tracker";
import { optiverProjection } from "@/lib/engine";
import { pullFromCloud, mergeData, getLastSync } from "@/lib/sync";

const MODES = [
  { label: "Blitz",   sub: "1 min",        href: "/drill?mode=adaptive&secs=60",  accent: "#7c3aed" },
  { label: "Speed",   sub: "2 min",        href: "/drill?mode=adaptive&secs=120", accent: "#1d4ed8" },
  { label: "Quick",   sub: "5 min",        href: "/drill?mode=adaptive&secs=300", accent: "#0e7490" },
  { label: "Full",    sub: "15 min",       href: "/drill?mode=adaptive&secs=900", accent: "#0f766e" },
  { label: "Sim",     sub: "80 q · 8 min", href: "/drill?mode=sim",              accent: "#b45309" },
  { label: "Focus",   sub: "pick skills",  href: "/drill?mode=focus",             accent: "#374151" },
];

export default function Home() {
  const [total,   setTotal]   = useState<number | null>(null);
  const [proj,    setProj]    = useState<{ projectedScore: number } | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      let local = loadData();
      const cloud = await pullFromCloud();
      if (cloud) { local = mergeData(local, cloud); saveData(local); }
      setTotal(totalQuestions(local));
      setProj(optiverProjection(local));
      setLastSync(getLastSync());
      setSyncing(false);
    }
    init();
  }, []);

  function fmtSync(ts: string | null) {
    if (!ts) return null;
    const diff = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1)  return "synced";
    if (diff < 60) return `synced ${diff}m ago`;
    return `synced ${Math.round(diff / 60)}h ago`;
  }

  const projScore = proj?.projectedScore ?? null;
  const projColor = projScore === null ? "#52525b" : projScore >= 70 ? "#10b981" : projScore >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <main className="max-w-md mx-auto px-5 pb-8" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 40px)" }}>

      {/* Title row */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Mental Math</h1>
          <p className="text-zinc-500 text-sm mt-1">Quant interview prep</p>
        </div>
        {!syncing && fmtSync(lastSync) && (
          <span className="text-xs text-zinc-600 mb-1">{fmtSync(lastSync)}</span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="text-3xl font-bold tabular-nums">{total ?? "—"}</div>
          <div className="text-zinc-500 text-xs mt-1 font-medium uppercase tracking-wide">total reps</div>
        </div>
        <div className="rounded-2xl border p-4" style={{
          background: `${projColor}18`,
          borderColor: `${projColor}30`,
        }}>
          <div className="text-3xl font-bold tabular-nums" style={{ color: projColor }}>
            {projScore !== null ? projScore : "—"}
            {projScore !== null && <span className="text-base font-normal text-zinc-500">/80</span>}
          </div>
          <div className="text-zinc-500 text-xs mt-1 font-medium uppercase tracking-wide">
            {projScore !== null ? "optiver est." : "need more reps"}
          </div>
        </div>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {MODES.map(m => (
          <Link key={m.href} href={m.href}
            className="rounded-2xl px-4 py-5 transition-all active:scale-95 border border-white/5"
            style={{ background: `${m.accent}cc` }}
          >
            <div className="font-bold text-xl leading-tight">{m.label}</div>
            <div className="text-sm text-white/60 mt-0.5">{m.sub}</div>
          </Link>
        ))}
      </div>

      {/* Dashboard link */}
      <Link href="/dashboard"
        className="flex items-center justify-between w-full bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 transition-colors">
        <span className="font-semibold">Coach Report</span>
        <span className="text-zinc-500">→</span>
      </Link>
    </main>
  );
}
