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

async function readFunctionBody(data, error) {
  if (data && typeof data === "object") return data;
  const ctx = error?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      return await ctx.json();
    } catch {
      /* fall through */
    }
  }
  if (ctx && typeof ctx.text === "function") {
    try {
      const text = await ctx.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
  return null;
}

const TEMPORARY_WAITLIST_ERROR = "We couldn't join the waitlist. Please try again.";

/**
 * Join a public waitlist via capture-lead.
 * Lead row is the source of truth; Resend segment/email is best-effort.
 *
 * @param {{ email?: string, kind: "ministry-waitlist"|"physical-deck-waitlist"|"mobile-app-waitlist", firstName?: string }} opts
 * @returns {Promise<{ ok: boolean, code: string, alreadyOnList?: boolean, error?: string, requestId?: string }>}
 */
export async function joinWaitlist({ email, kind, firstName } = {}) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isValidEmail(normalized)) {
    return { ok: false, code: "invalid_email", error: "Enter a valid email address." };
  }

  const payload = { email: normalized, kind };
  const cleanedName = normalizeFirstName(firstName);
  if (cleanedName) payload.first_name = cleanedName;

  try {
    const { data, error } = await supabase.functions.invoke("capture-lead", {
      body: payload,
    });
    const body = await readFunctionBody(data, error);

    if (body?.ok || body?.code === "joined" || body?.code === "already_on_list") {
      const alreadyOnList = !!(body.alreadyOnList || body.code === "already_on_list");
      return {
        ok: true,
        code: alreadyOnList ? "already_on_list" : "joined",
        alreadyOnList,
        requestId: body.requestId,
      };
    }

    if (body?.code === "invalid_email") {
      return {
        ok: false,
        code: "invalid_email",
        error: "Enter a valid email address.",
        requestId: body.requestId,
      };
    }

    return {
      ok: false,
      code: body?.code || (error ? "network_error" : "temporary_failure"),
      error: TEMPORARY_WAITLIST_ERROR,
      requestId: body?.requestId,
    };
  } catch {
    return { ok: false, code: "network_error", error: TEMPORARY_WAITLIST_ERROR };
  }
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
