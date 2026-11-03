/**
 * GET /api/reminder-action?token=...
 * Verifies signed reminder email CTAs: done | snooze | add_calendar | still_on | reschedule
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function verifyToken(secret, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  let got;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!json?.reminderId || !json?.action || !json?.exp) return null;
    if (Date.now() / 1000 > Number(json.exp)) return null;
    return json;
  } catch {
    return null;
  }
}

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<title>${title} · FamilyPause</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0F172A;background:#fff;margin:0;padding:48px 24px;text-align:center}
  h1{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:800;letter-spacing:-.03em;font-size:28px}
  p{color:#475569;line-height:1.6;max-width:420px;margin:12px auto 24px}
  a{color:#14805E;font-weight:600}
</style></head>
<body>
  <h1>${title}</h1>
  <p>${body}</p>
  <p><a href="https://www.familypause.com/app">Open FamilyPause</a></p>
</body></html>`;
}

function addDaysIso(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).end();
  }
  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  const secret = process.env.LINK_SIGNING_SECRET || process.env.REMINDER_CRON_SECRET;
  if (!secret) return res.status(500).send(htmlPage("Not configured", "Link signing is not set up."));

  const token = req.query?.token;
  const payload = verifyToken(secret, token);
  if (!payload) return res.status(400).send(htmlPage("Link expired", "This reminder link is invalid or has expired."));

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).send(htmlPage("Not configured", "Database is not configured."));

  const admin = createClient(url, key);
  const { data: row, error } = await admin
    .from("plan_item_reminders")
    .select("*")
    .eq("id", payload.reminderId)
    .maybeSingle();

  if (error || !row) {
    return res.status(404).send(htmlPage("Not found", "We couldn’t find that reminder."));
  }

  const action = payload.action;

  if (action === "done" || action === "still_on") {
    await admin.from("plan_item_reminders").update({
      status: "cancelled",
      last_error: action === "still_on" ? "still_on" : "done",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id).eq("status", "pending");
    // Also cancel sibling pending for same card
    await admin.from("plan_item_reminders").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("workspace_id", row.workspace_id).eq("card_id", row.card_id).eq("status", "pending");

    return res.status(200).send(htmlPage(
      action === "still_on" ? "Glad you’re still on" : "Marked done",
      action === "still_on"
        ? "Thanks — enjoy your time together."
        : "We’ll stop reminding you about this item.",
    ));
  }

  if (action === "snooze") {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await admin.from("plan_item_reminders").update({
      status: "pending",
      send_at: next.toISOString(),
      remind_at: next.toISOString(),
      updated_at: new Date().toISOString(),
      last_error: "snoozed",
    }).eq("id", row.id);
    return res.status(200).send(htmlPage("Snoozed", "We’ll remind you again in one day."));
  }

  if (action === "reschedule") {
    return res.status(200).send(htmlPage(
      "Reschedule",
      `Open FamilyPause to pick a new time for “${row.title}”.`,
    ));
  }

  if (action === "add_calendar") {
    const icsUrl = `${(process.env.PUBLIC_APP_ORIGIN || "https://www.familypause.com").replace(/\/$/, "")}/api/calendar-ics?token=${encodeURIComponent(row.access_token)}`;
    await admin.from("plan_item_reminders").update({
      added_to_calendar_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    res.writeHead(302, { Location: icsUrl });
    return res.end();
  }

  void addDaysIso;
  void b64url;
  return res.status(400).send(htmlPage("Unknown action", "That reminder action isn’t supported."));
}
