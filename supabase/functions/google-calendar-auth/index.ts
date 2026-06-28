import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appOrigin, signOAuthState } from "../_shared/googleOAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCOPE = "https://www.googleapis.com/auth/calendar.events";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { workspace_id, return_to } = await req.json();
    if (!workspace_id) return json({ error: "Missing workspace_id" }, 400);

    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return json({ error: "Not a workspace member" }, 403);

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
    if (!clientId || !stateSecret) return json({ error: "Google OAuth not configured" }, 500);

    const origin = appOrigin();
    const safeReturn = typeof return_to === "string" && return_to.startsWith("/")
      ? return_to
      : "/app/settings?calendar=connected";

    const state = await signOAuthState({
      workspace_id,
      user_id: user.id,
      return_to: safeReturn,
      exp: Date.now() + 10 * 60 * 1000,
    }, stateSecret);

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  } catch (e) {
    console.error("[google-calendar-auth]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
