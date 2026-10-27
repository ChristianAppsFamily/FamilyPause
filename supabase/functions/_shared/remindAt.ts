/** Pacific wall-clock → UTC Date helpers for plan item reminders. */

const TZ = "America/Los_Angeles";

export function normalizeTime(time: string): string {
  const [h, m = "00"] = String(time || "00:00").split(":");
  return `${String(parseInt(h, 10) || 0).padStart(2, "0")}:${String(parseInt(m, 10) || 0).padStart(2, "0")}`;
}

/** Offset (ms) of timeZone relative to UTC at the given instant. */
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

/**
 * Interpret YYYY-MM-DD + HH:MM as America/Los_Angeles wall time → UTC Date.
 */
export function pacificLocalToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = normalizeTime(time).split(":").map((n) => parseInt(n, 10));
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const offset = timeZoneOffsetMs(TZ, new Date(utcMs));
    utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0) - offset;
  }
  return new Date(utcMs);
}

/**
 * Event start instant in Pacific.
 * All-day / date-only → 09:00 Pacific on event_date (documented default).
 */
export function eventStartUtc(opts: {
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
}): Date {
  const dateOnly = !!opts.date_only || !opts.event_time;
  const time = dateOnly ? "09:00" : normalizeTime(opts.event_time!);
  return pacificLocalToUtc(opts.event_date, time);
}

/** When to send the reminder email. */
export function computeRemindAt(opts: {
  event_date: string;
  event_time?: string | null;
  date_only?: boolean;
  reminder_offset_minutes: number;
}): Date {
  const start = eventStartUtc(opts);
  return new Date(start.getTime() - Math.max(0, opts.reminder_offset_minutes) * 60_000);
}

export { TZ as REMINDER_TIME_ZONE };
