import { supabase } from "./supabase";
import { STRIPE_LINKS } from "./stripeLinks";

async function readFunctionBody(data, error) {
  if (data && typeof data === "object") return data;
  const ctx = error?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try {
    return await ctx.json();
  } catch {
    return null;
  }
}

async function invokeCheckout(body) {
  const first = await supabase.functions.invoke("create-checkout-session", { body });
  const firstBody = await readFunctionBody(first.data, first.error);
  if (firstBody?.url) return { data: firstBody, error: null };

  const second = await supabase.functions.invoke("stripe-checkout", { body });
  const secondBody = await readFunctionBody(second.data, second.error);
  if (secondBody?.url) return { data: secondBody, error: null };

  return { data: secondBody || firstBody, error: second.error || first.error };
}

/**
 * Start Stripe Checkout for a workspace-scoped purchase.
 * Falls back to static Payment Link URLs if the edge function is unavailable.
 * Existing subscribers are sent to the Customer Portal instead of a second Checkout.
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

  const resolved = await invokeCheckout(body);

  if (!resolved.error && resolved.data?.url) {
    window.location.href = resolved.data.url;
    return { portal: !!resolved.data.portal };
  }

  const failData = resolved.data;
  const failError = resolved.error;

  if (failData?.already_subscribed || failData?.code === "already_subscribed") {
    throw new Error(failData.message || "You already have a Family Plan. Manage billing from Settings.");
  }

  if (product === "digital_offer" || String(product).startsWith("pack_")) {
    const message = failData?.error || failData?.message || failError?.message || "This offer is no longer available.";
    throw new Error(message);
  }

  if (product === "family_monthly") {
    const monthly = STRIPE_LINKS.familyMonthly;
    if (monthly) {
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
    window.location.href = fallback;
    return;
  }

  const message = failData?.error || failData?.message || failError?.message || "Checkout is unavailable. Try again or contact support.";
  throw new Error(message);
}

/** Open Stripe Customer Portal for an existing subscriber. */
export async function openBillingPortal(returnPath = "/app/settings?billing=updated") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { action: "portal", successUrl: `${origin}${returnPath}` },
  });
  const body = await readFunctionBody(data, error);
  if (body?.url) {
    window.location.href = body.url;
    return;
  }
  const fallback = await supabase.functions.invoke("stripe-checkout", {
    body: { action: "portal", successUrl: `${origin}${returnPath}` },
  });
  const fallbackBody = await readFunctionBody(fallback.data, fallback.error);
  if (fallbackBody?.url) {
    window.location.href = fallbackBody.url;
    return;
  }
  throw new Error(
    fallbackBody?.message || fallbackBody?.error || "Could not open billing. Try again.",
  );
}
