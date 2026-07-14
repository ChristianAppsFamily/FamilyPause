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

type Product = "family" | "pro" | "digital" | "digital_offer";

const PRODUCT_PRICES: Record<"family" | "pro" | "digital", string> = {
  family: "STRIPE_PRICE_FAMILY",
  pro: "STRIPE_PRICE_PRO",
  digital: "STRIPE_PRICE_DIGITAL",
};

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
    };

    const workspaceId = await resolveWorkspaceId(supabase, user.id);
    if (!workspaceId) return json({ error: "No workspace found for this account" }, 400);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const admin = adminClient();

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

    const { product, successUrl, cancelUrl, parentSessionId } = body;

    if (!product || !["family", "pro", "digital", "digital_offer"].includes(product)) {
      return json({ error: "Invalid product" }, 400);
    }

    const origin = successUrl ? new URL(successUrl).origin : "https://familypause.com";
    const defaultSuccess = product === "family" || product === "pro"
      ? `${origin}/app/subscribe/success?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/app/settings?checkout=success`;
    const resolvedSuccess = successUrl || defaultSuccess;
    const resolvedCancel = cancelUrl || `${origin}/app/settings?checkout=cancel`;

    const metadata: Record<string, string> = {
      workspace_id: workspaceId,
      product,
      user_id: user.id,
    };

    let sessionParams: Stripe.Checkout.SessionCreateParams;

    if (product === "digital_offer") {
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
      const priceEnv = PRODUCT_PRICES[product];
      const priceId = Deno.env.get(priceEnv);
      if (!priceId) return json({ error: `${priceEnv} not configured` }, 500);

      sessionParams = {
        mode: product === "digital" ? "payment" : "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: resolvedSuccess.includes("{CHECKOUT_SESSION_ID}")
          ? resolvedSuccess
          : (product === "family" || product === "pro")
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
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return json({ error: "Failed to create checkout session" }, 500);

    return json({ url: session.url });
  } catch (e) {
    console.error("[stripe-checkout]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
