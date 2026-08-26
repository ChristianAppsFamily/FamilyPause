import { supabase } from "./supabase";
import { FREE_SESSION_BUILDS } from "./distillUsage";

export { FREE_SESSION_BUILDS };

/**
 * Entitlements (server row is source of truth; never grant paid access from a success URL):
 * - subscribed: plan is family | pro | ministry AND active
 * - trialing: plan is free AND trial_ends_at is in the future AND active
 * - past_due / unpaid: still treated as subscribed until Stripe sends subscription.deleted
 * - canceled / incomplete / paused: plan free (webhook clears stripe_sub_id)
 */

export const SUBSCRIPTION_SELECT = "*";

/** Load the workspace subscription row from Supabase. */
export async function fetchWorkspaceSubscription(workspaceId) {
  if (!workspaceId) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Poll until the webhook has written a paid plan, or time out.
 * Used after Checkout — do not treat the success URL as entitlement.
 */
export async function pollUntilPaid(workspaceId, { timeoutMs = 18000, intervalMs = 1200 } = {}) {
  const started = Date.now();
  let subscription = await fetchWorkspaceSubscription(workspaceId);
  if (isPaidPlan(subscription)) return { subscription, verified: true };
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    subscription = await fetchWorkspaceSubscription(workspaceId);
    if (isPaidPlan(subscription)) return { subscription, verified: true };
  }
  return { subscription, verified: false };
}

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

/**
 * Full Family Plan features: paid, or still inside the 5 free new sessions.
 * Recapture of an in-progress free session keeps features even after the 5th distill.
 */
export function hasFamilyPlanFeatures(subscription, { freeSessionsUsed = 0, sessionInProgress = false } = {}) {
  if (isPaidPlan(subscription)) return true;
  if (freeSessionsUsed < FREE_SESSION_BUILDS) return true;
  return sessionInProgress && freeSessionsUsed <= FREE_SESSION_BUILDS;
}

/**
 * Returns null if a new Build is allowed.
 * Recapture (same session) is never blocked — only a 6th new session is.
 * @param {object} subscription
 * @param {{ freeSessionsUsed?: number, sessionInProgress?: boolean, distillsThisWeek?: number }} opts
 */
export function paywallReason(subscription, { freeSessionsUsed, sessionInProgress = false, distillsThisWeek } = {}) {
  if (isPaidPlan(subscription)) return null;
  if (sessionInProgress) return null;
  const used = freeSessionsUsed ?? distillsThisWeek ?? 0;
  if (used >= FREE_SESSION_BUILDS) return "sessions";
  return null;
}

/** Reason for opening the full Paywall overlay from Settings / upgrade CTAs. */
export function upgradePaywallReason(subscription, { freeSessionsUsed = 0 } = {}) {
  if (isPaidPlan(subscription)) return "upgrade";
  if (freeSessionsUsed >= FREE_SESSION_BUILDS) return "sessions";
  return "upgrade";
}
