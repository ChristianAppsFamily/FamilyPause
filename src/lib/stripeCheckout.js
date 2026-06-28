import { supabase } from "./supabase";
import { STRIPE_LINKS } from "./stripeLinks";

/**
 * Start Stripe Checkout for a workspace-scoped purchase.
 * Falls back to static Payment Link URLs if the edge function is unavailable.
 *
 * @param {"family"|"pro"|"digital"} product
 * @param {{ successPath?: string, cancelPath?: string }} [opts]
 */
export async function openStripeCheckout(product, { successPath, cancelPath } = {}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const successUrl = successPath ? `${origin}${successPath}` : `${origin}/app/settings?checkout=success`;
  const cancelUrl = cancelPath ? `${origin}${cancelPath}` : `${origin}/app/settings?checkout=cancel`;

  const { data, error } = await supabase.functions.invoke("stripe-checkout", {
    body: { product, successUrl, cancelUrl },
  });

  if (!error && data?.url) {
    window.location.href = data.url;
    return;
  }

  const fallbackMap = {
    family: STRIPE_LINKS.family,
    pro: STRIPE_LINKS.pro,
    digital: STRIPE_LINKS.digital || STRIPE_LINKS.cardDigital,
  };
  const fallback = fallbackMap[product];
  if (fallback) {
    console.warn("[Stripe] Checkout session unavailable — using payment link fallback", error || data?.error);
    window.location.href = fallback;
    return;
  }

  const message = data?.error || error?.message || "Checkout is unavailable. Try again or contact support.";
  throw new Error(message);
}
