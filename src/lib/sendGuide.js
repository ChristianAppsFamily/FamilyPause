import { supabase } from "./supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === "string"
    && value.length <= 254
    && EMAIL_RE.test(value);
}

function normalizeFirstName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
}

/**
 * Request The FamilyPause Guide by email.
 * Production uses the Vercel /api/send-guide route (Resend + process.env).
 * Local Vite falls back to the capture-lead edge function.
 */
export async function requestFamilyPauseGuide({ email, firstName } = {}) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isValidEmail(normalized)) {
    return { error: "Enter a valid email address." };
  }

  const payload = {
    email: normalized,
    source: "plan_guide",
    kind: "guide",
  };
  const cleanedName = normalizeFirstName(firstName);
  if (cleanedName) payload.first_name = cleanedName;

  try {
    const res = await fetch("/api/send-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true };
      return { error: data.error || "We couldn't send the guide. Please try again." };
    }
  } catch {
    /* Vite has no /api route — fall through to the edge function. */
  }

  const { data, error } = await supabase.functions.invoke("capture-lead", {
    body: payload,
  });
  if (error || data?.error) {
    return { error: "We couldn't send the guide. Please try again." };
  }
  return { ok: true };
}
