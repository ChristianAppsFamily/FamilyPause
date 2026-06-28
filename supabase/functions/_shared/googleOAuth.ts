/** HMAC-signed OAuth state for Google Calendar connect flow. */

const encoder = new TextEncoder();

async function importKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type OAuthStatePayload = {
  workspace_id: string;
  user_id: string;
  return_to: string;
  exp: number;
};

export async function signOAuthState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyOAuthState(state: string, secret: string): Promise<OAuthStatePayload | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), encoder.encode(body));
  if (!valid) return null;
  try {
    const json = new TextDecoder().decode(b64urlDecode(body));
    const payload = JSON.parse(json) as OAuthStatePayload;
    if (!payload.workspace_id || !payload.user_id || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "Token exchange failed");
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "Token refresh failed");
  return data as { access_token: string; expires_in?: number };
}

export function googleCallbackRedirectUri(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL not set");
  return `${url}/functions/v1/google-calendar-callback`;
}

export function appOrigin(): string {
  return (Deno.env.get("GOOGLE_APP_ORIGIN") || "https://familypause.com").replace(/\/$/, "");
}

/** Fetch the Google account email for a freshly issued access token. */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json() as { email?: string };
  return data.email ?? null;
}
