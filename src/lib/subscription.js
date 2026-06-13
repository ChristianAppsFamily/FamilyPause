import { supabase } from "./supabase";

/** Create a 7-day trial subscription row for a new workspace (owner only). */
export async function ensureTrialSubscription(workspaceId) {
  if (!workspaceId) return;
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan: "free",
    active: true,
  });
}

export function trialDaysRemaining(subscription) {
  if (!subscription?.trial_ends_at) return null;
  const ms = new Date(subscription.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function isPaidPlan(subscription) {
  if (!subscription?.active) return false;
  return subscription.plan === "family" || subscription.plan === "pro";
}

export function isTrialActive(subscription) {
  if (!subscription?.trial_ends_at) return false;
  return new Date(subscription.trial_ends_at) > new Date();
}

/** Returns null if allowed, or paywall reason string. */
export function paywallReason(subscription, sessionsThisMonth = 0) {
  if (isPaidPlan(subscription)) return null;
  if (isTrialActive(subscription)) return null;
  if (sessionsThisMonth >= 1) return "limit";
  return null;
}
