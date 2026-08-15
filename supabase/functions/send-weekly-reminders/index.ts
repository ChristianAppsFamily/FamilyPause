// send-weekly-reminders — cron every 30 minutes.
// Matches workspaces whose Pacific-local reminder_day + reminder_time fall in the current 30-min slot
// (exact :00/:30 times and custom times such as 18:17).
// Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: REMINDER_CRON_SECRET (Authorization: Bearer <secret>), LEAD_FROM_EMAIL
//
// Deploy: supabase functions deploy send-weekly-reminders --no-verify-jwt
// Schedule (Dashboard → Edge Functions → Cron, or pg_cron + net.http_post):
//   */30 * * * *

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Current Pacific wall-clock parts using Intl (handles PST/PDT). */
function pacificNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekday = get("weekday"); // Sun, Mon, ...
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  let hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  // Some engines emit hour "24" for midnight
  if (hour === 24) hour = 0;

  // Floor to 30-minute slot so cron jitter still matches stored :00 / :30 times.
  const slotMinute = minute < 30 ? 0 : 30;
  const time = `${String(hour).padStart(2, "0")}:${String(slotMinute).padStart(2, "0")}`;

  return {
    day: dayMap[weekday] ?? 0,
    time,
    weekday,
    rawMinute: minute,
  };
}

function firstNameFrom(displayName: string | null | undefined, email: string | null | undefined) {
  const fromName = (displayName || "").trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = (email || "").split("@")[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "Friend";
}

function reminderHtml(firstName: string) {
  const safe = firstName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2E2820;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:#2E2820;">Hey ${safe},</p>
      <p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:#6A5A40;">This is your weekly reminder to sit down together.</p>
      <p style="margin:0 0 28px;font-size:17px;line-height:1.65;color:#6A5A40;">Pull a card, hit record, and let FamilyPause handle the rest. Takes about 20 minutes. Your week will thank you.</p>
      <a href="https://familypause.com/app" style="display:inline-block;padding:13px 22px;border-radius:7px;background:#BE5A37;color:#ffffff;text-decoration:none;font-size:14px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;">Open FamilyPause</a>
      <p style="margin:32px 0 0;font-size:16px;line-height:1.6;color:#2E2820;">Spence<br><span style="color:#8C8070;">FamilyPause</span></p>
      <hr style="border:none;border-top:1px solid #E6D9C4;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;line-height:1.5;color:#8C8070;font-family:ui-monospace,Menlo,monospace;">
        Update your reminder time in Settings.<br>
        <a href="https://familypause.com" style="color:#BE5A37;">familypause.com</a>
      </p>
    </div>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (cronSecret) {
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!resendKey || !supabaseUrl || !serviceKey) {
    return json({ error: "Missing Resend or Supabase configuration" }, 500);
  }

  const from = Deno.env.get("LEAD_FROM_EMAIL")
    || Deno.env.get("REMINDER_FROM_EMAIL")
    || "FamilyPause <hello@familypause.com>";

  const pacific = pacificNow();
  const admin = createClient(supabaseUrl, serviceKey);

  // Match exact :00/:30 times and any custom time in this 30-minute slot.
  const [slotHour] = pacific.time.split(":").map((n) => parseInt(n, 10));
  const slotMinute = pacific.time.endsWith(":30") ? 30 : 0;
  const slotStart = pacific.time;
  const nextHour = slotMinute === 0 ? slotHour : (slotHour + 1) % 24;
  const slotEndExclusive = slotMinute === 0
    ? `${String(slotHour).padStart(2, "0")}:30`
    : (slotHour === 23 ? null : `${String(nextHour).padStart(2, "0")}:00`);

  let reminderQuery = admin
    .from("workspaces")
    .select("id, reminder_day, reminder_time, owner_id")
    .eq("reminder_day", pacific.day)
    .gte("reminder_time", slotStart);

  reminderQuery = slotEndExclusive
    ? reminderQuery.lt("reminder_time", slotEndExclusive)
    : reminderQuery.lte("reminder_time", "23:59");

  const { data: workspaces, error: wsErr } = await reminderQuery;

  if (wsErr) {
    console.error("[send-weekly-reminders] workspace query", wsErr);
    return json({ error: wsErr.message }, 500);
  }

  const matches = workspaces || [];
  let sent = 0;
  const errors: string[] = [];

  for (const ws of matches) {
    try {
      const { data: ownerMember } = await admin
        .from("workspace_members")
        .select("user_id, display_name, role")
        .eq("workspace_id", ws.id)
        .eq("role", "owner")
        .maybeSingle();

      const ownerId = ownerMember?.user_id || ws.owner_id;
      if (!ownerId) {
        errors.push(`${ws.id}: no owner`);
        continue;
      }

      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(ownerId);
      if (userErr || !userData?.user?.email) {
        errors.push(`${ws.id}: no email`);
        continue;
      }

      const email = userData.user.email;
      const first = firstNameFrom(ownerMember?.display_name, email);

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Time for your FamilyPause.",
          html: reminderHtml(first),
        }),
      });

      if (!sendRes.ok) {
        const body = await sendRes.text();
        console.error("[send-weekly-reminders] Resend failed", ws.id, sendRes.status, body);
        errors.push(`${ws.id}: resend ${sendRes.status}`);
        continue;
      }

      sent += 1;
    } catch (e) {
      console.error("[send-weekly-reminders] workspace failed", ws.id, e);
      errors.push(`${ws.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({
    ok: true,
    pacific,
    matched: matches.length,
    sent,
    errors: errors.length ? errors : undefined,
  });
});
