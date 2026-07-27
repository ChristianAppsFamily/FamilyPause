import { supabase } from "./supabase";
import { STRIPE_LINKS } from "./stripeLinks";

/**
 * Start Stripe Checkout for a workspace-scoped purchase.
 * Falls back to static Payment Link URLs if the edge function is unavailable.
 *
 * @param {"family"|"family_monthly"|"pro"|"digital"|"digital_offer"|"pack_1"|"pack_3"|"pack_5"} product
 * @param {{ successPath?: string, cancelPath?: string, parentSessionId?: string, includeTrialDeckOffer?: boolean }} [opts]
 */
export async function openStripeCheckout(product, {
  successPath,
  cancelPath,
  parentSessionId,
  includeTrialDeckOffer,
} = {}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  let successUrl;
  if (successPath) {
    successUrl = `${origin}${successPath}`;
  } else if (product === "family" || product === "family_monthly" || product === "pro") {
    successUrl = `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`;
  } else if (String(product).startsWith("pack_")) {
    successUrl = `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&pack=1`;
  } else {
    successUrl = `${origin}/app/settings?checkout=success`;
  }

  const cancelUrl = cancelPath
    ? `${origin}${cancelPath}`
    : `${origin}/subscribe/cancel`;

  const body = { product, successUrl, cancelUrl };
  if (product === "digital_offer" && parentSessionId) {
    body.parentSessionId = parentSessionId;
  }
  if (includeTrialDeckOffer) {
    body.includeTrialDeckOffer = true;
  }

  const { data, error } = await supabase.functions.invoke("create-checkout-session", { body });

  // Fallback to legacy function name during rollout
  let resolved = { data, error };
  if (error || !data?.url) {
    resolved = await supabase.functions.invoke("stripe-checkout", { body });
  }

  if (!resolved.error && resolved.data?.url) {
    window.location.href = resolved.data.url;
    return;
  }

  const failData = resolved.data;
  const failError = resolved.error;

  if (product === "digital_offer" || String(product).startsWith("pack_")) {
    const message = failData?.error || failError?.message || "This offer is no longer available.";
    throw new Error(message);
  }

  if (product === "family_monthly") {
    const monthly = STRIPE_LINKS.familyMonthly;
    if (monthly) {
      console.warn("[Stripe] Monthly checkout session unavailable — using payment link fallback", failError || failData?.error);
      window.location.href = monthly;
      return;
    }
  }

  const fallbackMap = {
    family: STRIPE_LINKS.familyAnnual || STRIPE_LINKS.family,
    pro: STRIPE_LINKS.pro,
    digital: STRIPE_LINKS.digital || STRIPE_LINKS.cardDigital,
  };
  const fallback = fallbackMap[product];
  if (fallback) {
    console.warn("[Stripe] Checkout session unavailable — using payment link fallback", failError || failData?.error);
    window.location.href = fallback;
    return;
  }

  const message = failData?.error || failError?.message || "Checkout is unavailable. Try again or contact support.";
  throw new Error(message);
}
