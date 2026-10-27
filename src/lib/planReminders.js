import { supabase } from "./supabase";
import { CALENDAR_REMINDER_OPTIONS } from "./googleCalendar";

/** Default Set Reminder when the user leaves Select empty. */
export const DEFAULT_REMINDER_OFFSET = "1440"; // 1 day before

/** Google Calendar API sync is dormant until OAuth verification clears. */
export const ENABLE_GOOGLE_CALENDAR_SYNC = false;

export function reminderLabelFromOffset(minutes) {
  if (minutes == null) return null;
  const m = Number(minutes);
  const match = CALENDAR_REMINDER_OPTIONS.find((o) => o.value !== "custom" && o.value !== "none" && Number(o.value) === m);
  if (match) return match.label;
  if (m === 0) return "At time of event";
  if (m === 1440) return "1 day before";
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? "" : "s"} before`;
  return `${m} minutes before`;
}

export function reminderLabelFromCard(card) {
  if (!card) return null;
  if (card.reminder_label) return card.reminder_label;
  if (card.calendar_reminder === "none") return "No reminder";
  if (card.calendar_reminder === "custom") {
    return reminderLabelFromOffset(card.calendar_reminder_minutes);
  }
  if (card.calendar_reminder == null || card.calendar_reminder === "") {
    return reminderLabelFromOffset(Number(DEFAULT_REMINDER_OFFSET));
  }
  return reminderLabelFromOffset(Number(card.calendar_reminder));
}

/** Coerce blank reminder picks to the product default. */
export function coerceReminderFields(card) {
  const choice = card?.calendar_reminder;
  if (choice === "none") {
    return { calendar_reminder: "none", calendar_reminder_minutes: null };
  }
  if (choice === "custom") {
    const m = Number(card.calendar_reminder_minutes);
    return {
      calendar_reminder: "custom",
      calendar_reminder_minutes: Number.isFinite(m) && m >= 0 ? m : Number(DEFAULT_REMINDER_OFFSET),
    };
  }
  if (choice == null || choice === "") {
    return {
      calendar_reminder: DEFAULT_REMINDER_OFFSET,
      calendar_reminder_minutes: null,
    };
  }
  return {
    calendar_reminder: String(choice),
    calendar_reminder_minutes: null,
  };
}

/**
 * Schedule email reminders for kept cards (edge: schedule-reminders).
 * Must run before the session row is deleted.
 */
export async function scheduleItemReminders({
  workspaceId,
  sessionId,
  meetingDate,
  cards,
}) {
  if (!workspaceId) throw new Error("Missing workspace");

  const { data, error } = await supabase.functions.invoke("schedule-reminders", {
    body: {
      workspace_id: workspaceId,
      session_id: sessionId || null,
      meeting_date: meetingDate,
      cards,
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

/** Merge schedule API results onto card objects for Plan UI. */
export function applyReminderScheduleToCards(cards, scheduleResult) {
  const byId = new Map(
    (scheduleResult?.scheduled || []).map((s) => [String(s.card_id), s]),
  );
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
    if (hit) {
      return {
        ...c,
        ...coerceReminderFields(c),
        reminder_scheduled: true,
        reminder_offset_minutes: hit.reminder_offset_minutes,
        reminder_label: reminderLabelFromOffset(hit.reminder_offset_minutes),
        reminder_id: hit.reminder_id,
      };
    }
    if (skippedNone.has(id) || c.calendar_reminder === "none") {
      return {
        ...c,
        calendar_reminder: "none",
        reminder_scheduled: false,
        reminder_label: "No reminder",
        reminder_needs_set: true,
      };
    }
    if (skippedOther.has(id)) {
      return {
        ...c,
        ...coerceReminderFields(c),
        reminder_scheduled: false,
        reminder_needs_set: true,
        reminder_skip_reason: skippedOther.get(id),
        reminder_label: "Set reminder",
      };
    }
    return c;
  });
}

export function reminderScheduleOutcome(keptCards) {
  const kept = keptCards || [];
  const scheduled = kept.filter((c) => c.reminder_scheduled).length;
  const needsSet = kept.filter((c) => c.reminder_needs_set || (!c.reminder_scheduled && c.calendar_reminder === "none")).length;
  const failed = kept.filter((c) => c.reminder_schedule_failed).length;
  if (failed > 0 && scheduled === 0) return { state: "failed", scheduled, needsSet, failed };
  if (failed > 0) return { state: "partial", scheduled, needsSet, failed };
  if (scheduled > 0) return { state: "succeeded", scheduled, needsSet, failed: 0 };
  if (needsSet > 0) return { state: "needs_set", scheduled: 0, needsSet, failed: 0 };
  return { state: "idle", scheduled: 0, needsSet: 0, failed: 0 };
}
