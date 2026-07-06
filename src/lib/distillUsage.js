import { supabase } from "./supabase";

/** Local calendar date as YYYY-MM-DD (workspace timezone = browser). */
export function localUsageDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function loadDistillsToday(workspaceId) {
  if (!workspaceId) return 0;
  const usageDate = localUsageDate();
  const { data } = await supabase
    .from("ai_distill_usage")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("usage_date", usageDate)
    .maybeSingle();
  return data?.count ?? 0;
}

export async function recordDistillUsage(workspaceId) {
  if (!workspaceId) return;
  const usageDate = localUsageDate();
  const { data: existing } = await supabase
    .from("ai_distill_usage")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("ai_distill_usage")
      .update({ count: (existing.count ?? 0) + 1 })
      .eq("workspace_id", workspaceId)
      .eq("usage_date", usageDate);
  } else {
    await supabase.from("ai_distill_usage").insert({
      workspace_id: workspaceId,
      usage_date: usageDate,
      count: 1,
    });
  }
}
