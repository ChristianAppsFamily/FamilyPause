// Public lead capture for Free Planning Guide and waitlists.
// Required secrets:
//   RESEND_API_KEY
// Guide (kind = "guide"):
//   RESEND_SUNDAY_GUIDE_SEGMENT_ID
//   SUNDAY_GUIDE_URL
// Waitlists:
//   RESEND_MINISTRY_WAITLIST_SEGMENT_ID (kind = "ministry-waitlist")
//   RESEND_PHYSICAL_DECK_WAITLIST_SEGMENT_ID (kind = "physical-deck-waitlist")
// Optional:
//   SUNDAY_GUIDE_FROM_EMAIL / LEAD_FROM_EMAIL

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

function guideHtml(guideUrl: string) {
  const safeUrl = guideUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 18px;font-size:28px;font-style:italic;font-weight:600;line-height:1.25;">Your One-Plan Guide is here.</h1>
      <p style="margin:0 0 28px;color:#6A5A40;font-size:16px;line-height:1.65;">A simple weekly planning system for families with too much going on. With care, Spence.</p>
      <a href="${safeUrl}" style="display:inline-block;padding:13px 20px;border-radius:7px;background:#BE5A37;color:#ffffff;text-decoration:none;font-size:14px;">Open the One-Plan Guide</a>
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

async function handleWaitlist(
  req: Request,
  apiKey: string,
  from: string,
  email: string,
  segmentEnv: string,
  subject: string,
  html: string,
  label: string,
) {
  const segmentId = Deno.env.get(segmentEnv);
  if (!segmentId) {
    console.error(`[capture-lead] Missing ${segmentEnv}`);
    return json(req, { error: "Waitlist is not configured" }, 500);
  }

  const enrolled = await enrollContact(apiKey, email, segmentId);
  if (!enrolled.ok) {
    console.error(`[capture-lead] ${label} enrollment failed`, enrolled.stage, enrolled.status, enrolled.data);
    return json(req, { error: "Unable to join waitlist" }, 502);
  }

  const sendRes = await resendRequest("/emails", apiKey, {
    method: "POST",
    body: JSON.stringify({ from, to: [email], subject, html }),
  });
  const sendData = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    console.error(`[capture-lead] ${label} confirmation failed`, sendRes.status, sendData);
    return json(req, { error: "Unable to confirm waitlist" }, 502);
  }

  return json(req, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 2048) return json(req, { error: "Request too large" }, 413);

    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isEmail(email)) return json(req, { error: "Enter a valid email address" }, 400);

    const kind = body?.kind === "ministry-waitlist"
      ? "ministry-waitlist"
      : body?.kind === "physical-deck-waitlist"
        ? "physical-deck-waitlist"
        : "guide";
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("[capture-lead] Missing RESEND_API_KEY");
      return json(req, { error: "Lead capture is not configured" }, 500);
    }

    const from = Deno.env.get("LEAD_FROM_EMAIL")
      || Deno.env.get("SUNDAY_GUIDE_FROM_EMAIL")
      || "FamilyPause <hello@familypause.com>";

    if (kind === "ministry-waitlist") {
      return await handleWaitlist(
        req,
        apiKey,
        from,
        email,
        "RESEND_MINISTRY_WAITLIST_SEGMENT_ID",
        "You're on the Church & Ministry waitlist",
        ministryWaitlistHtml(),
        "Ministry waitlist",
      );
    }

    if (kind === "physical-deck-waitlist") {
      return await handleWaitlist(
        req,
        apiKey,
        from,
        email,
        "RESEND_PHYSICAL_DECK_WAITLIST_SEGMENT_ID",
        "You're on the physical deck waitlist",
        physicalDeckWaitlistHtml(),
        "Physical deck waitlist",
      );
    }

    const segmentId = Deno.env.get("RESEND_SUNDAY_GUIDE_SEGMENT_ID");
    const guideUrl = Deno.env.get("SUNDAY_GUIDE_URL");
    if (!segmentId || !guideUrl) {
      console.error("[capture-lead] Missing Resend or One-Plan Guide configuration");
      return json(req, { error: "Guide delivery is not configured" }, 500);
    }

    const enrolled = await enrollContact(apiKey, email, segmentId);
    if (!enrolled.ok) {
      console.error("[capture-lead] Guide enrollment failed", enrolled.stage, enrolled.status, enrolled.data);
      return json(req, { error: "Unable to save contact" }, 502);
    }

    const sendRes = await resendRequest("/emails", apiKey, {
      method: "POST",
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your One-Plan Guide is here",
        html: guideHtml(guideUrl),
      }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      console.error("[capture-lead] Delivery failed", sendRes.status, sendData);
      return json(req, { error: "Unable to send guide" }, 502);
    }

    return json(req, { ok: true });
  } catch (error) {
    console.error("[capture-lead] Unexpected failure", error);
    return json(req, { error: "Something went wrong" }, 500);
  }
});
