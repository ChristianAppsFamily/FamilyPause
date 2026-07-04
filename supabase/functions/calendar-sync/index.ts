import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleAccessToken } from "../_shared/googleOAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

type CalendarEventInput = {
  id: number | string;
  title: string;
  date: string;
  time?: string | null;
  duration_minutes?: number;
  description?: string;
  recurrence?: boolean;
};

type SessionCard = Record<string, unknown> & { id: number | string };

function normalizeTime(time: string): string {
  const [h, m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/** Wall-clock end date/time without timezone conversion (same calendar semantics as start). */
function addDurationToLocal(
  date: string,
  time: string,
  durationMinutes: number,
): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = normalizeTime(time).split(":").map(Number);
  let totalMinutes = h * 60 + mi + durationMinutes;
  let dayOffset = Math.floor(totalMinutes / (24 * 60));
  totalMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  const dt = new Date(Date.UTC(y, mo - 1, d + dayOffset));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    time: `${pad(endH)}:${pad(endM)}`,
  };
}

function buildEventBody(ev: CalendarEventInput, userTimeZone: string) {
  const time = normalizeTime(ev.time || "10:00");
  const duration = ev.duration_minutes ?? 60;
  const startDateTime = `${ev.date}T${time}:00`;
  const endLocal = addDurationToLocal(ev.date, time, duration);
  const endDateTime = `${endLocal.date}T${endLocal.time}:00`;

  const body: Record<string, unknown> = {
    summary: ev.title,
    description: ev.description || "",
    start: { dateTime: startDateTime, timeZone: userTimeZone },
    end: { dateTime: endDateTime, timeZone: userTimeZone },
  };
  if (ev.recurrence) {
    body.recurrence = [`RRULE:FREQ=WEEKLY;TZID=${userTimeZone}`];
  }
  return body;
}

async function createGoogleEvent(accessToken: string, eventBody: Record<string, unknown>) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    },
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function deleteGoogleEvent(accessToken: string, eventId: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return { ok: res.ok, status: res.status };
}

async function patchSessionCards(
  admin: ReturnType<typeof createClient>,
  sessionId: string,
  patches: Array<{ cardId: number | string; googleEventId?: string | null; unsync?: boolean }>,
) {
  const { data: session, error } = await admin
    .from("sessions")
    .select("cards")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session?.cards || !Array.isArray(session.cards)) return;

  const patchById = Object.fromEntries(patches.map((p) => [String(p.cardId), p]));
  const updated = (session.cards as SessionCard[]).map((c) => {
    const patch = patchById[String(c.id)];
    if (!patch) return c;
    if (patch.unsync) {
      return {
        ...c,
        calendar_synced: false,
        google_event_id: null,
        calendar_sync_failed: false,
      };
    }
    return {
      ...c,
      calendar_synced: true,
      google_event_id: patch.googleEventId ?? null,
      calendar_sync_failed: false,
    };
  });

  await admin.from("sessions").update({ cards: updated }).eq("id", sessionId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as {
      action?: string;
      workspace_id?: string;
      event_id?: string;
      session_id?: string;
      card_id?: number | string;
      time_zone?: string;
      events?: CalendarEventInput[];
    };

    const { workspace_id } = body;
    if (!workspace_id) return json({ error: "Missing workspace_id" }, 400);

    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return json({ error: "Not a workspace member" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: rowErr } = await admin
      .from("workspace_members")
      .select("id, google_calendar_token, google_calendar_refresh_token")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    if (rowErr || !row?.google_calendar_refresh_token) {
      return json({ error: "Google Calendar not connected" }, 400);
    }

    let accessToken = row.google_calendar_token as string;
    const refreshToken = row.google_calendar_refresh_token as string;

    async function ensureFreshToken() {
      const refreshed = await refreshGoogleAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      await admin.from("workspace_members").update({
        google_calendar_token: accessToken,
      }).eq("id", row!.id);
    }

    if (body.action === "delete") {
      const { event_id, session_id, card_id } = body;
      if (!event_id) return json({ error: "Missing event_id" }, 400);

      let attempt = await deleteGoogleEvent(accessToken, event_id);
      if (attempt.status === 401) {
        try {
          await ensureFreshToken();
          attempt = await deleteGoogleEvent(accessToken, event_id);
        } catch (refreshErr) {
          return json({
            success: false,
            error: refreshErr instanceof Error ? refreshErr.message : "Token refresh failed",
          }, 400);
        }
      }

      const gone = attempt.status === 404;
      if (!attempt.ok && !gone) {
        return json({ success: false, error: "Failed to delete calendar event" }, 400);
      }

      if (session_id && card_id != null) {
        await patchSessionCards(admin, session_id, [{ cardId: card_id, unsync: true }]);
      }

      return json({ success: true, notFound: gone });
    }

    const { events, session_id, time_zone: timeZoneRaw } = body;
    if (!Array.isArray(events) || !events.length) {
      return json({ error: "Missing events" }, 400);
    }

    const userTimeZone =
      typeof timeZoneRaw === "string" && timeZoneRaw.trim()
        ? timeZoneRaw.trim()
        : DEFAULT_TIME_ZONE;

    const results: { id: number | string; success: boolean; googleEventId?: string; error?: string }[] = [];
    const sessionPatches: Array<{ cardId: number | string; googleEventId: string }> = [];

    for (const ev of events) {
      const eventBody = buildEventBody(ev, userTimeZone);
      console.log("[calendar-sync] Google event start:", JSON.stringify(eventBody.start));
      if (eventBody.recurrence) {
        console.log("[calendar-sync] recurrence:", JSON.stringify(eventBody.recurrence));
      }
      let attempt = await createGoogleEvent(accessToken, eventBody);

      if (attempt.status === 401) {
        try {
          await ensureFreshToken();
          attempt = await createGoogleEvent(accessToken, eventBody);
        } catch (refreshErr) {
          results.push({
            id: ev.id,
            success: false,
            error: refreshErr instanceof Error ? refreshErr.message : "Token refresh failed",
          });
          continue;
        }
      }

      if (attempt.ok && attempt.data?.id) {
        results.push({ id: ev.id, success: true, googleEventId: attempt.data.id as string });
        sessionPatches.push({ cardId: ev.id, googleEventId: attempt.data.id as string });
      } else {
        results.push({
          id: ev.id,
          success: false,
          error: attempt.data?.error?.message || "Failed to create event",
        });
      }
    }

    if (session_id && sessionPatches.length) {
      await patchSessionCards(admin, session_id, sessionPatches);
    }

    return json({ results });
  } catch (e) {
    console.error("[calendar-sync]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
