import { calendarTitle } from "./googleCalendar";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday–Sunday ISO dates for the calendar week containing meetingDate. */
export function getMondaySundayWeek(meetingDate) {
  const start = new Date(`${meetingDate}T12:00:00`);
  const day = start.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(start);
  monday.setDate(start.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIso(d);
  });
}

/** "Jul 7 – Jul 13, 2026" for Mon–Sun week of meetingDate. */
export function formatItineraryWeekRange(meetingDate) {
  const dates = getMondaySundayWeek(meetingDate);
  const start = new Date(`${dates[0]}T12:00:00`);
  const end = new Date(`${dates[6]}T12:00:00`);
  const optsDay = { month: "short", day: "numeric" };
  const startLabel = start.toLocaleDateString("en-US", optsDay);
  const endLabel = end.toLocaleDateString("en-US", { ...optsDay, year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

/** "MONDAY, JULY 7" */
export function formatItineraryDayHeader(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

/** "6:30pm" */
export function formatItineraryTime(time) {
  if (!time) return "";
  const dt = new Date(`1970-01-01T${time}:00`);
  return dt
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s/g, "")
    .toLowerCase();
}

function timeSortKey(time) {
  if (!time || typeof time !== "string") return 9999;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return 9999;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Build itinerary days (Mon–Sun, empty days omitted) + recurring section.
 * Items without a confirmed time are excluded.
 * @param {object[]} cards
 * @param {string} meetingDate
 */
export function buildItinerary(cards, meetingDate) {
  const week = getMondaySundayWeek(meetingDate);
  const inWeek = new Set(week);
  const timed = (cards || []).filter((c) => c?.date && c?.time);

  const byDate = Object.fromEntries(week.map((iso) => [iso, []]));
  const recurring = [];

  for (const card of timed) {
    if (card.recurring) {
      recurring.push(card);
    }
    if (inWeek.has(card.date)) {
      byDate[card.date].push(card);
    }
  }

  for (const iso of week) {
    byDate[iso].sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time));
  }
  recurring.sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time));

  const days = week
    .filter((iso) => byDate[iso].length > 0)
    .map((iso) => ({
      date: iso,
      header: formatItineraryDayHeader(iso),
      items: byDate[iso],
    }));

  return { weekRange: formatItineraryWeekRange(meetingDate), days, recurring };
}

/**
 * Plain-text itinerary for clipboard.
 * @param {object[]} cards
 * @param {string} meetingDate
 */
export function buildItineraryText(cards, meetingDate) {
  const { weekRange, days, recurring } = buildItinerary(cards, meetingDate);
  const lines = [`FamilyPause - Week of ${weekRange}`, ""];

  for (const day of days) {
    lines.push(day.header);
    for (const it of day.items) {
      const who = it.person ? `  (${it.person})` : "";
      lines.push(`${formatItineraryTime(it.time)}  ${calendarTitle(it)}${who}`);
    }
    lines.push("");
  }

  if (recurring.length) {
    lines.push("RECURRING");
    for (const it of recurring) {
      const who = it.person ? `  (${it.person})` : "";
      lines.push(`Weekly · ${formatItineraryTime(it.time)}  ${calendarTitle(it)}${who}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
