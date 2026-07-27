/** Shared weekly reminder day/time picker (onboarding + Settings). */

export const REMINDER_DAYS = [
  { value: 0, label: "SUN" },
  { value: 1, label: "MON" },
  { value: 2, label: "TUE" },
  { value: 3, label: "WED" },
  { value: 4, label: "THU" },
  { value: 5, label: "FRI" },
  { value: 6, label: "SAT" },
];

/** 4:00 PM – 10:00 PM Pacific, 30-minute steps (stored as HH:MM 24h). */
export const REMINDER_TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 16; h <= 22; h += 1) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h >= 12 ? "PM" : "AM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value, label });
    }
  }
  return opts;
})();

export const DEFAULT_REMINDER_DAY = 0;
export const DEFAULT_REMINDER_TIME = "18:00";

export function normalizeReminderDay(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) return DEFAULT_REMINDER_DAY;
  return n;
}

export function normalizeReminderTime(value) {
  if (typeof value === "string" && REMINDER_TIME_OPTIONS.some((o) => o.value === value)) {
    return value;
  }
  return DEFAULT_REMINDER_TIME;
}

export function formatReminderDay(day) {
  return REMINDER_DAYS.find((d) => d.value === normalizeReminderDay(day))?.label || "SUN";
}

export function formatReminderTime(time) {
  const t = normalizeReminderTime(time);
  return REMINDER_TIME_OPTIONS.find((o) => o.value === t)?.label || "6:00 PM";
}

/**
 * @param {{
 *   day: number,
 *   time: string,
 *   onDayChange: (day: number) => void,
 *   onTimeChange: (time: string) => void,
 *   idPrefix?: string,
 *   className?: string,
 * }} props
 */
export default function ReminderPicker({
  day,
  time,
  onDayChange,
  onTimeChange,
  idPrefix = "reminder",
  className = "",
}) {
  const selectedDay = normalizeReminderDay(day);
  const selectedTime = normalizeReminderTime(time);

  return (
    <div className={`fp-reminder ${className}`.trim()}>
      <div className="fp-reminder-label">When do you want to do your FamilyPause?</div>
      <div className="fp-reminder-days" role="radiogroup" aria-label="Reminder day">
        {REMINDER_DAYS.map((d) => {
          const selected = selectedDay === d.value;
          return (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={"fp-reminder-day" + (selected ? " is-on" : "")}
              onClick={() => onDayChange(d.value)}
            >
              {d.label}
            </button>
          );
        })}
      </div>
      <label className="fp-reminder-time-label" htmlFor={`${idPrefix}-time`}>
        Time
      </label>
      <select
        id={`${idPrefix}-time`}
        className="fp-reminder-time"
        value={selectedTime}
        onChange={(e) => onTimeChange(e.target.value)}
      >
        {REMINDER_TIME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className="fp-reminder-hint">We&apos;ll send you a weekly reminder at this time.</p>
    </div>
  );
}
