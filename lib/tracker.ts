import { SkillId, SKILL_IDS, Difficulty } from "./questions";

export interface Attempt {
  ts: string;
  correct: boolean;
  elapsed: number;
  difficulty: Difficulty;
}

export interface SessionSummary {
  ts: string;
  mode: string;
  n: number;
  correct: number;
  wrong: number;        // explicit wrong count (not derived, to avoid confusion with 0-question sessions)
  avgTime: number;
  streak?: number;      // [Improvement #8] consecutive correct at end of session
}

export interface SkillData {
  attempts: Attempt[];
}

export interface PerfData {
  sessions: SessionSummary[];
  skills: Record<SkillId, SkillData>;
}

export interface SkillStats {
  accuracy: number | null;
  avgTime: number | null;
  n: number;
}

const STORAGE_KEY = "mentalmath_perf_v2"; // bumped to clear old format
const STORAGE_KEY_V1 = "mentalmath_perf_v1";

function emptySkill(): SkillData {
  return { attempts: [] };
}

function emptyData(): PerfData {
  return {
    sessions: [],
    skills: Object.fromEntries(SKILL_IDS.map(s => [s, emptySkill()])) as Record<SkillId, SkillData>,
  };
}

// Migrate v1 → v2: add wrong/streak fields to old sessions
function migrateV1(data: PerfData): PerfData {
  data.sessions = data.sessions.map(s => ({
    ...s,
    wrong: s.wrong ?? (s.n - s.correct),
    streak: s.streak ?? 0,
  }));
  return data;
}

export function loadData(): PerfData {
  if (typeof window === "undefined") return emptyData();
  try {
    // Try v2 first
    const raw2 = localStorage.getItem(STORAGE_KEY);
    if (raw2) {
      const data = JSON.parse(raw2) as PerfData;
      for (const s of SKILL_IDS) {
        if (!data.skills[s]) data.skills[s] = emptySkill();
      }
      return migrateV1(data);
    }
    // Fall back to v1
    const raw1 = localStorage.getItem(STORAGE_KEY_V1);
    if (raw1) {
      const data = JSON.parse(raw1) as PerfData;
      for (const s of SKILL_IDS) {
        if (!data.skills[s]) data.skills[s] = emptySkill();
      }
      return migrateV1(data);
    }
    throw new Error("no data");
  } catch {
    return emptyData();
  }
}

export function saveData(data: PerfData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordAttempt(
  data: PerfData, skillId: SkillId, correct: boolean, elapsed: number, difficulty: Difficulty
) {
  data.skills[skillId].attempts.push({
    ts: new Date().toISOString(),
    correct,
    elapsed: Math.round(elapsed * 100) / 100,
    difficulty,
  });
}

export function recordSession(
  data: PerfData,
  summary: Omit<SessionSummary, "ts" | "wrong" | "streak"> & { attempts?: Array<{ correct: boolean }> }
) {
  // [Improvement #8] Compute trailing streak from attempt records
  let streak = 0;
  if (summary.attempts) {
    for (let i = summary.attempts.length - 1; i >= 0; i--) {
      if (summary.attempts[i].correct) streak++;
      else break;
    }
  }
  const wrong = summary.n - summary.correct;
  data.sessions.push({
    ts: new Date().toISOString(),
    mode: summary.mode,
    n: summary.n,
    correct: summary.correct,
    wrong,
    avgTime: summary.avgTime,
    streak,
  });
}

// [Improvement #5] Decay-weighted skill stats: recent attempts count more
// halfLife = 30 days by default; set to 0 to disable decay (equal weight)
export function skillStats(data: PerfData, skillId: SkillId, lastN = 30, halfLifeDays = 7): SkillStats {
  const all = data.skills[skillId].attempts;
  if (!all.length) return { accuracy: null, avgTime: null, n: 0 };

  const now = Date.now();
  const halfMs = halfLifeDays * 24 * 3600 * 1000;

  // Use last N attempts, apply decay weights
  const window = all.slice(-lastN);
  let wSum = 0, wCorrect = 0, wTime = 0;

  for (const a of window) {
    const age = now - new Date(a.ts).getTime();
    // Exponential decay: weight = exp(-ln2 * age / halfLife)
    const w = Math.exp((-Math.LN2 * age) / halfMs);
    wSum     += w;
    wCorrect += a.correct ? w : 0;
    wTime    += a.elapsed * w;
  }

  if (wSum === 0) return { accuracy: null, avgTime: null, n: 0 };
  return {
    accuracy: wCorrect / wSum,
    avgTime:  wTime    / wSum,
    n:        window.length,
  };
}

export function allSkillStats(data: PerfData, lastN = 30): Record<SkillId, SkillStats> {
  return Object.fromEntries(SKILL_IDS.map(s => [s, skillStats(data, s, lastN)])) as Record<SkillId, SkillStats>;
}

export function totalQuestions(data: PerfData): number {
  return SKILL_IDS.reduce((sum, s) => sum + data.skills[s].attempts.length, 0);
}

// Find session by ts (more robust than by index across filtered/unfiltered arrays)
export function deleteSessionByTs(data: PerfData, ts: string): boolean {
  const idx = data.sessions.findIndex(s => s.ts === ts);
  if (idx === -1) return false;

  const tEnd   = ts;
  const tStart = idx > 0 ? data.sessions[idx - 1].ts : "1970-01-01T00:00:00";
  for (const skillId of SKILL_IDS) {
    data.skills[skillId].attempts = data.skills[skillId].attempts.filter(
      a => !(a.ts > tStart && a.ts <= tEnd)
    );
  }
  data.sessions.splice(idx, 1);
  return true;
}

// [Improvement #7] Better merge: deduplicate attempts by ts (no "longer array wins")
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const seen = new Set<string>();
  const merged: Attempt[] = [];
  for (const attempt of [...a, ...b]) {
    const key = `${attempt.ts}:${attempt.elapsed}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(attempt);
    }
  }
  return merged.sort((x, y) => x.ts.localeCompare(y.ts));
}

export function resetAllData(): PerfData {
  const fresh = emptyData();
  saveData(fresh);
  return fresh;
}

export interface SkillDifficultyStats {
  easy:   SkillStats;
  medium: SkillStats;
  hard:   SkillStats;
}

export function skillStatsByDifficulty(data: PerfData, skillId: SkillId): SkillDifficultyStats {
  const all = data.skills[skillId].attempts;
  function statsFor(diff: Difficulty): SkillStats {
    const f = all.filter(a => a.difficulty === diff);
    if (!f.length) return { accuracy: null, avgTime: null, n: 0 };
    const correct = f.filter(a => a.correct).length;
    return {
      accuracy: correct / f.length,
      avgTime: f.reduce((s, a) => s + a.elapsed, 0) / f.length,
      n: f.length,
    };
  }
  return { easy: statsFor("easy"), medium: statsFor("medium"), hard: statsFor("hard") };
}

export function lastSession(data: PerfData): SessionSummary | null {
  const valid = data.sessions.filter(s => s.n > 0);
  return valid.length ? valid[valid.length - 1] : null;
}
