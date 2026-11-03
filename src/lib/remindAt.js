/** Timezone-aware reminder send_at math (browser + Node tests). */

export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export const PLAN_REMINDER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "morning_of", label: "Morning of (8:00 AM)" },
  { value: "1_hour", label: "1 hour before" },
  { value: "day_before", label: "Day before" },
];

export const REMINDER_DEFAULTS_BY_TYPE = {
  event: "day_before",
  action: "morning_of",
  time_together: "day_before",
  decision: "none",
  note: "none",
};

export function defaultReminderForType(type) {
  return REMINDER_DEFAULTS_BY_TYPE[type] || "none";
}

export function normalizeTime(time) {
  const [h, m = "00"] = String(time || "00:00").split(":");
  return `${String(parseInt(h, 10) || 0).padStart(2, "0")}:${String(parseInt(m, 10) || 0).padStart(2, "0")}`;
}

function timeZoneOffsetMs(timeZone, instant) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t) => parts.find((p) => p.type === t)?.value || "0";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    parseInt(get("year"), 10),
    parseInt(get("month"), 10) - 1,
    parseInt(get("day"), 10),
    hour,
    parseInt(get("minute"), 10),
    parseInt(get("second"), 10),
  );
  return asUtc - instant.getTime();
}

/** Interpret YYYY-MM-DD + HH:MM as wall time in timeZone → UTC Date. */
export function localToUtc(date, time, timeZone = DEFAULT_TIME_ZONE) {
  const [y, mo, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = normalizeTime(time).split(":").map((n) => parseInt(n, 10));
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = timeZoneOffsetMs(timeZone, new Date(utcMs));
    utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0) - offset;
  }
  return new Date(utcMs);
}

function addDaysIso(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Event start instant in the account timezone.
 * All-day / date-only → 08:00 local on event_date (for day-before / morning-of math).
 */
export function eventStartUtc({
  event_date,
  event_time,
  date_only,
  timeZone = DEFAULT_TIME_ZONE,
}) {
  const dateOnly = !!date_only || !event_time;
  const time = dateOnly ? "08:00" : normalizeTime(event_time);
  return localToUtc(event_date, time, timeZone);
}

/**
 * Compute send_at for a reminder choice.
 * @returns {{ sendAt: Date, kind: 'reminder'|'checkin', choice: string }[]}
 */
export function computeReminderSends({
  event_date,
  event_time,
  date_only,
  reminder_choice,
  type,
  timeZone = DEFAULT_TIME_ZONE,
}) {
  const choice = reminder_choice === "" || reminder_choice == null
    ? defaultReminderForType(type)
    : reminder_choice;
  if (choice === "none") return [];

  const dateOnly = !!date_only || !event_time;
  const rows = [];

  if (choice === "morning_of") {
    rows.push({
      sendAt: localToUtc(event_date, "08:00", timeZone),
      kind: "reminder",
      choice: "morning_of",
    });
  } else if (choice === "1_hour") {
    const start = eventStartUtc({ event_date, event_time, date_only: dateOnly, timeZone });
    // For all-day, treat start as 08:00 so 1 hour before = 07:00
    rows.push({
      sendAt: new Date(start.getTime() - 60 * 60_000),
      kind: "reminder",
      choice: "1_hour",
    });
  } else if (choice === "day_before") {
    const prev = addDaysIso(event_date, -1);
    const wall = dateOnly ? "08:00" : normalizeTime(event_time);
    rows.push({
      sendAt: localToUtc(prev, wall, timeZone),
      kind: "reminder",
      choice: "day_before",
    });
  } else {
    // Legacy minute offsets
    const minutes = Number(choice);
    if (Number.isFinite(minutes) && minutes >= 0) {
      const start = eventStartUtc({ event_date, event_time, date_only: dateOnly, timeZone });
      rows.push({
        sendAt: new Date(start.getTime() - minutes * 60_000),
        kind: "reminder",
        choice: String(choice),
      });
    }
  }

  if (type === "time_together" && choice !== "none") {
    rows.push({
      sendAt: localToUtc(event_date, "09:00", timeZone),
      kind: "checkin",
      choice: "checkin_9am",
    });
  }

  return rows;
}

/** Label for UI chips. */
export function reminderChoiceLabel(choice) {
  if (!choice || choice === "none") return "None";
  const hit = PLAN_REMINDER_OPTIONS.find((o) => o.value === choice);
  if (hit) return hit.label;
  if (choice === "60" || choice === 60) return "1 hour before";
  if (choice === "1440" || choice === 1440) return "Day before";
  return String(choice);
}

/** Map legacy minute offsets onto the new choice set when possible. */
export function coercePlanReminderChoice(card) {
  const type = card?.type || "action";
  const raw = card?.calendar_reminder;
  if (raw === "none") return "none";
  if (raw === "morning_of" || raw === "1_hour" || raw === "day_before") return raw;
  if (raw === "60" || raw === 60) return "1_hour";
  if (raw === "1440" || raw === 1440) return "day_before";
  if (raw == null || raw === "" || raw === "custom") {
    return defaultReminderForType(type);
  }
  const n = Number(raw);
  if (n === 60) return "1_hour";
  if (n === 1440) return "day_before";
  if (n === 0) return "1_hour"; // closest; morning-of is preferred for todos
  return defaultReminderForType(type);
}
