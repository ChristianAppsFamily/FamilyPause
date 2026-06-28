// Creates a Stripe Checkout Session with workspace_id in metadata.
// Deploy: supabase functions deploy stripe-checkout
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_FAMILY, STRIPE_PRICE_PRO, STRIPE_PRICE_DIGITAL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Product = "family" | "pro" | "digital";

const PRODUCT_PRICES: Record<Product, string> = {
  family: "STRIPE_PRICE_FAMILY",
  pro: "STRIPE_PRICE_PRO",
  digital: "STRIPE_PRICE_DIGITAL",
};

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

    const { product, successUrl, cancelUrl } = await req.json() as {
      product?: Product;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!product || !["family", "pro", "digital"].includes(product)) {
      return json({ error: "Invalid product" }, 400);
    }

    const priceEnv = PRODUCT_PRICES[product];
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) return json({ error: `${priceEnv} not configured` }, 500);

    const { data: members, error: memberErr } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id);

    if (memberErr || !members?.length) {
      return json({ error: "No workspace found for this account" }, 400);
    }

    const owner = members.find((m) => m.role === "owner");
    const workspaceId = owner?.workspace_id ?? members[0].workspace_id;

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const origin = successUrl ? new URL(successUrl).origin : "https://familypause.com";
    const resolvedSuccess = successUrl || `${origin}/app/settings?checkout=success`;
    const resolvedCancel = cancelUrl || `${origin}/app/settings?checkout=cancel`;

    const metadata = {
      workspace_id: workspaceId,
      product,
      user_id: user.id,
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: product === "digital" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: resolvedSuccess,
      cancel_url: resolvedCancel,
      client_reference_id: workspaceId,
      metadata,
      customer_email: user.email ?? undefined,
    };

    if (product !== "digital") {
      sessionParams.subscription_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) return json({ error: "Failed to create checkout session" }, 500);

    return json({ url: session.url });
  } catch (e) {
    console.error("[stripe-checkout]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
