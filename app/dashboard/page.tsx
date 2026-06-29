"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  loadData, saveData, allSkillStats, skillStats, skillStatsByDifficulty, deleteSessionByTs,
  resetAllData, PerfData, SkillStats, totalQuestions,
} from "@/lib/tracker";
import {
  getWeaknessRanking, optiverProjection, sessionProjections,
  OptiverProjection,
} from "@/lib/engine";
import { SKILL_LABELS, SKILL_IDS, SkillId, TARGET_TIMES, TIPS } from "@/lib/questions";
import { getUserId, setSyncCode, pullFromCloud, pushToCloud, mergeData } from "@/lib/sync";

// ── Constants ─────────────────────────────────────────────────────────────────
const MASTERY_ACC  = 0.90;
const WEAK_ACC     = 0.75;
const SLOW_MULT    = 1.4;

// ── Score color ───────────────────────────────────────────────────────────────
function scoreColor(s: number): string {
  if (s >= 70) return "#f59e0b"; // gold — target achieved
  if (s >= 55) return "#10b981"; // green — competitive
  if (s >= 35) return "#60a5fa"; // blue — developing
  return "#ef4444";              // red — early stage
}
function scoreLabel(s: number): string {
  if (s >= 70) return "Target";
  if (s >= 55) return "Competitive";
  if (s >= 35) return "Developing";
  return "Early stage";
}

// ── Count-up animation ────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const frame = useRef<number>(0);
  useEffect(() => {
    setVal(0);
    const start = Date.now();
    const animate = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);
  return val;
}

// ── Score Hero ─────────────────────────────────────────────────────────────────
function ScoreHero({ proj }: { proj: OptiverProjection }) {
  const animScore = useCountUp(proj.projectedScore);
  const col       = scoreColor(proj.projectedScore);
  const pct       = (proj.projectedScore / 80) * 100;

  const milestones = [
    { score: 35, label: "35", title: "Developing" },
    { score: 55, label: "55", title: "Competitive" },
    { score: 70, label: "70", title: "Target" },
  ];

  return (
    <div className="mb-10">
      {/* Score numeral */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[72px] font-bold font-mono tabular-nums leading-none"
          style={{ color: col }}>
          {animScore}
        </span>
        <span className="text-zinc-600 text-2xl font-light">/80</span>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
          style={{ color: col, borderColor: col + "55", background: col + "18" }}>
          {scoreLabel(proj.projectedScore)}
        </span>
        <span className="text-xs text-zinc-600">Optiver 80-in-8 estimate</span>
      </div>

      {/* Track */}
      <div className="relative h-1.5 bg-zinc-800 rounded-full mb-1.5">
        {/* Filled bar */}
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: col }} />
        {/* Milestone ticks */}
        {milestones.map(m => (
          <div key={m.score}
            className="absolute top-[-4px] w-px h-[10px] bg-zinc-600"
            style={{ left: `${(m.score / 80) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative h-4 mb-5">
        {milestones.map(m => (
          <span key={m.score}
            className="absolute text-[9px] text-zinc-700 -translate-x-1/2"
            style={{ left: `${(m.score / 80) * 100}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "speed",      val: `${proj.avgSpeed.toFixed(1)}s` },
          { label: "accuracy",   val: `${Math.round(proj.avgAcc * 100)}%` },
          { label: "proj. correct", val: String(proj.answerable) },
          { label: "skills",     val: `${proj.coveredSkills}/8` },
        ].map(({ label, val }) => (
          <div key={label} className="bg-zinc-900/60 rounded-xl p-2.5 border border-zinc-800/60 text-center">
            <div className="font-mono tabular-nums font-semibold text-zinc-100 text-sm">{val}</div>
            <div className="text-[9px] text-zinc-600 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Confidence indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-zinc-600 rounded-full transition-all duration-700"
            style={{ width: `${proj.confidence * 100}%` }} />
        </div>
        <span className="text-[9px] text-zinc-700 shrink-0">
          {Math.round(proj.confidence * 100)}% confidence · {proj.totalAttempts} attempts
        </span>
      </div>
    </div>
  );
}

// ── Trajectory Chart ───────────────────────────────────────────────────────────
function TrajectoryChart({ points }: {
  points: Array<{ ts: string; score: number; cumulativeN: number }>;
}) {
  if (points.length < 2) return (
    <div className="border border-zinc-800/60 rounded-2xl px-4 py-6 text-center text-xs text-zinc-600 mb-10">
      Complete more sessions to see your progress trajectory
    </div>
  );

  const W = 300, H = 80;
  const pad = { t: 10, r: 10, b: 20, l: 28 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const xOf = (i: number) => pad.l + (i / (points.length - 1)) * iW;
  const yOf = (s: number) => H - pad.b - (s / 80) * iH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.score).toFixed(1)}`)
    .join(" ");

  const milestones = [
    { v: 35, c: "#ef4444" }, { v: 55, c: "#10b981" }, { v: 70, c: "#f59e0b" },
  ];

  return (
    <div className="mb-10">
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/60 px-3 pt-3 pb-2">
        <div className="flex justify-between px-1 mb-1">
          <span className="text-[10px] text-zinc-600">score trajectory</span>
          <span className="text-[10px] text-zinc-700">{points.length} sessions</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
          {/* Milestone lines */}
          {milestones.map(m => {
            const y = yOf(m.v);
            if (y < pad.t || y > H - pad.b) return null;
            return (
              <g key={m.v}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y}
                  stroke={m.c} strokeWidth={0.5} strokeDasharray="2,3" opacity={0.35} />
                <text x={pad.l - 4} y={y + 3} textAnchor="end"
                  fill={m.c} fontSize={7} opacity={0.5}>{m.v}</text>
              </g>
            );
          })}
          {/* Area fill */}
          <defs>
            <linearGradient id="traj-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${pathD} L${xOf(points.length - 1).toFixed(1)},${H - pad.b} L${xOf(0).toFixed(1)},${H - pad.b} Z`}
            fill="url(#traj-fill)"
          />
          {/* Line */}
          <path d={pathD} fill="none" stroke="#10b981" strokeWidth={1.5}
            strokeLinejoin="round" strokeLinecap="round" />
          {/* Dots */}
          {points.map((p, i) => {
            const x = xOf(i), y = yOf(p.score);
            const c = scoreColor(p.score);
            const isLast = i === points.length - 1;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={isLast ? 4 : 2.5}
                  fill={c} stroke="#09090b" strokeWidth={isLast ? 1.5 : 1} />
                {isLast && (
                  <circle cx={x} cy={y} r={7} fill="none" stroke={c} strokeWidth={0.5} opacity={0.4} />
                )}
                <title>{new Date(p.ts).toLocaleDateString()} · Est. {p.score}/80 · {p.cumulativeN} total attempts</title>
              </g>
            );
          })}
        </svg>
        <div className="flex justify-between text-[9px] text-zinc-700 mt-0.5 px-1">
          <span>{new Date(points[0].ts).toLocaleDateString()}</span>
          <span>{new Date(points[points.length - 1].ts).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Session Panel ─────────────────────────────────────────────────────────────
function SessionPanel({ data }: { data: PerfData }) {
  const valid = data.sessions.filter(s => s.n > 0);
  if (!valid.length) return null;
  const display = [...valid].reverse().slice(0, 8);

  return (
    <div className="mb-10">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-zinc-600">recent sessions</span>
        <span className="text-[10px] text-zinc-700">{valid.length} total</span>
      </div>
      <div className="space-y-1.5">
        {display.map((s, i) => {
          const acc   = s.n ? s.correct / s.n : 0;
          const wrong = s.n - s.correct;
          const c     = acc >= 0.85 ? "#10b981" : acc >= 0.70 ? "#f59e0b" : "#ef4444";
          const d     = new Date(s.ts);
          const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <div key={i} className="flex items-center gap-2.5 py-2 border-b border-zinc-800/30 last:border-0">
              <span className="text-[9px] text-zinc-700 font-mono w-10 shrink-0">{dateStr}</span>
              <span className="text-[9px] text-zinc-600 capitalize w-14 shrink-0 truncate">{s.mode}</span>
              {/* ✓ / ✗ / total */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-mono tabular-nums" style={{ color: c }}>✓{s.correct}</span>
                <span className="text-[9px] text-zinc-700 font-mono">✗{wrong}</span>
                <span className="text-[9px] text-zinc-700 font-mono">/{s.n}</span>
                <div className="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden ml-1">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(acc * 100)}%`, background: c }} />
                </div>
              </div>
              <span className="text-[9px] font-mono text-zinc-700 shrink-0">{s.avgTime.toFixed(1)}s</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scatter Chart ─────────────────────────────────────────────────────────────
function ScatterChart({ stats }: { stats: Record<SkillId, SkillStats> }) {
  const W = 280, H = 140;
  const pad = { t: 14, r: 22, b: 26, l: 28 };
  const iW  = W - pad.l - pad.r;
  const iH  = H - pad.t - pad.b;
  const maxT = 10;

  const xOf = (acc: number) => pad.l + acc * iW;
  const yOf = (t: number)   => pad.t + (Math.min(t, maxT) / maxT) * iH;

  const targetAcc = 0.85, targetSpd = 5.0;
  const hasData = SKILL_IDS.some(id => stats[id].n > 0);
  if (!hasData) return null;

  return (
    <div className="mb-10 bg-zinc-900/50 rounded-2xl border border-zinc-800/60 px-3 pt-3 pb-2">
      <div className="flex justify-between px-1 mb-0.5">
        <span className="text-[10px] text-zinc-600">accuracy vs speed · by skill</span>
        <span className="text-[10px] text-zinc-700">top-right = target</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
        {/* Target zone fill */}
        <rect
          x={xOf(targetAcc)} y={pad.t}
          width={W - pad.r - xOf(targetAcc)}
          height={yOf(targetSpd) - pad.t}
          fill="#10b981" opacity={0.05} rx={2}
        />
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(v => (
          <line key={v} x1={xOf(v)} y1={pad.t} x2={xOf(v)} y2={H - pad.b}
            stroke="#27272a" strokeWidth={0.5} />
        ))}
        {[2.5, 5, 7.5].map(v => (
          <line key={v} x1={pad.l} y1={yOf(v)} x2={W - pad.r} y2={yOf(v)}
            stroke="#27272a" strokeWidth={0.5} />
        ))}
        {/* Axes */}
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#3f3f46" strokeWidth={0.5} />
        <line x1={pad.l} y1={pad.t}     x2={pad.l}     y2={H - pad.b} stroke="#3f3f46" strokeWidth={0.5} />
        {/* Target lines */}
        <line x1={xOf(targetAcc)} y1={pad.t} x2={xOf(targetAcc)} y2={H - pad.b}
          stroke="#10b981" strokeWidth={0.5} strokeDasharray="2,3" opacity={0.4} />
        <line x1={pad.l} y1={yOf(targetSpd)} x2={W - pad.r} y2={yOf(targetSpd)}
          stroke="#10b981" strokeWidth={0.5} strokeDasharray="2,3" opacity={0.4} />
        {/* Axis labels */}
        <text x={W / 2}   y={H - 2} textAnchor="middle" fill="#3f3f46" fontSize={7}>accuracy →</text>
        <text x={pad.l - 4} y={pad.t + 4}    textAnchor="end" fill="#3f3f46" fontSize={7}>fast</text>
        <text x={pad.l - 4} y={H - pad.b - 2} textAnchor="end" fill="#3f3f46" fontSize={7}>slow</text>
        <text x={xOf(0) + 2}    y={H - pad.b + 9} fill="#3f3f46" fontSize={7}>0%</text>
        <text x={xOf(1) - 2}    y={H - pad.b + 9} textAnchor="end" fill="#3f3f46" fontSize={7}>100%</text>
        <text x={W - pad.r - 2} y={pad.t + 8}     textAnchor="end" fill="#10b981" fontSize={6} opacity={0.45}>✓ 85%+, 5s−</text>
        {/* Dots */}
        {SKILL_IDS.map(id => {
          const s = stats[id];
          if (!s.n) return null;
          const x = xOf(s.accuracy!);
          const y = yOf(s.avgTime!);
          const good = s.accuracy! >= targetAcc && s.avgTime! <= targetSpd;
          const ok   = s.accuracy! >= 0.75;
          const c    = good ? "#10b981" : ok ? "#f59e0b" : "#ef4444";
          return (
            <g key={id}>
              <circle cx={x} cy={y} r={5} fill={c} opacity={0.88}
                stroke="#09090b" strokeWidth={1} />
              <text x={x} y={y - 8} textAnchor="middle" fill="#71717a" fontSize={7}>
                {ABBR[id]}
              </text>
              <title>{SKILL_LABELS[id]}: {Math.round(s.accuracy! * 100)}% acc · {s.avgTime!.toFixed(1)}s avg</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Radar ──────────────────────────────────────────────────────────────────────
const ABBR: Record<SkillId, string> = {
  add_sub:    "+/−", mul_1d: "×1d", mul_2d: "×2d", div: "÷",
  percent:    "%",   frac_arith: "fracs", frac_dec: "f↔d", mixed: "mix",
};

function Radar({ stats, onSelect, selected }: {
  stats: Record<SkillId, SkillStats>;
  onSelect: (id: SkillId | null) => void;
  selected: SkillId | null;
}) {
  const N = SKILL_IDS.length;
  const cx = 110, cy = 110, maxR = 78;
  const angles = SKILL_IDS.map((_, i) => (i * 2 * Math.PI) / N - Math.PI / 2);

  function pt(i: number, r: number): [number, number] {
    return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  }

  const gridPoly = (r: number) =>
    SKILL_IDS.map((_, i) => pt(i, r).join(",")).join(" ");

  const accPts = SKILL_IDS.map((id, i) => pt(i, (stats[id]?.accuracy ?? 0) * maxR));
  const fillPoly = accPts.map(p => p.join(",")).join(" ");
  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[240px] mx-auto">
      {/* Grid rings */}
      {levels.map(l => (
        <polygon key={l} points={gridPoly(l * maxR)} fill="none"
          stroke={l === 1 ? "#3f3f46" : "#27272a"}
          strokeWidth={l === 1 ? 1 : 0.5}
        />
      ))}
      {/* Spokes */}
      {SKILL_IDS.map((_, i) => {
        const [x, y] = pt(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#27272a" strokeWidth={0.5} />;
      })}
      {/* Fill */}
      <polygon points={fillPoly}
        fill={selected ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.10)"}
        stroke="#10b981" strokeWidth={1.5}
      />
      {/* Dots */}
      {accPts.map(([x, y], i) => {
        const id  = SKILL_IDS[i];
        const acc = stats[id]?.accuracy ?? 0;
        const c   = acc >= 0.9 ? "#10b981" : acc >= 0.75 ? "#f59e0b" : acc > 0 ? "#ef4444" : "#3f3f46";
        const isSelected = selected === id;
        return (
          <g key={id} onClick={() => onSelect(isSelected ? null : id)} className="cursor-pointer">
            <circle cx={x} cy={y} r={isSelected ? 5 : 3.5}
              fill={c} stroke="#0a0a0e" strokeWidth={isSelected ? 2 : 1.5}
            />
            {isSelected && (
              <circle cx={x} cy={y} r={9} fill="none" stroke={c} strokeWidth={0.8} opacity={0.4} />
            )}
          </g>
        );
      })}
      {/* Labels */}
      {SKILL_IDS.map((id, i) => {
        const [x, y] = pt(i, maxR + 17);
        const isSelected = selected === id;
        return (
          <text key={id} x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fill={isSelected ? "#d4d4d8" : "#52525b"}
            fontSize={isSelected ? 9 : 8} fontWeight={isSelected ? "600" : "500"}>
            {ABBR[id]}
          </text>
        );
      })}
    </svg>
  );
}

// ── Skill Table ────────────────────────────────────────────────────────────────
function SkillTable({ stats, onDrill }: {
  stats: Record<SkillId, SkillStats>;
  onDrill: (id: SkillId) => void;
}) {
  const [expanded, setExpanded] = useState<SkillId | null>(null);
  const tgt = TARGET_TIMES.medium;

  return (
    <div className="space-y-1.5 mb-10">
      {SKILL_IDS.map(id => {
        const s       = stats[id];
        const hasData = s.n > 0;
        const acc     = s.accuracy ?? 0;
        const dotColor = !hasData ? "#3f3f46"
          : acc >= MASTERY_ACC ? "#10b981"
          : acc >= WEAK_ACC    ? "#f59e0b"
          :                      "#ef4444";
        const isSlow   = hasData && s.avgTime! > tgt * SLOW_MULT;
        const isOpen   = expanded === id;

        return (
          <div key={id} className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
            {/* Row */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left group"
              onClick={() => setExpanded(isOpen ? null : id)}>
              {/* Status dot */}
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
              {/* Name */}
              <span className="text-sm font-medium text-zinc-200 flex-1 truncate">
                {SKILL_LABELS[id]}
              </span>
              {/* Accuracy bar */}
              {hasData ? (
                <div className="shrink-0 w-16 flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.round(acc * 100)}%`, background: dotColor }} />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-zinc-400 w-8 text-right">
                    {Math.round(acc * 100)}%
                  </span>
                </div>
              ) : (
                <span className="text-xs text-zinc-700 shrink-0">no data</span>
              )}
              {/* Speed */}
              {hasData && (
                <span className={`text-xs font-mono tabular-nums shrink-0 w-10 text-right ${
                  isSlow ? "text-red-400" : "text-zinc-500"
                }`}>
                  {s.avgTime!.toFixed(1)}s
                </span>
              )}
              {/* Chevron */}
              <span className="text-zinc-700 text-xs shrink-0 ml-1 group-hover:text-zinc-500 transition-colors">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t border-zinc-800/60 px-3 py-3 space-y-3">
                {!hasData ? (
                  <p className="text-xs text-zinc-600">No attempts yet. Start an adaptive drill to see stats here.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-base font-mono font-bold" style={{ color: dotColor }}>
                          {Math.round(acc * 100)}%
                        </div>
                        <div className="text-[9px] text-zinc-600">accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-base font-mono font-bold ${isSlow ? "text-red-400" : "text-zinc-200"}`}>
                          {s.avgTime!.toFixed(1)}s
                        </div>
                        <div className="text-[9px] text-zinc-600">avg speed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-base font-mono font-bold text-zinc-300">{s.n}</div>
                        <div className="text-[9px] text-zinc-600">attempts</div>
                      </div>
                    </div>
                    {/* Speed indicator */}
                    <div>
                      <div className="flex justify-between text-[9px] text-zinc-700 mb-1">
                        <span>speed</span>
                        <span>target {tgt}s</span>
                      </div>
                      <div className="relative h-1 bg-zinc-800 rounded-full">
                        <div className="absolute left-0 top-0 h-full rounded-full"
                          style={{
                            width: `${Math.min((s.avgTime! / (tgt * 2)) * 100, 100)}%`,
                            background: isSlow ? "#ef4444" : "#10b981",
                          }} />
                        {/* Target marker */}
                        <div className="absolute top-[-3px] w-px h-[7px] bg-zinc-500"
                          style={{ left: "50%" }} />
                      </div>
                    </div>
                    {/* Tip */}
                    {TIPS[id] && (
                      <div className="bg-zinc-800/40 rounded-lg px-3 py-2 text-xs text-zinc-400 leading-relaxed">
                        {TIPS[id][0]}
                      </div>
                    )}
                    {/* Drill this */}
                    <button
                      onClick={() => onDrill(id)}
                      className="w-full text-xs py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-emerald-700/60 hover:text-emerald-400 transition-colors">
                      Drill this skill →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Difficulty Heatmap ────────────────────────────────────────────────────────
const DIFF_ABBR: Record<SkillId, string> = {
  add_sub: "Add/Sub", mul_1d: "×1-digit", mul_2d: "×2-digit", div: "Division",
  percent: "Percent", frac_arith: "Fractions", frac_dec: "Frac↔Dec", mixed: "Mixed",
};

function cellStyle(s: SkillStats): { bg: string; text: string } {
  if (!s.n) return { bg: "#18181b", text: "#3f3f46" };
  const acc = s.accuracy!;
  if (acc >= 0.90) return { bg: "#052e16", text: "#6ee7b7" };
  if (acc >= 0.80) return { bg: "#112d0f", text: "#86efac" };
  if (acc >= 0.70) return { bg: "#2d1600", text: "#fbbf24" };
  return { bg: "#1f0a0a", text: "#fca5a5" };
}

function DifficultyHeatmap({ data }: { data: PerfData }) {
  return (
    <div className="mb-10">
      <p className="text-[10px] text-zinc-600 mb-1">Accuracy by skill × difficulty</p>
      <p className="text-[9px] text-zinc-700 mb-3">
        Absolute difficulty varies — easy ×2d (e.g. 17×23) is harder than easy addition.
      </p>

      {/* Column headers */}
      <div className="grid gap-x-1.5 mb-1.5"
        style={{ gridTemplateColumns: "88px repeat(3, 1fr)" }}>
        <div />
        {["Easy", "Medium", "Hard"].map(d => (
          <div key={d} className="text-[9px] text-zinc-700 text-center">{d}</div>
        ))}
      </div>

      <div className="space-y-1.5">
        {SKILL_IDS.map(id => {
          const ds = skillStatsByDifficulty(data, id);
          return (
            <div key={id} className="grid items-center gap-x-1.5"
              style={{ gridTemplateColumns: "88px repeat(3, 1fr)" }}>
              <span className="text-[10px] text-zinc-500 truncate pr-1"
                title={SKILL_LABELS[id]}>
                {DIFF_ABBR[id]}
              </span>
              {([ds.easy, ds.medium, ds.hard] as SkillStats[]).map((s, i) => {
                const { bg, text } = cellStyle(s);
                const label = i === 0 ? "easy" : i === 1 ? "medium" : "hard";
                return (
                  <div key={label}
                    className="h-7 rounded text-[10px] font-mono flex items-center justify-center gap-0.5"
                    style={{ background: bg, color: text }}
                    title={s.n ? `${Math.round(s.accuracy! * 100)}% · ${s.avgTime!.toFixed(1)}s · ${s.n} attempts` : "No data"}>
                    {s.n ? `${Math.round(s.accuracy! * 100)}%` : "—"}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap">
        {[
          { label: "≥90%",  bg: "#052e16", text: "#6ee7b7" },
          { label: "80–90%",bg: "#112d0f", text: "#86efac" },
          { label: "70–80%",bg: "#2d1600", text: "#fbbf24" },
          { label: "<70%",  bg: "#1f0a0a", text: "#fca5a5" },
          { label: "no data",bg:"#18181b", text: "#3f3f46" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: l.bg }} />
            <span className="text-[8px] text-zinc-700">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Weakness Cards ─────────────────────────────────────────────────────────────
function WeaknessCards({ data, onDrill }: { data: PerfData; onDrill: (id: SkillId) => void }) {
  const ranking = getWeaknessRanking(data);
  const tgt     = TARGET_TIMES.medium;

  const weaknesses = ranking.filter(r =>
    r.stats.n >= 3 && (
      r.stats.accuracy! < WEAK_ACC ||
      r.stats.avgTime!  > tgt * SLOW_MULT
    )
  ).slice(0, 4);

  if (!weaknesses.length) {
    return (
      <div className="border border-zinc-800/60 rounded-2xl px-4 py-6 text-center mb-10">
        <p className="text-sm text-zinc-500">No clear weaknesses yet.</p>
        <p className="text-xs text-zinc-700 mt-1">Do more drills to see targeted analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-10">
      {weaknesses.map(({ skillId, stats: s }) => {
        const acc      = s.accuracy!;
        const isWeak   = acc < WEAK_ACC;
        const isSlow   = s.avgTime! > tgt * SLOW_MULT;
        const isCrit   = acc < 0.65 || s.avgTime! > tgt * 2.2;
        const tipList  = TIPS[skillId] || [];
        const tip      = tipList[Math.floor(Math.random() * tipList.length)] || "";

        // Score impact: if this skill were fixed to mastery, how much would score improve?
        const currentImpact = (1 - acc) * 10 + Math.max(0, s.avgTime! - tgt) * 2;

        return (
          <div key={skillId} className="bg-zinc-900/60 rounded-2xl border border-zinc-800/60 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-4 pt-3.5 pb-2">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{SKILL_LABELS[skillId]}</div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  {s.n} attempts · {Math.round(currentImpact * 10) / 10} impact score
                </div>
              </div>
              <span className={`text-[9px] font-bold px-2 py-1 rounded-full tracking-widest ${
                isCrit
                  ? "bg-red-900/50 text-red-400 border border-red-800/50"
                  : "bg-amber-900/30 text-amber-500 border border-amber-800/40"
              }`}>
                {isCrit ? "CRITICAL" : "WEAK"}
              </span>
            </div>

            {/* Metrics */}
            <div className="flex gap-2 px-4 pb-3">
              {/* Accuracy */}
              <div className={`flex-1 rounded-xl px-3 py-2 ${
                isWeak ? "bg-red-900/20 border border-red-900/30" : "bg-zinc-800/50 border border-zinc-800"
              }`}>
                <div className={`text-lg font-mono font-bold tabular-nums ${
                  isWeak ? "text-red-300" : "text-zinc-200"
                }`}>
                  {Math.round(acc * 100)}%
                </div>
                <div className="text-[9px] text-zinc-600">accuracy</div>
                <div className="h-0.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.round(acc * 100)}%`, background: isWeak ? "#ef4444" : "#10b981" }} />
                </div>
              </div>
              {/* Speed */}
              <div className={`flex-1 rounded-xl px-3 py-2 ${
                isSlow ? "bg-red-900/20 border border-red-900/30" : "bg-zinc-800/50 border border-zinc-800"
              }`}>
                <div className={`text-lg font-mono font-bold tabular-nums ${
                  isSlow ? "text-red-300" : "text-zinc-200"
                }`}>
                  {s.avgTime!.toFixed(1)}s
                </div>
                <div className="text-[9px] text-zinc-600">avg · target {tgt}s</div>
                <div className="h-0.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{
                      width: `${Math.min((s.avgTime! / (tgt * 2.5)) * 100, 100)}%`,
                      background: isSlow ? "#ef4444" : "#10b981",
                    }} />
                </div>
              </div>
            </div>

            {/* Tip */}
            {tip && (
              <div className="mx-4 mb-3 bg-zinc-800/40 rounded-xl px-3 py-2 text-xs text-zinc-400 leading-relaxed">
                {tip}
              </div>
            )}

            {/* Action */}
            <div className="border-t border-zinc-800/50 px-4 py-2">
              <button
                onClick={() => onDrill(skillId)}
                className="w-full text-xs py-1.5 text-emerald-500 hover:text-emerald-400 font-medium text-left transition-colors">
                → Focus drill on {SKILL_LABELS[skillId]}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Session Log ────────────────────────────────────────────────────────────────
function SessionLog({ data, projections, onDelete }: {
  data: PerfData;
  projections: Array<{ ts: string; score: number; cumulativeN: number }>;
  onDelete: (ts: string) => void;  // [Fix] identify by ts, not index
}) {
  const [pendingTs, setPendingTs] = useState<string | null>(null);
  const valid   = data.sessions.filter(s => s.n > 0);
  const display = [...valid].reverse();

  if (!display.length) {
    return <p className="text-xs text-zinc-600 py-4">No sessions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {display.map((s, dIdx) => {
        const acc      = s.n ? Math.round(s.correct / s.n * 100) : 0;
        const wrong    = s.n - s.correct;
        const simScore = s.correct - wrong;
        const d        = new Date(s.ts);
        const dateStr  = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const timeStr  = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const proj     = projections.find(p => p.ts === s.ts);
        const dotColor = acc >= 85 ? "#10b981" : acc >= 70 ? "#f59e0b" : "#ef4444";
        const isPending = pendingTs === s.ts;

        return (
          <div key={dIdx} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: dotColor }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-300 capitalize">{s.mode}</span>
                  <span className="text-[10px] text-zinc-600">{dateStr} · {timeStr}</span>
                </div>
                {/* ✓ / ✗ / total — primary stats */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: dotColor }}>
                    ✓{s.correct}
                  </span>
                  <span className="text-sm font-mono text-zinc-600 tabular-nums">✗{wrong}</span>
                  <span className="text-xs text-zinc-700 font-mono">/{s.n}q</span>
                  <span className="text-xs font-mono tabular-nums" style={{ color: dotColor }}>{acc}%</span>
                  {s.mode === "sim" && (
                    <span className="text-xs font-mono text-zinc-500">score {simScore}/80</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-zinc-700">{s.avgTime.toFixed(1)}s/q</span>
                  {proj && (
                    <span className="text-[10px] font-mono text-zinc-700">est {proj.score}/80</span>
                  )}
                  {(s.streak ?? 0) >= 5 && (
                    <span className="text-[10px] text-amber-600 font-mono">{s.streak} streak</span>
                  )}
                </div>
              </div>
              {isPending ? (
                <div className="flex gap-2 shrink-0 pt-0.5">
                  <button onClick={() => { onDelete(s.ts); setPendingTs(null); }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors">confirm</button>
                  <button onClick={() => setPendingTs(null)}
                    className="text-xs text-zinc-600 transition-colors">cancel</button>
                </div>
              ) : (
                <button onClick={() => setPendingTs(s.ts)}
                  className="text-xs text-zinc-700 hover:text-red-400 transition-colors shrink-0 pt-0.5">
                  ×
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
type Tab = "overview" | "skills" | "history" | "settings";

export default function Dashboard() {
  const [data,         setData]         = useState<PerfData | null>(null);
  const [tab,          setTab]          = useState<Tab>("overview");
  const [selectedSkill,setSelectedSkill]= useState<SkillId | null>(null);
  const [myId,         setMyId]         = useState("");
  const [syncInput,    setSyncInput]    = useState("");
  const [syncMsg,      setSyncMsg]      = useState("");
  const [copied,       setCopied]       = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { setData(loadData()); setMyId(getUserId()); }, []);

  // All hooks above the early return
  const stats       = data ? allSkillStats(data)        : null;
  const proj        = data ? optiverProjection(data)    : null;
  const projHistory = data ? sessionProjections(data)   : [];
  const total       = data ? totalQuestions(data)       : 0;

  const weaknessTips = useMemo(
    () => {
      if (!data) return {};
      return Object.fromEntries(
        SKILL_IDS.map(id => {
          const tips = TIPS[id] || [];
          return [id, tips[Math.floor(Math.random() * tips.length)] || ""];
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data ? data.sessions.length : 0]
  );

  if (!data || !stats) {
    return (
      <main className="max-w-md mx-auto px-4 pt-6 pb-20 md:max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="h-4 w-12 bg-zinc-800/60 rounded animate-pulse" />
          <div className="h-4 w-24 bg-zinc-800/60 rounded animate-pulse" />
          <div className="h-4 w-10 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="flex gap-0.5 bg-zinc-900 rounded-xl p-1 mb-7 border border-zinc-800/60">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-1 h-7 bg-zinc-800/40 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="mb-10">
          <div className="h-20 w-40 bg-zinc-900/60 rounded-xl animate-pulse mb-4" />
          <div className="flex gap-2 mb-5">
            <div className="h-6 w-16 bg-zinc-900/40 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-zinc-900/40 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-16 bg-zinc-900/40 rounded-xl animate-pulse border border-zinc-800/60" />
            ))}
          </div>
        </div>
        <div className="h-24 bg-zinc-900/40 rounded-2xl animate-pulse border border-zinc-800/60" />
      </main>
    );
  }

  // ── Event handlers ──────────────────────────────────────────────────────────
  async function handleLinkDevice() {
    if (!syncInput.trim()) return;
    setSyncMsg("Pulling…");
    const cloud = await pullFromCloud(syncInput.trim().toLowerCase());
    if (!cloud) { setSyncMsg("No data found for that code."); return; }
    setSyncCode(syncInput.trim().toLowerCase());
    setMyId(syncInput.trim().toLowerCase());
    const local  = loadData();
    const merged = mergeData(local, cloud);
    saveData(merged);
    setData(merged);
    await pushToCloud(merged);
    setSyncMsg("Linked. Data merged.");
    setSyncInput("");
  }

  // [Fix] Delete by ts — avoids index confusion between filtered and unfiltered session arrays
  function handleDelete(ts: string) {
    if (!data) return;
    deleteSessionByTs(data, ts);
    saveData(data);
    setData({ ...data });
  }

  function handleReset() {
    setData(resetAllData());
    setConfirmReset(false);
  }

  function handleDrill(skillId: SkillId) {
    window.location.href = `/drill?mode=focus&skills=${skillId}`;
  }

  function copyId() {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Tab nav ─────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview",  label: "Overview"  },
    { id: "skills",    label: "Skills"    },
    { id: "history",   label: "History"   },
    { id: "settings",  label: "Settings"  },
  ];

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-20 md:max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-zinc-600 text-sm hover:text-zinc-300 transition-colors">← home</Link>
        <h1 className="text-base font-semibold tracking-tight text-zinc-200">Dashboard</h1>
        <span className="text-xs text-zinc-700 font-mono">{total} reps</span>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 bg-zinc-900 rounded-xl p-1 mb-7 border border-zinc-800/60">
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-xs py-1.5 rounded-lg transition-colors font-medium ${
              tab === t.id
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-600 hover:text-zinc-400"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ───────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <>
          {/* On desktop: 2-column grid */}
          <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start">
            {/* Left column: score + trajectory */}
            <div>
              {proj ? (
                <ScoreHero proj={proj} />
              ) : (
                <div className="border border-zinc-800/60 rounded-2xl px-4 py-8 text-center mb-10">
                  <p className="text-zinc-500 text-sm mb-1">Not enough data yet</p>
                  <p className="text-zinc-700 text-xs">Do at least 10 attempts across 1+ skills to unlock your estimate.</p>
                </div>
              )}

              {/* Trajectory */}
              <div className="mb-2">
                <p className="text-[10px] text-zinc-600 mb-2">Score trajectory</p>
                <TrajectoryChart points={projHistory} />
              </div>

              {/* Scatter: accuracy vs speed */}
              <ScatterChart stats={stats} />
            </div>

            {/* Right column: session panel + radar */}
            <div>
              {/* Session panel */}
              <SessionPanel data={data} />

              {/* Radar snapshot */}
              <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/60 p-3 mb-10">
            <div className="flex justify-between px-1 mb-1">
              <span className="text-[10px] text-zinc-600">skill profile</span>
              <button className="text-[10px] text-zinc-700 hover:text-zinc-400"
                onClick={() => setTab("skills")}>
                see breakdown →
              </button>
            </div>
            <Radar stats={stats} onSelect={setSelectedSkill} selected={selectedSkill} />
            {selectedSkill && (
              <div className="mt-2 border-t border-zinc-800/60 pt-2 px-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-200">{SKILL_LABELS[selectedSkill]}</span>
                  <button onClick={() => setSelectedSkill(null)} className="text-zinc-700 text-xs">✕</button>
                </div>
                {stats[selectedSkill].n === 0 ? (
                  <p className="text-xs text-zinc-600">No data yet.</p>
                ) : (
                  <div className="flex gap-4 text-xs">
                    <span className="font-mono text-zinc-300">{Math.round(stats[selectedSkill].accuracy! * 100)}% acc</span>
                    <span className="font-mono text-zinc-300">{stats[selectedSkill].avgTime!.toFixed(1)}s avg</span>
                    <span className="text-zinc-600">{stats[selectedSkill].n} attempts</span>
                  </div>
                )}
                <button onClick={() => handleDrill(selectedSkill)}
                  className="text-xs text-emerald-500 hover:text-emerald-400 mt-1.5 transition-colors">
                  → Drill this skill
                </button>
              </div>
            )}
          </div>
          </div>{/* end right column */}
          </div>{/* end 2-col grid */}
        </>
      )}

      {/* ── Skills tab ─────────────────────────────────────────────────────── */}
      {tab === "skills" && (
        <div className="md:grid md:grid-cols-2 md:gap-8 md:items-start">
          <DifficultyHeatmap data={data} />
          <div>
            <p className="text-[10px] text-zinc-600 mb-4">Priority focus areas</p>
            <WeaknessCards data={data} onDrill={handleDrill} />
          </div>
        </div>
      )}

      {/* ── History tab ────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <>
          <div className="mb-4">
            <p className="text-xs text-zinc-600">
              {data.sessions.filter(s => s.n > 0).length} sessions · {total} total reps
            </p>
          </div>
          <SessionLog
            data={data}
            projections={projHistory}
            onDelete={handleDelete}
          />
        </>
      )}

      {/* ── Settings tab ───────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="space-y-5">

          {/* Sync */}
          <div>
            <p className="text-xs text-zinc-500 mb-3">Cross-device sync</p>
            <div className="bg-zinc-900/50 rounded-xl p-3 mb-2 border border-zinc-800/50">
              <p className="text-xs text-zinc-700 mb-2">Your sync code</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs text-zinc-400 bg-zinc-800/60 rounded-lg px-3 py-2 break-all font-mono">
                  {myId || "loading…"}
                </code>
                <button onClick={copyId}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2 whitespace-nowrap text-zinc-300 transition-colors">
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
              <p className="text-xs text-zinc-700 mb-2">Paste a code from another device</p>
              <div className="flex gap-2">
                <input
                  value={syncInput}
                  onChange={e => setSyncInput(e.target.value)}
                  placeholder="paste code…"
                  className="flex-1 text-xs bg-zinc-800/60 rounded-lg px-3 py-2 font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                />
                <button onClick={handleLinkDevice}
                  className="text-xs bg-blue-700 hover:bg-blue-600 rounded-lg px-3 py-2 text-white font-medium transition-colors whitespace-nowrap">
                  Link
                </button>
              </div>
              {syncMsg && <p className="text-xs text-zinc-500 mt-2">{syncMsg}</p>}
            </div>
          </div>

          {/* Reset */}
          <div>
            <p className="text-xs text-zinc-500 mb-3">Data</p>
            {confirmReset ? (
              <div className="bg-red-950/30 rounded-xl p-3 border border-red-900/30">
                <p className="text-xs text-red-300 mb-3">Delete ALL history? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={handleReset}
                    className="flex-1 bg-red-700 hover:bg-red-600 rounded-lg py-2 text-xs font-semibold text-white transition-colors">
                    Yes, reset everything
                  </button>
                  <button onClick={() => setConfirmReset(false)}
                    className="flex-1 bg-zinc-800 rounded-lg py-2 text-xs text-zinc-300 transition-colors">
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

    </main>
  );
}
