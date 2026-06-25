import { SkillId, SKILL_IDS, Difficulty, TARGET_TIMES } from "./questions";
import { PerfData, SkillStats, skillStats } from "./tracker";

const ALPHA = 0.55;
const BETA  = 0.45;
const NEW_SKILL_SCORE = 2.5;

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const PROMOTE_AT = 4;
const DEMOTE_AT  = 3;

// In-memory session state
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
}

export function optiverProjection(data: PerfData): OptiverProjection | null {
  const statsArr = SKILL_IDS.map(s => skillStats(data, s)).filter(s => s.n >= 3);
  if (!statsArr.length) return null;
  const avgAcc   = statsArr.reduce((a, s) => a + s.accuracy!, 0) / statsArr.length;
  const avgSpeed = statsArr.reduce((a, s) => a + s.avgTime!, 0)  / statsArr.length;
  const answerable     = Math.min(80, Math.floor(480 / avgSpeed));
  const correct        = Math.round(answerable * avgAcc);
  const wrong          = answerable - correct;
  return { answerable, projectedScore: correct - wrong, avgAcc, avgSpeed };
}
