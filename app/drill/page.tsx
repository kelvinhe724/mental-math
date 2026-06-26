"use client";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Numpad from "@/components/Numpad";
import Timer from "@/components/Timer";
import {
  SKILL_IDS, SKILL_LABELS, SkillId, Difficulty, getQuestion,
  checkAnswer, getRandomTip, Question,
} from "@/lib/questions";
import {
  loadData, saveData, recordAttempt, recordSession, PerfData,
} from "@/lib/tracker";
import { pickNext, updateDifficulty, resetSessionState } from "@/lib/engine";
import { pushToCloud } from "@/lib/sync";

type Phase = "focus-pick" | "running" | "paused" | "done";

interface AttemptRecord {
  skillId: SkillId;
  correct: boolean;
  elapsed: number;
  difficulty: Difficulty;
  question: string;
  answer: number | string;
  userAnswer: string;
}

function DrillInner() {
  const router       = useRouter();
  const params       = useSearchParams();
  const mode         = (params.get("mode") || "adaptive") as "adaptive" | "sim" | "focus";
  const durSecs      = params.get("secs") ? Number(params.get("secs")) : (mode === "sim" ? 480 : null);

  const [phase,       setPhase]       = useState<Phase>(mode === "focus" ? "focus-pick" : "running");
  const [focusSkills, setFocusSkills] = useState<SkillId[]>([]);
  const [current,     setCurrent]     = useState<{ q: Question; skillId: SkillId } | null>(null);
  const [input,       setInput]       = useState("");
  const [feedback,    setFeedback]    = useState<"correct" | "wrong" | null>(null);
  const [tip,         setTip]         = useState("");
  const [qCount,      setQCount]      = useState(0);
  const [attempts,    setAttempts]    = useState<AttemptRecord[]>([]);
  const [paused,      setPaused]      = useState(false);

  const dataRef    = useRef<PerfData>(loadData());
  const startRef   = useRef<number>(Date.now());
  const qStartRef  = useRef<number>(Date.now());
  const pauseRef   = useRef<number>(0);

  // reset engine state on mount
  useEffect(() => { resetSessionState(); }, []);

  const nextQuestion = useCallback((data: PerfData, skills: SkillId[]) => {
    let skillId: SkillId;
    let difficulty: Difficulty;
    if (mode === "sim") {
      skillId    = SKILL_IDS[Math.floor(Math.random() * SKILL_IDS.length)];
      difficulty = ["easy", "medium", "hard"][Math.floor(Math.random() * 3)] as Difficulty;
    } else if (mode === "focus" && skills.length) {
      skillId    = skills[Math.floor(Math.random() * skills.length)];
      const next = pickNext(data);
      difficulty = next.difficulty;
    } else {
      const next = pickNext(data);
      skillId    = next.skillId;
      difficulty = next.difficulty;
    }
    const q = getQuestion(skillId, difficulty);
    setCurrent({ q, skillId });
    setInput("");
    setFeedback(null);
    setTip("");
    qStartRef.current = Date.now();
  }, [mode]);

  // start first question
  useEffect(() => {
    if (phase === "running") {
      nextQuestion(dataRef.current, focusSkills);
    }
  }, [phase, focusSkills, nextQuestion]);

  function handleExpire() {
    finishSession();
  }

  function handleSubmit() {
    if (!current || !input || feedback) return;
    const elapsed = (Date.now() - qStartRef.current) / 1000;
    const correct = checkAnswer(input, current.q.answer);
    const tip     = correct ? "" : getRandomTip(current.skillId);

    setFeedback(correct ? "correct" : "wrong");
    setTip(tip);

    recordAttempt(dataRef.current, current.skillId, correct, elapsed, current.q.difficulty);
    updateDifficulty(current.skillId, correct, elapsed);

    const rec: AttemptRecord = {
      skillId:    current.skillId,
      correct,
      elapsed,
      difficulty: current.q.difficulty,
      question:   current.q.text,
      answer:     current.q.answer,
      userAnswer: input,
    };
    const newAttempts = [...attempts, rec];
    setAttempts(newAttempts);
    setQCount(c => c + 1);

    // check sim question limit
    const newCount = qCount + 1;
    if (mode === "sim" && newCount >= 80) {
      setTimeout(() => finishSession(newAttempts), 900);
      return;
    }

    // auto-advance after brief feedback
    setTimeout(() => nextQuestion(dataRef.current, focusSkills), correct ? 700 : 1800);
  }

  function finishSession(finalAttempts?: AttemptRecord[]) {
    const all = finalAttempts ?? attempts;
    const correct = all.filter(a => a.correct).length;
    const avgTime = all.length ? all.reduce((s, a) => s + a.elapsed, 0) / all.length : 0;
    recordSession(dataRef.current, { mode, n: all.length, correct, avgTime });
    saveData(dataRef.current);
    pushToCloud(dataRef.current); // fire-and-forget, offline-safe
    setPhase("done");
  }

  function togglePause() {
    if (!paused) {
      pauseRef.current = Date.now();
      setPaused(true);
      setPhase("paused");
    } else {
      startRef.current += Date.now() - pauseRef.current;
      setPaused(false);
      setPhase("running");
    }
  }

  // ── Focus skill picker ─────────────────────────────────────────────────────
  if (phase === "focus-pick") {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-8">
        <button onClick={() => router.push("/")} className="text-zinc-400 text-sm mb-6">← back</button>
        <h2 className="text-xl font-bold mb-4">Pick skills to focus on</h2>
        <div className="space-y-2 mb-6">
          {SKILL_IDS.map(s => (
            <button key={s}
              onClick={() => setFocusSkills(prev =>
                prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
              )}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors font-medium ${
                focusSkills.includes(s) ? "bg-blue-700" : "bg-zinc-800 hover:bg-zinc-700"
              }`}>
              {SKILL_LABELS[s]}
            </button>
          ))}
        </div>
        <button
          disabled={!focusSkills.length}
          onClick={() => setPhase("running")}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-2xl py-4 font-bold text-lg transition-colors">
          Start
        </button>
      </main>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (phase === "done") {
    const correct = attempts.filter(a => a.correct).length;
    const acc     = attempts.length ? Math.round(correct / attempts.length * 100) : 0;
    const missed  = attempts.filter(a => !a.correct);
    const simScore = correct - (attempts.length - correct);

    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-8">
        <h2 className="text-2xl font-bold mb-1">Done</h2>
        <p className="text-zinc-400 text-sm mb-6">Progress saved</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold">{attempts.length}</div>
            <div className="text-xs text-zinc-500 mt-0.5">questions</div>
          </div>
          <div className={`rounded-2xl p-4 text-center ${acc >= 85 ? "bg-emerald-900/50" : acc >= 70 ? "bg-amber-900/50" : "bg-red-900/50"}`}>
            <div className="text-2xl font-bold">{acc}%</div>
            <div className="text-xs text-zinc-400 mt-0.5">accuracy</div>
          </div>
          {mode === "sim" ? (
            <div className={`rounded-2xl p-4 text-center ${simScore >= 70 ? "bg-emerald-900/50" : simScore >= 50 ? "bg-amber-900/50" : "bg-red-900/50"}`}>
              <div className="text-2xl font-bold">{simScore}<span className="text-sm text-zinc-400">/80</span></div>
              <div className="text-xs text-zinc-400 mt-0.5">score</div>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold">{correct}</div>
              <div className="text-xs text-zinc-500 mt-0.5">correct</div>
            </div>
          )}
        </div>

        {missed.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Missed</h3>
            <div className="space-y-2">
              {missed.slice(0, 8).map((a, i) => (
                <div key={i} className="bg-zinc-900 rounded-xl px-4 py-3 text-sm">
                  <span className="text-zinc-300">{a.question}</span>
                  <span className="text-zinc-500 mx-2">=</span>
                  <span className="text-emerald-400 font-mono">{String(a.answer)}</span>
                  <span className="text-zinc-600 ml-2">(you: {a.userAnswer})</span>
                </div>
              ))}
              {missed.length > 8 && (
                <p className="text-xs text-zinc-500 px-1">+{missed.length - 8} more</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => router.push("/dashboard")}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 rounded-2xl py-4 font-semibold transition-colors">
            Coach Report
          </button>
          <button onClick={() => router.push("/")}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-2xl py-4 font-bold transition-colors">
            Home
          </button>
        </div>
      </main>
    );
  }

  // ── Active drill ───────────────────────────────────────────────────────────
  const feedbackColor =
    feedback === "correct" ? "text-emerald-400" :
    feedback === "wrong"   ? "text-red-400"     : "";

  return (
    // Use 100dvh so numpad always anchors to bottom on mobile
    <main className="max-w-md mx-auto flex flex-col px-4" style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top, 12px)", paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <button
          onClick={() => finishSession()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 bg-zinc-900 rounded-full px-4 py-1.5 border border-zinc-800">
          {durSecs
            ? <Timer totalSecs={durSecs} onExpire={handleExpire} running={phase === "running"} />
            : <span className="text-zinc-500 text-sm">open</span>
          }
          <span className="text-zinc-700 text-xs">·</span>
          <span className="text-zinc-400 text-sm font-medium">Q{qCount + (feedback ? 0 : 1)}</span>
        </div>

        <button
          onClick={togglePause}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          {phase === "paused" ? "▶" : "⏸"}
        </button>
      </div>

      {/* ── Paused ──────────────────────────────────────────────────────────── */}
      {phase === "paused" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <p className="text-zinc-500 text-lg">Paused</p>
          <button onClick={togglePause} className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl px-8 py-3 font-semibold transition-colors">
            ▶ Resume
          </button>
        </div>
      )}

      {/* ── Question area (top, grows) ───────────────────────────────────────── */}
      {phase === "running" && current && (
        <>
          <div className="flex-1 flex flex-col justify-center pt-2">
            <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase mb-4">
              {SKILL_LABELS[current.skillId]}
            </p>

            <div className="text-[3rem] font-bold leading-tight tracking-tight text-white mb-2">
              {current.q.text}
            </div>

            {current.q.subtext && (
              <p className="text-sm text-zinc-500 mb-2">{current.q.subtext}</p>
            )}

            {/* Inline feedback — no reserved space, appears only when needed */}
            {feedback && (
              <div className={`mt-2 text-base font-semibold ${feedbackColor}`}>
                {feedback === "correct" && "✓ Correct"}
                {feedback === "wrong" && (
                  <span>
                    ✗ &nbsp;
                    <span className="text-zinc-400 font-normal">Answer: </span>
                    <span className="font-mono text-white">{String(current.q.answer)}</span>
                    {tip && <div className="text-zinc-500 text-sm font-normal mt-1">{tip}</div>}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Numpad (bottom, fixed height) ─────────────────────────────────── */}
          <div className="shrink-0 pb-2">
            <Numpad value={input} onChange={setInput} onSubmit={handleSubmit} />
          </div>
        </>
      )}
    </main>
  );
}

export default function DrillPage() {
  return (
    <Suspense>
      <DrillInner />
    </Suspense>
  );
}
