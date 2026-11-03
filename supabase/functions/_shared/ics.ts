/** Build VEVENT .ics for Add to Calendar emails. */

import { normalizeTime, DEFAULT_TIME_ZONE } from "./remindAt.ts";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function icsUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function icsLocalStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  const [hh, mm] = normalizeTime(time).split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function escapeText(s: string): string {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let out = "";
  let rest = line;
  while (rest.length > 75) {
    out += `${rest.slice(0, 75)}\r\n `;
    rest = rest.slice(75);
  }
  return out + rest;
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
  duration_minutes?: number;
  timeZone?: string;
  rrule?: string | null;
  valarm_trigger?: string | null;
};

export function buildIcs(event: IcsEvent): string {
  const dateOnly = !!event.date_only || !event.event_time;
  const title = escapeText(event.title || "FamilyPause");
  const description = escapeText(event.description || "");
  const location = escapeText(event.location || "");
  const tz = event.timeZone || DEFAULT_TIME_ZONE;
  const now = icsUtcStamp(new Date());
  const lines: string[] = [
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
    const startDate = event.event_date.replace(/-/g, "");
    const endDate = addDaysIso(event.event_date, 1).replace(/-/g, "");
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
  } else {
    const startLocal = icsLocalStamp(event.event_date, event.event_time!);
    const duration = Math.max(15, event.duration_minutes || 60);
    const [hh, mm] = normalizeTime(event.event_time!).split(":").map(Number);
    const endMin = hh * 60 + mm + duration;
    const endH = Math.floor(endMin / 60) % 24;
    const endM = endMin % 60;
    const dayAdd = Math.floor(endMin / (24 * 60));
    let endDate = event.event_date;
    if (dayAdd > 0) endDate = addDaysIso(event.event_date, dayAdd);
    const endLocal = icsLocalStamp(endDate, `${pad(endH)}:${pad(endM)}`);
    lines.push(`DTSTART;TZID=${tz}:${startLocal}`);
    lines.push(`DTEND;TZID=${tz}:${endLocal}`);
  }

  lines.push(`SUMMARY:${title}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  if (location) lines.push(`LOCATION:${location}`);
  if (event.rrule) lines.push(`RRULE:${event.rrule.replace(/^RRULE:/, "")}`);
  if (event.valarm_trigger) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:FamilyPause reminder",
      `TRIGGER:${event.valarm_trigger}`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function buildIcsCalendar(events: IcsEvent[]): string {
  if (!events.length) return "";
  const now = icsUtcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FamilyPause//Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    const single = buildIcs(event)
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("BEGIN:VCALENDAR") && !l.startsWith("END:VCALENDAR")
        && !l.startsWith("VERSION:") && !l.startsWith("PRODID:")
        && !l.startsWith("CALSCALE:") && !l.startsWith("METHOD:"));
    lines.push(...single);
  }
  lines.push("END:VCALENDAR");
  void now;
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
