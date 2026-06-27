import { supabase } from "./supabase";
import { PerfData, mergeAttempts } from "./tracker";
import { SKILL_IDS } from "./questions";

function withTimeout<T>(thenable: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

const USER_ID_KEY   = "mentalmath_user_id";
const LAST_SYNC_KEY = "mentalmath_last_sync";

export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function setSyncCode(code: string) {
  localStorage.setItem(USER_ID_KEY, code.trim().toLowerCase());
}

export function getLastSync(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

function stampSync() {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export async function pushToCloud(data: PerfData): Promise<boolean> {
  try {
    const userId = getUserId();
    if (!userId) return false;
    const result = await withTimeout(
      supabase.from("user_data").upsert({ user_id: userId, data, updated_at: new Date().toISOString() }),
      5000,
    );
    if (!result || result.error) return false;
    stampSync();
    return true;
  } catch {
    return false;
  }
}

export async function pullFromCloud(userId?: string): Promise<PerfData | null> {
  try {
    const id = userId ?? getUserId();
    if (!id) return null;
    const result = await withTimeout(
      supabase.from("user_data").select("data").eq("user_id", id).single(),
      4000,
    );
    if (!result || result.error || !result.data) return null;
    return result.data.data as PerfData;
  } catch {
    return null;
  }
}

// [Improvement #7] Merge cloud + local: deduplicate attempts by ts+elapsed key
// Dedup sessions by ts; dedup attempts by (ts:elapsed) pair per skill
export function mergeData(local: PerfData, cloud: PerfData): PerfData {
  // Merge sessions: union by ts, sorted chronologically
  const sessionMap = new Map<string, typeof local.sessions[0]>();
  for (const s of [...cloud.sessions, ...local.sessions]) {
    if (!sessionMap.has(s.ts)) sessionMap.set(s.ts, s);
  }
  const sessions = [...sessionMap.values()].sort((a, b) => a.ts.localeCompare(b.ts));

  // Merge skills: dedup attempts by ts+elapsed key
  const skills = {} as PerfData["skills"];
  for (const skillId of SKILL_IDS) {
    const localAttempts = local.skills[skillId]?.attempts ?? [];
    const cloudAttempts = cloud.skills[skillId]?.attempts ?? [];
    skills[skillId] = { attempts: mergeAttempts(localAttempts, cloudAttempts) };
  }

  return { sessions, skills };
}
