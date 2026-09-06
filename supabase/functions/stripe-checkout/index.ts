// Creates a Stripe Checkout Session with workspace_id in metadata.
// Also verifies / creates the post-subscribe digital deck offer ($4.97, 24h).
// Deploy: supabase functions deploy stripe-checkout
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_FAMILY, STRIPE_PRICE_PRO,
//          STRIPE_PRICE_DIGITAL, optional STRIPE_PRICE_DIGITAL_OFFER

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Product =
  | "family"
  | "family_monthly"
  | "pro"
  | "digital"
  | "digital_offer"
  | "pack_1"
  | "pack_3"
  | "pack_5";

const PRODUCT_PRICES: Record<"family" | "family_monthly" | "pro" | "digital", string> = {
  family: "STRIPE_PRICE_FAMILY",
  family_monthly: "STRIPE_PRICE_FAMILY_MONTHLY",
  pro: "STRIPE_PRICE_PRO",
  digital: "STRIPE_PRICE_DIGITAL",
};

const PACK_PRICES: Record<"pack_1" | "pack_3" | "pack_5", { env: string; sessions: number; fallbackCents: number; name: string }> = {
  pack_1: { env: "STRIPE_PACK_1_PRICE_ID", sessions: 1, fallbackCents: 199, name: "1 Session Pack" },
  pack_3: { env: "STRIPE_PACK_3_PRICE_ID", sessions: 3, fallbackCents: 299, name: "3 Session Pack" },
  pack_5: { env: "STRIPE_PACK_5_PRICE_ID", sessions: 5, fallbackCents: 499, name: "5 Session Pack" },
};

function parseConfigCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getSubscriberCount(admin: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "subscriber_count")
    .maybeSingle();
  return parseConfigCount(data?.value);
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function resolveWorkspaceId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);
  if (!members?.length) return null;
  const owner = members.find((m: { role: string }) => m.role === "owner");
  return owner?.workspace_id ?? members[0].workspace_id;
}

async function verifyParentSession(
  stripe: Stripe,
  parentSessionId: string,
  workspaceId: string,
) {
  const session = await stripe.checkout.sessions.retrieve(parentSessionId);
  if (session.status !== "complete" && session.payment_status !== "paid") {
    return { ok: false as const, reason: "not_complete" };
  }
  if (session.mode !== "subscription") {
    return { ok: false as const, reason: "not_subscription" };
  }
  const sessionWs = session.metadata?.workspace_id || session.client_reference_id;
  if (!sessionWs || sessionWs !== workspaceId) {
    return { ok: false as const, reason: "workspace_mismatch" };
  }
  const created = session.created ? session.created * 1000 : 0;
  const ageMs = Date.now() - created;
  if (ageMs > 24 * 60 * 60 * 1000) {
    return { ok: false as const, reason: "expired" };
  }
  const product = session.metadata?.product;
  if (product && product !== "family" && product !== "pro") {
    return { ok: false as const, reason: "wrong_product" };
  }
  return { ok: true as const, session };
}

function appOriginFromUrl(successUrl?: string): string {
  try {
    if (successUrl) return new URL(successUrl).origin;
  } catch { /* ignore */ }
  return "https://familypause.com";
}

async function billingPortalUrl(
  stripe: Stripe,
  customerId: string | null,
  subscriptionId: string | null,
  returnUrl: string,
): Promise<string | null> {
  let customer = customerId;
  if (!customer && subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    } catch {
      return null;
    }
  }
  if (!customer) return null;
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: returnUrl,
    });
    return portal.url ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as {
      product?: Product;
      successUrl?: string;
      cancelUrl?: string;
      parentSessionId?: string;
      action?: string;
      /** When true on family checkout and subscriber_count >= 100, add half-off deck line item. */
      includeTrialDeckOffer?: boolean;
    };

    const workspaceId = await resolveWorkspaceId(supabase, user.id);
    if (!workspaceId) return json({ error: "No workspace found for this account" }, 400);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const admin = adminClient();

    if (body.action === "portal") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_customer_id, stripe_sub_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!sub?.stripe_customer_id && !sub?.stripe_sub_id) {
        return json({ error: "No billing account yet", code: "no_customer" }, 400);
      }
      const origin = appOriginFromUrl(body.successUrl);
      const url = await billingPortalUrl(
        stripe,
        sub.stripe_customer_id,
        sub.stripe_sub_id,
        body.successUrl || `${origin}/app/settings?billing=updated`,
      );
      if (!url) return json({ error: "Could not open billing portal", code: "portal_failed" }, 502);
      return json({ url, portal: true });
    }

    // Immediate cancel when deleting a workspace so billing stops.
    if (body.action === "cancel_subscription") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_sub_id, id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!sub?.stripe_sub_id) {
        return json({ ok: true, canceled: false, reason: "no_subscription" });
      }
      try {
        await stripe.subscriptions.cancel(sub.stripe_sub_id);
      } catch (err) {
        const msg = err?.message || String(err);
        // Already canceled / missing — treat as success so delete can proceed.
        if (/No such subscription|already been canceled|resource_missing/i.test(msg)) {
          await admin.from("subscriptions").update({
            active: false,
            stripe_sub_id: null,
            updated_at: new Date().toISOString(),
          }).eq("id", sub.id);
          return json({ ok: true, canceled: true, reason: "already_canceled" });
        }
        console.error("[stripe-checkout] cancel_subscription", err);
        return json({ error: "Could not cancel subscription. Try again or manage billing first.", code: "cancel_failed" }, 502);
      }
      await admin.from("subscriptions").update({
        active: false,
        stripe_sub_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
      return json({ ok: true, canceled: true });
    }

    // ── Verify post-subscribe deck offer eligibility ───────────────────────
    if (body.action === "verify_deck_offer") {
      const parentSessionId = body.parentSessionId?.trim();
      if (!parentSessionId) return json({ eligible: false, reason: "missing_session" });

      const { data: ws } = await admin
        .from("workspaces")
        .select("cards_unlocked")
        .eq("id", workspaceId)
        .single();
      if (ws?.cards_unlocked) {
        return json({ eligible: false, reason: "already_unlocked", cardsUnlocked: true });
      }

      const verified = await verifyParentSession(stripe, parentSessionId, workspaceId);
      if (!verified.ok) return json({ eligible: false, reason: verified.reason });

      const { data: existing } = await admin
        .from("deck_offer_claims")
        .select("id, redeemed_at, expires_at")
        .eq("parent_session_id", parentSessionId)
        .maybeSingle();

      if (existing?.redeemed_at) {
        return json({ eligible: false, reason: "already_redeemed" });
      }

      const expiresAt = new Date(verified.session.created * 1000 + 24 * 60 * 60 * 1000).toISOString();
      if (existing && new Date(existing.expires_at).getTime() < Date.now()) {
        return json({ eligible: false, reason: "expired" });
      }

      if (!existing) {
        const { error: claimErr } = await admin.from("deck_offer_claims").insert({
          workspace_id: workspaceId,
          parent_session_id: parentSessionId,
          expires_at: expiresAt,
        });
        if (claimErr && claimErr.code !== "23505") {
          console.error("[stripe-checkout] claim insert", claimErr);
          return json({ error: "Could not reserve offer" }, 500);
        }
      }

      return json({ eligible: true, expiresAt, cardsUnlocked: false });
    }

    const { product, successUrl, cancelUrl, parentSessionId, includeTrialDeckOffer } = body;

    const allowed = [
      "family", "family_monthly", "pro", "digital", "digital_offer",
      "pack_1", "pack_3", "pack_5",
    ];
    if (!product || !allowed.includes(product)) {
      return json({ error: "Invalid product" }, 400);
    }

    const origin = successUrl ? new URL(successUrl).origin : "https://familypause.com";
    const isSubscription = product === "family" || product === "family_monthly" || product === "pro";
    const isPack = product === "pack_1" || product === "pack_3" || product === "pack_5";

    if (isSubscription) {
      const { data: existingSub } = await admin
        .from("subscriptions")
        .select("plan, active, stripe_sub_id, stripe_customer_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (existingSub?.stripe_sub_id) {
        const url = await billingPortalUrl(
          stripe,
          existingSub.stripe_customer_id,
          existingSub.stripe_sub_id,
          `${origin}/app/settings?billing=updated`,
        );
        if (url) {
          return json({
            url,
            portal: true,
            already_subscribed: true,
            code: "already_subscribed",
            message: "You already have a Family Plan. Manage billing from Settings.",
          });
        }
        return json({
          error: "You already have a Family Plan. Manage billing from Settings.",
          code: "already_subscribed",
        }, 409);
      }
    }

    const defaultSuccess = isSubscription
      ? `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`
      : isPack
        ? `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&pack=1`
        : `${origin}/app/settings?checkout=success`;
    const resolvedSuccess = successUrl || defaultSuccess;
    const resolvedCancel = cancelUrl || `${origin}/subscribe/cancel`;

    const metadata: Record<string, string> = {
      workspace_id: workspaceId,
      product: product === "family_monthly" ? "family" : product,
      user_id: user.id,
      billing_period: product === "family_monthly" ? "monthly" : product === "family" ? "annual" : "",
    };

    let sessionParams: Stripe.Checkout.SessionCreateParams;

    if (isPack) {
      const pack = PACK_PRICES[product];
      metadata.sessions_to_add = String(pack.sessions);
      metadata.product = product;
      const priceId = Deno.env.get(pack.env);
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
        ? [{ price: priceId, quantity: 1 }]
        : [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.fallbackCents,
            product_data: { name: pack.name, description: "FamilyPause à la carte sessions" },
          },
        }];

      sessionParams = {
        mode: "payment",
        line_items: lineItems,
        success_url: resolvedSuccess.includes("{CHECKOUT_SESSION_ID}")
          ? resolvedSuccess
          : `${resolvedSuccess}${resolvedSuccess.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: resolvedCancel,
        client_reference_id: workspaceId,
        metadata,
        customer_email: user.email ?? undefined,
      };
    } else if (product === "digital_offer") {
      const parentId = parentSessionId?.trim();
      if (!parentId) return json({ error: "parentSessionId required" }, 400);

      const { data: ws } = await admin
        .from("workspaces")
        .select("cards_unlocked")
        .eq("id", workspaceId)
        .single();
      if (ws?.cards_unlocked) return json({ error: "Deck already unlocked" }, 400);

      const verified = await verifyParentSession(stripe, parentId, workspaceId);
      if (!verified.ok) return json({ error: "Offer not available", reason: verified.reason }, 400);

      const { data: claim } = await admin
        .from("deck_offer_claims")
        .select("id, redeemed_at, expires_at")
        .eq("parent_session_id", parentId)
        .maybeSingle();

      if (claim?.redeemed_at) return json({ error: "Offer already redeemed" }, 400);
      if (claim && new Date(claim.expires_at).getTime() < Date.now()) {
        return json({ error: "Offer expired" }, 400);
      }

      if (!claim) {
        const expiresAt = new Date(verified.session.created * 1000 + 24 * 60 * 60 * 1000).toISOString();
        await admin.from("deck_offer_claims").insert({
          workspace_id: workspaceId,
          parent_session_id: parentId,
          expires_at: expiresAt,
        });
      }

      metadata.parent_session_id = parentId;
      metadata.deck_year = String(new Date().getFullYear());

      const offerPriceId = Deno.env.get("STRIPE_PRICE_DIGITAL_OFFER");
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = offerPriceId
        ? [{ price: offerPriceId, quantity: 1 }]
        : [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 497,
            product_data: {
              name: "FamilyPause 2026 Digital Card Deck",
              description: "Today-only subscribe bump · 50% off",
            },
          },
        }];

      sessionParams = {
        mode: "payment",
        line_items: lineItems,
        success_url: resolvedSuccess,
        cancel_url: resolvedCancel,
        client_reference_id: workspaceId,
        metadata,
        customer_email: user.email ?? undefined,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // Stripe max for open sessions ~24h; 1h is fine
      };
    } else {
      const priceEnv = PRODUCT_PRICES[product as "family" | "family_monthly" | "pro" | "digital"];
      const priceId = Deno.env.get(priceEnv);
      if (!priceId) return json({ error: `${priceEnv} not configured` }, 500);

      sessionParams = {
        mode: product === "digital" ? "payment" : "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: resolvedSuccess.includes("{CHECKOUT_SESSION_ID}")
          ? resolvedSuccess
          : (isSubscription)
            ? `${resolvedSuccess}${resolvedSuccess.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`
            : resolvedSuccess,
        cancel_url: resolvedCancel,
        client_reference_id: workspaceId,
        metadata,
        customer_email: user.email ?? undefined,
      };

      if (product !== "digital") {
        sessionParams.subscription_data = { metadata };
      }

      // Founding members: auto-apply FOUNDING30 while under 100.
      if (isSubscription) {
        const { data: ws } = await admin
          .from("workspaces")
          .select("metadata, cards_unlocked")
          .eq("id", workspaceId)
          .maybeSingle();
        const meta = (ws?.metadata && typeof ws.metadata === "object") ? ws.metadata as Record<string, unknown> : {};
        const count = await getSubscriberCount(admin);

        if (meta.founding_member === true && count < 100) {
          const coupon = Deno.env.get("STRIPE_FOUNDING_COUPON") || "FOUNDING30";
          sessionParams.discounts = [{ coupon }];
          metadata.founding_member = "true";
          metadata.founding_coupon = coupon;
        }

        // Trial-expiry / first-100 deck offer
        if (includeTrialDeckOffer && !ws?.cards_unlocked) {
          if (count < 100) {
            metadata.trial_deck_offer = "free";
            metadata.unlock_deck = "true";
          } else {
            metadata.trial_deck_offer = "half";
            metadata.unlock_deck = "true";
            const halfPriceId = Deno.env.get("STRIPE_PRICE_DIGITAL_OFFER")
              || Deno.env.get("STRIPE_PRICE_DIGITAL_HALF");
            const deckItem: Stripe.Checkout.SessionCreateParams.LineItem = halfPriceId
              ? { price: halfPriceId, quantity: 1 }
              : {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: 499,
                  product_data: {
                    name: "Digital Card Deck (half off)",
                    description: "Trial member offer · one-time",
                  },
                },
              };
            sessionParams.line_items = [
              ...(sessionParams.line_items || []),
              deckItem,
            ];
            // Stripe Checkout: subscription mode can include one-time prices in some API versions;
            // if rejected, fall back to subscription only + unlock_deck metadata for free path.
            metadata.half_off_deck = "true";
          }
        }

        sessionParams.metadata = metadata;
        if (sessionParams.subscription_data) {
          sessionParams.subscription_data.metadata = metadata;
        }
      }
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (createErr) {
      // Subscription + one-time line items may be rejected — retry without deck item.
      const msg = createErr instanceof Error ? createErr.message : String(createErr);
      if (isSubscription && metadata.half_off_deck === "true" && /one.time|mixed|line_items/i.test(msg)) {
        console.warn("[stripe-checkout] mixed line items rejected; subscription only", msg);
        delete metadata.half_off_deck;
        metadata.trial_deck_offer = "half_pending";
        sessionParams.line_items = (sessionParams.line_items || []).slice(0, 1);
        sessionParams.metadata = metadata;
        if (sessionParams.subscription_data) sessionParams.subscription_data.metadata = metadata;
        session = await stripe.checkout.sessions.create(sessionParams);
      } else {
        throw createErr;
      }
    }
    if (!session.url) return json({ error: "Failed to create checkout session" }, 500);

    return json({ url: session.url });
  } catch (e) {
    console.error("[stripe-checkout]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
