import { supabase } from "./supabase";

/** @typedef {{ connected: boolean, connectedAt: string|null, memberId: string|null, googleEmail: string|null }} CalendarConnection */

/** Calendar-relevant card missing date or time — needs Resolve times step. */
export function needsDateTime(card) {
  if (card.type === "note") return false;
  if (card.date && card.time) return false;
  if (
    card.type === "event"
    || card.recurring
    || card.date
    || card.time
  ) {
    return !card.date || !card.time;
  }
  // Open actions/decisions with no schedule — optional date/time in Resolve
  return card.type === "action" || card.type === "decision";
}

/** Both date and time required for Google Calendar sync. */
export function isSyncEligible(card) {
  return !!(card.date && card.time);
}

/** Item may belong on a calendar (used for sync guard warnings). */
export function isCalendarRelevant(card) {
  return (
    card.type === "event"
    || (card.type === "action" && card.recurring)
    || !!card.date
    || !!card.time
  );
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

/** Map a kept card to calendar-sync API payload (requires date and time). */
export function cardToCalendarEvent(card) {
  if (!card.date || !card.time) {
    throw new Error("Card missing date or time");
  }
  return {
    id: card.id,
    title: card.task,
    date: card.date,
    time: card.time,
    duration_minutes: card.duration_minutes ?? 60,
    description: card.source || card.task,
    recurrence: !!card.recurring,
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
 * @param {{ sessionId?: string }} [opts]
 * @returns {Promise<{ results: object[], updatedCards: object[] }>}
 */
export async function syncCardsToCalendar(workspaceId, cards, opts = {}) {
  const kept = cards.filter((c) => c.status === "kept" || c.status === "calendared");
  const unsyncedRelevant = kept.filter((c) => !c.calendar_synced && isCalendarRelevant(c));
  const skipped = unsyncedRelevant.filter((c) => !isSyncEligible(c));
  if (skipped.length) {
    console.warn(
      "[calendar-sync] Skipped items missing date or time:",
      skipped.map((c) => ({ id: c.id, task: c.task, date: c.date, time: c.time })),
    );
  }
  const toSync = kept.filter((c) => isSyncEligible(c) && !c.calendar_synced);
  if (!toSync.length) return { results: [], updatedCards: cards };
  const events = toSync.map(cardToCalendarEvent);
  const { results } = await syncCalendarEvents(workspaceId, events, opts);
  return { results, updatedCards: applySyncResults(cards, results) };
}
