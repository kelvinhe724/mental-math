import { supabase } from "./supabase";
import { PerfData } from "./tracker";

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
    const { error } = await supabase
      .from("user_data")
      .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
    if (!error) stampSync();
    return !error;
  } catch {
    return false;
  }
}

export async function pullFromCloud(userId?: string): Promise<PerfData | null> {
  try {
    const id = userId ?? getUserId();
    if (!id) return null;
    const { data, error } = await supabase
      .from("user_data")
      .select("data")
      .eq("user_id", id)
      .single();
    if (error || !data) return null;
    return data.data as PerfData;
  } catch {
    return null;
  }
}

// Merge cloud + local: keep whichever has more attempts per skill
export function mergeData(local: PerfData, cloud: PerfData): PerfData {
  const merged: PerfData = {
    sessions: [...cloud.sessions],
    skills:   { ...cloud.skills },
  };

  // Add any local sessions not in cloud (by ts)
  const cloudTs = new Set(cloud.sessions.map(s => s.ts));
  for (const s of local.sessions) {
    if (!cloudTs.has(s.ts)) merged.sessions.push(s);
  }
  merged.sessions.sort((a, b) => a.ts.localeCompare(b.ts));

  // For each skill, keep whichever side has more attempts
  for (const skillId of Object.keys(local.skills) as (keyof typeof local.skills)[]) {
    const localAttempts = local.skills[skillId]?.attempts ?? [];
    const cloudAttempts = merged.skills[skillId]?.attempts ?? [];
    if (localAttempts.length > cloudAttempts.length) {
      merged.skills[skillId] = local.skills[skillId];
    }
  }
  return merged;
}
