// schedule-reminders — JWT required.
// Replaces pending plan_item_reminders for kept cards (holder + spouse).
// Deploy: supabase functions deploy schedule-reminders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  coerceReminderChoice,
  computeReminderSends,
  DEFAULT_TIME_ZONE,
} from "../_shared/remindAt.ts";

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

type InCard = {
  id?: number | string;
  status?: string;
  task?: string;
  source?: string;
  date?: string | null;
  time?: string | null;
  date_only?: boolean;
  date_precision?: string | null;
  calendar_reminder?: string | null;
  type?: string;
  duration_minutes?: number | null;
  recurring?: boolean;
  byday?: string[] | null;
};

function keptStatus(card: InCard) {
  const s = String(card.status || "").toLowerCase();
  return s === "kept" || s === "calendared";
}

function calendarTitle(card: InCard): string {
  const task = (card.task || "").trim() || "Untitled";
  const type = (card.type || "action").toLowerCase();
  if (type === "event" || type === "time_together") return task;
  if (type === "action") return task.startsWith("To-Do:") ? task : `To-Do: ${task}`;
  if (type === "decision") return task.startsWith("Decision:") ? task : `Decision: ${task}`;
  if (type === "note") return task.startsWith("Note:") ? task : `Note: ${task}`;
  return task;
}

function offsetMinutesForChoice(choice: string): number {
  if (choice === "morning_of") return 0;
  if (choice === "1_hour") return 60;
  if (choice === "day_before") return 1440;
  if (choice === "checkin_9am") return 0;
  const n = Number(choice);
  return Number.isFinite(n) ? n : 1440;
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
      card_ids_to_cancel?: string[];
    };

    const workspaceId = body.workspace_id;
    if (!workspaceId) return json({ error: "Missing workspace_id" }, 400);
    if (!Array.isArray(body.cards) && !Array.isArray(body.card_ids_to_cancel)) {
      return json({ error: "Missing cards" }, 400);
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ws } = await admin
      .from("workspaces")
      .select("id, timezone, reminder_emails_enabled, owner_id")
      .eq("id", workspaceId)
      .maybeSingle();

    const timeZone = ws?.timezone || DEFAULT_TIME_ZONE;

    const { data: members } = await admin
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);

    const memberList = members || [];
    const recipients: Array<"holder" | "spouse"> = ["holder"];
    if (memberList.length >= 2) recipients.push("spouse");

    // Cancel pending for discarded cards
    for (const id of body.card_ids_to_cancel || []) {
      await admin
        .from("plan_item_reminders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("card_id", String(id))
        .eq("status", "pending");
    }

    const meetingDate = body.meeting_date || null;
    const scheduled: Array<{
      card_id: string;
      reminder_id: string;
      reminder_offset_minutes: number;
      remind_at: string;
      send_at: string;
      recipient: string;
      kind: string;
      access_token: string;
      reminder_choice: string;
    }> = [];
    const skipped: Array<{ card_id: string; reason: string }> = [];

    for (const card of body.cards || []) {
      const cardId = String(card.id ?? "");
      if (!cardId) {
        skipped.push({ card_id: "", reason: "missing_id" });
        continue;
      }
      if (!keptStatus(card)) {
        await admin
          .from("plan_item_reminders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("card_id", cardId)
          .eq("status", "pending");
        skipped.push({ card_id: cardId, reason: "not_kept" });
        continue;
      }

      // Replace pending rows for this card
      await admin
        .from("plan_item_reminders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("card_id", cardId)
        .eq("status", "pending");

      if (card.date_precision === "month") {
        skipped.push({ card_id: cardId, reason: "month_only" });
        continue;
      }

      const choice = coerceReminderChoice(card);
      if (choice === "none") {
        skipped.push({ card_id: cardId, reason: "none" });
        continue;
      }

      const eventDate = (card.date || meetingDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        skipped.push({ card_id: cardId, reason: "missing_date" });
        continue;
      }

      const dateOnly = !!card.date_only || !card.time;
      const sends = computeReminderSends({
        event_date: eventDate,
        event_time: dateOnly ? null : card.time,
        date_only: dateOnly,
        reminder_choice: choice,
        type: card.type,
        timeZone,
      });

      if (!sends.length) {
        skipped.push({ card_id: cardId, reason: "none" });
        continue;
      }

      const title = calendarTitle(card);
      const description = (card.source || card.task || title || "").slice(0, 2000);
      const icsUid = `${cardId}-${workspaceId}@familypause.com`;

      for (const send of sends) {
        for (const recipient of recipients) {
          const row = {
            workspace_id: workspaceId,
            session_id: body.session_id || null,
            card_id: cardId,
            title,
            description,
            event_date: eventDate,
            event_time: dateOnly ? null : String(card.time),
            date_only: dateOnly,
            reminder_offset_minutes: offsetMinutesForChoice(send.choice),
            remind_at: send.sendAt.toISOString(),
            send_at: send.sendAt.toISOString(),
            status: "pending",
            ics_uid: icsUid,
            recipient,
            kind: send.kind,
            reminder_choice: send.choice,
            attempts: 0,
            recurring: !!card.recurring,
            updated_at: new Date().toISOString(),
          };

          const { data: inserted, error } = await admin
            .from("plan_item_reminders")
            .insert(row)
            .select("id, access_token, remind_at, send_at, reminder_offset_minutes, recipient, kind, reminder_choice")
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
            remind_at: inserted.send_at || inserted.remind_at,
            send_at: inserted.send_at || inserted.remind_at,
            recipient: inserted.recipient,
            kind: inserted.kind,
            access_token: inserted.access_token,
            reminder_choice: inserted.reminder_choice || choice,
          });
        }
      }
    }

    return json({
      ok: true,
      scheduled_count: scheduled.length,
      scheduled,
      skipped,
      timezone: timeZone,
      reminder_emails_enabled: ws?.reminder_emails_enabled !== false,
    });
  } catch (e) {
    console.error("[schedule-reminders]", e);
    return json({ error: String(e) }, 500);
  }
});
