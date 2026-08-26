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
  allDay?: boolean;
  duration_minutes?: number;
  description?: string;
  recurrence?: boolean;
  googleEventId?: string | null;
  byday?: string[] | null;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
};

type ItemResult = {
  id: number | string;
  success: boolean;
  googleEventId?: string;
  code?: string;
  error?: string;
};

/** Next calendar day YYYY-MM-DD for Google all-day end (exclusive). */
function nextDayIso(date: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

type SessionCard = Record<string, unknown> & { id: number | string };

type Subscription = {
  plan?: string | null;
  active?: boolean | null;
  trial_ends_at?: string | null;
};

function hasFamilyFeatures(
  subscription: Subscription | null,
  { freeSessionsUsed = 0, sessionInProgress = false } = {},
): boolean {
  const paid = subscription?.active === true
    && (
      subscription.plan === "family"
      || subscription.plan === "pro"
      || subscription.plan === "ministry"
    );
  if (paid) return true;
  if (freeSessionsUsed < 5) return true;
  return sessionInProgress && freeSessionsUsed <= 5;
}

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

function fail(code: string, message: string, status: number, requestId: string) {
  console.error("[calendar-sync]", { requestId, code, status });
  return json({ code, message }, status);
}

function itemFail(id: number | string, code: string, error: string): ItemResult {
  return { id, success: false, code, error };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function providerMessage(data: Record<string, unknown>, fallback: string): string {
  const err = data.error;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    const msg = (err as { message: string }).message;
    if (/invalid_grant|invalid credentials|unauthorized/i.test(msg)) {
      return "Reconnect Google Calendar in Settings, then try again.";
    }
    if (/rateLimitExceeded|backendError|internalError|unavailable/i.test(msg)) {
      return "Temporary calendar error. Try again.";
    }
  }
  return fallback;
}

const BYDAY_CODES = new Set(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

function sanitizeByday(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw
      .map((d) => String(d || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
      .filter((d) => BYDAY_CODES.has(d)),
  )];
}

function recurrenceLines(ev: CalendarEventInput, userTimeZone: string, timed: boolean): string[] | undefined {
  if (!ev.recurrence) return undefined;
  const by = sanitizeByday(ev.byday);
  const byPart = by.length ? `;BYDAY=${by.join(",")}` : "";
  if (timed) return [`RRULE:FREQ=WEEKLY${byPart};TZID=${userTimeZone}`];
  return [`RRULE:FREQ=WEEKLY${byPart}`];
}

function buildEventBody(ev: CalendarEventInput, userTimeZone: string) {
  const useAllDay = ev.allDay === true || !ev.time;

  if (useAllDay) {
    const body: Record<string, unknown> = {
      summary: ev.title,
      description: ev.description || "",
      start: { date: ev.date },
      end: { date: nextDayIso(ev.date) },
    };
    const rec = recurrenceLines(ev, userTimeZone, false);
    if (rec) body.recurrence = rec;
    if (ev.reminders) {
      body.reminders = ev.reminders;
    }
    return body;
  }

  const time = normalizeTime(ev.time);
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
  const rec = recurrenceLines(ev, userTimeZone, true);
  if (rec) body.recurrence = rec;
  if (ev.reminders) {
    body.reminders = ev.reminders;
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
  const data = await readJson(res);
  return { ok: res.ok, status: res.status, data };
}

async function patchGoogleEvent(accessToken: string, eventId: string, eventBody: Record<string, unknown>) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    },
  );
  const data = await readJson(res);
  return { ok: res.ok, status: res.status, data };
}

async function upsertGoogleEvent(
  accessToken: string,
  eventBody: Record<string, unknown>,
  existingId?: string | null,
) {
  if (existingId) {
    const patched = await patchGoogleEvent(accessToken, existingId, eventBody);
    if (patched.status === 404) {
      return createGoogleEvent(accessToken, eventBody);
    }
    return patched;
  }
  return createGoogleEvent(accessToken, eventBody);
}

async function deleteGoogleEvent(accessToken: string, eventId: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (res.status === 204 || res.status === 200) {
    return { ok: true, status: res.status };
  }
  await readJson(res);
  return { ok: res.ok, status: res.status };
}

async function patchSessionCards(
  admin: ReturnType<typeof createClient>,
  sessionId: string,
  workspaceId: string,
  patches: Array<{ cardId: number | string; googleEventId?: string | null; unsync?: boolean }>,
) {
  const { data: session, error } = await admin
    .from("sessions")
    .select("cards")
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId)
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

  await admin
    .from("sessions")
    .update({ cards: updated })
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId);
}

function refreshCode(err: unknown): { code: string; message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/not configured/i.test(raw)) {
    return { code: "CONFIG", message: "Calendar is not configured.", status: 503 };
  }
  if (/invalid_grant/i.test(raw)) {
    return {
      code: "RECONNECT_REQUIRED",
      message: "Reconnect Google Calendar in Settings, then try again.",
      status: 401,
    };
  }
  return {
    code: "RECONNECT_REQUIRED",
    message: "Reconnect Google Calendar in Settings, then try again.",
    status: 401,
  };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method not allowed", 405, requestId);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("UNAUTHORIZED", "Sign in to sync your calendar.", 401, requestId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail("UNAUTHORIZED", "Sign in to sync your calendar.", 401, requestId);

    let body: {
      action?: string;
      workspace_id?: string;
      event_id?: string;
      session_id?: string;
      card_id?: number | string;
      time_zone?: string;
      events?: CalendarEventInput[];
    };
    try {
      body = await req.json();
    } catch {
      return fail("INVALID_PAYLOAD", "That request could not be read.", 400, requestId);
    }

    const { workspace_id } = body;
    if (!workspace_id) return fail("INVALID_PAYLOAD", "Missing workspace.", 400, requestId);

    const { data: member } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return fail("FORBIDDEN", "Not a workspace member.", 403, requestId);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("plan, active, trial_ends_at")
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (subscriptionError) {
      console.error("[calendar-sync]", { requestId, code: "PLAN_LOOKUP", stage: "subscription" });
      return fail("PLAN_LOOKUP", "Could not verify plan access. Try again.", 503, requestId);
    }
    const { data: usageRows } = await admin
      .from("ai_distill_usage")
      .select("count")
      .eq("workspace_id", workspace_id);
    const freeSessionsUsed = (usageRows || []).reduce(
      (sum: number, row: { count?: number }) => sum + (row.count || 0),
      0,
    );
    let sessionInProgress = false;
    if (typeof body.session_id === "string" && body.session_id) {
      const { data: sess } = await admin
        .from("sessions")
        .select("id")
        .eq("id", body.session_id)
        .eq("workspace_id", workspace_id)
        .maybeSingle();
      sessionInProgress = !!sess;
    }
    const familyFeatures = hasFamilyFeatures(subscription as Subscription | null, {
      freeSessionsUsed,
      sessionInProgress,
    });

    const { data: row, error: rowErr } = await admin
      .from("workspace_members")
      .select("id, google_calendar_token, google_calendar_refresh_token")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    if (rowErr || !row?.google_calendar_refresh_token) {
      return fail("NOT_CONNECTED", "Connect Google Calendar in Settings, then try again.", 400, requestId);
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
      if (!event_id) return fail("INVALID_PAYLOAD", "Missing event.", 400, requestId);

      let attempt = await deleteGoogleEvent(accessToken, event_id);
      if (attempt.status === 401) {
        try {
          await ensureFreshToken();
          attempt = await deleteGoogleEvent(accessToken, event_id);
        } catch (refreshErr) {
          const mapped = refreshCode(refreshErr);
          return fail(mapped.code, mapped.message, mapped.status, requestId);
        }
      }

      const gone = attempt.status === 404;
      if (!attempt.ok && !gone) {
        return fail("PROVIDER_ERROR", "Couldn't remove that calendar event. Try again.", 502, requestId);
      }

      if (session_id && card_id != null) {
        await patchSessionCards(admin, session_id, workspace_id, [{ cardId: card_id, unsync: true }]);
      }

      return json({ success: true, notFound: gone, code: "OK" });
    }

    const { events, session_id, time_zone: timeZoneRaw } = body;
    if (!Array.isArray(events) || !events.length) {
      return fail("INVALID_PAYLOAD", "Missing events.", 400, requestId);
    }

    const userTimeZone =
      typeof timeZoneRaw === "string" && timeZoneRaw.trim()
        ? timeZoneRaw.trim()
        : DEFAULT_TIME_ZONE;

    const results: ItemResult[] = [];

    for (const ev of events) {
      try {
        if (!familyFeatures && (!ev.date || !ev.time || ev.allDay === true)) {
          results.push(itemFail(ev.id, "PLAN_REQUIRED", "A date and time are required on the Free plan."));
          continue;
        }

        const eventBody = buildEventBody(ev, userTimeZone);
        const existingId = typeof ev.googleEventId === "string" && ev.googleEventId
          ? ev.googleEventId
          : null;
        let attempt = await upsertGoogleEvent(accessToken, eventBody, existingId);

        if (attempt.status === 401) {
          try {
            await ensureFreshToken();
            attempt = await upsertGoogleEvent(accessToken, eventBody, existingId);
          } catch (refreshErr) {
            const mapped = refreshCode(refreshErr);
            results.push(itemFail(ev.id, mapped.code, mapped.message));
            continue;
          }
        }

        const googleId = typeof attempt.data.id === "string"
          ? attempt.data.id
          : existingId || undefined;

        if (attempt.ok && googleId) {
          results.push({ id: ev.id, success: true, googleEventId: googleId, code: "OK" });
          if (session_id) {
            await patchSessionCards(admin, session_id, workspace_id, [
              { cardId: ev.id, googleEventId: googleId },
            ]);
          }
        } else {
          const status = attempt.status;
          const code = status >= 500 ? "PROVIDER_UNAVAILABLE" : status === 401 || status === 403
            ? "RECONNECT_REQUIRED"
            : "PROVIDER_ERROR";
          const error = providerMessage(
            attempt.data,
            status >= 500
              ? "Temporary calendar error. Try again."
              : "Couldn't add this to the calendar. Try again.",
          );
          console.error("[calendar-sync]", { requestId, code, status, itemId: ev.id });
          results.push(itemFail(ev.id, code, error));
        }
      } catch (itemErr) {
        console.error("[calendar-sync]", {
          requestId,
          code: "PROVIDER_ERROR",
          itemId: ev.id,
          stage: "item",
        });
        results.push(itemFail(
          ev.id,
          "PROVIDER_ERROR",
          "Couldn't add this to the calendar. Try again.",
        ));
        void itemErr;
      }
    }

    return json({ results, code: "OK" });
  } catch (e) {
    console.error("[calendar-sync]", {
      requestId,
      code: "INTERNAL",
      stage: "unhandled",
    });
    void e;
    return json({ code: "INTERNAL", message: "Couldn't sync the calendar. Try again." }, 500);
  }
});
