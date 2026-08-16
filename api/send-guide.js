import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_RE = /^[a-z0-9_]{2,80}$/;

function isEmail(value) {
  return typeof value === "string"
    && value.length <= 254
    && EMAIL_RE.test(value);
}

function normalizeFirstName(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  return cleaned || null;
}

function resolveSource(raw) {
  if (typeof raw === "string") {
    const source = raw.trim().toLowerCase();
    if (SOURCE_RE.test(source)) return source;
  }
  return "plan_guide";
}

function guideHtml(guideUrl) {
  const safeUrl = String(guideUrl)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Times New Roman',serif;color:#2A251D;">
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

async function saveLead(email, firstName, source) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || (!serviceKey && !anonKey)) {
    console.warn("[send-guide] Skipping leads insert — Supabase keys are not set on Vercel");
    return;
  }

  const client = createClient(supabaseUrl, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!serviceKey) {
    const { error } = await client.rpc("upsert_guide_lead", {
      p_email: email,
      p_first_name: firstName,
      p_source: source,
    });
    if (error) throw error;
    return;
  }

  const { data: existing, error: lookupError } = await client
    .from("leads")
    .select("id, first_name")
    .eq("email", email)
    .eq("source", source)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    if (firstName && existing.first_name !== firstName) {
      const { error: updateError } = await client
        .from("leads")
        .update({ first_name: firstName })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
    return;
  }

  const { error: insertError } = await client.from("leads").insert({
    email,
    first_name: firstName,
    source,
  });
  if (insertError?.code === "23505") return;
  if (insertError) throw insertError;
}

export default async function handler(req, res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const firstName = normalizeFirstName(body.first_name ?? body.firstName);
  const source = resolveSource(body.source);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "FamilyPause <hello@mail.familypause.com>";
  const guideUrl = process.env.FAMILYPAUSE_GUIDE_URL || "https://familypause.com/guide.pdf";

  if (!apiKey) {
    console.error("[send-guide] Missing RESEND_API_KEY");
    return res.status(500).json({ error: "We couldn't send the guide. Please try again." });
  }

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: email,
    subject: "Your FamilyPause Guide is here.",
    html: guideHtml(guideUrl),
  });

  if (sendError) {
    console.error("[send-guide] Resend failed", sendError);
    return res.status(502).json({ error: "We couldn't send the guide. Please try again." });
  }

  try {
    await saveLead(email, firstName, source);
  } catch (error) {
    console.error("[send-guide] Lead save failed after send", error);
  }

  return res.status(200).json({ ok: true });
}
