import { supabase } from "./supabase";

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Pacific calendar date as YYYY-MM-DD. */
export function localUsageDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Sunday of the current Pacific planning week as YYYY-MM-DD. */
export function localUsageWeekStart(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const dayIndex = WEEKDAY_INDEX[get("weekday")] ?? 0;
  const sunday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0) - dayIndex * 86400000);
  const y = sunday.getUTCFullYear();
  const m = String(sunday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function loadDistillsThisWeek(workspaceId) {
  if (!workspaceId) return 0;
  const usageDate = localUsageWeekStart();
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
  const usageDate = localUsageWeekStart();
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
