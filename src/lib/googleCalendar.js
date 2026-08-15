import { supabase } from "./supabase";

/** @typedef {{ connected: boolean, connectedAt: string|null, memberId: string|null, googleEmail: string|null }} CalendarConnection */

/** Schema types stored on cards. */
export const CARD_TYPES = ["event", "action", "decision", "note"];

const TYPE_LABELS = {
  event: "Event",
  action: "To-Do",
  decision: "Decision",
  note: "Note",
};

/** UI label for a schema type. */
export function typeLabel(type) {
  return TYPE_LABELS[type] || "To-Do";
}

/** Calendar event title from current type + task (regenerated at sync).
 * User-authored titles (titleEditedByUser) ship as-is — never clobber with type logic.
 */
export function calendarTitle(card) {
  const task = (card?.task || "").trim() || "Untitled";
  if (card?.titleEditedByUser) return task;
  if (card?.type === "event") return task;
  return `${typeLabel(card?.type)}: ${task}`;
}

/** Types that benefit from an optional/manual date-time before sync. */
export function typeNeedsSchedule(type) {
  return type === "event" || type === "action" || type === "decision";
}

/**
 * Calendar-bound card missing date or time — offer in Times / Review schedule row.
 * Notes only appear if they already have a partial schedule.
 */
export function needsDateTime(card) {
  if (!card) return false;
  if (card.date && card.time) return false;
  if (card.type === "note") {
    return !!(card.date || card.time);
  }
  if (typeNeedsSchedule(card.type)) {
    return !card.date || !card.time;
  }
  return false;
}

/**
 * Kept/calendared card can sync — timed if complete, else all-day via meetingDate.
 * @param {object} card
 * @param {{ meetingDate?: string, requireResolved?: boolean }} [opts]
 */
export function isSyncEligible(card, opts = {}) {
  if (!(card.status === "kept" || card.status === "calendared")) return false;
  if (opts.requireResolved && (!card.date || !card.time)) return false;
  if (card.date && card.time) return true;
  const fallbackDate = card.date || opts.meetingDate;
  return !!fallbackDate;
}

/** All kept items are calendar-relevant. */
export function isCalendarRelevant(card) {
  return card.status === "kept" || card.status === "calendared"
    || card.type === "event"
    || card.type === "action"
    || card.type === "decision"
    || card.type === "note"
    || !!card.date
    || !!card.time;
}

/**
 * Start Google Calendar OAuth — redirects browser to Google consent.
 * @param {string} workspaceId
 * @param {string} [returnTo] path e.g. '/app/settings?calendar=connected'
 */
export async function startGoogleCalendarConnect(workspaceId, returnTo = "/app/settings?calendar=connected") {
  const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
    body: { workspace_id: workspaceId, return_to: returnTo },
  });
  if (error) throw new Error(error.message || "Could not start Google Calendar connect");
  if (!data?.url) throw new Error(data?.error || "No authorization URL returned");
  window.location.href = data.url;
}

/**
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {Promise<{ connected: boolean, connectedAt: string|null, memberId: string|null, googleEmail: string|null }>}
 */
export async function getCalendarConnection(workspaceId, userId) {
  if (!workspaceId || !userId) {
    return { connected: false, connectedAt: null, memberId: null, googleEmail: null };
  }
  const { data } = await supabase
    .from("workspace_members")
    .select("id, google_calendar_refresh_token, google_calendar_connected_at, google_calendar_email")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    connected: !!data?.google_calendar_refresh_token,
    connectedAt: data?.google_calendar_connected_at ?? null,
    memberId: data?.id ?? null,
    googleEmail: data?.google_calendar_email ?? null,
  };
}

/** @param {string} memberId */
export async function disconnectGoogleCalendar(memberId) {
  if (!memberId) return;
  await supabase.from("workspace_members").update({
    google_calendar_token: null,
    google_calendar_refresh_token: null,
    google_calendar_connected_at: null,
    google_calendar_email: null,
  }).eq("id", memberId);
}

/** IANA timezone from the browser (e.g. America/Los_Angeles). */
export function getUserTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === "string" ? tz : "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

/**
 * @param {string} workspaceId
 * @param {object[]} events
 * @param {{ sessionId?: string, timeZone?: string }} [opts]
 */
export async function syncCalendarEvents(workspaceId, events, opts = {}) {
  const payload = {
    workspace_id: workspaceId,
    events,
    time_zone: opts.timeZone ?? getUserTimeZone(),
  };
  if (opts.sessionId) payload.session_id = opts.sessionId;
  const { data, error } = await supabase.functions.invoke("calendar-sync", {
    body: payload,
  });
  if (error) throw new Error(error.message || "Calendar sync failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Remove a synced event from Google Calendar and optionally clear session card state.
 * @param {string} workspaceId
 * @param {string} eventId
 * @param {{ sessionId?: string, cardId?: number|string }} [opts]
 * @returns {Promise<{ success: boolean, notFound?: boolean }>}
 */
export async function unsyncCalendarEvent(workspaceId, eventId, opts = {}) {
  const payload = {
    action: "delete",
    workspace_id: workspaceId,
    event_id: eventId,
  };
  if (opts.sessionId) payload.session_id = opts.sessionId;
  if (opts.cardId != null) payload.card_id = opts.cardId;
  const { data, error } = await supabase.functions.invoke("calendar-sync", { body: payload });
  if (error) throw new Error(error.message || "Calendar unsync failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Clear calendar sync fields on a single card (client state). */
export function clearCardCalendarSync(cards, cardId) {
  return cards.map((c) => (
    c.id === cardId
      ? { ...c, calendar_synced: false, google_event_id: null, calendar_sync_failed: false }
      : c
  ));
}

/** Google Calendar reminder choices — user-picked, never inferred from card type. */
export const CALENDAR_REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "0", label: "At time of event" },
  { value: "5", label: "5 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "custom", label: "Custom" },
];

/**
 * Build a Google Calendar reminders override from the user's pick.
 * Unset → omit (no automatic reminder). None → explicit empty overrides.
 */
export function googleRemindersFromCard(card) {
  const choice = card?.calendar_reminder;
  if (choice == null || choice === "") return undefined;
  if (choice === "none") {
    return { useDefault: false, overrides: [] };
  }
  const minutes = choice === "custom"
    ? Number(card.calendar_reminder_minutes)
    : Number(choice);
  if (!Number.isFinite(minutes) || minutes < 0) return undefined;
  return {
    useDefault: false,
    overrides: [{ method: "popup", minutes: Math.round(minutes) }],
  };
}

/**
 * Map a kept card to calendar-sync API payload.
 * Timed when date+time present; otherwise all-day on card.date or meetingDate.
 * @param {object} card
 * @param {{ meetingDate?: string }} [opts]
 */
export function cardToCalendarEvent(card, opts = {}) {
  const title = calendarTitle(card);
  const description = card.source || card.task || title;
  const reminders = googleRemindersFromCard(card);
  if (card.date && card.time) {
    return {
      id: card.id,
      title,
      date: card.date,
      time: card.time,
      allDay: false,
      duration_minutes: card.duration_minutes ?? 60,
      description,
      recurrence: !!card.recurring,
      ...(reminders ? { reminders } : {}),
    };
  }
  const date = card.date || opts.meetingDate;
  if (!date) {
    throw new Error("Card missing date for calendar sync");
  }
  return {
    id: card.id,
    title,
    date,
    time: null,
    allDay: true,
    duration_minutes: null,
    description,
    recurrence: !!card.recurring,
    ...(reminders ? { reminders } : {}),
  };
}

/** Apply calendar-sync edge function results onto card list. */
export function applySyncResults(cards, results) {
  const byId = Object.fromEntries(results.map((r) => [String(r.id), r]));
  return cards.map((c) => {
    const r = byId[String(c.id)];
    if (!r) return c;
    if (r.success) {
      return {
        ...c,
        calendar_synced: true,
        google_event_id: r.googleEventId,
        calendar_sync_failed: false,
      };
    }
    return { ...c, calendar_sync_failed: true };
  });
}

/**
 * Batch-sync eligible kept cards that are not already synced.
 * @param {string} workspaceId
 * @param {object[]} cards
 * @param {{ sessionId?: string, meetingDate?: string }} [opts]
 * @returns {Promise<{ results: object[], updatedCards: object[] }>}
 */
export async function syncCardsToCalendar(workspaceId, cards, opts = {}) {
  const kept = cards.filter((c) => c.status === "kept" || c.status === "calendared");
  const toSync = kept.filter((c) => isSyncEligible(c, opts) && !c.calendar_synced);
  if (!toSync.length) return { results: [], updatedCards: cards };
  const events = toSync.map((c) => cardToCalendarEvent(c, { meetingDate: opts.meetingDate }));
  const { results } = await syncCalendarEvents(workspaceId, events, opts);
  return { results, updatedCards: applySyncResults(cards, results) };
}
