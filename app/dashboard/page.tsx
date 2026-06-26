"use client";
import { useEffect, useState } from "react";
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

// ── Arc Gauge ──────────────────────────────────────────────────────────────────
function ArcGauge({ score, max = 80, speed, acc, answerable }: {
  score: number; max?: number; speed: number; acc: number; answerable: number;
}) {
  const r = 50, cx = 60, cy = 60;
  const circ   = 2 * Math.PI * r;
  const arcLen = (270 / 360) * circ;
  const fillLen = Math.max(0, Math.min(1, score / max)) * arcLen;
  const color   = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  // target tick at 70/80 position along the arc
  const tickAngleDeg = 135 + (70 / max) * 270;
  const tickRad = (tickAngleDeg * Math.PI) / 180;
  const tx1 = cx + (r - 7) * Math.cos(tickRad);
  const ty1 = cy + (r - 7) * Math.sin(tickRad);
  const tx2 = cx + (r + 4) * Math.cos(tickRad);
  const ty2 = cy + (r + 4) * Math.sin(tickRad);

  return (
    <div className="flex flex-col items-center mb-8">
      <svg viewBox="0 0 120 120" className="w-44 h-44">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circ - arcLen}`}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Target tick at 70 */}
        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#3f3f46" strokeWidth={1.5} />
        {/* Fill */}
        {fillLen > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${circ}`}
            transform={`rotate(135 ${cx} ${cy})`}
          />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize={22} fontWeight="bold">
          {score}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#71717a" fontSize={10}>/ {max}</text>
        <text x={cx} y={cy + 23} textAnchor="middle" fill="#52525b" fontSize={7} letterSpacing="1">
          TARGET 70
        </text>
      </svg>
      <div className="flex gap-8 text-center mt-1">
        <div>
          <div className="font-bold text-white tabular-nums">{speed.toFixed(1)}s</div>
          <div className="text-zinc-500 text-xs mt-0.5">per q</div>
        </div>
        <div>
          <div className="font-bold text-white tabular-nums">{Math.round(acc * 100)}%</div>
          <div className="text-zinc-500 text-xs mt-0.5">accuracy</div>
        </div>
        <div>
          <div className="font-bold text-white tabular-nums">{answerable}</div>
          <div className="text-zinc-500 text-xs mt-0.5">answerable</div>
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
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Skill Profile</h2>
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-3">
        <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
          {/* Grid rings */}
          {levels.map(l => (
            <polygon key={l} points={gridPoly(l * maxR)} fill="none"
              stroke={l === 1 ? "#3f3f46" : "#27272a"}
              strokeWidth={l === 1 ? 1 : 0.5}
            />
          ))}
          {/* Axis lines */}
          {SKILL_IDS.map((_, i) => {
            const [x, y] = pt(i, maxR);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#27272a" strokeWidth={0.5} />;
          })}
          {/* Accuracy fill */}
          <polygon points={fillPoly} fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth={1.5} />
          {/* Vertex dots */}
          {accPts.map(([x, y], i) => {
            const acc = stats[SKILL_IDS[i]]?.accuracy ?? 0;
            const dotColor = acc >= 0.9 ? "#10b981" : acc >= 0.75 ? "#f59e0b" : "#ef4444";
            return (
              <circle key={i} cx={x} cy={y} r={3.5}
                fill={dotColor} stroke="#09090b" strokeWidth={1}
              />
            );
          })}
          {/* Labels */}
          {SKILL_IDS.map((id, i) => {
            const [x, y] = pt(i, maxR + 17);
            return (
              <text key={id} x={x} y={y}
                textAnchor="middle" dominantBaseline="middle"
                fill="#71717a" fontSize={8} fontWeight="500">
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
function SessionTrend({ sessions }: { sessions: Array<{ n: number; correct: number }> }) {
  const last10 = sessions.slice(-10);
  if (last10.length < 2) return null;

  const barH = 48, barW = 14, gap = 4;
  const totalW = last10.length * (barW + gap) - gap;

  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Accuracy Trend</h2>
      <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 px-4 pt-3 pb-2">
        <svg viewBox={`0 0 ${totalW} ${barH + 14}`} className="w-full" style={{ height: 70 }}>
          {last10.map((s, i) => {
            const acc   = s.n ? s.correct / s.n : 0;
            const h     = Math.max(3, acc * barH);
            const x     = i * (barW + gap);
            const color = acc >= 0.85 ? "#10b981" : acc >= 0.7 ? "#f59e0b" : "#ef4444";
            return (
              <g key={i}>
                <rect x={x} y={barH - h} width={barW} height={h} rx={2.5}
                  fill={color} opacity={0.85}
                />
                <text x={x + barW / 2} y={barH + 10} textAnchor="middle" fill="#52525b" fontSize={7}>
                  {Math.round(acc * 100)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex justify-between text-zinc-600 text-[10px] mt-0.5">
          <span>older</span>
          <span>latest</span>
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

  const sessions = [...data.sessions].reverse();

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-zinc-400 text-sm">← home</Link>
        <h1 className="text-xl font-bold">Coach Report</h1>
        <div />
      </div>

      {/* 1. Hero Arc Gauge */}
      {proj ? (
        <ArcGauge
          score={proj.projectedScore}
          speed={proj.avgSpeed}
          acc={proj.avgAcc}
          answerable={proj.answerable}
        />
      ) : (
        <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6 mb-8 text-center">
          <div className="text-zinc-500 text-sm">Complete a few drills to see your Optiver estimate</div>
        </div>
      )}

      {/* 2. Radar Chart */}
      <RadarChart stats={stats} />

      {/* 3. Weaknesses */}
      {weaknesses.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Diagnose</h2>
          <div className="space-y-3">
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
                <div key={skillId} className="bg-zinc-900/80 rounded-2xl p-4 border border-zinc-800">
                  <div className="flex items-start justify-between mb-3">
                    <span className="font-semibold text-sm">{SKILL_LABELS[skillId]}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isCrit
                        ? "bg-red-900/60 text-red-400"
                        : "bg-amber-900/40 text-amber-400"
                    }`}>
                      {isCrit ? "Critical" : "Needs Work"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {s.accuracy !== null && (
                      <span className={`text-xs px-2 py-1 rounded-lg font-mono ${
                        isWeak ? "bg-red-900/40 text-red-300" : "bg-amber-900/40 text-amber-300"
                      }`}>
                        {Math.round(s.accuracy * 100)}% acc
                      </span>
                    )}
                    {s.avgTime !== null && (
                      <span className={`text-xs px-2 py-1 rounded-lg font-mono ${
                        isSlow ? "bg-red-900/40 text-red-300" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {s.avgTime.toFixed(1)}s · target {tgt}s
                      </span>
                    )}
                  </div>
                  {s.accuracy !== null && (
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(acc * 100, 100)}%`, background: gradient }}
                      />
                    </div>
                  )}
                  <div className="bg-zinc-800/60 rounded-xl px-3 py-2 text-xs text-zinc-400 leading-relaxed">
                    {getRandomTip(skillId)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Session Trend */}
      <SessionTrend sessions={data.sessions} />

      {/* 5. All Skills Grid */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">All Skills</h2>
        <div className="grid grid-cols-2 gap-2">
          {SKILL_IDS.map(id => {
            const st = stats[id];
            const dotColor =
              !st || st.n === 0                                                                            ? "#52525b"
              : st.accuracy! >= MASTERY_ACC && st.avgTime! <= TARGET_TIMES.medium * MASTERY_MULT          ? "#10b981"
              : st.accuracy! < WEAK_ACC     || st.avgTime! > TARGET_TIMES.medium * SLOW_MULT             ? "#ef4444"
              : "#f59e0b";

            return (
              <div key={id} className="bg-zinc-900/60 rounded-xl px-3 py-2.5 border border-zinc-800/60 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">{SKILL_LABELS[id]}</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: dotColor }}>
                    {st.n === 0
                      ? "no data"
                      : `${Math.round(st.accuracy! * 100)}%  ${st.avgTime!.toFixed(1)}s`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Mastered */}
      {mastered.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Mastered</h2>
          <div className="flex flex-wrap gap-2">
            {mastered.map(({ skillId }) => (
              <span key={skillId}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-emerald-700/50 bg-emerald-900/25 text-emerald-300 font-medium">
                <span className="text-emerald-500 text-[10px]">✓</span>
                {SKILL_LABELS[skillId]}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 7. Session History */}
      <section className="mb-4">
        <button
          onClick={() => setShowSessions(s => !s)}
          className="w-full flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2"
        >
          <span>Sessions ({data.sessions.length})</span>
          <span className="text-zinc-600">{showSessions ? "▲" : "▼"}</span>
        </button>
        {showSessions && (
          <div className="space-y-2 mt-2">
            {sessions.length === 0 && (
              <p className="text-zinc-600 text-sm">No sessions yet.</p>
            )}
            {sessions.map((s, displayIdx) => {
              const realIdx  = data.sessions.length - 1 - displayIdx;
              const ts       = s.ts.slice(0, 16).replace("T", " ");
              const acc      = s.n ? Math.round(s.correct / s.n * 100) : 0;
              const simScore = s.correct - (s.n - s.correct);
              return (
                <div key={displayIdx}
                  className="bg-zinc-900/60 rounded-xl px-4 py-3 flex items-center justify-between border border-zinc-800/50">
                  <div>
                    <div className="text-sm font-medium capitalize">{s.mode} — {s.n}q</div>
                    <div className="text-xs text-zinc-500">
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
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                      delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 8. Settings */}
      <section className="border-t border-zinc-800/60 pt-3 mt-4">
        <button
          onClick={() => setShowSettings(s => !s)}
          className="w-full flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2"
        >
          <span>⚙ Settings</span>
          <span className="text-zinc-600">{showSettings ? "▲" : "▼"}</span>
        </button>
        {showSettings && (
          <div className="mt-4 space-y-4">

            {/* Sync */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Sync Between Devices</p>
              <div className="bg-zinc-900/60 rounded-xl p-3 mb-2 border border-zinc-800/50">
                <p className="text-xs text-zinc-600 mb-2">Your sync code — paste on another device</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2 break-all font-mono">
                    {myId || "loading…"}
                  </code>
                  <button onClick={copyId}
                    className="text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg px-3 py-2 whitespace-nowrap transition-colors">
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800/50">
                <p className="text-xs text-zinc-600 mb-2">Got a code from another device? Paste it here</p>
                <div className="flex gap-2">
                  <input
                    value={syncInput}
                    onChange={e => setSyncInput(e.target.value)}
                    placeholder="paste sync code…"
                    className="flex-1 text-xs bg-zinc-800 rounded-lg px-3 py-2 font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                  <button onClick={handleLinkDevice}
                    className="text-xs bg-blue-700 hover:bg-blue-600 rounded-lg px-3 py-2 transition-colors whitespace-nowrap">
                    Link
                  </button>
                </div>
                {syncMsg && <p className="text-xs text-zinc-400 mt-2">{syncMsg}</p>}
              </div>
            </div>

            {/* Reset */}
            <div>
              {confirmReset ? (
                <div className="bg-red-950/40 rounded-xl p-3 border border-red-900/40">
                  <p className="text-xs text-red-300 mb-3">Delete all history? Can&apos;t be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={handleReset}
                      className="flex-1 bg-red-700 hover:bg-red-600 rounded-lg py-2 text-xs font-semibold transition-colors">
                      Yes, reset
                    </button>
                    <button onClick={() => setConfirmReset(false)}
                      className="flex-1 bg-zinc-800 rounded-lg py-2 text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmReset(true)}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                  Reset all data
                </button>
              )}
            </div>

          </div>
        )}
      </section>

    </main>
  );
}
