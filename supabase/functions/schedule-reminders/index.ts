// schedule-reminders — JWT required.
// Inserts plan_item_reminders rows for kept cards before the session is deleted.
// Deploy: supabase functions deploy schedule-reminders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeRemindAt } from "../_shared/remindAt.ts";

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

const DEFAULT_OFFSET = 1440; // 1 day before

type InCard = {
  id?: number | string;
  status?: string;
  task?: string;
  source?: string;
  date?: string | null;
  time?: string | null;
  date_only?: boolean;
  calendar_reminder?: string | null;
  calendar_reminder_minutes?: number | null;
  duration_minutes?: number | null;
  type?: string;
};

function reminderOffsetMinutes(card: InCard): number | null {
  const choice = card.calendar_reminder;
  if (choice === "none") return null;
  if (choice == null || choice === "") return DEFAULT_OFFSET;
  if (choice === "custom") {
    const m = Number(card.calendar_reminder_minutes);
    if (!Number.isFinite(m) || m < 0) return DEFAULT_OFFSET;
    return Math.round(m);
  }
  const m = Number(choice);
  if (!Number.isFinite(m) || m < 0) return DEFAULT_OFFSET;
  return Math.round(m);
}

function keptStatus(card: InCard) {
  const s = String(card.status || "").toLowerCase();
  return s === "kept" || s === "calendared";
}

function calendarTitle(card: InCard): string {
  const task = (card.task || "").trim() || "Untitled";
  const type = (card.type || "action").toLowerCase();
  if (type === "event") return task;
  if (type === "action") return task.startsWith("To-Do:") ? task : `To-Do: ${task}`;
  if (type === "decision") return task.startsWith("Decision:") ? task : `Decision: ${task}`;
  if (type === "note") return task.startsWith("Note:") ? task : `Note: ${task}`;
  return task;
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

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as {
      workspace_id?: string;
      session_id?: string | null;
      meeting_date?: string;
      cards?: InCard[];
    };

    const workspaceId = body.workspace_id;
    if (!workspaceId) return json({ error: "Missing workspace_id" }, 400);
    if (!Array.isArray(body.cards)) return json({ error: "Missing cards" }, 400);

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const admin = createClient(supabaseUrl, serviceKey);
    const meetingDate = body.meeting_date || null;
    const scheduled: Array<{
      card_id: string;
      reminder_id: string;
      reminder_offset_minutes: number;
      remind_at: string;
      access_token: string;
    }> = [];
    const skipped: Array<{ card_id: string; reason: string }> = [];

    for (const card of body.cards) {
      const cardId = String(card.id ?? "");
      if (!cardId) {
        skipped.push({ card_id: "", reason: "missing_id" });
        continue;
      }
      if (!keptStatus(card)) {
        skipped.push({ card_id: cardId, reason: "not_kept" });
        continue;
      }

      const offset = reminderOffsetMinutes(card);
      if (offset === null) {
        skipped.push({ card_id: cardId, reason: "none" });
        continue;
      }

      const eventDate = (card.date || meetingDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        skipped.push({ card_id: cardId, reason: "missing_date" });
        continue;
      }

      const dateOnly = !!card.date_only || !card.time;
      if (!dateOnly && !card.time) {
        skipped.push({ card_id: cardId, reason: "missing_time" });
        continue;
      }

      const remindAt = computeRemindAt({
        event_date: eventDate,
        event_time: dateOnly ? null : card.time,
        date_only: dateOnly,
        reminder_offset_minutes: offset,
      });

      const title = calendarTitle(card);
      const description = (card.source || card.task || title || "").slice(0, 2000);
      const icsUid = `${cardId}-${workspaceId}@familypause.com`;

      const row = {
        workspace_id: workspaceId,
        session_id: body.session_id || null,
        card_id: cardId,
        title,
        description,
        event_date: eventDate,
        event_time: dateOnly ? null : String(card.time),
        date_only: dateOnly,
        reminder_offset_minutes: offset,
        remind_at: remindAt.toISOString(),
        status: "pending",
        ics_uid: icsUid,
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await admin
        .from("plan_item_reminders")
        .insert(row)
        .select("id, access_token, remind_at, reminder_offset_minutes")
        .single();

      if (error || !inserted) {
        console.error("[schedule-reminders] insert", cardId, error);
        skipped.push({ card_id: cardId, reason: "insert_failed" });
        continue;
      }

      scheduled.push({
        card_id: cardId,
        reminder_id: inserted.id,
        reminder_offset_minutes: inserted.reminder_offset_minutes,
        remind_at: inserted.remind_at,
        access_token: inserted.access_token,
      });
    }

    return json({
      ok: true,
      scheduled_count: scheduled.length,
      scheduled,
      skipped,
    });
  } catch (e) {
    console.error("[schedule-reminders]", e);
    return json({ error: String(e) }, 500);
  }
});
