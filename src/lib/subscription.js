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

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  await supabase.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan: "free",
    active: true,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
  });
}

export function trialDaysRemaining(subscription) {
  if (!subscription?.trial_ends_at) return null;
  const ms = new Date(subscription.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function isPaidPlan(subscription) {
  if (!subscription?.active) return false;
  return subscription.plan === "family"
    || subscription.plan === "pro"
    || subscription.plan === "ministry";
}

export function isTrialActive(subscription) {
  if (!subscription?.active || subscription.plan !== "free" || !subscription?.trial_ends_at) return false;
  return new Date(subscription.trial_ends_at) > new Date();
}

/** Full Family Plan features are available to paid plans and active trials. */
export function hasFamilyPlanFeatures(subscription) {
  return isPaidPlan(subscription) || isTrialActive(subscription);
}

/**
 * Returns null if plan creation is allowed, or "daily" after Free uses its daily plan.
 * @param {object} subscription
 * @param {{ distillsToday?: number }} opts
 */
/**
 * Returns null if plan creation is allowed, or a paywall reason.
 * After trial expiry, distill is gated server-side (session packs → 402).
 * @param {object} subscription
 * @param {{ distillsToday?: number }} opts
 */
export function paywallReason(subscription, { distillsToday = 0 } = {}) {
  if (isPaidPlan(subscription)) return null;
  if (isTrialActive(subscription)) return null;
  // Trial expired: free daily limit no longer applies — session packs / upgrade instead.
  // Keep "daily" unused for expired; client shows SessionPackModal on 402.
  void distillsToday;
  return null;
}

/** Reason for opening the full Paywall overlay from Settings / upgrade CTAs. */
export function upgradePaywallReason(subscription) {
  if (isPaidPlan(subscription)) return "upgrade";
  if (isTrialActive(subscription)) return "upgrade";
  return "trial";
}
