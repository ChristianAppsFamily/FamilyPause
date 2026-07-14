// Stripe webhook — upgrades subscriptions and unlocks digital decks.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//          STRIPE_PRICE_FAMILY, STRIPE_PRICE_PRO, STRIPE_PRICE_DIGITAL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

type Product = "family" | "pro" | "digital" | "digital_offer";

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function planFromPriceId(priceId: string | undefined): Product | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_PRICE_FAMILY")) return "family";
  if (priceId === Deno.env.get("STRIPE_PRICE_PRO")) return "pro";
  if (priceId === Deno.env.get("STRIPE_PRICE_DIGITAL")) return "digital";
  if (priceId === Deno.env.get("STRIPE_PRICE_DIGITAL_OFFER")) return "digital_offer";
  return null;
}

async function markEventProcessed(admin: ReturnType<typeof adminClient>, eventId: string, eventType: string) {
  const { error } = await admin.from("stripe_webhook_events").insert({ id: eventId, event_type: eventType });
  if (error?.code === "23505") return false; // duplicate — already processed
  if (error) throw error;
  return true;
}

async function unlockDigitalDeck(admin: ReturnType<typeof adminClient>, workspaceId: string, deckYear?: number) {
  const year = deckYear ?? new Date().getFullYear();
  const { data: ws, error: fetchErr } = await admin
    .from("workspaces")
    .select("unlocked_deck_years")
    .eq("id", workspaceId)
    .single();
  if (fetchErr) throw fetchErr;

  const years = [...new Set([...(ws?.unlocked_deck_years ?? []), year])];
  const { error } = await admin.from("workspaces").update({
    cards_unlocked: true,
    unlocked_deck_years: years,
    deck_unlocked_at: new Date().toISOString(),
  }).eq("id", workspaceId);
  if (error) throw error;
}

async function upsertSubscription(
  admin: ReturnType<typeof adminClient>,
  workspaceId: string,
  plan: "family" | "pro",
  stripeCustomerId: string | null,
  stripeSubId: string | null,
  active: boolean,
) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const row = {
    workspace_id: workspaceId,
    plan: active ? plan : "free",
    active: true,
    stripe_customer_id: stripeCustomerId,
    stripe_sub_id: stripeSubId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await admin.from("subscriptions").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("subscriptions").insert(row);
    if (error) throw error;
  }
}

async function handleCheckoutCompleted(admin: ReturnType<typeof adminClient>, session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspace_id || session.client_reference_id;
  const product = session.metadata?.product as Product | undefined;

  if (!workspaceId) {
    console.warn("[stripe-webhook] checkout.session.completed missing workspace_id", session.id);
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  if (product === "digital" || product === "digital_offer" || session.mode === "payment") {
    const deckYear = session.metadata?.deck_year
      ? parseInt(session.metadata.deck_year, 10)
      : new Date().getFullYear();
    await unlockDigitalDeck(admin, workspaceId, Number.isFinite(deckYear) ? deckYear : undefined);
    if (product === "digital_offer" || session.metadata?.parent_session_id) {
      const parentId = session.metadata?.parent_session_id;
      if (parentId) {
        await admin.from("deck_offer_claims").update({
          redeemed_at: new Date().toISOString(),
        }).eq("parent_session_id", parentId);
      }
    }
    return;
  }

  if (product === "family" || product === "pro") {
    await upsertSubscription(admin, workspaceId, product, customerId, subscriptionId, true);
    return;
  }

  // Payment Link fallback: infer product from line items when metadata is absent.
  if (subscriptionId) {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = sub.items.data[0]?.price?.id;
    const inferred = planFromPriceId(priceId);
    if (inferred === "family" || inferred === "pro") {
      await upsertSubscription(admin, workspaceId, inferred, customerId, subscriptionId, true);
    }
  }
}

async function handleSubscriptionChange(admin: ReturnType<typeof adminClient>, subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata?.workspace_id;
  const priceId = subscription.items.data[0]?.price?.id;
  const inferred = (subscription.metadata?.product as Product | undefined) ?? planFromPriceId(priceId);

  let target = workspaceId
    ? { workspace_id: workspaceId }
    : null;

  if (!target) {
    const { data } = await admin
      .from("subscriptions")
      .select("workspace_id")
      .eq("stripe_sub_id", subscription.id)
      .maybeSingle();
    if (!data?.workspace_id) return;
    target = data;
  }

  const active = subscription.status === "active" || subscription.status === "trialing";
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;

  if (inferred === "family" || inferred === "pro") {
    await upsertSubscription(
      admin,
      target.workspace_id,
      inferred,
      customerId,
      subscription.id,
      active,
    );
    return;
  }

  if (!active) {
    await admin.from("subscriptions").update({
      plan: "free",
      active: true,
      stripe_sub_id: null,
      updated_at: new Date().toISOString(),
    }).eq("workspace_id", target.workspace_id);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = adminClient();
  const isNew = await markEventProcessed(admin, event.id, event.type);
  if (!isNew) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionChange(admin, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionChange(admin, event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] handler error for ${event.type}`, err);
    // Remove idempotency row so Stripe retry can succeed.
    await admin.from("stripe_webhook_events").delete().eq("id", event.id);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
