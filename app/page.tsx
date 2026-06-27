"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadData, saveData, totalQuestions, lastSession } from "@/lib/tracker";
import { optiverProjection, getWeaknessRanking } from "@/lib/engine";
import { SKILL_LABELS, SkillId } from "@/lib/questions";
import { pullFromCloud, mergeData, getLastSync } from "@/lib/sync";

export default function Home() {
  const [loaded,  setLoaded]  = useState(false);
  const [total,   setTotal]   = useState(0);
  const [proj,    setProj]    = useState<ReturnType<typeof optiverProjection>>(null);
  const [last,    setLast]    = useState<ReturnType<typeof lastSession>>(null);
  const [weakId,  setWeakId]  = useState<string | null>(null);
  const [syncStr, setSyncStr] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      let data = loadData();
      const cloud = await pullFromCloud();
      if (cloud) { data = mergeData(data, cloud); saveData(data); }
      setTotal(totalQuestions(data));
      setProj(optiverProjection(data));
      setLast(lastSession(data));
      const ranking = getWeaknessRanking(data);
      const weak = ranking.find(r => r.stats.n >= 3);
      setWeakId(weak?.skillId ?? null);
      const ls = getLastSync();
      if (ls) {
        const diff = Math.round((Date.now() - new Date(ls).getTime()) / 60000);
        setSyncStr(diff < 1 ? "synced" : diff < 60 ? `synced ${diff}m ago` : `synced ${Math.round(diff / 60)}h ago`);
      }
      setLoaded(true);
    }
    init();
  }, []);

  const score = proj?.projectedScore ?? null;
  const scoreC = score === null ? "#52525b"
    : score >= 70 ? "#f59e0b"
    : score >= 55 ? "#10b981"
    : score >= 35 ? "#60a5fa"
    : "#ef4444";
  const scoreLabel = score === null ? null
    : score >= 70 ? "Target"
    : score >= 55 ? "Competitive"
    : score >= 35 ? "Developing"
    : "Early stage";

  const accPct = proj ? Math.round(proj.avgAcc * 100) : null;
  const speed  = proj ? proj.avgSpeed.toFixed(1) : null;

  const lastLabel = (() => {
    if (!last) return null;
    const diff = Date.now() - new Date(last.ts).getTime();
    const mins = Math.floor(diff / 60000);
    const ago = mins < 60 ? `${mins}m ago`
      : Math.floor(mins / 60) < 24 ? `${Math.floor(mins / 60)}h ago`
      : new Date(last.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const acc = last.n ? Math.round(last.correct / last.n * 100) : 0;
    return `${last.mode} · ${acc}% · ${last.avgTime.toFixed(1)}s/q · ${ago}`;
  })();

  const TIMES = [
    { label: "1 min",  href: "/drill?mode=adaptive&secs=60"  },
    { label: "2 min",  href: "/drill?mode=adaptive&secs=120" },
    { label: "5 min",  href: "/drill?mode=adaptive&secs=300" },
    { label: "15 min", href: "/drill?mode=adaptive&secs=900" },
  ];

  return (
    <main className="max-w-md mx-auto px-5 pb-10"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 40px)" }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-[10px] font-mono text-zinc-600 tracking-[0.2em] mb-0.5">MENTAL MATH</div>
          <div className="text-xs text-zinc-700">Optiver · Jane Street · SIG prep</div>
        </div>
        {syncStr && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
            <span className="text-[10px] text-zinc-700">{syncStr}</span>
          </div>
        )}
      </div>

      {/* Score block */}
      <div className="mb-8">
        {loaded ? (
          score !== null ? (
            <>
              <div className="flex items-baseline gap-2.5 mb-1.5">
                <span
                  className="text-[56px] font-bold font-mono tabular-nums leading-none"
                  style={{ color: scoreC }}>
                  {score}
                </span>
                <span className="text-zinc-700 text-xl font-light">/80</span>
                {scoreLabel && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full border self-end mb-1"
                    style={{ color: scoreC, borderColor: scoreC + "40", background: scoreC + "12" }}>
                    {scoreLabel}
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-xs font-mono text-zinc-500 mb-1">
                {accPct !== null && <span>{accPct}% acc</span>}
                {speed  !== null && <span>{speed}s avg</span>}
                <span className="text-zinc-700">{total} reps</span>
              </div>
              {lastLabel && (
                <div className="text-[10px] text-zinc-700 font-mono">last: {lastLabel}</div>
              )}
            </>
          ) : (
            <div>
              <div className="text-zinc-700 text-2xl font-mono mb-1">— / 80</div>
              <div className="text-xs text-zinc-700">
                {total > 0 ? `${total} reps · need 10+ attempts to unlock estimate` : "No drills yet — start below"}
              </div>
            </div>
          )
        ) : (
          <div className="h-16 bg-zinc-900/40 rounded-xl animate-pulse" />
        )}
      </div>

      {/* Adaptive — primary */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-semibold text-zinc-200">Adaptive drill</span>
          <span className="text-[10px] text-zinc-700">AI-targeted · all 8 skills</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TIMES.map(t => (
            <Link key={t.href} href={t.href}
              className="py-3.5 text-center text-sm font-medium rounded-xl bg-zinc-900 border border-zinc-800
                         hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 transition-all text-zinc-200">
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="my-5 h-px bg-zinc-800/50" />

      {/* Simulation */}
      <Link href="/drill?mode=sim"
        className="group flex items-center justify-between w-full py-2.5 mb-1">
        <div>
          <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
            Simulation
          </span>
          <span className="text-xs text-zinc-700 ml-2.5">80 questions · 8 minutes</span>
        </div>
        <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors">→</span>
      </Link>

      <div className="h-px bg-zinc-800/40" />

      {/* Focus */}
      <Link
        href={weakId ? `/drill?mode=focus&skills=${weakId}` : "/drill?mode=focus"}
        className="group flex items-center justify-between w-full py-2.5 mt-1">
        <div>
          <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
            Focus
          </span>
          {weakId ? (
            <span className="text-xs ml-2.5" style={{ color: "#b45309" }}>
              → {SKILL_LABELS[weakId as SkillId]}
            </span>
          ) : (
            <span className="text-xs text-zinc-700 ml-2.5">target your weak spots</span>
          )}
        </div>
        <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors">→</span>
      </Link>

      <div className="my-5 h-px bg-zinc-800/50" />

      {/* Coach Report */}
      <Link href="/dashboard"
        className="group flex items-center justify-between w-full py-2.5">
        <span className="text-sm font-medium text-zinc-500 group-hover:text-zinc-200 transition-colors">
          Coach Report
        </span>
        <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors">→</span>
      </Link>

    </main>
  );
}
