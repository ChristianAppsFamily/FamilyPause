/** Timezone-aware reminder send_at helpers for edge functions. */

export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export function normalizeTime(time: string): string {
  const [h, m = "00"] = String(time || "00:00").split(":");
  return `${String(parseInt(h, 10) || 0).padStart(2, "0")}:${String(parseInt(m, 10) || 0).padStart(2, "0")}`;
}

function timeZoneOffsetMs(timeZone: string, instant: Date): number {
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
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
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

export function localToUtc(date: string, time: string, timeZone = DEFAULT_TIME_ZONE): Date {
  const [y, mo, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = normalizeTime(time).split(":").map((n) => parseInt(n, 10));
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const offset = timeZoneOffsetMs(timeZone, new Date(utcMs));
    utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0) - offset;
  }
  return new Date(utcMs);
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function eventStartUtc(opts: {
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
  timeZone?: string;
}): Date {
  const tz = opts.timeZone || DEFAULT_TIME_ZONE;
  const dateOnly = !!opts.date_only || !opts.event_time;
  const time = dateOnly ? "08:00" : normalizeTime(opts.event_time!);
  return localToUtc(opts.event_date, time, tz);
}

export function defaultReminderForType(type?: string): string {
  switch (type) {
    case "event":
      return "day_before";
    case "action":
      return "morning_of";
    case "time_together":
      return "day_before";
    case "decision":
    case "note":
      return "none";
    default:
      return "none";
  }
}

export function coerceReminderChoice(card: {
  calendar_reminder?: string | null;
  type?: string;
}): string {
  const raw = card.calendar_reminder;
  if (raw === "none") return "none";
  if (raw === "morning_of" || raw === "1_hour" || raw === "day_before") return raw;
  if (raw === "60") return "1_hour";
  if (raw === "1440") return "day_before";
  if (raw == null || raw === "" || raw === "custom") return defaultReminderForType(card.type);
  const n = Number(raw);
  if (n === 60) return "1_hour";
  if (n === 1440) return "day_before";
  return defaultReminderForType(card.type);
}

export type ReminderSend = {
  sendAt: Date;
  kind: "reminder" | "checkin";
  choice: string;
};

export function computeReminderSends(opts: {
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
  reminder_choice?: string | null;
  type?: string;
  timeZone?: string;
}): ReminderSend[] {
  const tz = opts.timeZone || DEFAULT_TIME_ZONE;
  const choice = opts.reminder_choice == null || opts.reminder_choice === ""
    ? defaultReminderForType(opts.type)
    : coerceReminderChoice({ calendar_reminder: opts.reminder_choice, type: opts.type });
  if (choice === "none") return [];

  const dateOnly = !!opts.date_only || !opts.event_time;
  const rows: ReminderSend[] = [];

  if (choice === "morning_of") {
    rows.push({ sendAt: localToUtc(opts.event_date, "08:00", tz), kind: "reminder", choice: "morning_of" });
  } else if (choice === "1_hour") {
    const start = eventStartUtc({ ...opts, date_only: dateOnly, timeZone: tz });
    rows.push({ sendAt: new Date(start.getTime() - 60 * 60_000), kind: "reminder", choice: "1_hour" });
  } else if (choice === "day_before") {
    const prev = addDaysIso(opts.event_date, -1);
    const wall = dateOnly ? "08:00" : normalizeTime(opts.event_time!);
    rows.push({ sendAt: localToUtc(prev, wall, tz), kind: "reminder", choice: "day_before" });
  } else {
    const minutes = Number(choice);
    if (Number.isFinite(minutes) && minutes >= 0) {
      const start = eventStartUtc({ ...opts, date_only: dateOnly, timeZone: tz });
      rows.push({
        sendAt: new Date(start.getTime() - minutes * 60_000),
        kind: "reminder",
        choice: String(choice),
      });
    }
  }

  if (opts.type === "time_together" && choice !== "none") {
    rows.push({
      sendAt: localToUtc(opts.event_date, "09:00", tz),
      kind: "checkin",
      choice: "checkin_9am",
    });
  }

  return rows;
}

/** Legacy API used by older callers. */
export function computeRemindAt(opts: {
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
  reminder_offset_minutes: number;
  timeZone?: string;
}): Date {
  const start = eventStartUtc(opts);
  return new Date(start.getTime() - Math.max(0, opts.reminder_offset_minutes) * 60_000);
}

export { DEFAULT_TIME_ZONE as REMINDER_TIME_ZONE };
