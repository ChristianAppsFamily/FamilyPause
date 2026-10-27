import { createClient } from "@supabase/supabase-js";

function pad(n) {
  return String(n).padStart(2, "0");
}

function normalizeTime(time) {
  const [h, m = "00"] = String(time || "00:00").split(":");
  return `${String(parseInt(h, 10) || 0).padStart(2, "0")}:${String(parseInt(m, 10) || 0).padStart(2, "0")}`;
}

function icsUtcStamp(d) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function icsLocalStamp(date, time) {
  const [y, m, d] = date.split("-");
  const [hh, mm] = normalizeTime(time).split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function escapeText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildIcs(event) {
  const dateOnly = !!event.date_only || !event.event_time;
  const title = escapeText(event.title || "FamilyPause");
  const description = escapeText(event.description || "");
  const now = icsUtcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FamilyPause//Plan Reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${now}`,
  ];

  if (dateOnly) {
    const [y, m, d] = event.event_date.split("-").map(Number);
    const end = new Date(Date.UTC(y, m - 1, d + 1));
    const endDate = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}`;
    lines.push(`DTSTART;VALUE=DATE:${event.event_date.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
  } else {
    const startLocal = icsLocalStamp(event.event_date, event.event_time);
    const duration = 60;
    const [hh, mm] = normalizeTime(event.event_time).split(":").map(Number);
    const endMin = hh * 60 + mm + duration;
    const endH = Math.floor(endMin / 60) % 24;
    const endM = endMin % 60;
    const endLocal = icsLocalStamp(event.event_date, `${pad(endH)}:${pad(endM)}`);
    lines.push(`DTSTART;TZID=America/Los_Angeles:${startLocal}`);
    lines.push(`DTEND;TZID=America/Los_Angeles:${endLocal}`);
  }

  lines.push(`SUMMARY:${title}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = typeof req.query?.token === "string" ? req.query.token.trim() : "";
  if (!TOKEN_RE.test(token)) {
    return res.status(400).json({ error: "Invalid token" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[calendar-ics] Missing Supabase service config");
    return res.status(500).json({ error: "Calendar file unavailable" });
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error } = await client
    .from("plan_item_reminders")
    .select("title, description, event_date, event_time, date_only, ics_uid")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !row) {
    return res.status(404).json({ error: "Reminder not found" });
  }

  const ics = buildIcs({
    uid: row.ics_uid,
    title: row.title,
    description: row.description,
    event_date: row.event_date,
    event_time: row.event_time,
    date_only: row.date_only,
  });

  const filename = `${String(row.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 40) || "event"}.ics`;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.status(200).send(ics);
}
