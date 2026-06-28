import { supabase } from "./supabase";

/** @typedef {{ connected: boolean, connectedAt: string|null, memberId: string|null }} CalendarConnection */

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
 * @returns {Promise<{ connected: boolean, connectedAt: string|null, memberId: string|null }>}
 */
export async function getCalendarConnection(workspaceId, userId) {
  if (!workspaceId || !userId) {
    return { connected: false, connectedAt: null, memberId: null };
  }
  const { data } = await supabase
    .from("workspace_members")
    .select("id, google_calendar_refresh_token, google_calendar_connected_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    connected: !!data?.google_calendar_refresh_token,
    connectedAt: data?.google_calendar_connected_at ?? null,
    memberId: data?.id ?? null,
  };
}

/** @param {string} memberId */
export async function disconnectGoogleCalendar(memberId) {
  if (!memberId) return;
  await supabase.from("workspace_members").update({
    google_calendar_token: null,
    google_calendar_refresh_token: null,
    google_calendar_connected_at: null,
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

/** Map a kept card to calendar-sync API payload. */
export function cardToCalendarEvent(card) {
  return {
    id: card.id,
    title: card.task,
    date: card.date,
    time: card.time || null,
    duration_minutes: card.duration_minutes ?? 60,
    description: card.source || card.task,
    recurrence: !!card.recurring,
  };
}
