import { supabase } from "./supabase";

/** Sentinel row for lifetime free-session counts (older weekly rows still sum in). */
export const LIFETIME_USAGE_DATE = "1970-01-01";

export const FREE_SESSION_BUILDS = 5;

export async function loadFreeSessionCount(workspaceId) {
  if (!workspaceId) return 0;
  const { data } = await supabase
    .from("ai_distill_usage")
    .select("count")
    .eq("workspace_id", workspaceId);
  return (data || []).reduce((sum, row) => sum + (row.count || 0), 0);
}

/** @deprecated use loadFreeSessionCount */
export async function loadDistillsThisWeek(workspaceId) {
  return loadFreeSessionCount(workspaceId);
}
