import { SkillId, SKILL_IDS, Difficulty, TARGET_TIMES } from "./questions";
import { PerfData, SkillStats, skillStats } from "./tracker";

const ALPHA = 0.55;
const BETA  = 0.45;
const NEW_SKILL_SCORE = 2.5;

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const PROMOTE_AT = 4;
const DEMOTE_AT  = 3;

const skillDifficulty: Record<SkillId, Difficulty> = Object.fromEntries(
  SKILL_IDS.map(s => [s, "medium"])
) as Record<SkillId, Difficulty>;

const streak: Record<SkillId, number> = Object.fromEntries(
  SKILL_IDS.map(s => [s, 0])
) as Record<SkillId, number>;

export function resetSessionState() {
  for (const s of SKILL_IDS) {
    skillDifficulty[s] = "medium";
    streak[s] = 0;
  }
}

export function getSkillDifficulty(skillId: SkillId): Difficulty {
  return skillDifficulty[skillId];
}

export function weaknessScore(skillId: SkillId, stats: SkillStats): number {
  if (stats.n < 5) return NEW_SKILL_SCORE;
  const acc   = stats.accuracy!;
  const avgT  = stats.avgTime!;
  const tgt   = TARGET_TIMES[skillDifficulty[skillId]];
  const ratio = Math.min(avgT / tgt, 3.0);
  return Math.max(ALPHA * (1 - acc) + BETA * Math.max(ratio - 1, 0) / 2, 0.01);
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
  return { skillId, difficulty: skillDifficulty[skillId] };
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
  // confidence 0–1: how reliable the estimate is (ramps from 0 at 10 attempts to 1 at 100)
  confidence: number;
  totalAttempts: number;
  coveredSkills: number;
}

export function optiverProjection(data: PerfData): OptiverProjection | null {
  const statsArr   = SKILL_IDS.map(s => skillStats(data, s));
  const withData   = statsArr.filter(s => s.n >= 3);
  if (!withData.length) return null;

  const totalAttempts = SKILL_IDS.reduce((sum, s) => sum + data.skills[s].attempts.length, 0);
  if (totalAttempts < 10) return null;

  // Weight by sample size so large-N skills drive the average
  const totalN   = withData.reduce((sum, s) => sum + s.n, 0);
  const avgAcc   = withData.reduce((sum, s) => sum + s.accuracy! * s.n, 0) / totalN;
  const avgSpeed = withData.reduce((sum, s) => sum + s.avgTime!  * s.n, 0) / totalN;

  // Test-condition penalties: you're 10% slower and 8% less accurate under pressure
  const testSpeed = avgSpeed * 1.10;
  const testAcc   = avgAcc   * 0.92;

  const answerable = Math.min(80, Math.floor(480 / testSpeed));
  const correct    = answerable * testAcc;
  const wrong      = answerable - correct;
  const rawScore   = Math.max(0, correct - wrong);

  // Coverage penalty: untested skills will hurt on test day
  const coverage   = withData.length / SKILL_IDS.length;

  // Confidence: 0 at 10 attempts, 1 at 100 attempts
  const confidence = Math.min(1, Math.max(0, (totalAttempts - 10) / 90));

  // Pull estimate toward zero at low confidence; full estimate at high confidence
  const projectedScore = Math.round(rawScore * coverage * (0.15 + 0.85 * confidence));

  return {
    answerable,
    projectedScore: Math.max(0, Math.min(80, projectedScore)),
    avgAcc,
    avgSpeed,
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

// Cumulative estimate after each session — drives the trajectory chart
export function sessionProjections(data: PerfData): SessionProjection[] {
  const result: SessionProjection[] = [];
  let cumN = 0, cumCorrect = 0, cumTimeSum = 0;

  for (const session of data.sessions) {
    if (session.n === 0) continue;
    cumN       += session.n;
    cumCorrect += session.correct;
    cumTimeSum += session.avgTime * session.n;
    if (cumN < 5) continue;

    const acc     = cumCorrect / cumN;
    const avgTime = cumTimeSum / cumN;
    const testAcc   = acc * 0.92;
    const testSpeed = avgTime * 1.10;
    const answerable = Math.min(80, Math.floor(480 / Math.max(testSpeed, 0.5)));
    const correct    = answerable * testAcc;
    const wrong      = answerable - correct;
    const rawScore   = Math.max(0, correct - wrong);
    const confidence = Math.min(1, Math.max(0, (cumN - 10) / 90));
    const score = Math.round(rawScore * (0.15 + 0.85 * confidence));

    result.push({ ts: session.ts, score: Math.max(0, score), cumulativeN: cumN });
  }
  return result;
}
