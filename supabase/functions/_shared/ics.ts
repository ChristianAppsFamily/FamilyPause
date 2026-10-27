/** Build a minimal VEVENT .ics for Add to Calendar emails. */

import { normalizeTime, REMINDER_TIME_ZONE } from "./remindAt.ts";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC stamp YYYYMMDDTHHMMSSZ */
export function icsUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Floating / TZID local stamp YYYYMMDDTHHMMSS */
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

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
  duration_minutes?: number;
};

export function buildIcs(event: IcsEvent): string {
  const dateOnly = !!event.date_only || !event.event_time;
  const title = escapeText(event.title || "FamilyPause");
  const description = escapeText(event.description || "");
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
    const [y, m, d] = event.event_date.split("-").map(Number);
    const end = new Date(Date.UTC(y, m - 1, d + 1));
    const endDate = `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}`;
    const startDate = event.event_date.replace(/-/g, "");
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
    if (dayAdd > 0) {
      const [y, mo, d] = event.event_date.split("-").map(Number);
      const dt = new Date(Date.UTC(y, mo - 1, d + dayAdd));
      endDate = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    }
    const endLocal = icsLocalStamp(endDate, `${pad(endH)}:${pad(endM)}`);
    lines.push(`DTSTART;TZID=${REMINDER_TIME_ZONE}:${startLocal}`);
    lines.push(`DTEND;TZID=${REMINDER_TIME_ZONE}:${endLocal}`);
  }

  lines.push(`SUMMARY:${title}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
