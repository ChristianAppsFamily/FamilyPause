import { supabase } from "./supabase";
import { STRIPE_LINKS } from "./stripeLinks";

/**
 * Start Stripe Checkout for a workspace-scoped purchase.
 * Falls back to static Payment Link URLs if the edge function is unavailable.
 *
 * @param {"family"|"family_monthly"|"pro"|"digital"|"digital_offer"} product
 * @param {{ successPath?: string, cancelPath?: string, parentSessionId?: string }} [opts]
 */
export async function openStripeCheckout(product, { successPath, cancelPath, parentSessionId } = {}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  let successUrl;
  if (successPath) {
    successUrl = `${origin}${successPath}`;
  } else if (product === "family" || product === "family_monthly" || product === "pro") {
    successUrl = `${origin}/app/subscribe/success?session_id={CHECKOUT_SESSION_ID}`;
  } else {
    successUrl = `${origin}/app/settings?checkout=success`;
  }

  const cancelUrl = cancelPath
    ? `${origin}${cancelPath}`
    : `${origin}/app/settings?checkout=cancel`;

  // Edge function currently handles family / pro / digital / digital_offer (price IDs).
  // Monthly uses the Payment Link until STRIPE_PRICE_FAMILY_MONTHLY is wired server-side.
  const edgeProduct = product === "family_monthly" ? null : product;

  if (edgeProduct) {
    const body = { product: edgeProduct, successUrl, cancelUrl };
    if (product === "digital_offer" && parentSessionId) {
      body.parentSessionId = parentSessionId;
    }

    const { data, error } = await supabase.functions.invoke("stripe-checkout", { body });

    if (!error && data?.url) {
      window.location.href = data.url;
      return;
    }

    if (product === "digital_offer") {
      const message = data?.error || error?.message || "This offer is no longer available.";
      throw new Error(message);
    }

    const fallbackMap = {
      family: STRIPE_LINKS.familyAnnual || STRIPE_LINKS.family,
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

  const monthly = STRIPE_LINKS.familyMonthly;
  if (monthly) {
    window.location.href = monthly;
    return;
  }

  throw new Error("Monthly checkout is unavailable. Try again or contact support.");
}
