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

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Format stored HH:MM (24h) as "6:00 PM". */
export function formatTimeLabel(hhmm) {
  const m = typeof hhmm === "string" && hhmm.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return "6:00 PM";
  const h = Number(m[1]);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m[2]} ${ampm}`;
}

/** Parse "18:00", "6:15 PM", "6pm", etc. Returns HH:MM or null. */
export function parseReminderTime(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  const m24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) {
    const h = Number(m24[1]);
    if (h > 23) return null;
    return `${pad2(h)}:${m24[2]}`;
  }
  const m12 = s.match(/^(\d{1,2})(?::([0-5]\d))?\s*([AaPp])\.?[Mm]\.?$/);
  if (!m12) return null;
  let h = Number(m12[1]);
  const min = m12[2] || "00";
  if (h < 1 || h > 12) return null;
  const pm = m12[3].toLowerCase() === "p";
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  return `${pad2(h)}:${min}`;
}

/** 12:00 AM – 11:30 PM Pacific, 30-minute steps (stored as HH:MM 24h). */
export const REMINDER_TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      const value = `${pad2(h)}:${pad2(m)}`;
      opts.push({ value, label: formatTimeLabel(value) });
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
  return parseReminderTime(value) || DEFAULT_REMINDER_TIME;
}

export function formatReminderDay(day) {
  return REMINDER_DAYS.find((d) => d.value === normalizeReminderDay(day))?.label || "SUN";
}

export function formatReminderTime(time) {
  return formatTimeLabel(normalizeReminderTime(time));
}

/**
 * @param {{
 *   day: number,
 *   time: string,
 *   onDayChange: (day: number) => void,
 *   onTimeChange: (time: string) => void,
 *   idPrefix?: string,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function ReminderPicker({
  day,
  time,
  onDayChange,
  onTimeChange,
  idPrefix = "reminder",
  className = "",
  label = "Set a reminder to do your FamilyPause",
}) {
  const selectedDay = normalizeReminderDay(day);
  const selectedTime = normalizeReminderTime(time);
  const isCustom = !REMINDER_TIME_OPTIONS.some((o) => o.value === selectedTime);

  return (
    <div className={`fp-reminder ${className}`.trim()}>
      <div className="fp-reminder-label">{label}</div>
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
        {isCustom && (
          <option value={selectedTime}>{formatReminderTime(selectedTime)}</option>
        )}
        {REMINDER_TIME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <label className="fp-reminder-custom-label" htmlFor={`${idPrefix}-custom-time`}>
        Or enter a custom time
      </label>
      <input
        id={`${idPrefix}-custom-time`}
        className="fp-reminder-time fp-reminder-time-custom"
        type="time"
        step="60"
        value={selectedTime}
        onChange={(e) => {
          if (e.target.value) onTimeChange(e.target.value);
        }}
      />
      <p className="fp-reminder-hint">We&apos;ll send you a weekly reminder at this time.</p>
    </div>
  );
}
