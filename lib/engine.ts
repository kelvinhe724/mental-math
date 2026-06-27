import { SkillId, SKILL_IDS, Difficulty, TARGET_TIMES } from "./questions";
import { PerfData, SkillStats, skillStats } from "./tracker";

const ALPHA = 0.50;
const BETA  = 0.50;
const NEW_SKILL_SCORE = 2.5;

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const PROMOTE_AT = 4;
const DEMOTE_AT  = 3;

// [Improvement #1] Per-skill difficulty that persists via history-seeding
const skillDifficulty: Record<SkillId, Difficulty> = Object.fromEntries(
  SKILL_IDS.map(s => [s, "medium"])
) as Record<SkillId, Difficulty>;

const streak: Record<SkillId, number> = Object.fromEntries(
  SKILL_IDS.map(s => [s, 0])
) as Record<SkillId, number>;

// [Improvement #3] Warm-up: first encounter of each skill this session starts easy
const seenThisSession = new Set<SkillId>();

export function resetSessionState(data?: PerfData) {
  seenThisSession.clear();
  for (const s of SKILL_IDS) {
    streak[s] = 0;
    // [Improvement #1] Seed difficulty from history to avoid cold-start mismatch
    if (data) {
      const st = skillStats(data, s);
      if (st.n < 3) {
        skillDifficulty[s] = "easy";
      } else if (st.accuracy !== null && st.accuracy >= 0.90 && st.avgTime !== null && st.avgTime <= TARGET_TIMES.medium) {
        skillDifficulty[s] = "hard";
      } else if (st.accuracy !== null && st.accuracy >= 0.80) {
        skillDifficulty[s] = "medium";
      } else {
        skillDifficulty[s] = "easy";
      }
    } else {
      skillDifficulty[s] = "medium";
    }
  }
}

export function getSkillDifficulty(skillId: SkillId): Difficulty {
  return skillDifficulty[skillId];
}

// [Improvement #6] Weakness score = opportunity cost: combines inaccuracy × time penalty
// Higher = more worth drilling
export function weaknessScore(skillId: SkillId, stats: SkillStats): number {
  if (stats.n < 5) return NEW_SKILL_SCORE;
  const acc   = stats.accuracy!;
  const avgT  = stats.avgTime!;
  const tgt   = TARGET_TIMES[skillDifficulty[skillId]];
  const timeRatio = Math.min(avgT / tgt, 3.0);
  // [Improvement #4] Time-weighted accuracy: slow correct answers still hurt your score
  const timePenalty = Math.max(timeRatio - 1, 0) / 2;
  // Opportunity cost = inaccuracy + slowness, weighted equally
  return Math.max(ALPHA * (1 - acc) + BETA * timePenalty, 0.01);
}

function softmaxSample(scores: Record<SkillId, number>): SkillId {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [skill, score] of Object.entries(scores) as [SkillId, number][]) {
    r -= score;
    if (r <= 0) return skill;
  }
  return SKILL_IDS[SKILL_IDS.length - 1];
}

export function pickNext(data: PerfData): { skillId: SkillId; difficulty: Difficulty } {
  const scores = Object.fromEntries(
    SKILL_IDS.map(s => [s, weaknessScore(s, skillStats(data, s))])
  ) as Record<SkillId, number>;
  const skillId = softmaxSample(scores);

  // [Improvement #3] Warm-up: force easy on first encounter of each skill per session
  let difficulty = skillDifficulty[skillId];
  if (!seenThisSession.has(skillId)) {
    seenThisSession.add(skillId);
    difficulty = "easy";
  }

  return { skillId, difficulty };
}

export function updateDifficulty(skillId: SkillId, correct: boolean, elapsed: number) {
  const tgt = TARGET_TIMES[skillDifficulty[skillId]];
  const fast = elapsed <= tgt * 1.2;
  if (correct && fast) streak[skillId] = Math.max(streak[skillId], 0) + 1;
  else                  streak[skillId] = Math.min(streak[skillId], 0) - 1;

  const idx = DIFFICULTIES.indexOf(skillDifficulty[skillId]);
  if (streak[skillId] >= PROMOTE_AT && idx < 2) {
    skillDifficulty[skillId] = DIFFICULTIES[idx + 1];
    streak[skillId] = 0;
  }
  if (streak[skillId] <= -DEMOTE_AT && idx > 0) {
    skillDifficulty[skillId] = DIFFICULTIES[idx - 1];
    streak[skillId] = 0;
  }
}

export interface RankedSkill {
  skillId: SkillId;
  score: number;
  stats: SkillStats;
}

// [Improvement #6] Rank by opportunity cost = (1 − acc) × avgTime (more = more worth drilling)
export function getWeaknessRanking(data: PerfData): RankedSkill[] {
  return SKILL_IDS
    .map(s => ({ skillId: s, score: weaknessScore(s, skillStats(data, s)), stats: skillStats(data, s) }))
    .sort((a, b) => b.score - a.score);
}

export interface OptiverProjection {
  answerable: number;
  projectedScore: number;
  avgAcc: number;
  avgSpeed: number;
  confidence: number;
  totalAttempts: number;
  coveredSkills: number;
}

// [Improvement fixed] Score formula: honest estimate without aggressive confidence crushing.
// Uncovered skills are blended with conservative assumptions (72% acc, 5.5s) rather than zeroed.
// Confidence penalty is light: 0.70 at 10 attempts → 1.0 at 80+ attempts.
export function optiverProjection(data: PerfData): OptiverProjection | null {
  const statsArr = SKILL_IDS.map(s => skillStats(data, s));
  const withData = statsArr.filter(s => s.n >= 3);
  if (!withData.length) return null;

  const totalAttempts = SKILL_IDS.reduce((sum, s) => sum + data.skills[s].attempts.length, 0);
  if (totalAttempts < 10) return null;

  // Weight by sample size
  const totalN = withData.reduce((sum, s) => sum + s.n, 0);
  const coveredAcc   = withData.reduce((sum, s) => sum + s.accuracy! * s.n, 0) / totalN;
  const coveredSpeed = withData.reduce((sum, s) => sum + s.avgTime!  * s.n, 0) / totalN;

  // Blend uncovered skills with conservative assumption (not zero — zeroing kills the estimate)
  const uncovered = SKILL_IDS.length - withData.length;
  const ASSUMED_ACC   = 0.72;
  const ASSUMED_SPEED = 5.5;
  const blendW = Math.max(5, totalN / withData.length); // effective N per uncovered skill

  const blendedAcc   = (coveredAcc   * totalN + ASSUMED_ACC   * uncovered * blendW) / (totalN + uncovered * blendW);
  const blendedSpeed = (coveredSpeed * totalN + ASSUMED_SPEED * uncovered * blendW) / (totalN + uncovered * blendW);

  // Test-condition penalties: 10% slower, 8% less accurate under pressure
  const testSpeed = blendedSpeed * 1.10;
  const testAcc   = blendedAcc   * 0.92;

  const answerable = Math.min(80, Math.floor(480 / Math.max(testSpeed, 0.5)));
  const correct    = answerable * testAcc;
  const wrong      = answerable - correct;
  const rawScore   = Math.max(0, correct - wrong);

  // [Fixed] Light confidence multiplier: 0.70 → 1.0 as attempts grow (not 0.15 → 1.0)
  const confidence = Math.min(1, Math.max(0, (totalAttempts - 10) / 70));
  const projectedScore = Math.round(rawScore * (0.70 + 0.30 * confidence));

  return {
    answerable,
    projectedScore: Math.max(0, Math.min(80, projectedScore)),
    avgAcc:   coveredAcc,   // show actual tested acc, not blended
    avgSpeed: coveredSpeed, // show actual tested speed
    confidence,
    totalAttempts,
    coveredSkills: withData.length,
  };
}

export interface SessionProjection {
  ts: string;
  score: number;
  cumulativeN: number;
}

export function sessionProjections(data: PerfData): SessionProjection[] {
  const result: SessionProjection[] = [];
  let cumN = 0, cumCorrect = 0, cumTimeSum = 0;

  for (const session of data.sessions) {
    if (session.n === 0) continue;
    cumN       += session.n;
    cumCorrect += session.correct;
    cumTimeSum += session.avgTime * session.n;
    if (cumN < 5) continue;

    const acc      = cumCorrect / cumN;
    const avgTime  = cumTimeSum / cumN;
    const testAcc   = acc * 0.92;
    const testSpeed = avgTime * 1.10;
    const answerable = Math.min(80, Math.floor(480 / Math.max(testSpeed, 0.5)));
    const correct    = answerable * testAcc;
    const wrong      = answerable - correct;
    const rawScore   = Math.max(0, correct - wrong);
    const confidence = Math.min(1, Math.max(0, (cumN - 10) / 70));
    const score = Math.round(rawScore * (0.70 + 0.30 * confidence));

    result.push({ ts: session.ts, score: Math.max(0, score), cumulativeN: cumN });
  }
  return result;
}
