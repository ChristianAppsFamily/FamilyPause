import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleAccessToken } from "../_shared/googleOAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type CalendarEventInput = {
  id: number | string;
  title: string;
  date: string;
  time?: string | null;
  duration_minutes?: number;
  description?: string;
  recurrence?: boolean;
};

function buildEventBody(ev: CalendarEventInput) {
  const time = ev.time || "10:00";
  const duration = ev.duration_minutes ?? 60;
  const startLocal = `${ev.date}T${time}:00`;
  const start = new Date(startLocal);
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };

  const body: Record<string, unknown> = {
    summary: ev.title,
    description: ev.description || "",
    start: { dateTime: fmt(start), timeZone: "America/New_York" },
    end: { dateTime: fmt(end), timeZone: "America/New_York" },
  };
  if (ev.recurrence) body.recurrence = ["RRULE:FREQ=WEEKLY"];
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

    const { workspace_id, events } = await req.json() as {
      workspace_id?: string;
      events?: CalendarEventInput[];
    };
    if (!workspace_id || !Array.isArray(events) || !events.length) {
      return json({ error: "Missing workspace_id or events" }, 400);
    }

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

    const results: { id: number | string; success: boolean; googleEventId?: string; error?: string }[] = [];

    for (const ev of events) {
      const eventBody = buildEventBody(ev);
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
        results.push({ id: ev.id, success: true, googleEventId: attempt.data.id });
      } else {
        results.push({
          id: ev.id,
          success: false,
          error: attempt.data?.error?.message || "Failed to create event",
        });
      }
    }

    return json({ results });
  } catch (e) {
    console.error("[calendar-sync]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
