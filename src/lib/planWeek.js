const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Seven ISO dates starting on meetingDate (day 0). */
export function getPlanningWeekDates(meetingDate) {
  const start = new Date(`${meetingDate}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toIso(d);
  });
}

/** Indices 0–6 of week days that have at least one kept card with a date. */
export function eventDayIndices(cards, meetingDate) {
  const week = getPlanningWeekDates(meetingDate);
  const isoToIdx = Object.fromEntries(week.map((iso, i) => [iso, i]));
  const indices = new Set();
  for (const c of cards) {
    if (c.date && isoToIdx[c.date] != null) indices.add(isoToIdx[c.date]);
  }
  return [...indices].sort((a, b) => a - b);
}

export function weekStripLabels() {
  return WEEK_LABELS;
}
