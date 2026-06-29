"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { SKILL_IDS, SKILL_LABELS, SkillId, Difficulty, getQuestion, checkAnswer, Question } from "@/lib/questions";
import { GUIDES, solveSteps, Step } from "@/lib/learn";

const DIFF_LABELS: Difficulty[] = ["easy", "medium", "hard"];

const SHORT: Record<SkillId, string> = {
  add_sub:    "Add/Sub",
  mul_1d:     "×1d",
  mul_2d:     "×2d",
  div:        "Division",
  percent:    "Percent",
  frac_arith: "Fractions",
  frac_dec:   "Frac↔Dec",
  mixed:      "Mixed",
};

// ── Accordion card ────────────────────────────────────────────────────────────
function StrategyCard({ strategy, index }: { strategy: typeof GUIDES["add_sub"]["strategies"][0]; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0 mt-[5px]" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-zinc-200">{strategy.title}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{strategy.tagline}</div>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-600 shrink-0 transition-transform duration-200 mt-0.5 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-5 border-t border-zinc-800/60">
          {/* Key steps */}
          <div className="mt-4 space-y-1.5">
            {strategy.keySteps.map((step, i) => (
              <div key={i} className="flex gap-2.5 text-[12px]">
                <span className="text-emerald-600 shrink-0 mt-0.5">→</span>
                <span className="text-zinc-300">{step}</span>
              </div>
            ))}
          </div>

          {/* Worked example */}
          <div className="mt-5 bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
            <div className="text-[10px] text-zinc-500 font-mono mb-3">example</div>
            <div className="text-[20px] font-mono font-semibold text-zinc-100 mb-4">
              {strategy.example.problem}
            </div>
            <div className="space-y-2">
              {strategy.example.steps.map((s, i) => (
                <div key={i} className="flex items-baseline gap-3">
                  <span className="text-[12px] text-zinc-500 flex-1">{s.desc}</span>
                  {s.calc && (
                    <span className="text-[13px] font-mono text-emerald-400 shrink-0">{s.calc}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">Answer</span>
              <span className="text-[15px] font-mono font-bold text-amber-400">{strategy.example.answer}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step reveal ───────────────────────────────────────────────────────────────
function StepReveal({ steps, answer }: { steps: Step[]; answer: number | string }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    const t = setInterval(() => {
      setRevealed(r => {
        if (r >= steps.length) { clearInterval(t); return r; }
        return r + 1;
      });
    }, 380);
    return () => clearInterval(t);
  }, [steps]);

  if (!steps.length) {
    return (
      <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="text-[12px] text-zinc-500">Answer: <span className="font-mono text-amber-400">{String(answer)}</span></div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {steps.slice(0, revealed).map((s, i) => (
        <div
          key={i}
          className="flex items-baseline gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800/60 animate-fade-in"
        >
          <div className="flex-1 min-w-0">
            <span className="text-[12px] text-zinc-400">{s.label}</span>
            {s.note && <span className="text-[10px] text-zinc-600 ml-2">({s.note})</span>}
          </div>
          <span className="text-[14px] font-mono text-emerald-400 shrink-0">{s.result}</span>
        </div>
      ))}
      {revealed >= steps.length && (
        <div className="flex items-center gap-2 p-3 bg-zinc-900/50 rounded-lg border border-amber-900/40">
          <span className="text-[12px] text-zinc-500">Answer</span>
          <span className="text-[16px] font-mono font-bold text-amber-400">{String(answer)}</span>
        </div>
      )}
    </div>
  );
}

// ── Practice zone ─────────────────────────────────────────────────────────────
function PracticeZone({ skillId }: { skillId: SkillId }) {
  const [diff, setDiff] = useState<Difficulty>("medium");
  const [q, setQ] = useState<Question | null>(null);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "answered" | "explained">("idle");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const nextQ = useCallback(() => {
    setQ(getQuestion(skillId, diff));
    setInput("");
    setPhase("idle");
    setCorrect(null);
    setSteps([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [skillId, diff]);

  // Generate first question when skill or diff changes
  useEffect(() => { nextQ(); }, [skillId, diff]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheck = () => {
    if (!q || !input.trim()) return;
    const ok = checkAnswer(input, q.answer);
    setCorrect(ok);
    setPhase("answered");
  };

  const handleExplain = () => {
    if (!q) return;
    const s = solveSteps(q, skillId);
    setSteps(s);
    setPhase("explained");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (phase === "idle") handleCheck();
      else nextQ();
    }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-widest text-zinc-600">practice</div>
        <div className="flex gap-1">
          {DIFF_LABELS.map(d => (
            <button
              key={d}
              onClick={() => setDiff(d)}
              className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
                diff === d
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {q && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          {/* Question */}
          <div className="text-center py-4">
            <div className="text-[32px] font-mono font-semibold text-zinc-100 tracking-tight">
              {q.text}
            </div>
            {q.subtext && (
              <div className="text-[12px] text-zinc-500 mt-1">{q.subtext}</div>
            )}
          </div>

          {/* Input row */}
          {phase !== "answered" && phase !== "explained" ? (
            <div className="flex gap-2 mt-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={q.inputType === "fraction" ? "e.g. 3/4" : "answer"}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-[14px] font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={handleCheck}
                disabled={!input.trim()}
                className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200 text-[13px] rounded-lg transition-colors"
              >
                Check →
              </button>
              <button
                onClick={handleExplain}
                className="px-4 py-2.5 text-zinc-500 hover:text-zinc-300 text-[13px] transition-colors"
              >
                Explain
              </button>
            </div>
          ) : (
            /* Result row */
            <div className="flex items-center gap-3 mt-2">
              <div className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border ${
                correct
                  ? "bg-emerald-950/40 border-emerald-800/40"
                  : correct === false
                  ? "bg-red-950/30 border-red-900/30"
                  : "bg-zinc-800 border-zinc-700"
              }`}>
                {correct === true && <span className="text-emerald-400 text-[13px]">✓ Correct</span>}
                {correct === false && (
                  <>
                    <span className="text-red-400 text-[13px]">✗</span>
                    <span className="text-zinc-500 text-[13px]">Correct: <span className="font-mono text-zinc-300">{String(q.answer)}</span></span>
                  </>
                )}
              </div>
              {phase === "answered" && (
                <button
                  onClick={handleExplain}
                  className="px-4 py-2.5 text-zinc-500 hover:text-zinc-300 text-[13px] transition-colors"
                >
                  Explain
                </button>
              )}
              <button
                onClick={nextQ}
                className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[13px] rounded-lg transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          {/* Step reveal */}
          {phase === "explained" && (
            <>
              <StepReveal steps={steps} answer={q.answer} />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={nextQ}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-[13px] rounded-lg transition-colors"
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LearnPage() {
  const [skill, setSkill] = useState<SkillId>("add_sub");
  const chipsRef = useRef<HTMLDivElement>(null);

  const guide = GUIDES[skill];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[11px] text-zinc-600 mb-1">mental math</div>
            <h1 className="text-[22px] font-semibold text-zinc-100 tracking-tight">Strategy Guide</h1>
          </div>
          <Link href="/" className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Home
          </Link>
        </div>

        {/* Skill chips — horizontal scroll */}
        <div
          ref={chipsRef}
          className="flex gap-2 overflow-x-auto pb-1 mb-8 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {SKILL_IDS.map(id => (
            <button
              key={id}
              onClick={() => setSkill(id)}
              className={`shrink-0 text-[12px] px-3.5 py-1.5 rounded-full border transition-all ${
                skill === id
                  ? "border-zinc-500 bg-zinc-800 text-zinc-200"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
              }`}
            >
              {SHORT[id]}
            </button>
          ))}
        </div>

        {/* Skill header */}
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-zinc-100">{SKILL_LABELS[skill]}</h2>
          <p className="text-[13px] text-zinc-400 mt-2 leading-relaxed">{guide.intro}</p>
        </div>

        {/* Strategy accordion */}
        <div className="space-y-2">
          {guide.strategies.map((s, i) => (
            <StrategyCard key={i} strategy={s} index={i} />
          ))}
        </div>

        {/* Practice zone */}
        <PracticeZone skillId={skill} />

      </div>
    </main>
  );
}
