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
  avgTime: number;
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

const STORAGE_KEY = "mentalmath_perf_v1";

function emptySkill(): SkillData {
  return { attempts: [] };
}

export function loadData(): PerfData {
  if (typeof window === "undefined") {
    return { sessions: [], skills: Object.fromEntries(SKILL_IDS.map(s => [s, emptySkill()])) as Record<SkillId, SkillData> };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const data = JSON.parse(raw) as PerfData;
    for (const s of SKILL_IDS) {
      if (!data.skills[s]) data.skills[s] = emptySkill();
    }
    return data;
  } catch {
    return {
      sessions: [],
      skills: Object.fromEntries(SKILL_IDS.map(s => [s, emptySkill()])) as Record<SkillId, SkillData>,
    };
  }
}

export function saveData(data: PerfData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordAttempt(data: PerfData, skillId: SkillId, correct: boolean, elapsed: number, difficulty: Difficulty) {
  data.skills[skillId].attempts.push({
    ts: new Date().toISOString(),
    correct,
    elapsed: Math.round(elapsed * 100) / 100,
    difficulty,
  });
}

export function recordSession(data: PerfData, summary: Omit<SessionSummary, "ts">) {
  data.sessions.push({ ...summary, ts: new Date().toISOString() });
}

export function skillStats(data: PerfData, skillId: SkillId, lastN = 20): SkillStats {
  const attempts = data.skills[skillId].attempts.slice(-lastN);
  if (!attempts.length) return { accuracy: null, avgTime: null, n: 0 };
  const correct = attempts.filter(a => a.correct).length;
  const times = attempts.map(a => a.elapsed);
  return {
    accuracy: correct / attempts.length,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    n: attempts.length,
  };
}

export function allSkillStats(data: PerfData, lastN = 20): Record<SkillId, SkillStats> {
  return Object.fromEntries(SKILL_IDS.map(s => [s, skillStats(data, s, lastN)])) as Record<SkillId, SkillStats>;
}

export function totalQuestions(data: PerfData): number {
  return SKILL_IDS.reduce((sum, s) => sum + data.skills[s].attempts.length, 0);
}

export function deleteSession(data: PerfData, index: number): boolean {
  const sessions = data.sessions;
  if (index < 0 || index >= sessions.length) return false;
  const tEnd = sessions[index].ts;
  const tStart = index > 0 ? sessions[index - 1].ts : "1970-01-01T00:00:00";
  for (const skillId of SKILL_IDS) {
    data.skills[skillId].attempts = data.skills[skillId].attempts.filter(
      a => !(a.ts > tStart && a.ts <= tEnd)
    );
  }
  sessions.splice(index, 1);
  return true;
}

export function resetAllData(): PerfData {
  const fresh: PerfData = {
    sessions: [],
    skills: Object.fromEntries(SKILL_IDS.map(s => [s, emptySkill()])) as Record<SkillId, SkillData>,
  };
  saveData(fresh);
  return fresh;
}
