/** When / Time chip helpers for the Times step (pure, timezone-naive local calendar). */

export const TIME_PERIODS = {
  morning: "09:00",
  afternoon: "14:00",
  evening: "19:00",
};

export const TIMES_REMINDER_CHIPS = [
  { value: "none", label: "None" },
  { value: "morning_of", label: "Morning of" },
  { value: "day_before", label: "Day before" },
];

export const TYPE_MENU = [
  { value: "event", label: "Appointment", article: "an appointment" },
  { value: "action", label: "To-do", article: "a to-do" },
  { value: "decision", label: "Decision", article: "a decision" },
  { value: "note", label: "Note", article: "a note" },
  { value: "time_together", label: "Time Together", article: "Time Together" },
];

export const BYDAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
export const BYDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** @param {Date} d */
export function ymdFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** @param {string} ymd */
export function parseYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, day] = ymd.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

/** @param {string} ymd @param {number} n */
export function addDaysYmd(ymd, n) {
  const d = parseYmd(ymd);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return ymdFromDate(d);
}

/** @param {Date} [now] */
export function todayYmd(now = new Date()) {
  return ymdFromDate(now);
}

/** @param {Date} [now] */
export function tomorrowYmd(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return ymdFromDate(d);
}

/** Next Saturday; if already Sat/Sun, use today. @param {Date} [now] */
export function thisWeekendYmd(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay();
  if (day === 0 || day === 6) return ymdFromDate(d);
  d.setDate(d.getDate() + (6 - day));
  return ymdFromDate(d);
}

/** Monday of next calendar week. @param {Date} [now] */
export function nextWeekMondayYmd(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay();
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + daysUntil);
  return ymdFromDate(d);
}

/** First day of the current month. @param {Date} [now] */
export function thisMonthYmd(now = new Date()) {
  const d = new Date(now);
  return ymdFromDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** @param {Date} [now] */
export function thisWeekYmd(now = new Date()) {
  return todayYmd(now);
}

/**
 * @param {string} preset
 * @param {Date} [now]
 * @returns {{ date: string|null, date_precision?: string|null, date_only?: boolean, clear?: boolean }|null}
 */
export function applyWhenPreset(preset, now = new Date()) {
  switch (preset) {
    case "today":
      return { date: todayYmd(now), date_precision: "day", date_only: false };
    case "tomorrow":
      return { date: tomorrowYmd(now), date_precision: "day", date_only: false };
    case "this_weekend":
      return { date: thisWeekendYmd(now), date_precision: "day", date_only: false };
    case "next_week":
      return { date: nextWeekMondayYmd(now), date_precision: "day", date_only: false };
    case "this_week":
      return { date: thisWeekYmd(now), date_precision: "day", date_only: false };
    case "this_month":
      return { date: thisMonthYmd(now), date_precision: "month", date_only: true };
    case "no_date":
    case "no_date_needed":
      return { date: null, date_precision: null, date_only: false, clear: true };
    case "pick_date":
      return null;
    default:
      return null;
  }
}

/**
 * @param {string} preset
 * @param {string} [exactTime]
 */
export function applyTimePreset(preset, exactTime = "12:00") {
  switch (preset) {
    case "morning":
      return { time: TIME_PERIODS.morning, date_only: false, time_period: "morning" };
    case "afternoon":
      return { time: TIME_PERIODS.afternoon, date_only: false, time_period: "afternoon" };
    case "evening":
      return { time: TIME_PERIODS.evening, date_only: false, time_period: "evening" };
    case "all_day":
      return { time: null, date_only: true, time_period: null };
    case "exact":
      return { time: exactTime || "12:00", date_only: false, time_period: null };
    default:
      return null;
  }
}

/** @param {string} ymd */
export function formatChipDate(ymd) {
  const d = parseYmd(ymd);
  if (!d) return "";
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** @param {string} ymd */
export function formatLongDate(ymd) {
  const d = parseYmd(ymd);
  if (!d) return "";
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** @param {number} year @param {number} month0 */
export function formatMonthTitle(year, month0) {
  return `${MONTH_LONG[month0]} ${year}`;
}

/** @param {string} hhmm */
export function formatTimeLabel(hhmm) {
  if (!hhmm) return "";
  const [hRaw, mRaw = "00"] = String(hhmm).split(":");
  let h = parseInt(hRaw, 10);
  if (Number.isNaN(h)) return hhmm;
  const m = String(parseInt(mRaw, 10) || 0).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Infer which When chip is selected from draft fields.
 * @param {{ date?: string|null, date_precision?: string|null }} draft
 * @param {Date} [now]
 */
export function inferWhenChip(draft, now = new Date()) {
  if (!draft?.date) {
    return draft?.date_precision === "month" ? "this_month" : "no_date";
  }
  if (draft.date_precision === "month") return "this_month";
  const date = draft.date;
  if (date === todayYmd(now)) return "today";
  if (date === tomorrowYmd(now)) return "tomorrow";
  if (date === thisWeekendYmd(now)) return "this_weekend";
  if (date === nextWeekMondayYmd(now)) return "next_week";
  if (date === thisWeekYmd(now) && date !== todayYmd(now)) return "this_week";
  return "pick_date";
}

/**
 * @param {{ time?: string|null, date_only?: boolean, time_period?: string|null }} draft
 */
export function inferTimeChip(draft) {
  if (draft?.date_only || (!draft?.time && draft?.date_only !== false && !draft?.time)) {
    if (draft?.date_only) return "all_day";
  }
  if (draft?.date_only) return "all_day";
  if (!draft?.time) return null;
  if (draft.time_period === "morning" || draft.time === TIME_PERIODS.morning) return "morning";
  if (draft.time_period === "afternoon" || draft.time === TIME_PERIODS.afternoon) return "afternoon";
  if (draft.time_period === "evening" || draft.time === TIME_PERIODS.evening) return "evening";
  return "exact";
}

/**
 * Build a month grid for the inline calendar.
 * @param {number} year
 * @param {number} month0
 * @param {string} today
 * @returns {Array<{ day: number|null, ymd: string|null, past: boolean, today: boolean }>}
 */
export function buildMonthGrid(year, month0, today) {
  const first = new Date(year, month0, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null, ymd: null, past: false, today: false });
  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      ymd,
      past: ymd < today,
      today: ymd === today,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, ymd: null, past: false, today: false });
  return cells;
}

/**
 * Human summary for Time Together weekly lock.
 * @param {{ recurring?: boolean, byday?: string[]|null, time?: string|null, date?: string|null }} draft
 */
export function timeTogetherSummary(draft) {
  const timeLabel = draft?.time ? formatTimeLabel(draft.time) : null;
  const start = draft?.date ? formatChipDate(draft.date) : null;
  if (draft?.recurring && Array.isArray(draft.byday) && draft.byday.length) {
    const names = draft.byday.map((code) => {
      const i = BYDAY_ORDER.indexOf(code);
      return i >= 0 ? WEEKDAY_LONG[i] : code;
    });
    const days = names.length === 1 ? names[0] : names.join(" & ");
    const every = `Every ${days}${timeLabel ? ` at ${timeLabel}` : ""}`;
    return start ? `${every}, starting ${start.replace(/^\w+, /, "")}` : every;
  }
  if (start && timeLabel) return `${start} at ${timeLabel}`;
  if (start) return start;
  if (timeLabel) return timeLabel;
  return "Pick a day and time";
}

/** Map schema type → design badge key */
export function typeBadgeKey(type) {
  switch (type) {
    case "event": return "appt";
    case "action": return "todo";
    case "decision": return "dec";
    case "note": return "note";
    case "time_together": return "tt";
    default: return "todo";
  }
}

export function timesTypeLabel(type) {
  return TYPE_MENU.find((t) => t.value === type)?.label || "To-do";
}

export function timesTypeArticle(type) {
  return TYPE_MENU.find((t) => t.value === type)?.article || "a to-do";
}
