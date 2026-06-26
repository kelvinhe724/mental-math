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
  userAnswer: string; // "skip" | "" (timeout) | actual answer
}

function DrillInner() {
  const router  = useRouter();
  const params  = useSearchParams();
  const mode    = (params.get("mode") || "adaptive") as "adaptive" | "sim" | "focus";
  const durSecs = params.get("secs") ? Number(params.get("secs")) : (mode === "sim" ? 480 : null);

  // Pre-select skills from URL (e.g. ?mode=focus&skills=mul_2d,frac_dec)
  const preSkills = params.get("skills")
    ? (params.get("skills")!.split(",") as SkillId[]).filter(s => SKILL_IDS.includes(s))
    : [];

  const [phase,       setPhase]       = useState<Phase>(mode === "focus" ? "focus-pick" : "running");
  const [focusSkills, setFocusSkills] = useState<SkillId[]>(preSkills);
  const [current,     setCurrent]     = useState<{ q: Question; skillId: SkillId } | null>(null);
  const [input,       setInput]       = useState("");
  const [feedback,    setFeedback]    = useState<"correct" | "wrong" | "skip" | null>(null);
  const [tip,         setTip]         = useState("");
  const [qCount,      setQCount]      = useState(0);
  const [attempts,    setAttempts]    = useState<AttemptRecord[]>([]);
  const [paused,      setPaused]      = useState(false);

  const dataRef   = useRef<PerfData>(loadData());
  const startRef  = useRef<number>(Date.now());
  const qStartRef = useRef<number>(Date.now());
  const pauseRef  = useRef<number>(0);
  // Track current attempts in a ref so handleExpire can access latest value
  const attemptsRef = useRef<AttemptRecord[]>([]);
  attemptsRef.current = attempts;

  useEffect(() => {
    resetSessionState();
    // If focus mode and skills pre-selected, jump straight to running
    if (mode === "focus" && preSkills.length > 0) {
      setPhase("running");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (phase === "running") {
      nextQuestion(dataRef.current, focusSkills);
    }
  }, [phase, focusSkills, nextQuestion]);

  function recordAndAdvance(
    current: { q: Question; skillId: SkillId },
    correct: boolean,
    elapsed: number,
    userAnswer: string,
    prevAttempts: AttemptRecord[],
    isSkip = false
  ): AttemptRecord[] {
    recordAttempt(dataRef.current, current.skillId, correct, elapsed, current.q.difficulty);
    updateDifficulty(current.skillId, correct, elapsed);
    const rec: AttemptRecord = {
      skillId:    current.skillId,
      correct,
      elapsed,
      difficulty: current.q.difficulty,
      question:   current.q.text,
      answer:     current.q.answer,
      userAnswer,
    };
    return [...prevAttempts, rec];
  }

  function handleSubmit() {
    if (!current || !input || feedback) return;
    const elapsed = (Date.now() - qStartRef.current) / 1000;
    const correct = checkAnswer(input, current.q.answer);
    const tipText = correct ? "" : getRandomTip(current.skillId);

    setFeedback(correct ? "correct" : "wrong");
    setTip(tipText);

    const newAttempts = recordAndAdvance(current, correct, elapsed, input, attempts);
    setAttempts(newAttempts);
    setQCount(c => c + 1);

    const newCount = qCount + 1;
    if (mode === "sim" && newCount >= 80) {
      setTimeout(() => finishSession(newAttempts), 900);
      return;
    }

    setTimeout(() => nextQuestion(dataRef.current, focusSkills), correct ? 600 : 1600);
  }

  function handleSkip() {
    if (!current || feedback) return;
    const elapsed = (Date.now() - qStartRef.current) / 1000;
    const newAttempts = recordAndAdvance(current, false, elapsed, "skip", attempts, true);
    setAttempts(newAttempts);
    setQCount(c => c + 1);
    setFeedback("skip");
    setTip("");
    // Brief skip flash then advance
    setTimeout(() => nextQuestion(dataRef.current, focusSkills), 400);
  }

  function handleExpire() {
    // Auto-count the current unanswered question as wrong (timeout)
    if (current && !feedback) {
      const elapsed = (Date.now() - qStartRef.current) / 1000;
      const newAttempts = recordAndAdvance(current, false, elapsed, "", attemptsRef.current, false);
      finishSession(newAttempts);
    } else {
      finishSession();
    }
  }

  function finishSession(finalAttempts?: AttemptRecord[]) {
    const all     = finalAttempts ?? attempts;
    const correct = all.filter(a => a.correct).length;
    const avgTime = all.length ? all.reduce((s, a) => s + a.elapsed, 0) / all.length : 0;
    recordSession(dataRef.current, { mode, n: all.length, correct, avgTime });
    saveData(dataRef.current);
    pushToCloud(dataRef.current);
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
        <button onClick={() => router.push("/")} className="text-zinc-400 text-sm mb-6 block">← back</button>
        <h2 className="text-xl font-bold mb-1">Focus drill</h2>
        <p className="text-zinc-600 text-sm mb-5">Pick one or more skills to drill intensively.</p>
        <div className="space-y-2 mb-6">
          {SKILL_IDS.map(s => (
            <button key={s}
              onClick={() => setFocusSkills(prev =>
                prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
              )}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                focusSkills.includes(s)
                  ? "bg-emerald-900/60 border border-emerald-700/60 text-emerald-300"
                  : "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300"
              }`}>
              {SKILL_LABELS[s]}
            </button>
          ))}
        </div>
        <button
          disabled={!focusSkills.length}
          onClick={() => setPhase("running")}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500 rounded-2xl py-4 font-bold text-lg transition-colors">
          Start
        </button>
      </main>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (phase === "done") {
    const correct  = attempts.filter(a => a.correct).length;
    const skipped  = attempts.filter(a => a.userAnswer === "skip").length;
    const timeout  = attempts.filter(a => !a.correct && a.userAnswer === "").length;
    const acc      = attempts.length ? Math.round(correct / attempts.length * 100) : 0;
    const missed   = attempts.filter(a => !a.correct);
    const simScore = correct - (attempts.length - correct);

    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-8">
        <h2 className="text-2xl font-bold mb-1">Done</h2>
        <p className="text-zinc-500 text-sm mb-6">Progress saved</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 rounded-2xl p-4 text-center border border-zinc-800">
            <div className="text-2xl font-bold font-mono">{attempts.length}</div>
            <div className="text-xs text-zinc-500 mt-0.5">questions</div>
          </div>
          <div className={`rounded-2xl p-4 text-center border ${
            acc >= 85 ? "bg-emerald-900/30 border-emerald-800/40" :
            acc >= 70 ? "bg-amber-900/30 border-amber-800/40" :
                        "bg-red-900/30 border-red-800/40"
          }`}>
            <div className="text-2xl font-bold font-mono">{acc}%</div>
            <div className="text-xs text-zinc-400 mt-0.5">accuracy</div>
          </div>
          {mode === "sim" ? (
            <div className={`rounded-2xl p-4 text-center border ${
              simScore >= 70 ? "bg-emerald-900/30 border-emerald-800/40" :
              simScore >= 50 ? "bg-amber-900/30 border-amber-800/40" :
                               "bg-red-900/30 border-red-800/40"
            }`}>
              <div className="text-2xl font-bold font-mono">{simScore}<span className="text-sm text-zinc-400">/80</span></div>
              <div className="text-xs text-zinc-400 mt-0.5">score</div>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-2xl p-4 text-center border border-zinc-800">
              <div className="text-2xl font-bold font-mono">{correct}</div>
              <div className="text-xs text-zinc-500 mt-0.5">correct</div>
            </div>
          )}
        </div>

        {(skipped > 0 || timeout > 0) && (
          <div className="flex gap-3 mb-4 text-xs text-zinc-600">
            {skipped > 0 && <span>{skipped} skipped</span>}
            {timeout > 0 && <span>{timeout} timed out</span>}
          </div>
        )}

        {missed.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-zinc-600 mb-2">{missed.length} missed</p>
            <div className="space-y-2">
              {missed.slice(0, 8).map((a, i) => (
                <div key={i} className="bg-zinc-900 rounded-xl px-4 py-3 text-sm border border-zinc-800">
                  <span className="text-zinc-300">{a.question}</span>
                  <span className="text-zinc-600 mx-2">=</span>
                  <span className="text-emerald-400 font-mono">{String(a.answer)}</span>
                  {a.userAnswer === "skip"
                    ? <span className="text-zinc-700 ml-2 text-xs">skipped</span>
                    : a.userAnswer
                      ? <span className="text-zinc-600 ml-2">(you: {a.userAnswer})</span>
                      : <span className="text-zinc-700 ml-2 text-xs">timeout</span>
                  }
                </div>
              ))}
              {missed.length > 8 && (
                <p className="text-xs text-zinc-600 px-1">+{missed.length - 8} more</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => router.replace(`/drill?mode=${mode}${durSecs ? `&secs=${durSecs}` : ''}${focusSkills.length ? `&skills=${focusSkills.join(',')}` : ''}`)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-4 font-bold text-lg transition-colors mb-3">
          Again →
        </button>
        <div className="flex gap-3">
          <button onClick={() => router.push("/dashboard")}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl py-3 font-medium text-sm transition-colors text-zinc-300">
            Coach Report
          </button>
          <button onClick={() => router.push("/")}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl py-3 font-medium text-sm transition-colors text-zinc-300">
            Home
          </button>
        </div>
      </main>
    );
  }

  // ── Active drill ───────────────────────────────────────────────────────────
  const feedbackColor =
    feedback === "correct" ? "text-emerald-400" :
    feedback === "skip"    ? "text-zinc-500"    :
    feedback === "wrong"   ? "text-red-400"     : "";

  return (
    <main className="max-w-md mx-auto flex flex-col px-4"
      style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top, 12px)", paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>

      {/* Header */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <button onClick={() => finishSession()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
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
        <button onClick={togglePause}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
          {phase === "paused" ? "▶" : "⏸"}
        </button>
      </div>

      {/* Paused */}
      {phase === "paused" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <p className="text-zinc-500 text-lg">Paused</p>
          <button onClick={togglePause}
            className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl px-8 py-3 font-semibold transition-colors">
            ▶ Resume
          </button>
        </div>
      )}

      {/* Question area */}
      {phase === "running" && current && (
        <>
          <div className="flex-1 flex flex-col justify-between pt-2">
            <div>
              <p className="text-xs font-medium text-zinc-600 mb-4 tracking-wide">
                {SKILL_LABELS[current.skillId]}
              </p>
              <div className="text-[3rem] font-bold leading-tight tracking-tight text-white mb-2">
                {current.q.text}
              </div>
              {current.q.subtext && (
                <p className="text-sm text-zinc-500 mb-2">{current.q.subtext}</p>
              )}
              {feedback && (
                <div className={`mt-2 text-base font-semibold ${feedbackColor}`}>
                  {feedback === "correct" && "✓ Correct"}
                  {feedback === "skip"    && "→ Skipped"}
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

            {/* Skip button — subtle, above numpad */}
            {!feedback && (
              <div className="flex justify-end pb-2">
                <button onClick={handleSkip}
                  className="text-zinc-700 hover:text-zinc-400 text-sm transition-colors py-1 px-2">
                  skip →
                </button>
              </div>
            )}
          </div>

          {/* Numpad */}
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
