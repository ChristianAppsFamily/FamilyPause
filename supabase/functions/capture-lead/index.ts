import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public lead capture for Free Planning Guide, waitlists, and founding members.
// Required secrets:
//   RESEND_API_KEY
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injected)
// Guide (kind = "guide"):
//   RESEND_FROM_EMAIL (FamilyPause <hello@mail.familypause.com>)
//   FAMILYPAUSE_GUIDE_URL (defaults to https://familypause.com/guide.pdf)
//   optional RESEND_SUNDAY_GUIDE_SEGMENT_ID
// Waitlists (lead row is the source of truth; Resend is best-effort):
//   optional RESEND_MINISTRY_WAITLIST_SEGMENT_ID (kind = "ministry-waitlist")
//   optional RESEND_PHYSICAL_DECK_WAITLIST_SEGMENT_ID (kind = "physical-deck-waitlist")
//   optional RESEND_MOBILE_APP_WAITLIST_SEGMENT_ID (kind = "mobile-app-waitlist")
// Founding (kind = "founding-member"):
//   optional RESEND_FOUNDING_SEGMENT_ID
// Optional fallbacks:
//   SUNDAY_GUIDE_FROM_EMAIL / LEAD_FROM_EMAIL / SUNDAY_GUIDE_URL

const allowedOrigins = new Set([
  "https://familypause.com",
  "https://www.familypause.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://familypause.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function isEmail(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const SOURCE_RE = /^[a-z0-9_]{2,80}$/;

function normalizeFirstName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  return cleaned || null;
}

function defaultSource(kind: string): string {
  if (kind === "ministry-waitlist") return "enterprise_waitlist";
  if (kind === "physical-deck-waitlist") return "physical_deck_waitlist";
  if (kind === "mobile-app-waitlist") return "mobile_app_waitlist";
  if (kind === "founding-member") return "founding_member";
  return "plan_guide";
}

function resolveSource(kind: string, raw: unknown): string {
  if (typeof raw === "string") {
    const source = raw.trim().toLowerCase();
    if (SOURCE_RE.test(source)) return source;
  }
  return defaultSource(kind);
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Insert a lead, or keep the existing row on (email, source) and still allow a resend. */
async function upsertLead(email: string, firstName: string | null, source: string) {
  const admin = adminClient();
  const { data: existing, error: lookupError } = await admin
    .from("leads")
    .select("id, first_name")
    .eq("email", email)
    .eq("source", source)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    if (firstName && existing.first_name !== firstName) {
      const { error: updateError } = await admin
        .from("leads")
        .update({ first_name: firstName })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
    return { duplicate: true };
  }

  const { error: insertError } = await admin.from("leads").insert({
    email,
    first_name: firstName,
    source,
  });
  if (insertError?.code === "23505") return { duplicate: true };
  if (insertError) throw insertError;
  return { duplicate: false };
}

function guideHtml(guideUrl: string) {
  const safeUrl = guideUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-style:italic;font-weight:600;line-height:1.25;color:#2A251D;">Your FamilyPause Guide is here.</h1>
      <p style="margin:0 0 28px;color:#5B5245;font-size:16px;line-height:1.65;">The FamilyPause Guide is ready for you — a simple weekly planning system for families with too much going on. Download it below, pick one conversation, and give this week a little more room.</p>
      <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:7px;background:#BE5A37;color:#ffffff;text-decoration:none;font-size:15px;letter-spacing:.02em;">Download The FamilyPause Guide</a>
      <p style="margin:28px 0 0;color:#5B5245;font-size:16px;line-height:1.65;">With care,<br>Spence</p>
    </div>
  </body>
</html>`;
}

function ministryWaitlistHtml() {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 18px;font-size:28px;font-style:italic;font-weight:600;line-height:1.25;">You're on the Church &amp; Ministry waitlist.</h1>
      <p style="margin:0;color:#6A5A40;font-size:16px;line-height:1.65;">Thanks for your interest. We'll reach out when FamilyPause is ready for couples ministries, teams, and family programs. With care, Spence.</p>
    </div>
  </body>
</html>`;
}

function physicalDeckWaitlistHtml() {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 18px;font-size:28px;font-style:italic;font-weight:600;line-height:1.25;">You're on the physical deck waitlist.</h1>
      <p style="margin:0;color:#6A5A40;font-size:16px;line-height:1.65;">Thanks for joining. We'll let you know when the printed FamilyPause Conversation Deck is ready. With care, Spence.</p>
    </div>
  </body>
</html>`;
}

function mobileAppWaitlistHtml() {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 18px;font-size:28px;font-style:italic;font-weight:600;line-height:1.25;">You're on the iOS and Android waitlist.</h1>
      <p style="margin:0;color:#6A5A40;font-size:16px;line-height:1.65;">Thanks for joining. We'll let you know when FamilyPause is on the App Store and Google Play. Until then, the full web app works in a phone browser. With care, Spence.</p>
    </div>
  </body>
</html>`;
}

function foundingMemberHtml() {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 18px;font-size:28px;font-style:italic;font-weight:600;line-height:1.25;">Welcome, founding member.</h1>
      <p style="margin:0;color:#6A5A40;font-size:16px;line-height:1.65;">Your free trial is ready. Check your inbox for a link to set your password, then start your first weekly sync. With care, Spence.</p>
    </div>
  </body>
</html>`;
}

async function resendRequest(path: string, apiKey: string, init: RequestInit) {
  return fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function enrollContact(apiKey: string, email: string, segmentId: string) {
  const contactRes = await resendRequest("/contacts", apiKey, {
    method: "POST",
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    }),
  });
  const contactData = await contactRes.json().catch(() => ({}));
  const duplicate = contactRes.status === 409 || /already exists/i.test(contactData?.message || "");

  if (!contactRes.ok && !duplicate) {
    return { ok: false as const, status: contactRes.status, data: contactData, stage: "contact" as const };
  }

  if (duplicate) {
    const segmentRes = await resendRequest(
      `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
      apiKey,
      { method: "POST" },
    );
    const segmentData = await segmentRes.json().catch(() => ({}));
    const alreadySegmented = segmentRes.status === 409 || /already/i.test(segmentData?.message || "");
    if (!segmentRes.ok && !alreadySegmented) {
      return { ok: false as const, status: segmentRes.status, data: segmentData, stage: "segment" as const };
    }
  }

  return { ok: true as const };
}

const WAITLIST_META: Record<string, { segmentEnv: string; subject: string; html: () => string }> = {
  "ministry-waitlist": {
    segmentEnv: "RESEND_MINISTRY_WAITLIST_SEGMENT_ID",
    subject: "You're on the Church & Ministry waitlist",
    html: ministryWaitlistHtml,
  },
  "physical-deck-waitlist": {
    segmentEnv: "RESEND_PHYSICAL_DECK_WAITLIST_SEGMENT_ID",
    subject: "You're on the physical deck waitlist",
    html: physicalDeckWaitlistHtml,
  },
  "mobile-app-waitlist": {
    segmentEnv: "RESEND_MOBILE_APP_WAITLIST_SEGMENT_ID",
    subject: "You're on the iOS and Android waitlist",
    html: mobileAppWaitlistHtml,
  },
};

function fail(req: Request, requestId: string, code: string, error: string, status: number) {
  console.error(`[capture-lead] ${requestId} ${code}`);
  return json(req, { ok: false, code, error, requestId }, status);
}

async function handleWaitlist(
  req: Request,
  email: string,
  firstName: string | null,
  source: string,
  kind: keyof typeof WAITLIST_META,
  requestId: string,
) {
  let duplicate = false;
  try {
    const saved = await upsertLead(email, firstName, source);
    duplicate = saved.duplicate;
  } catch {
    return fail(req, requestId, "lead_save_failed", "Unable to join waitlist", 502);
  }

  const meta = WAITLIST_META[kind];
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL")
    || Deno.env.get("LEAD_FROM_EMAIL")
    || Deno.env.get("SUNDAY_GUIDE_FROM_EMAIL")
    || "FamilyPause <hello@mail.familypause.com>";
  const segmentId = Deno.env.get(meta.segmentEnv);

  if (!apiKey) {
    console.error(`[capture-lead] ${requestId} missing_resend_key`);
  } else {
    if (segmentId) {
      const enrolled = await enrollContact(apiKey, email, segmentId);
      if (!enrolled.ok) {
        console.error(`[capture-lead] ${requestId} enrollment_failed stage=${enrolled.stage} status=${enrolled.status}`);
      }
    } else {
      console.error(`[capture-lead] ${requestId} missing_segment`);
    }
    if (!duplicate) {
      const sendRes = await resendRequest("/emails", apiKey, {
        method: "POST",
        body: JSON.stringify({ from, to: [email], subject: meta.subject, html: meta.html() }),
      });
      if (!sendRes.ok) {
        console.error(`[capture-lead] ${requestId} confirmation_failed status=${sendRes.status}`);
      }
    }
  }

  const code = duplicate ? "already_on_list" : "joined";
  return json(req, { ok: true, code, alreadyOnList: duplicate, requestId });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 2048) return json(req, { error: "Request too large" }, 413);

    const requestId = crypto.randomUUID();
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isEmail(email)) {
      return fail(req, requestId, "invalid_email", "Enter a valid email address", 400);
    }
    const firstName = normalizeFirstName(body?.first_name ?? body?.firstName);

    const kind = body?.kind === "ministry-waitlist"
      ? "ministry-waitlist"
      : body?.kind === "physical-deck-waitlist"
        ? "physical-deck-waitlist"
        : body?.kind === "mobile-app-waitlist"
          ? "mobile-app-waitlist"
          : body?.kind === "founding-member"
            ? "founding-member"
            : "guide";
    const source = resolveSource(kind, body?.source);

    if (kind === "ministry-waitlist" || kind === "physical-deck-waitlist" || kind === "mobile-app-waitlist") {
      return await handleWaitlist(req, email, firstName, source, kind, requestId);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return fail(req, requestId, "not_configured", "Lead capture is not configured", 500);
    }

    const from = Deno.env.get("RESEND_FROM_EMAIL")
      || Deno.env.get("LEAD_FROM_EMAIL")
      || Deno.env.get("SUNDAY_GUIDE_FROM_EMAIL")
      || "FamilyPause <hello@mail.familypause.com>";

    if (kind === "founding-member") {
      try {
        await upsertLead(email, firstName, source);
      } catch (error) {
        console.error("[capture-lead] Founding lead save failed", error);
      }
      // Soft capture: enroll when segment is configured; never block signup on missing segment.
      const segmentId = Deno.env.get("RESEND_FOUNDING_SEGMENT_ID");
      if (segmentId) {
        const enrolled = await enrollContact(apiKey, email, segmentId);
        if (!enrolled.ok) {
          console.error("[capture-lead] Founding enrollment failed", enrolled.stage, enrolled.status, enrolled.data);
        }
      }
      const sendRes = await resendRequest("/emails", apiKey, {
        method: "POST",
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Welcome, founding member",
          html: foundingMemberHtml(),
        }),
      });
      if (!sendRes.ok) {
        const sendData = await sendRes.json().catch(() => ({}));
        console.error("[capture-lead] Founding confirmation failed", sendRes.status, sendData);
      }
      return json(req, { ok: true });
    }

    const guideUrl = Deno.env.get("FAMILYPAUSE_GUIDE_URL")
      || Deno.env.get("SUNDAY_GUIDE_URL")
      || "https://familypause.com/guide.pdf";
    const sendRes = await resendRequest("/emails", apiKey, {
      method: "POST",
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your FamilyPause Guide is here.",
        html: guideHtml(guideUrl),
      }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      console.error("[capture-lead] Delivery failed", sendRes.status, sendData);
      return json(req, { error: "Unable to send guide" }, 502);
    }

    try {
      await upsertLead(email, firstName, source);
    } catch (error) {
      console.error("[capture-lead] Guide lead save failed after send", error);
    }

    const segmentId = Deno.env.get("RESEND_SUNDAY_GUIDE_SEGMENT_ID");
    if (segmentId) {
      const enrolled = await enrollContact(apiKey, email, segmentId);
      if (!enrolled.ok) {
        console.error("[capture-lead] Guide enrollment failed", enrolled.stage, enrolled.status, enrolled.data);
      }
    }

    return json(req, { ok: true });
  } catch (error) {
    console.error("[capture-lead] unexpected_failure");
    return json(req, { ok: false, code: "temporary_failure", error: "Something went wrong" }, 500);
  }
});
