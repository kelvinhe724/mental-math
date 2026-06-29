"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadData, saveData, totalQuestions, lastSession } from "@/lib/tracker";
import { optiverProjection, getWeaknessRanking } from "@/lib/engine";
import { SKILL_LABELS, SkillId } from "@/lib/questions";
import { pullFromCloud, mergeData, getLastSync } from "@/lib/sync";

const TIMES = [
  { label: "1m",  href: "/drill?mode=adaptive&secs=60",  timed: true  },
  { label: "2m",  href: "/drill?mode=adaptive&secs=120", timed: true  },
  { label: "5m",  href: "/drill?mode=adaptive&secs=300", timed: true  },
  { label: "15m", href: "/drill?mode=adaptive&secs=900", timed: true  },
  { label: "∞",   href: "/drill?mode=adaptive",          timed: false },
];

const SCORE_COLOR = (s: number) =>
  s >= 70 ? "#f59e0b" : s >= 55 ? "#10b981" : s >= 35 ? "#60a5fa" : "#ef4444";
const SCORE_LABEL = (s: number) =>
  s >= 70 ? "Target" : s >= 55 ? "Competitive" : s >= 35 ? "Developing" : "Early stage";

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
      setWeakId(ranking.find(r => r.stats.n >= 3)?.skillId ?? null);
      const ls = getLastSync();
      if (ls) {
        const diff = Math.round((Date.now() - new Date(ls).getTime()) / 60000);
        setSyncStr(diff < 1 ? "synced" : diff < 60 ? `synced ${diff}m ago` : `synced ${Math.round(diff / 60)}h ago`);
      }
      setLoaded(true);
    }
    init();
  }, []);

  const score   = proj?.projectedScore ?? null;
  const scoreC  = score !== null ? SCORE_COLOR(score) : "#52525b";
  const scoreLbl = score !== null ? SCORE_LABEL(score) : null;
  const accPct  = proj ? Math.round(proj.avgAcc * 100) : null;
  const speed   = proj ? proj.avgSpeed.toFixed(1) : null;

  const lastLabel = (() => {
    if (!last) return null;
    const diff = Date.now() - new Date(last.ts).getTime();
    const mins = Math.floor(diff / 60000);
    const ago = mins < 60 ? `${mins}m ago`
      : Math.floor(mins / 60) < 24 ? `${Math.floor(mins / 60)}h ago`
      : new Date(last.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { mode: last.mode, correct: last.correct, wrong: last.n - last.correct,
             n: last.n, speed: last.avgTime.toFixed(1), ago };
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-5 md:px-10"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 32px)", paddingBottom: 48 }}>

        <div className="md:grid md:grid-cols-[300px_1fr] md:gap-16 md:items-start">

          {/* ── LEFT: Identity + Score ─────────────────────────────────────── */}
          <div className="md:sticky md:top-8 md:self-start mb-10 md:mb-0">

            <div className="flex items-center justify-between mb-8 md:mb-10">
              <div>
                <div className="text-[10px] font-mono text-zinc-500 tracking-[0.18em]">MENTAL MATH</div>
                <div className="text-xs text-zinc-500 mt-0.5">Optiver · Jane Street · SIG</div>
              </div>
              {syncStr && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                  <span className="text-[10px] text-zinc-500">{syncStr}</span>
                </div>
              )}
            </div>

            {!loaded ? (
              /* Shaped skeleton — mirrors score + pills layout */
              <div className="mb-6">
                <div className="h-16 w-36 bg-zinc-900/60 rounded-xl animate-pulse mb-3" />
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-zinc-900/40 rounded-lg animate-pulse" />
                  <div className="h-8 w-16 bg-zinc-900/40 rounded-lg animate-pulse" />
                  <div className="h-8 w-14 bg-zinc-900/40 rounded-lg animate-pulse" />
                </div>
              </div>
            ) : score !== null && scoreLbl ? (
              <>
                {/* Score number */}
                <div className="flex items-baseline gap-2.5 mb-3">
                  <span className="text-[64px] md:text-[72px] font-bold font-mono tabular-nums leading-none"
                    style={{ color: scoreC }}>
                    {score}
                  </span>
                  <div className="flex flex-col gap-1 pb-1">
                    <span className="text-zinc-500 text-lg font-light">/80</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border"
                      style={{ color: scoreC, borderColor: scoreC + "50", background: scoreC + "15" }}>
                      {scoreLbl}
                    </span>
                  </div>
                </div>

                {/* Stat pills */}
                <div className="flex gap-2 flex-wrap mb-4">
                  {accPct !== null && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
                      <span className="text-sm font-mono font-semibold text-zinc-100">{accPct}%</span>
                      <span className="text-[10px] text-zinc-500 ml-1.5">accuracy</span>
                    </div>
                  )}
                  {speed !== null && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
                      <span className="text-sm font-mono font-semibold text-zinc-100">{speed}s</span>
                      <span className="text-[10px] text-zinc-500 ml-1.5">avg</span>
                    </div>
                  )}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
                    <span className="text-sm font-mono font-semibold text-zinc-100">{total}</span>
                    <span className="text-[10px] text-zinc-500 ml-1.5">reps</span>
                  </div>
                </div>

                {/* Last session */}
                {lastLabel && (
                  <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 px-3 py-2.5">
                    <div className="text-[9px] text-zinc-500 mb-1.5 uppercase tracking-widest">last session</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-400 capitalize">{lastLabel.mode}</span>
                      <span className="text-[10px] font-mono text-emerald-500">✓{lastLabel.correct}</span>
                      <span className="text-[10px] font-mono text-zinc-500">✗{lastLabel.wrong}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{lastLabel.speed}s/q</span>
                      <span className="text-[9px] text-zinc-500 ml-auto">{lastLabel.ago}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-4xl font-mono text-zinc-600 mb-2">—/80</div>
                <p className="text-xs text-zinc-500">
                  {total > 0
                    ? `${total} reps · need 10+ to unlock score estimate`
                    : "Start a drill to track your progress"}
                </p>
              </>
            )}
          </div>

          {/* ── RIGHT: Mode cards — each visually distinct ───────────────────── */}
          <div className="space-y-3">

            {/* 1. Adaptive Drill — primary, with time picker */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-base font-semibold text-zinc-100">Adaptive Drill</div>
                  <div className="text-xs text-zinc-500 mt-0.5">targets your weakest skill each question</div>
                </div>
                <span className="text-[10px] text-zinc-500 mt-0.5">all 8 skills</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {TIMES.map(t => (
                  <Link key={t.href} href={t.href}
                    className={`flex items-center justify-center py-3 rounded-xl text-sm font-medium
                                transition-all active:scale-95
                                ${!t.timed
                                  ? "bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 border border-zinc-700/50"
                                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                                }`}>
                    {t.label}
                  </Link>
                ))}
              </div>
              <div className="flex justify-end mt-2">
                <span className="text-[9px] text-zinc-500">∞ = untimed practice</span>
              </div>
            </div>

            {/* 2. Simulation — horizontal layout, clock as visual anchor */}
            <Link href="/drill?mode=sim"
              className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-5
                         hover:border-zinc-700 hover:bg-zinc-800/40 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-zinc-100 mb-1">Simulation</div>
                  <div className="text-xs text-zinc-500 mb-4">Optiver 80-in-8 format · all skills · no pausing</div>
                  <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 font-mono">
                    80 questions
                  </span>
                </div>
                <div className="text-right shrink-0 pl-4">
                  <div className="text-[48px] font-bold font-mono tabular-nums leading-none text-zinc-600
                                  group-hover:text-zinc-400 transition-colors">
                    8:00
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">minutes</div>
                </div>
              </div>
            </Link>

            {/* 3. Focus — weakness recommendation as hero */}
            <Link href={weakId ? `/drill?mode=focus&skills=${weakId}` : "/drill?mode=focus"}
              className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-5
                         hover:border-zinc-700 hover:bg-zinc-800/40 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-base font-semibold text-zinc-100 mb-0.5">Focus</div>
                  <div className="text-xs text-zinc-500">one skill, drilled intensively</div>
                </div>
                <span className="text-[10px] text-zinc-500 mt-0.5">targeted</span>
              </div>
              {weakId ? (
                <div className="bg-amber-950/40 border border-amber-800/30 rounded-xl px-4 py-3
                                group-hover:bg-amber-950/60 transition-colors">
                  <div className="text-[9px] text-amber-600 mb-1.5 tracking-wide">recommended · weakest skill</div>
                  <div className="text-[15px] font-semibold text-amber-400">
                    {SKILL_LABELS[weakId as SkillId]}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-800/40 rounded-xl px-4 py-3 border border-zinc-800">
                  <div className="text-sm text-zinc-500">pick a skill to drill →</div>
                </div>
              )}
            </Link>

            {/* 4. Learn + Progress — compact supporting tier */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/learn"
                className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-4
                           hover:border-zinc-700 hover:bg-zinc-800/40 transition-all">
                <div className="text-sm font-semibold text-zinc-200 group-hover:text-white mb-1.5 transition-colors">
                  Learn
                </div>
                <div className="text-[10px] text-zinc-500 leading-relaxed">
                  strategy guides + interactive practice for all 8 skills
                </div>
              </Link>

              <Link href="/dashboard"
                className="group bg-zinc-900 border border-zinc-800 rounded-2xl p-4
                           hover:border-zinc-700 hover:bg-zinc-800/40 transition-all">
                <div className="text-sm font-semibold text-zinc-200 group-hover:text-white mb-1.5 transition-colors">
                  Dashboard
                </div>
                <div className="text-[10px] text-zinc-500 leading-relaxed">
                  session history, skill breakdown, score trajectory
                </div>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
