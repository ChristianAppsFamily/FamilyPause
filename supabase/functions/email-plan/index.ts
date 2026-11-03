// email-plan — JWT required. Emails the weekly plan + ICS to holder and spouse.
// Deploy: supabase functions deploy email-plan

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildIcsCalendar } from "../_shared/ics.ts";
import { DEFAULT_TIME_ZONE } from "../_shared/remindAt.ts";

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

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeTime(time: string): string {
  const [h, m = "00"] = String(time || "00:00").split(":");
  return `${String(parseInt(h, 10) || 0).padStart(2, "0")}:${String(parseInt(m, 10) || 0).padStart(2, "0")}`;
}

function googleTemplateUrl(item: {
  title: string;
  date: string;
  time?: string | null;
  date_only?: boolean;
  source?: string;
  timeZone: string;
  duration_minutes?: number;
}) {
  const dateOnly = !!item.date_only || !item.time;
  let dates: string;
  if (dateOnly) {
    const start = item.date.replace(/-/g, "");
    const [y, m, d] = item.date.split("-").map(Number);
    const endDt = new Date(Date.UTC(y, m - 1, d + 1));
    const end = `${endDt.getUTCFullYear()}${pad(endDt.getUTCMonth() + 1)}${pad(endDt.getUTCDate())}`;
    dates = `${start}/${end}`;
  } else {
    const [hh, mm] = normalizeTime(item.time!).split(":").map(Number);
    const duration = Math.max(15, item.duration_minutes || 60);
    const start = `${item.date.replace(/-/g, "")}T${pad(hh)}${pad(mm)}00`;
    const endMin = hh * 60 + mm + duration;
    const endH = Math.floor(endMin / 60) % 24;
    const endM = endMin % 60;
    const end = `${item.date.replace(/-/g, "")}T${pad(endH)}${pad(endM)}00`;
    dates = `${start}/${end}`;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates,
    details: item.source || item.title,
  });
  if (!dateOnly) params.set("ctz", item.timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as {
      workspace_id?: string;
      meeting_date?: string;
      spouse_name?: string;
      cards?: Array<{
        id?: string | number;
        task?: string;
        source?: string;
        date?: string | null;
        time?: string | null;
        date_only?: boolean;
        date_precision?: string;
        type?: string;
        person?: string;
        status?: string;
        duration_minutes?: number;
        recurring?: boolean;
      }>;
    };

    if (!body.workspace_id || !Array.isArray(body.cards)) {
      return json({ error: "Missing workspace_id or cards" }, 400);
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", body.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: ws } = await admin
      .from("workspaces")
      .select("id, timezone")
      .eq("id", body.workspace_id)
      .maybeSingle();
    const timeZone = ws?.timezone || DEFAULT_TIME_ZONE;

    const { data: members } = await admin
      .from("workspace_members")
      .select("user_id, created_at")
      .eq("workspace_id", body.workspace_id)
      .order("created_at", { ascending: true });

    const emails: string[] = [];
    for (const m of members || []) {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data?.user?.email) emails.push(data.user.email);
    }
    if (!emails.length && user.email) emails.push(user.email);

    const kept = body.cards.filter((c) => {
      const s = String(c.status || "kept").toLowerCase();
      return (s === "kept" || s === "calendared") && c.date && c.date_precision !== "month";
    });

    const titleOf = (c: (typeof kept)[0]) => {
      const task = (c.task || "").trim() || "Untitled";
      if (c.type === "event" || c.type === "time_together") return task;
      if (c.type === "decision") return task.startsWith("Decision:") ? task : `Decision: ${task}`;
      if (c.type === "note") return task.startsWith("Note:") ? task : `Note: ${task}`;
      if (c.type === "action") return task.startsWith("To-Do:") ? task : `To-Do: ${task}`;
      return task;
    };

    const listHtml = kept.map((c) => {
      const title = titleOf(c);
      const gcal = googleTemplateUrl({
        title,
        date: c.date!,
        time: c.time,
        date_only: !!c.date_only || !c.time,
        source: c.source || title,
        timeZone,
        duration_minutes: c.duration_minutes,
      });
      return `<li style="margin:0 0 12px;line-height:1.5;">
        <strong>${escapeHtml(title)}</strong>
        ${c.person ? ` · ${escapeHtml(c.person)}` : ""}
        <br/><a href="${escapeHtml(gcal)}" style="color:#14805E;">Add to Google Calendar</a>
      </li>`;
    }).join("");

    const ics = buildIcsCalendar(kept.map((c) => ({
      uid: `${c.id}-${body.workspace_id}@familypause.com`,
      title: titleOf(c),
      description: c.source || c.task,
      event_date: c.date!,
      event_time: c.date_only || !c.time ? null : c.time,
      date_only: !!c.date_only || !c.time,
      duration_minutes: c.duration_minutes,
      timeZone,
    })));

    const from = Deno.env.get("REMINDER_FROM_EMAIL") || "FamilyPause <reminders@familypause.com>";
    const spouse = body.spouse_name || "your spouse";
    const subject = `Your FamilyPause plan${body.meeting_date ? ` · ${body.meeting_date}` : ""}`;

    const html = `<!DOCTYPE html>
<html><body style="font-family:Inter,system-ui,sans-serif;color:#0F172A;padding:40px 24px;">
  <p style="color:#14805E;font-weight:600;">FamilyPause</p>
  <h1 style="font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:800;letter-spacing:-.03em;">Your week is set</h1>
  <p style="color:#475569;line-height:1.6;">Here’s the plan for you and ${escapeHtml(spouse)}. The .ics attachment adds every dated item at once.</p>
  <ul style="padding-left:18px;color:#0F172A;">${listHtml || "<li>No dated items this week.</li>"}</ul>
  <p style="margin-top:28px;">Spence<br/><span style="color:#94A3B8;">FamilyPause</span></p>
</body></html>`;

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: emails,
        subject,
        html,
        attachments: ics
          ? [{ filename: "familypause-plan.ics", content: toBase64(ics) }]
          : [],
      }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) return json({ error: sendData?.message || "Resend failed" }, 502);

    return json({ ok: true, id: sendData?.id, recipients: emails.length });
  } catch (e) {
    console.error("[email-plan]", e);
    return json({ error: String(e) }, 500);
  }
});
