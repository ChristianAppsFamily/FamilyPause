import { supabase } from "./supabase";
import {
  coercePlanReminderChoice,
  defaultReminderForType,
  PLAN_REMINDER_OPTIONS,
  reminderChoiceLabel,
} from "./remindAt.js";

export { PLAN_REMINDER_OPTIONS, defaultReminderForType, coercePlanReminderChoice, reminderChoiceLabel };

/** Google Calendar API sync is dormant until OAuth verification clears. */
export const ENABLE_GOOGLE_CALENDAR_SYNC = false;

/** @deprecated Prefer PLAN_REMINDER_OPTIONS / coercePlanReminderChoice */
export const DEFAULT_REMINDER_OFFSET = "day_before";

export function reminderLabelFromOffset(minutes) {
  if (minutes == null) return null;
  const m = Number(minutes);
  if (m === 0) return "Morning of";
  if (m === 60) return "1 hour before";
  if (m === 1440) return "Day before";
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? "" : "s"} before`;
  return `${m} minutes before`;
}

export function reminderLabelFromCard(card) {
  if (!card) return null;
  if (card.reminder_label) return card.reminder_label;
  const choice = coercePlanReminderChoice(card);
  return reminderChoiceLabel(choice);
}

/** Coerce blank reminder picks to type defaults (new choice set). */
export function coerceReminderFields(card) {
  const choice = coercePlanReminderChoice(card);
  return {
    calendar_reminder: choice,
    calendar_reminder_minutes: null,
  };
}

/**
 * Schedule email reminders for kept cards (edge: schedule-reminders).
 */
export async function scheduleItemReminders({
  workspaceId,
  sessionId,
  meetingDate,
  cards,
  cardIdsToCancel,
}) {
  if (!workspaceId) throw new Error("Missing workspace");

  const { data, error } = await supabase.functions.invoke("schedule-reminders", {
    body: {
      workspace_id: workspaceId,
      session_id: sessionId || null,
      meeting_date: meetingDate,
      cards: (cards || []).map((c) => ({ ...c, ...coerceReminderFields(c) })),
      card_ids_to_cancel: cardIdsToCancel || [],
    },
  });

  if (error) {
    const ctx = error?.context;
    let body = data;
    if (!body && ctx && typeof ctx.json === "function") {
      try { body = await ctx.json(); } catch { /* ignore */ }
    }
    throw new Error(body?.error || error.message || "Could not schedule reminders");
  }

  if (!data?.ok && data?.error) {
    throw new Error(data.error);
  }

  return data || { scheduled_count: 0, scheduled: [], skipped: [] };
}

/** Email the plan to holder + spouse. */
export async function emailPlanToFamily({
  workspaceId,
  meetingDate,
  spouseName,
  cards,
}) {
  if (!workspaceId) throw new Error("Missing workspace");
  const { data, error } = await supabase.functions.invoke("email-plan", {
    body: {
      workspace_id: workspaceId,
      meeting_date: meetingDate,
      spouse_name: spouseName,
      cards,
    },
  });
  if (error) {
    let body = data;
    if (!body && error?.context && typeof error.context.json === "function") {
      try { body = await error.context.json(); } catch { /* ignore */ }
    }
    throw new Error(body?.error || error.message || "Could not email plan");
  }
  if (!data?.ok && data?.error) throw new Error(data.error);
  return data;
}

/** Merge schedule API results onto card objects for Plan UI. */
export function applyReminderScheduleToCards(cards, scheduleResult) {
  const byId = new Map();
  for (const s of scheduleResult?.scheduled || []) {
    const id = String(s.card_id);
    if (!byId.has(id)) byId.set(id, s);
  }
  const skippedNone = new Set(
    (scheduleResult?.skipped || [])
      .filter((s) => s.reason === "none")
      .map((s) => String(s.card_id)),
  );
  const skippedOther = new Map(
    (scheduleResult?.skipped || [])
      .filter((s) => s.reason !== "none" && s.reason !== "not_kept")
      .map((s) => [String(s.card_id), s.reason]),
  );

  return cards.map((c) => {
    const id = String(c.id);
    const hit = byId.get(id);
    const coerced = coerceReminderFields(c);
    if (hit) {
      return {
        ...c,
        ...coerced,
        reminder_scheduled: true,
        reminder_offset_minutes: hit.reminder_offset_minutes,
        reminder_label: reminderChoiceLabel(hit.reminder_choice || coerced.calendar_reminder),
        reminder_id: hit.reminder_id,
        reminder_needs_set: false,
      };
    }
    if (skippedNone.has(id) || coerced.calendar_reminder === "none") {
      return {
        ...c,
        ...coerced,
        calendar_reminder: "none",
        reminder_scheduled: false,
        reminder_label: "None",
        reminder_needs_set: false,
      };
    }
    if (skippedOther.has(id)) {
      return {
        ...c,
        ...coerced,
        reminder_scheduled: false,
        reminder_needs_set: true,
        reminder_skip_reason: skippedOther.get(id),
        reminder_label: "Set reminder",
      };
    }
    return { ...c, ...coerced };
  });
}

export function reminderScheduleOutcome(keptCards) {
  const kept = keptCards || [];
  const scheduled = kept.filter((c) => c.reminder_scheduled).length;
  const needsSet = kept.filter((c) => c.reminder_needs_set).length;
  const failed = kept.filter((c) => c.reminder_schedule_failed).length;
  if (failed > 0 && scheduled === 0) return { state: "failed", scheduled, needsSet, failed };
  if (failed > 0) return { state: "partial", scheduled, needsSet, failed };
  if (scheduled > 0) return { state: "succeeded", scheduled, needsSet, failed: 0 };
  if (needsSet > 0) return { state: "needs_set", scheduled: 0, needsSet, failed: 0 };
  return { state: "idle", scheduled: 0, needsSet: 0, failed: 0 };
}
