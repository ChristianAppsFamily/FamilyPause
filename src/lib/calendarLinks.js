/** Google Calendar TEMPLATE links + .ics builders for Plan Add-to-Calendar. */

import { coercePlanReminderChoice, DEFAULT_TIME_ZONE, normalizeTime } from "./remindAt.js";

const BYDAY_CODES = new Set(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

function normalizeByday(raw) {
  if (!Array.isArray(raw)) return null;
  const days = [...new Set(
    raw
      .map((d) => String(d || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
      .filter((d) => BYDAY_CODES.has(d)),
  )];
  return days.length ? days : null;
}

function typeLabel(type) {
  return ({
    event: "Event",
    action: "To-Do",
    decision: "Decision",
    note: "Note",
    time_together: "Time Together",
  })[type] || "To-Do";
}

function calendarTitle(card) {
  const task = (card?.task || "").trim() || "Untitled";
  if (card?.titleEditedByUser) return task;
  if (card?.type === "event" || card?.type === "time_together") return task;
  return `${typeLabel(card?.type)}: ${task}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function escapeText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line) {
  if (line.length <= 75) return line;
  let out = "";
  let rest = line;
  while (rest.length > 75) {
    out += `${rest.slice(0, 75)}\r\n `;
    rest = rest.slice(75);
  }
  return out + rest;
}

function icsUtcStamp(d = new Date()) {
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

function addDaysIso(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function addMinutesLocal(date, time, minutes) {
  const [hh, mm] = normalizeTime(time).split(":").map(Number);
  const endMin = hh * 60 + mm + minutes;
  const dayAdd = Math.floor(endMin / (24 * 60));
  const endH = Math.floor(endMin / 60) % 24;
  const endM = endMin % 60;
  return {
    date: dayAdd > 0 ? addDaysIso(date, dayAdd) : date,
    time: `${pad(endH)}:${pad(endM)}`,
  };
}

/** Month-only items are not calendar-ready as a specific day. */
export function isCalendarDated(item) {
  if (!item?.date) return false;
  if (item.date_precision === "month") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(item.date);
}

export function buildRrule(item) {
  if (!item?.recurring) return null;
  const byday = normalizeByday(item.byday);
  const byPart = byday?.length ? `;BYDAY=${byday.join(",")}` : "";
  return `FREQ=WEEKLY${byPart}`;
}

function valarmTrigger(item) {
  const choice = coercePlanReminderChoice(item);
  if (choice === "none") return null;
  if (choice === "morning_of") return null; // email reminder; no ICS alarm at 8am relative
  if (choice === "1_hour") return "-PT1H";
  if (choice === "day_before") return "-P1D";
  const n = Number(choice);
  if (Number.isFinite(n) && n > 0) {
    if (n % 1440 === 0) return `-P${n / 1440}D`;
    if (n % 60 === 0) return `-PT${n / 60}H`;
    return `-PT${n}M`;
  }
  return null;
}

export function icsUid(item, workspaceId) {
  if (item?.ics_uid) return item.ics_uid;
  const id = item?.id != null ? String(item.id) : cryptoRandom();
  return `${id}-${workspaceId || "fp"}@familypause.com`;
}

function cryptoRandom() {
  try {
    return crypto.randomUUID();
  } catch {
    return `fp-${Date.now()}`;
  }
}

/**
 * Google Calendar template URL.
 * @param {object} item
 * @param {string} [timeZone]
 */
export function buildGoogleTemplateUrl(item, timeZone = DEFAULT_TIME_ZONE) {
  if (!isCalendarDated(item)) return null;
  const title = calendarTitle(item);
  const details = item.source || item.task || title;
  const location = item.location || "";
  const dateOnly = !!item.date_only || !item.time;
  const duration = Math.max(15, Number(item.duration_minutes) || 60);

  let dates;
  if (dateOnly) {
    const start = item.date.replace(/-/g, "");
    const end = addDaysIso(item.date, 1).replace(/-/g, "");
    dates = `${start}/${end}`;
  } else {
    const start = icsLocalStamp(item.date, item.time);
    const endParts = addMinutesLocal(item.date, item.time, duration);
    const end = icsLocalStamp(endParts.date, endParts.time);
    dates = `${start}/${end}`;
  }

  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", title);
  params.set("dates", dates);
  if (!dateOnly) params.set("ctz", timeZone);
  if (details) params.set("details", details);
  if (location) params.set("location", location);
  const rrule = buildRrule(item);
  if (rrule) params.set("recur", `RRULE:${rrule}`);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Single VEVENT body lines (without VCALENDAR wrapper).
 */
export function buildVEventLines(item, {
  timeZone = DEFAULT_TIME_ZONE,
  workspaceId = null,
} = {}) {
  if (!isCalendarDated(item)) return null;
  const title = escapeText(calendarTitle(item));
  const description = escapeText(item.source || item.task || "");
  const location = escapeText(item.location || "");
  const dateOnly = !!item.date_only || !item.time;
  const duration = Math.max(15, Number(item.duration_minutes) || 60);
  const uid = icsUid(item, workspaceId);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsUtcStamp()}`,
  ];

  if (dateOnly) {
    const startDate = item.date.replace(/-/g, "");
    const endDate = addDaysIso(item.date, 1).replace(/-/g, "");
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
  } else {
    const startLocal = icsLocalStamp(item.date, item.time);
    const endParts = addMinutesLocal(item.date, item.time, duration);
    const endLocal = icsLocalStamp(endParts.date, endParts.time);
    lines.push(`DTSTART;TZID=${timeZone}:${startLocal}`);
    lines.push(`DTEND;TZID=${timeZone}:${endLocal}`);
  }

  lines.push(`SUMMARY:${title}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  if (location) lines.push(`LOCATION:${location}`);

  const rrule = buildRrule(item);
  if (rrule) lines.push(`RRULE:${rrule}`);

  const trigger = valarmTrigger(item);
  if (trigger) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:FamilyPause reminder`, `TRIGGER:${trigger}`, "END:VALARM");
  }

  lines.push("END:VEVENT");
  return lines;
}

export function buildIcsCalendar(items, {
  timeZone = DEFAULT_TIME_ZONE,
  workspaceId = null,
  prodId = "-//FamilyPause//Plan//EN",
} = {}) {
  const events = (items || [])
    .map((it) => buildVEventLines(it, { timeZone, workspaceId }))
    .filter(Boolean);
  if (!events.length) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function downloadIcs(filename, icsBody) {
  if (!icsBody) return false;
  const blob = new Blob([icsBody], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function safeIcsFilename(title) {
  return `${String(title || "familypause").replace(/[^\w\-]+/g, "_").slice(0, 40) || "event"}.ics`;
}

/** Format month-only display (e.g. "December"). */
export function formatMonthOnly(date) {
  if (!date) return "";
  const m = String(date).match(/^(\d{4})-(\d{2})/);
  if (!m) return "";
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return dt.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

export function formatPlanWhen(card) {
  if (!card?.date) return "";
  if (card.date_precision === "month") return formatMonthOnly(card.date);
  const dateOnly = !!card.date_only || !card.time;
  const dt = new Date(`${card.date}T${card.time || "12:00"}:00`);
  const day = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (dateOnly) return day;
  const t = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}
