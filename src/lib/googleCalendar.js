import { supabase } from "./supabase";

/** @typedef {{ connected: boolean, connectedAt: string|null, memberId: string|null, googleEmail: string|null }} CalendarConnection */

/** Calendar-relevant card missing date or time — needs Resolve times step. */
export function needsDateTime(card) {
  const calendarRelevant =
    card.type === "event"
    || (card.type === "action" && card.recurring)
    || card.date
    || card.time;
  if (!calendarRelevant) return false;
  return !card.date || !card.time;
}

/** Both date and time required for Google Calendar sync. */
export function isSyncEligible(card) {
  return !!(card.date && card.time);
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

/**
 * @param {string} workspaceId
 * @param {object[]} events
 * @returns {Promise<{ results: Array<{ id: number|string, success: boolean, googleEventId?: string, error?: string }> }>}
 */
export async function syncCalendarEvents(workspaceId, events) {
  const { data, error } = await supabase.functions.invoke("calendar-sync", {
    body: { workspace_id: workspaceId, events },
  });
  if (error) throw new Error(error.message || "Calendar sync failed");
  if (data?.error) throw new Error(data.error);
  return data;
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
 * @returns {Promise<{ results: object[], updatedCards: object[] }>}
 */
export async function syncCardsToCalendar(workspaceId, cards) {
  const toSync = cards.filter((c) => isSyncEligible(c) && !c.calendar_synced);
  if (!toSync.length) return { results: [], updatedCards: cards };
  const events = toSync.map(cardToCalendarEvent);
  const { results } = await syncCalendarEvents(workspaceId, events);
  return { results, updatedCards: applySyncResults(cards, results) };
}
