import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  appOrigin,
  exchangeGoogleCode,
  fetchGoogleUserEmail,
  googleCallbackRedirectUri,
  verifyOAuthState,
} from "../_shared/googleOAuth.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const origin = appOrigin();

  const redirectFail = (msg: string) =>
    Response.redirect(`${origin}/app/settings?calendar=error&msg=${encodeURIComponent(msg)}`, 302);

  if (oauthError) {
    const msg = oauthError === "access_denied"
      ? "Google account connection was cancelled"
      : oauthError;
    return redirectFail(msg);
  }
  if (!code || !state) return redirectFail("Missing authorization code");

  try {
    const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
    if (!stateSecret) return redirectFail("OAuth not configured");

    const payload = await verifyOAuthState(state, stateSecret);
    if (!payload) return redirectFail("Invalid or expired state");

    const redirectUri = googleCallbackRedirectUri();
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const googleEmail = await fetchGoogleUserEmail(tokens.access_token);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, string | null> = {
      google_calendar_token: tokens.access_token,
      google_calendar_connected_at: new Date().toISOString(),
      google_calendar_email: googleEmail,
    };
    if (tokens.refresh_token) {
      update.google_calendar_refresh_token = tokens.refresh_token;
    }

    const { error } = await admin
      .from("workspace_members")
      .update(update)
      .eq("workspace_id", payload.workspace_id)
      .eq("user_id", payload.user_id);

    if (error) {
      console.error("[google-calendar-callback] db update", error);
      return redirectFail("Failed to save calendar connection");
    }

    const returnPath = payload.return_to || "/app/settings?calendar=connected";
    return Response.redirect(`${origin}${returnPath}`, 302);
  } catch (e) {
    console.error("[google-calendar-callback]", e);
    return redirectFail(e instanceof Error ? e.message : "Connection failed");
  }
});
