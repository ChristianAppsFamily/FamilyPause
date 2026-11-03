// send-due-reminders — cron every 5 minutes.
// Claims due plan_item_reminders with SKIP LOCKED, sends via Resend.
// Deploy: supabase functions deploy send-due-reminders --no-verify-jwt
// Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//          REMINDER_CRON_SECRET, LINK_SIGNING_SECRET, REMINDER_FROM_EMAIL, PUBLIC_APP_ORIGIN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildIcs } from "../_shared/ics.ts";
import { DEFAULT_TIME_ZONE, localToUtc } from "../_shared/remindAt.ts";
import { actionUrl, signReminderAction } from "../_shared/signedLinks.ts";

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
}, timeZone: string): string {
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
  return `${day} · ${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function btn(href: string, label: string, primary = false) {
  const bg = primary ? "#14805E" : "#FFFFFF";
  const color = primary ? "#ffffff" : "#0F172A";
  const border = primary ? "#14805E" : "#0F172A";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;margin:4px 6px 4px 0;border-radius:999px;background:${bg};color:${color};border:1.5px solid ${border};text-decoration:none;font-size:13px;font-weight:600;">${escapeHtml(label)}</a>`;
}

async function buildActionButtons(
  secret: string,
  origin: string,
  reminderId: string,
  kind: string,
) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
  const make = async (action: "done" | "snooze" | "add_calendar" | "still_on" | "reschedule") =>
    actionUrl(origin, await signReminderAction(secret, { reminderId, action, exp }));

  if (kind === "checkin") {
    return `${btn(await make("still_on"), "Still on", true)}${btn(await make("reschedule"), "Reschedule")}`;
  }
  return `${btn(await make("done"), "Done", true)}${btn(await make("snooze"), "Snooze 1 day")}${btn(await make("add_calendar"), "Add to calendar")}`;
}

function singleHtml(opts: {
  title: string;
  when: string;
  description?: string | null;
  buttons: string;
  kind: string;
}) {
  const heading = opts.kind === "checkin" ? "Still on for today?" : opts.title;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
    <p style="margin:0 0 24px;color:#14805E;font-size:13px;font-weight:600;">FamilyPause</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;font-family:'Plus Jakarta Sans',Inter,sans-serif;letter-spacing:-0.03em;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#475569;">${escapeHtml(opts.when)}</p>
    ${opts.description ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#94A3B8;">${escapeHtml(opts.description)}</p>` : ""}
    <div style="margin:8px 0 28px;">${opts.buttons}</div>
    <p style="margin:32px 0 0;font-size:15px;line-height:1.6;color:#0F172A;">Spence<br><span style="color:#94A3B8;">FamilyPause</span></p>
  </div>
</body></html>`;
}

function digestHtml(opts: {
  items: Array<{ title: string; when: string; buttons: string }>;
}) {
  const rows = opts.items.map((it) => `
    <div style="padding:16px 0;border-bottom:1px solid #E5E7EB;">
      <strong style="display:block;font-size:16px;margin-bottom:4px;">${escapeHtml(it.title)}</strong>
      <span style="color:#475569;font-size:14px;">${escapeHtml(it.when)}</span>
      <div style="margin-top:12px;">${it.buttons}</div>
    </div>`).join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F172A;">
  <div style="max-width:560px;margin:0 auto;padding:44px 24px;">
    <p style="margin:0 0 24px;color:#14805E;font-size:13px;font-weight:600;">FamilyPause</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;font-family:'Plus Jakarta Sans',Inter,sans-serif;letter-spacing:-0.03em;">This morning’s plan</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475569;">A few things on your plate today.</p>
    ${rows}
    <p style="margin:32px 0 0;font-size:15px;line-height:1.6;color:#0F172A;">Spence<br><span style="color:#94A3B8;">FamilyPause</span></p>
  </div>
</body></html>`;
}

async function resolveRecipientEmail(
  admin: ReturnType<typeof createClient>,
  workspaceId: string,
  recipient: string,
): Promise<string | null> {
  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const list = members || [];
  if (!list.length) return null;
  const target = recipient === "spouse" && list.length >= 2 ? list[1] : list[0];
  const { data: userData } = await admin.auth.admin.getUserById(target.user_id);
  return userData?.user?.email || null;
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
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
  const linkSecret = Deno.env.get("LINK_SIGNING_SECRET") || Deno.env.get("REMINDER_CRON_SECRET") || "dev-link-secret";
  if (!resendKey || !supabaseUrl || !serviceKey) {
    return json({ error: "Missing Resend or Supabase configuration" }, 500);
  }

  const from = Deno.env.get("REMINDER_FROM_EMAIL")
    || "FamilyPause <reminders@familypause.com>";
  const origin = (Deno.env.get("PUBLIC_APP_ORIGIN") || "https://www.familypause.com").replace(/\/$/, "");

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: claimed, error: claimErr } = await admin.rpc("claim_due_plan_reminders", {
    batch_limit: 50,
  });

  if (claimErr) {
    // Fallback without RPC (pre-migration)
    console.warn("[send-due-reminders] claim rpc", claimErr.message);
    const { data: due } = await admin
      .from("plan_item_reminders")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true })
      .limit(50);
    if (!due?.length) return json({ ok: true, sent: 0, claimed: 0 });
    for (const row of due) {
      await admin.from("plan_item_reminders").update({
        status: "claiming",
        attempts: (row.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id).eq("status", "pending");
    }
    return await processRows(admin, due, {
      resendKey, from, origin, linkSecret,
    });
  }

  const rows = claimed || [];
  if (!rows.length) return json({ ok: true, sent: 0, claimed: 0 });

  return await processRows(admin, rows, {
    resendKey, from, origin, linkSecret,
  });
});

async function processRows(
  admin: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
  cfg: { resendKey: string; from: string; origin: string; linkSecret: string },
) {
  let sent = 0;
  const errors: string[] = [];

  // Group morning_of digests by workspace+recipient+day
  const digests = new Map<string, Record<string, unknown>[]>();
  const singles: Record<string, unknown>[] = [];

  for (const row of rows) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("id, timezone, reminder_emails_enabled")
      .eq("id", row.workspace_id as string)
      .maybeSingle();

    if (ws && ws.reminder_emails_enabled === false) {
      await admin.from("plan_item_reminders").update({
        status: "cancelled",
        last_error: "emails_disabled",
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      continue;
    }

    (row as { _tz?: string })._tz = ws?.timezone || DEFAULT_TIME_ZONE;

    if (row.reminder_choice === "morning_of" && row.kind === "reminder") {
      const key = `${row.workspace_id}:${row.recipient}:${row.event_date}`;
      if (!digests.has(key)) digests.set(key, []);
      digests.get(key)!.push(row);
    } else {
      singles.push(row);
    }
  }

  for (const [, group] of digests) {
    try {
      await sendDigest(admin, group, cfg);
      sent += group.length;
    } catch (e) {
      errors.push(String(e));
      for (const row of group) await markFailed(admin, row, String(e));
    }
  }

  for (const row of singles) {
    try {
      await sendSingle(admin, row, cfg);
      sent += 1;
    } catch (e) {
      errors.push(`${row.id}: ${e}`);
      await markFailed(admin, row, String(e));
    }
  }

  return json({ ok: true, sent, claimed: rows.length, errors: errors.slice(0, 20) });
}

async function markFailed(
  admin: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
  err: string,
) {
  const attempts = Number(row.attempts || 1);
  await admin.from("plan_item_reminders").update({
    status: attempts >= 3 ? "failed" : "pending",
    last_error: err.slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
}

async function markSent(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  await admin.from("plan_item_reminders").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", row.id);

  // Recurring: schedule next week occurrence
  if (row.event_date) {
    // Only for rows that look weekly — next occurrence in 7 days
    // Callers can expand later with byday; keep simple weekly bump.
  }
}

async function scheduleNextOccurrence(
  admin: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  // Create next week's pending reminder if this was a recurring series card.
  // We detect via ics_uid pattern + reminder_choice preserved.
  const nextDate = addDaysIso(String(row.event_date), 7);
  const tz = (row as { _tz?: string })._tz || DEFAULT_TIME_ZONE;
  let sendAt: Date;
  if (row.reminder_choice === "morning_of") {
    sendAt = localToUtc(nextDate, "08:00", tz);
  } else if (row.reminder_choice === "checkin_9am" || row.kind === "checkin") {
    sendAt = localToUtc(nextDate, "09:00", tz);
  } else if (row.reminder_choice === "1_hour") {
    const time = row.date_only || !row.event_time ? "08:00" : String(row.event_time);
    const start = localToUtc(nextDate, time, tz);
    sendAt = new Date(start.getTime() - 60 * 60_000);
  } else if (row.reminder_choice === "day_before") {
    const prev = addDaysIso(nextDate, -1);
    const wall = row.date_only || !row.event_time ? "08:00" : String(row.event_time);
    sendAt = localToUtc(prev, wall, tz);
  } else {
    return;
  }

  await admin.from("plan_item_reminders").insert({
    workspace_id: row.workspace_id,
    session_id: row.session_id || null,
    card_id: row.card_id,
    title: row.title,
    description: row.description,
    event_date: nextDate,
    event_time: row.event_time,
    date_only: row.date_only,
    reminder_offset_minutes: row.reminder_offset_minutes || 0,
    remind_at: sendAt.toISOString(),
    send_at: sendAt.toISOString(),
    status: "pending",
    ics_uid: row.ics_uid,
    recipient: row.recipient,
    kind: row.kind,
    reminder_choice: row.reminder_choice,
    attempts: 0,
  });
}

async function sendSingle(
  admin: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
  cfg: { resendKey: string; from: string; origin: string; linkSecret: string },
) {
  const email = await resolveRecipientEmail(admin, String(row.workspace_id), String(row.recipient || "holder"));
  if (!email) throw new Error("no_email");

  const tz = (row as { _tz?: string })._tz || DEFAULT_TIME_ZONE;
  const when = formatWhen({
    event_date: String(row.event_date),
    event_time: row.event_time as string | null,
    date_only: !!row.date_only,
  }, tz);
  const buttons = await buildActionButtons(
    cfg.linkSecret,
    cfg.origin,
    String(row.id),
    String(row.kind || "reminder"),
  );
  const icsBody = buildIcs({
    uid: String(row.ics_uid),
    title: String(row.title),
    description: row.description as string | null,
    event_date: String(row.event_date),
    event_time: row.event_time as string | null,
    date_only: !!row.date_only,
    timeZone: tz,
  });
  const filename = `${String(row.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 40) || "event"}.ics`;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": String(row.id),
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [email],
      subject: row.kind === "checkin"
        ? `Still on for ${row.title}?`
        : `Reminder: ${row.title}`,
      html: singleHtml({
        title: String(row.title),
        when,
        description: row.description as string | null,
        buttons,
        kind: String(row.kind || "reminder"),
      }),
      attachments: [{
        filename,
        content: toBase64(icsBody),
      }],
    }),
  });
  const sendData = await sendRes.json();
  if (!sendRes.ok) throw new Error(sendData?.message || "Resend failed");

  await markSent(admin, row);
  if (row.recurring) {
    try {
      await scheduleNextOccurrence(admin, row);
    } catch (e) {
      console.warn("[send-due-reminders] next occurrence", e);
    }
  }
}

async function sendDigest(
  admin: ReturnType<typeof createClient>,
  group: Record<string, unknown>[],
  cfg: { resendKey: string; from: string; origin: string; linkSecret: string },
) {
  const first = group[0];
  const email = await resolveRecipientEmail(
    admin,
    String(first.workspace_id),
    String(first.recipient || "holder"),
  );
  if (!email) throw new Error("no_email");

  const tz = (first as { _tz?: string })._tz || DEFAULT_TIME_ZONE;
  const items = [];
  for (const row of group) {
    items.push({
      title: String(row.title),
      when: formatWhen({
        event_date: String(row.event_date),
        event_time: row.event_time as string | null,
        date_only: !!row.date_only,
      }, tz),
      buttons: await buildActionButtons(
        cfg.linkSecret,
        cfg.origin,
        String(row.id),
        String(row.kind || "reminder"),
      ),
    });
  }

  const attachments = group.map((row) => ({
    filename: `${String(row.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 40)}.ics`,
    content: toBase64(buildIcs({
      uid: String(row.ics_uid),
      title: String(row.title),
      description: row.description as string | null,
      event_date: String(row.event_date),
      event_time: row.event_time as string | null,
      date_only: !!row.date_only,
      timeZone: tz,
    })),
  }));

  const idempotencyKey = `digest:${first.workspace_id}:${first.recipient}:${first.event_date}`;
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [email],
      subject: "This morning’s plan",
      html: digestHtml({ items }),
      attachments,
    }),
  });
  const sendData = await sendRes.json();
  if (!sendRes.ok) throw new Error(sendData?.message || "Resend failed");

  for (const row of group) {
    await markSent(admin, row);
    if (row.recurring) {
      try { await scheduleNextOccurrence(admin, row); } catch { /* ignore */ }
    }
  }
}
