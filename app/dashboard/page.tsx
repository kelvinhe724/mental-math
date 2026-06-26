"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadData, saveData, allSkillStats, deleteSession, resetAllData, PerfData,
} from "@/lib/tracker";
import { getWeaknessRanking, optiverProjection } from "@/lib/engine";
import {
  SKILL_LABELS, SKILL_IDS, SkillId, TARGET_TIMES, getRandomTip,
} from "@/lib/questions";
import { getUserId, setSyncCode, pullFromCloud, pushToCloud, mergeData } from "@/lib/sync";

const MASTERY_ACC  = 0.92;
const WEAK_ACC     = 0.75;
const SLOW_MULT    = 1.5;
const MASTERY_MULT = 1.15;

// ── Score Block (replaces arc gauge hero-metric template) ──────────────────────
function ScoreBlock({ score, max = 80, speed, acc, answerable }: {
  score: number; max?: number; speed: number; acc: number; answerable: number;
}) {
  const pct        = Math.min(score / max, 1) * 100;
  const targetPct  = (70 / max) * 100;
  const scoreColor = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const trackColor = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="mb-10">
      {/* Score line */}
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className="text-6xl font-bold font-mono tabular-nums leading-none"
          style={{ color: scoreColor }}>
          {score}
        </span>
        <span className="text-zinc-600 text-xl">/80</span>
        <span className="text-zinc-600 text-xs ml-1 self-center">Optiver estimate</span>
      </div>

      {/* Horizontal track */}
      <div className="relative h-1 bg-zinc-800 rounded-full mb-1">
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: trackColor }} />
        {/* Target notch at 70 */}
        <div className="absolute top-[-4px] w-px h-[9px] bg-zinc-500"
          style={{ left: `${targetPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-700 mb-4">
        <span>0</span>
        <span>target 70</span>
        <span>80</span>
      </div>

      {/* Sub-stats row */}
      <div className="flex gap-6">
        <div>
          <span className="font-mono tabular-nums font-semibold text-zinc-200 text-sm">{speed.toFixed(1)}s</span>
          <span className="text-zinc-600 text-xs ml-1.5">per q</span>
        </div>
        <div>
          <span className="font-mono tabular-nums font-semibold text-zinc-200 text-sm">{Math.round(acc * 100)}%</span>
          <span className="text-zinc-600 text-xs ml-1.5">accuracy</span>
        </div>
        <div>
          <span className="font-mono tabular-nums font-semibold text-zinc-200 text-sm">{answerable}</span>
          <span className="text-zinc-600 text-xs ml-1.5">answerable</span>
        </div>
      </div>
    </div>
  );
}

// ── Radar Chart ────────────────────────────────────────────────────────────────
const ABBR: Record<SkillId, string> = {
  add_sub:    "+/−",
  mul_1d:     "×1d",
  mul_2d:     "×2d",
  div:        "÷",
  percent:    "%",
  frac_arith: "fracs",
  frac_dec:   "f↔d",
  mixed:      "mix",
};

type StatsMap = Record<SkillId, { accuracy: number | null; avgTime: number | null; n: number }>;

function RadarChart({ stats }: { stats: StatsMap }) {
  const N = SKILL_IDS.length;
  const cx = 110, cy = 110, maxR = 78;
  const angles = SKILL_IDS.map((_, i) => (i * 2 * Math.PI) / N - Math.PI / 2);
  const levels = [0.25, 0.5, 0.75, 1.0];

  function pt(i: number, r: number): [number, number] {
    return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  }

  const gridPoly = (r: number) =>
    SKILL_IDS.map((_, i) => pt(i, r).join(",")).join(" ");

  const accPts = SKILL_IDS.map((id, i) => pt(i, (stats[id]?.accuracy ?? 0) * maxR));
  const fillPoly = accPts.map(p => p.join(",")).join(" ");

  return (
    <div className="mb-10">
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-3">
        {/* Caption inside card — not an eyebrow header above it */}
        <div className="flex justify-between px-1 mb-1">
          <span className="text-[10px] text-zinc-700">skill profile</span>
          <span className="text-[10px] text-zinc-700">8 skills</span>
        </div>
        <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
          {levels.map(l => (
            <polygon key={l} points={gridPoly(l * maxR)} fill="none"
              stroke={l === 1 ? "#3f3f46" : "#27272a"}
              strokeWidth={l === 1 ? 1 : 0.5}
            />
          ))}
          {SKILL_IDS.map((_, i) => {
            const [x, y] = pt(i, maxR);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#27272a" strokeWidth={0.5} />;
          })}
          <polygon points={fillPoly} fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth={1.5} />
          {accPts.map(([x, y], i) => {
            const acc = stats[SKILL_IDS[i]]?.accuracy ?? 0;
            const c = acc >= 0.9 ? "#10b981" : acc >= 0.75 ? "#f59e0b" : acc > 0 ? "#ef4444" : "#3f3f46";
            return (
              <circle key={i} cx={x} cy={y} r={3.5}
                fill={c} stroke="#0a0a0e" strokeWidth={1.5}
              />
            );
          })}
          {SKILL_IDS.map((id, i) => {
            const [x, y] = pt(i, maxR + 17);
            return (
              <text key={id} x={x} y={y}
                textAnchor="middle" dominantBaseline="middle"
                fill="#52525b" fontSize={8} fontWeight="500">
                {ABBR[id]}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Session Trend ──────────────────────────────────────────────────────────────
function SessionTrend({ sessions }: {
  sessions: Array<{ n: number; correct: number; ts: string; mode: string }>;
}) {
  const valid = sessions.filter(s => s.n > 0);
  const last10 = valid.slice(-10);
  if (last10.length < 2) return null;

  const barH = 48, barW = 14, gap = 4;
  const totalW = last10.length * (barW + gap) - gap;

  // Show date label for first and last bar
  function shortDate(ts: string) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div className="mb-10">
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/80 px-4 pt-3 pb-2">
        <div className="flex justify-between px-1 mb-2">
          <span className="text-[10px] text-zinc-700">session accuracy</span>
          <span className="text-[10px] text-zinc-700">last {last10.length}</span>
        </div>
        <svg viewBox={`0 0 ${totalW} ${barH + 14}`} className="w-full" style={{ height: 70 }}>
          {last10.map((s, i) => {
            const acc   = s.n ? s.correct / s.n : 0;
            const h     = Math.max(3, acc * barH);
            const x     = i * (barW + gap);
            const color = acc >= 0.85 ? "#10b981" : acc >= 0.7 ? "#f59e0b" : "#ef4444";
            return (
              <g key={i}>
                <title>{shortDate(s.ts)} · {s.mode} · {Math.round(acc * 100)}% · {s.n}q</title>
                <rect x={x} y={barH - h} width={barW} height={h} rx={2.5}
                  fill={color} opacity={0.8}
                />
                <text x={x + barW / 2} y={barH + 10} textAnchor="middle" fill="#3f3f46" fontSize={7}
                  fontFamily="var(--font-jb-mono), monospace">
                  {Math.round(acc * 100)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex justify-between text-zinc-700 text-[10px] mt-0.5">
          <span>{shortDate(last10[0].ts)}</span>
          <span>{shortDate(last10[last10.length - 1].ts)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data,          setData]          = useState<PerfData | null>(null);
  const [showSessions,  setShowSessions]  = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [deleteIdx,     setDeleteIdx]     = useState<number | null>(null);
  const [myId,          setMyId]          = useState("");
  const [syncInput,     setSyncInput]     = useState("");
  const [syncMsg,       setSyncMsg]       = useState("");
  const [copied,        setCopied]        = useState(false);

  useEffect(() => { setData(loadData()); setMyId(getUserId()); }, []);
  if (!data) return null;

  async function handleLinkDevice() {
    if (!syncInput.trim()) return;
    setSyncMsg("Pulling data…");
    const cloud = await pullFromCloud(syncInput.trim().toLowerCase());
    if (!cloud) { setSyncMsg("No data found for that code."); return; }
    setSyncCode(syncInput.trim().toLowerCase());
    setMyId(syncInput.trim().toLowerCase());
    const local  = loadData();
    const merged = mergeData(local, cloud);
    saveData(merged);
    setData(merged);
    await pushToCloud(merged);
    setSyncMsg("Linked! Data merged.");
    setSyncInput("");
  }

  function copyId() {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDelete(idx: number) {
    if (!data) return;
    deleteSession(data, idx);
    saveData(data);
    setData({ ...data });
    setDeleteIdx(null);
  }

  function handleReset() {
    setData(resetAllData());
    setConfirmReset(false);
  }

  const stats    = allSkillStats(data);
  const ranking  = getWeaknessRanking(data);
  const proj     = optiverProjection(data);

  const weaknesses = ranking
    .filter(r =>
      r.stats.n >= 3 && (
        r.stats.accuracy! < WEAK_ACC ||
        r.stats.avgTime!  > TARGET_TIMES.medium * SLOW_MULT
      )
    )
    .slice(0, 3);

  const mastered = ranking.filter(r =>
    r.stats.n >= 3 &&
    r.stats.accuracy! >= MASTERY_ACC &&
    r.stats.avgTime!  <= TARGET_TIMES.medium * MASTERY_MULT
  );

  // Memoize tips so they don't randomize on every re-render
  const weaknessTips = useMemo(
    () => Object.fromEntries(weaknesses.map(({ skillId }) => [skillId, getRandomTip(skillId)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weaknesses.map(w => w.skillId).join(",")]
  );

  const validSessions = data.sessions.filter(s => s.n > 0);
  const sessions      = [...validSessions].reverse();

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors">← home</Link>
        <h1 className="text-lg font-semibold tracking-tight">Coach Report</h1>
        <div />
      </div>

      {/* 1. Score block */}
      {proj ? (
        <ScoreBlock
          score={proj.projectedScore}
          speed={proj.avgSpeed}
          acc={proj.avgAcc}
          answerable={proj.answerable}
        />
      ) : (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-6 mb-10 text-center">
          <div className="text-zinc-500 text-sm">Complete a few drills to see your Optiver estimate</div>
        </div>
      )}

      {/* 2. Radar Chart */}
      <RadarChart stats={stats} />

      {/* 3. Weaknesses — no header, severity badges self-identify the section */}
      {weaknesses.length > 0 && (
        <div className="space-y-3 mb-10">
          {weaknesses.map(({ skillId, stats: s }) => {
            const tgt      = TARGET_TIMES.medium;
            const isSlow   = s.avgTime  !== null && s.avgTime  > tgt * SLOW_MULT;
            const isWeak   = s.accuracy !== null && s.accuracy < WEAK_ACC;
            const isCrit   = (s.accuracy !== null && s.accuracy < 0.65) ||
                             (s.avgTime  !== null && s.avgTime  > tgt * 2);
            const acc      = s.accuracy ?? 0;
            const barStop  = Math.min(acc * 100 * 1.3, 100);
            const gradient = isWeak
              ? `linear-gradient(90deg, #ef4444 0%, #f59e0b ${barStop}%)`
              : `linear-gradient(90deg, #f59e0b 0%, #10b981 ${barStop}%)`;

            return (
              <div key={skillId} className="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-800/60">
                <div className="flex items-start justify-between mb-3">
                  <span className="font-medium text-sm text-zinc-100">{SKILL_LABELS[skillId]}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide ${
                    isCrit
                      ? "bg-red-900/50 text-red-400"
                      : "bg-amber-900/30 text-amber-500"
                  }`}>
                    {isCrit ? "CRITICAL" : "NEEDS WORK"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {s.accuracy !== null && (
                    <span className={`text-xs px-2 py-1 rounded-lg font-mono tabular-nums ${
                      isWeak ? "bg-red-900/30 text-red-300" : "bg-amber-900/30 text-amber-300"
                    }`}>
                      {Math.round(s.accuracy * 100)}% acc
                    </span>
                  )}
                  {s.avgTime !== null && (
                    <span className={`text-xs px-2 py-1 rounded-lg font-mono tabular-nums ${
                      isSlow ? "bg-red-900/30 text-red-300" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {s.avgTime.toFixed(1)}s · target {tgt}s
                    </span>
                  )}
                </div>
                {s.accuracy !== null && (
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(acc * 100, 100)}%`, background: gradient }}
                    />
                  </div>
                )}
                <div className="bg-zinc-800/40 rounded-xl px-3 py-2 text-xs text-zinc-400 leading-relaxed">
                  {weaknessTips[skillId]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Session Trend */}
      <SessionTrend sessions={data.sessions} />

      {/* 5. All Skills Grid — no header, grid is self-identifying */}
      <div className="grid grid-cols-2 gap-2 mb-10">
        {SKILL_IDS.map(id => {
          const st = stats[id];
          const dotColor =
            !st || st.n === 0 ? "#3f3f46"
            : st.accuracy! >= MASTERY_ACC ? "#10b981"
            : st.accuracy! < WEAK_ACC     ? "#ef4444"
            : "#f59e0b";
          const dataColor =
            !st || st.n === 0 ? "#52525b"
            : st.accuracy! >= MASTERY_ACC ? "#6ee7b7"
            : st.accuracy! < WEAK_ACC     ? "#fca5a5"
            : "#fcd34d";

          return (
            <div key={id}
              className="bg-zinc-900/50 rounded-xl px-3 py-2.5 border border-zinc-800/60 flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-300 truncate leading-snug">
                  {SKILL_LABELS[id]}
                </div>
                {st.n === 0 ? (
                  <div className="text-xs text-zinc-600 mt-0.5 leading-snug">no data</div>
                ) : (
                  <div className="text-xs font-mono tabular-nums mt-0.5 leading-snug"
                    style={{ color: dataColor }}>
                    {Math.round(st.accuracy! * 100)}%&nbsp;&nbsp;{st.avgTime!.toFixed(1)}s
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Mastered — chips, no header */}
      {mastered.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {mastered.map(({ skillId }) => (
            <span key={skillId}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-emerald-800/60 bg-emerald-900/20 text-emerald-400 font-medium">
              <span className="text-emerald-600 text-[9px]">✓</span>
              {SKILL_LABELS[skillId]}
            </span>
          ))}
        </div>
      )}

      {/* 7. Sessions — collapsible, trigger is the label */}
      <div className="mb-1">
        <button
          onClick={() => setShowSessions(s => !s)}
          className="w-full flex items-center justify-between py-3 border-t border-zinc-800/60 group"
        >
          <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
            Sessions ({validSessions.length})
          </span>
          <span className="text-zinc-700 text-xs">{showSessions ? "▲" : "▼"}</span>
        </button>
        {showSessions && (
          <div className="space-y-2 pb-2">
            {sessions.length === 0 && (
              <p className="text-zinc-600 text-sm py-2">No sessions yet.</p>
            )}
            {sessions.map((s, displayIdx) => {
              const realIdx  = validSessions.length - 1 - displayIdx;
              const ts       = s.ts.slice(0, 16).replace("T", " ");
              const acc      = s.n ? Math.round(s.correct / s.n * 100) : 0;
              const simScore = s.correct - (s.n - s.correct);
              return (
                <div key={displayIdx}
                  className="bg-zinc-900/50 rounded-xl px-4 py-3 flex items-center justify-between border border-zinc-800/50">
                  <div>
                    <div className="text-sm font-medium capitalize text-zinc-200">{s.mode} — {s.n}q</div>
                    <div className="text-xs text-zinc-600 font-mono tabular-nums mt-0.5">
                      {ts} · {acc}%{s.mode === "sim" ? ` · ${simScore}/80` : ""}
                    </div>
                  </div>
                  {deleteIdx === realIdx ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(realIdx)} className="text-xs text-red-400 hover:text-red-300">confirm</button>
                      <button onClick={() => setDeleteIdx(null)} className="text-xs text-zinc-500">cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteIdx(realIdx)}
                      className="text-xs text-zinc-700 hover:text-red-400 transition-colors">
                      delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 8. Settings — collapsible */}
      <div>
        <button
          onClick={() => setShowSettings(s => !s)}
          className="w-full flex items-center justify-between py-3 border-t border-zinc-800/60 group"
        >
          <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
            Settings
          </span>
          <span className="text-zinc-700 text-xs">{showSettings ? "▲" : "▼"}</span>
        </button>
        {showSettings && (
          <div className="space-y-4 pb-4">

            {/* Sync */}
            <div>
              <p className="text-xs text-zinc-600 mb-2">Sync between devices</p>
              <div className="bg-zinc-900/50 rounded-xl p-3 mb-2 border border-zinc-800/50">
                <p className="text-xs text-zinc-700 mb-2">Your sync code — paste on another device</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-zinc-400 bg-zinc-800/60 rounded-lg px-3 py-2 break-all font-mono">
                    {myId || "loading…"}
                  </code>
                  <button onClick={copyId}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2 whitespace-nowrap transition-colors text-zinc-300">
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                <p className="text-xs text-zinc-700 mb-2">Got a code from another device?</p>
                <div className="flex gap-2">
                  <input
                    value={syncInput}
                    onChange={e => setSyncInput(e.target.value)}
                    placeholder="paste sync code…"
                    className="flex-1 text-xs bg-zinc-800/60 rounded-lg px-3 py-2 font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  />
                  <button onClick={handleLinkDevice}
                    className="text-xs bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-2 transition-colors whitespace-nowrap font-medium">
                    Link
                  </button>
                </div>
                {syncMsg && <p className="text-xs text-zinc-500 mt-2">{syncMsg}</p>}
              </div>
            </div>

            {/* Reset */}
            <div>
              {confirmReset ? (
                <div className="bg-red-950/30 rounded-xl p-3 border border-red-900/30">
                  {/* Fixed: was text-zinc-400 on bg-red-900 → now text-red-300 */}
                  <p className="text-xs text-red-300 mb-3">Delete all history? Can&apos;t be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={handleReset}
                      className="flex-1 bg-red-700 hover:bg-red-600 rounded-lg py-2 text-xs font-semibold transition-colors text-white">
                      Yes, reset
                    </button>
                    <button onClick={() => setConfirmReset(false)}
                      className="flex-1 bg-zinc-800 rounded-lg py-2 text-xs transition-colors text-zinc-300">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmReset(true)}
                  className="text-xs text-zinc-700 hover:text-red-400 transition-colors">
                  Reset all data
                </button>
              )}
            </div>

          </div>
        )}
      </div>

    </main>
  );
}
