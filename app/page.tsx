"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadData, saveData, totalQuestions } from "@/lib/tracker";
import { optiverProjection } from "@/lib/engine";
import { pullFromCloud, mergeData, getLastSync } from "@/lib/sync";

const MODES = [
  { label: "Blitz",       sub: "1 min",        href: "/drill?mode=adaptive&secs=60",  color: "bg-violet-700 hover:bg-violet-600 active:bg-violet-800" },
  { label: "Speed",       sub: "2 min",        href: "/drill?mode=adaptive&secs=120", color: "bg-blue-700 hover:bg-blue-600 active:bg-blue-800" },
  { label: "Quick",       sub: "5 min",        href: "/drill?mode=adaptive&secs=300", color: "bg-cyan-800 hover:bg-cyan-700 active:bg-cyan-900" },
  { label: "Full",        sub: "15 min",       href: "/drill?mode=adaptive&secs=900", color: "bg-teal-800 hover:bg-teal-700 active:bg-teal-900" },
  { label: "Optiver Sim", sub: "80 q · 8 min", href: "/drill?mode=sim",              color: "bg-amber-700 hover:bg-amber-600 active:bg-amber-800" },
  { label: "Focus",       sub: "pick skills",  href: "/drill?mode=focus",             color: "bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800" },
];

export default function Home() {
  const [total,    setTotal]    = useState<number | null>(null);
  const [proj,     setProj]     = useState<{ projectedScore: number } | null>(null);
  const [syncing,  setSyncing]  = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      let local = loadData();

      // Pull from cloud and merge on every load
      const cloud = await pullFromCloud();
      if (cloud) {
        local = mergeData(local, cloud);
        saveData(local);
      }

      setTotal(totalQuestions(local));
      setProj(optiverProjection(local));
      setLastSync(getLastSync());
      setSyncing(false);
    }
    init();
  }, []);

  function fmtSync(ts: string | null) {
    if (!ts) return "never synced";
    const diff = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1)  return "synced just now";
    if (diff < 60) return `synced ${diff}m ago`;
    return `synced ${Math.round(diff / 60)}h ago`;
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-8">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-3xl font-bold">Mental Math</h1>
        <span className="text-xs text-zinc-600 mt-2">
          {syncing ? "syncing…" : fmtSync(lastSync)}
        </span>
      </div>
      <p className="text-zinc-400 text-sm mb-6">Adaptive quant interview prep</p>

      {/* stats strip */}
      {total !== null && (
        <div className="flex gap-3 mb-8">
          <div className="bg-zinc-900 rounded-2xl px-4 py-4 flex-1 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-zinc-500 text-xs mt-0.5">total reps</div>
          </div>
          {proj ? (
            <div className={`rounded-2xl px-4 py-4 flex-1 text-center ${
              proj.projectedScore >= 70 ? "bg-emerald-900/60" :
              proj.projectedScore >= 50 ? "bg-amber-900/60"  : "bg-red-900/60"
            }`}>
              <div className="text-2xl font-bold">{proj.projectedScore}<span className="text-sm text-zinc-400">/80</span></div>
              <div className="text-zinc-300 text-xs mt-0.5">Optiver est.</div>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-2xl px-4 py-4 flex-1 text-center">
              <div className="text-2xl font-bold text-zinc-600">—</div>
              <div className="text-zinc-500 text-xs mt-0.5">need more reps</div>
            </div>
          )}
        </div>
      )}

      {/* mode grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {MODES.map(m => (
          <Link key={m.href} href={m.href}
            className={`${m.color} rounded-2xl px-4 py-5 transition-colors`}>
            <div className="font-bold text-lg leading-tight">{m.label}</div>
            <div className="text-sm opacity-70 mt-0.5">{m.sub}</div>
          </Link>
        ))}
      </div>

      <Link href="/dashboard"
        className="block w-full text-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 rounded-2xl py-4 font-semibold transition-colors">
        Coach Report &amp; Stats →
      </Link>
    </main>
  );
}
