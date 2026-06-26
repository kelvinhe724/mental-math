"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadData, saveData, allSkillStats, deleteSession, resetAllData, PerfData } from "@/lib/tracker";
import { getWeaknessRanking, optiverProjection } from "@/lib/engine";
import { SKILL_LABELS, SKILL_IDS, TARGET_TIMES, getRandomTip } from "@/lib/questions";
import { getUserId, setSyncCode, pullFromCloud, pushToCloud, mergeData } from "@/lib/sync";

const MASTERY_ACC  = 0.92;
const WEAK_ACC     = 0.75;
const SLOW_MULT    = 1.5;
const MASTERY_MULT = 1.15;

function statusColor(acc: number | null, avgT: number | null) {
  if (acc === null) return "text-zinc-600";
  const tgt = TARGET_TIMES.medium;
  if (acc >= MASTERY_ACC && avgT !== null && avgT <= tgt * MASTERY_MULT) return "text-emerald-400";
  if (acc < WEAK_ACC || (avgT !== null && avgT > tgt * SLOW_MULT)) return "text-red-400";
  return "text-amber-400";
}

function BarFill({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const [data,           setData]           = useState<PerfData | null>(null);
  const [showSessions,   setShowSessions]   = useState(false);
  const [confirmReset,   setConfirmReset]   = useState(false);
  const [deleteIdx,      setDeleteIdx]      = useState<number | null>(null);
  const [syncCode,       setSyncCodeState]  = useState("");
  const [myId,           setMyId]           = useState("");
  const [syncInput,      setSyncInput]      = useState("");
  const [syncMsg,        setSyncMsg]        = useState("");
  const [copied,         setCopied]         = useState(false);

  useEffect(() => {
    setData(loadData());
    setMyId(getUserId());
  }, []);
  if (!data) return null;

  async function handleLinkDevice() {
    if (!syncInput.trim()) return;
    setSyncMsg("Pulling data…");
    const cloud = await pullFromCloud(syncInput.trim().toLowerCase());
    if (!cloud) { setSyncMsg("No data found for that code."); return; }
    setSyncCode(syncInput.trim().toLowerCase());
    setMyId(syncInput.trim().toLowerCase());
    const local   = loadData();
    const merged  = mergeData(local, cloud);
    saveData(merged);
    setData(merged);
    await pushToCloud(merged);
    setSyncMsg("Linked! Data merged from other device.");
    setSyncInput("");
  }

  function copyId() {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stats   = allSkillStats(data);
  const ranking = getWeaknessRanking(data);
  const proj    = optiverProjection(data);

  const weaknesses = ranking.filter(r =>
    r.stats.n >= 3 && (r.stats.accuracy! < WEAK_ACC || r.stats.avgTime! > TARGET_TIMES.medium * SLOW_MULT)
  );
  const mastered = ranking.filter(r =>
    r.stats.n >= 3 && r.stats.accuracy! >= MASTERY_ACC && r.stats.avgTime! <= TARGET_TIMES.medium * MASTERY_MULT
  );

  function handleDelete(idx: number) {
    if (!data) return;
    deleteSession(data, idx);
    saveData(data);
    setData({ ...data });
    setDeleteIdx(null);
  }

  function handleReset() {
    const fresh = resetAllData();
    setData(fresh);
    setConfirmReset(false);
  }

  // sessions displayed newest-first
  const sessions = [...(data.sessions)].reverse();

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-12">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-zinc-400 text-sm">← home</Link>
        <h1 className="text-xl font-bold">Coach Report</h1>
        <div />
      </div>

      {/* Optiver projection */}
      {proj ? (
        <div className={`rounded-2xl p-5 mb-6 text-center ${
          proj.projectedScore >= 70 ? "bg-emerald-900/40 border border-emerald-800" :
          proj.projectedScore >= 50 ? "bg-amber-900/40 border border-amber-800"   :
          "bg-red-900/40 border border-red-800"
        }`}>
          <div className="text-4xl font-bold mb-1">
            {proj.projectedScore}<span className="text-xl text-zinc-400">/80</span>
          </div>
          <div className="text-sm text-zinc-300">Optiver 80-in-8 estimate</div>
          <div className="text-xs text-zinc-500 mt-1">
            ~{proj.answerable} answerable · {proj.avgSpeed.toFixed(1)}s/q · {Math.round(proj.avgAcc * 100)}% acc
          </div>
          {proj.projectedScore < 70 && (
            <div className="text-xs text-zinc-400 mt-2">Target: 70+ to be competitive</div>
          )}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl p-5 mb-6 text-center text-zinc-500">
          Complete a few drills to see your Optiver estimate
        </div>
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">⚠ Weaknesses</h2>
          <div className="space-y-3">
            {weaknesses.map(({ skillId, stats: s }) => {
              const tgt  = TARGET_TIMES.medium;
              const slow = s.avgTime !== null && s.avgTime > tgt * SLOW_MULT;
              const weak = s.accuracy !== null && s.accuracy < WEAK_ACC;
              return (
                <div key={skillId} className="bg-zinc-900 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{SKILL_LABELS[skillId]}</span>
                    <span className="text-xs text-zinc-500">{s.n} attempts</span>
                  </div>
                  <div className="flex gap-4 text-xs mb-2">
                    {s.accuracy !== null && (
                      <span className={weak ? "text-red-400" : "text-amber-400"}>
                        {Math.round(s.accuracy * 100)}% acc
                      </span>
                    )}
                    {s.avgTime !== null && (
                      <span className={slow ? "text-red-400" : "text-zinc-400"}>
                        {s.avgTime.toFixed(1)}s/q (target {tgt}s)
                      </span>
                    )}
                  </div>
                  {s.accuracy !== null && (
                    <BarFill ratio={s.accuracy} color={weak ? "bg-red-500" : "bg-amber-500"} />
                  )}
                  <p className="text-xs text-zinc-500 mt-2">Tip → {getRandomTip(skillId)}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* All skills */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">All Skills</h2>
        <div className="space-y-2">
          {SKILL_IDS.map(s => {
            const st  = stats[s];
            const col = statusColor(st.accuracy, st.avgTime);
            const barColor = col === "text-emerald-400" ? "bg-emerald-500" :
                             col === "text-red-400"     ? "bg-red-500"     :
                             col === "text-amber-400"   ? "bg-amber-500"   : "bg-zinc-700";
            return (
              <div key={s} className="bg-zinc-900 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium">{SKILL_LABELS[s]}</span>
                  <span className={`text-xs font-mono ${col}`}>
                    {st.n === 0 ? "no data" :
                     st.accuracy !== null ? `${Math.round(st.accuracy * 100)}%  ${st.avgTime!.toFixed(1)}s` : ""}
                  </span>
                </div>
                {st.n > 0 && st.accuracy !== null && (
                  <BarFill ratio={st.accuracy} color={barColor} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Mastered */}
      {mastered.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-2">✓ Mastered</h2>
          <div className="flex flex-wrap gap-2">
            {mastered.map(({ skillId }) => (
              <span key={skillId} className="bg-emerald-900/40 text-emerald-300 text-xs rounded-full px-3 py-1">
                {SKILL_LABELS[skillId]}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Session history */}
      <section className="mb-6">
        <button onClick={() => setShowSessions(s => !s)}
          className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-1">
          Sessions {showSessions ? "▲" : "▼"}
        </button>
        {showSessions && (
          <div className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-zinc-600 text-sm">No sessions yet.</p>
            )}
            {sessions.map((s, displayIdx) => {
              const realIdx = data.sessions.length - 1 - displayIdx;
              const ts   = s.ts.slice(0, 16).replace("T", " ");
              const acc  = s.n ? Math.round(s.correct / s.n * 100) : 0;
              const simScore = s.correct - (s.n - s.correct);
              return (
                <div key={displayIdx} className="bg-zinc-900 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium capitalize">{s.mode} — {s.n}q</div>
                    <div className="text-xs text-zinc-500">{ts} · {acc}% acc{s.mode === "sim" ? ` · ${simScore}/80` : ""}</div>
                  </div>
                  {deleteIdx === realIdx ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(realIdx)} className="text-xs text-red-400 hover:text-red-300">confirm</button>
                      <button onClick={() => setDeleteIdx(null)} className="text-xs text-zinc-500">cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteIdx(realIdx)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">delete</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sync */}
      <section className="mb-6 border-t border-zinc-800 pt-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Sync Between Devices</h2>
        <div className="bg-zinc-900 rounded-2xl p-4 mb-3">
          <p className="text-xs text-zinc-500 mb-2">Your sync code — paste this on your other device</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2 break-all font-mono">
              {myId || "loading…"}
            </code>
            <button onClick={copyId}
              className="text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg px-3 py-2 whitespace-nowrap transition-colors">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 mb-2">Got a sync code from another device? Paste it here</p>
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
      </section>

      {/* Reset */}
      <div className="border-t border-zinc-800 pt-6">
        {confirmReset ? (
          <div className="bg-red-950/50 rounded-2xl p-4">
            <p className="text-sm text-red-300 mb-3">Delete all history? This can&apos;t be undone.</p>
            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 bg-red-700 hover:bg-red-600 rounded-xl py-2 text-sm font-semibold transition-colors">
                Yes, reset everything
              </button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 bg-zinc-800 rounded-xl py-2 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)}
            className="text-sm text-zinc-600 hover:text-red-400 transition-colors">
            Reset all data
          </button>
        )}
      </div>
    </main>
  );
}
