/** HMAC signed action tokens for reminder email buttons. */

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type ReminderAction =
  | "done"
  | "snooze"
  | "add_calendar"
  | "still_on"
  | "reschedule";

export async function signReminderAction(
  secret: string,
  payload: { reminderId: string; action: ReminderAction; exp: number },
): Promise<string> {
  const body = b64url(toBytes(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = b64url(await crypto.subtle.sign("HMAC", key, toBytes(body)));
  return `${body}.${sig}`;
}

export async function verifyReminderAction(
  secret: string,
  token: string,
): Promise<{ reminderId: string; action: ReminderAction; exp: number } | null> {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sig),
    toBytes(body),
  );
  if (!ok) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!json?.reminderId || !json?.action || !json?.exp) return null;
    if (Date.now() / 1000 > Number(json.exp)) return null;
    return json;
  } catch {
    return null;
  }
}

export function actionUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/api/reminder-action?token=${encodeURIComponent(token)}`;
}
