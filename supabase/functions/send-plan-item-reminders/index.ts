// send-plan-item-reminders — cron every 15 minutes.
// Finds due plan_item_reminders and emails Add-to-Calendar (.ics) via Resend.
//
// Deploy: supabase functions deploy send-plan-item-reminders --no-verify-jwt
// Schedule (Dashboard → Edge Functions → Cron):
//   */15 * * * *
// Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: REMINDER_CRON_SECRET, REMINDER_FROM_EMAIL, PUBLIC_APP_ORIGIN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildIcs } from "../_shared/ics.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(row: {
  event_date: string;
  event_time: string | null;
  date_only: boolean;
}): string {
  const [y, m, d] = row.event_date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  if (row.date_only || !row.event_time) return day;
  const [hh, mm] = row.event_time.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${day} · ${h12}:${String(mm).padStart(2, "0")} ${ampm} PT`;
}

function reminderHtml(opts: {
  title: string;
  when: string;
  description?: string | null;
  icsUrl: string;
}) {
  const title = escapeHtml(opts.title);
  const when = escapeHtml(opts.when);
  const desc = opts.description ? escapeHtml(opts.description) : "";
  const icsUrl = escapeHtml(opts.icsUrl);
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2A251D;">
    <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
      <p style="margin:0 0 24px;color:#BE5A37;font-size:13px;letter-spacing:.12em;text-transform:uppercase;">FamilyPause</p>
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:600;line-height:1.25;">${title}</h1>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#5B5245;">${when}</p>
      ${desc ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#8C8070;">${desc}</p>` : ""}
      <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#5B5245;">Add this to your calendar so it doesn't get lost.</p>
      <a href="${icsUrl}" style="display:inline-block;padding:14px 22px;border-radius:7px;background:#BE5A37;color:#ffffff;text-decoration:none;font-size:14px;letter-spacing:.06em;text-transform:uppercase;font-family:ui-monospace,Menlo,monospace;">Add to Calendar</a>
      <p style="margin:32px 0 0;font-size:15px;line-height:1.6;color:#2A251D;">Spence<br><span style="color:#8C8070;">FamilyPause</span></p>
      <hr style="border:none;border-top:1px solid #E6D9C4;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;line-height:1.5;color:#8C8070;">
        This reminder was scheduled from your FamilyPause plan.<br>
        <a href="https://www.familypause.com/app" style="color:#BE5A37;">Open FamilyPause</a>
      </p>
    </div>
  </body>
</html>`;
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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

  const from = Deno.env.get("REMINDER_FROM_EMAIL")
    || Deno.env.get("LEAD_FROM_EMAIL")
    || "FamilyPause <hello@mail.familypause.com>";
  const origin = (Deno.env.get("PUBLIC_APP_ORIGIN") || "https://www.familypause.com").replace(/\/$/, "");

  const admin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();

  const { data: due, error: dueErr } = await admin
    .from("plan_item_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("remind_at", nowIso)
    .order("remind_at", { ascending: true })
    .limit(50);

  if (dueErr) {
    console.error("[send-plan-item-reminders] query", dueErr);
    return json({ error: dueErr.message }, 500);
  }

  const rows = due || [];
  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const { data: ws } = await admin
        .from("workspaces")
        .select("id, owner_id")
        .eq("id", row.workspace_id)
        .maybeSingle();
      if (!ws?.owner_id) {
        await admin.from("plan_item_reminders").update({
          status: "failed",
          last_error: "no_owner",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        errors.push(`${row.id}: no_owner`);
        continue;
      }

      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(ws.owner_id);
      const email = userData?.user?.email;
      if (userErr || !email) {
        await admin.from("plan_item_reminders").update({
          status: "failed",
          last_error: "no_email",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        errors.push(`${row.id}: no_email`);
        continue;
      }

      const icsUrl = `${origin}/api/calendar-ics?token=${encodeURIComponent(row.access_token)}`;
      const icsBody = buildIcs({
        uid: row.ics_uid,
        title: row.title,
        description: row.description,
        event_date: row.event_date,
        event_time: row.event_time,
        date_only: row.date_only,
      });
      const filename = `${String(row.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 40) || "event"}.ics`;

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `Reminder: ${row.title}`,
          html: reminderHtml({
            title: row.title,
            when: formatWhen(row),
            description: row.description,
            icsUrl,
          }),
          attachments: [
            {
              filename,
              content: toBase64(icsBody),
              content_type: "text/calendar; charset=utf-8; method=PUBLISH",
            },
          ],
        }),
      });

      if (!sendRes.ok) {
        const body = await sendRes.text();
        console.error("[send-plan-item-reminders] Resend", row.id, sendRes.status, body);
        await admin.from("plan_item_reminders").update({
          status: "failed",
          last_error: `resend_${sendRes.status}`,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        errors.push(`${row.id}: resend ${sendRes.status}`);
        continue;
      }

      await admin.from("plan_item_reminders").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      sent += 1;
    } catch (e) {
      console.error("[send-plan-item-reminders] row", row.id, e);
      await admin.from("plan_item_reminders").update({
        status: "failed",
        last_error: String(e).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      errors.push(`${row.id}: ${String(e)}`);
    }
  }

  return json({ ok: true, due: rows.length, sent, errors });
});
