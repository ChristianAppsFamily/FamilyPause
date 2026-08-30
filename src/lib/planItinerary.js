import { calendarTitle } from "./googleCalendar";
import { getPlanningWeekDates } from "./planWeek";
import { formatWeekOfRange } from "./planExport";

/** Week range label — same 7-day window as Plan strip and PDF. */
export function formatItineraryWeekRange(meetingDate) {
  return formatWeekOfRange(meetingDate);
}
export function formatItineraryDayHeader(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

/** "6:30pm" / "All day" / "Choose a start time" */
export function formatItineraryTime(cardOrTime) {
  if (cardOrTime && typeof cardOrTime === "object") {
    if (cardOrTime.date_only || (!cardOrTime.time && cardOrTime.date)) {
      return cardOrTime.date_only ? "All day" : "Choose a start time";
    }
    return formatClock(cardOrTime.time);
  }
  return formatClock(cardOrTime);
}

function formatClock(time) {
  if (!time) return "";
  const dt = new Date(`1970-01-01T${time}:00`);
  return dt
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s/g, "")
    .toLowerCase();
}

function timeSortKey(card) {
  const time = typeof card === "string" ? card : card?.time;
  if (!time || typeof time !== "string") return card?.date_only ? 0 : 9999;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return 9999;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Build itinerary days (planning week from meeting date, empty days omitted) + recurring + unscheduled.
 * Dated items stay visible even without a clock time.
 * @param {object[]} cards
 * @param {string} meetingDate
 */
export function buildItinerary(cards, meetingDate) {
  const week = getPlanningWeekDates(meetingDate);
  const inWeek = new Set(week);
  const list = cards || [];
  const dated = list.filter((c) => c?.date);
  const unscheduled = list.filter((c) => !c?.date);

  const byDate = Object.fromEntries(week.map((iso) => [iso, []]));
  const recurring = [];

  for (const card of dated) {
    if (card.recurring) {
      recurring.push(card);
    }
    if (inWeek.has(card.date)) {
      byDate[card.date].push(card);
    }
  }

  for (const iso of week) {
    byDate[iso].sort((a, b) => timeSortKey(a) - timeSortKey(b));
  }
  recurring.sort((a, b) => timeSortKey(a) - timeSortKey(b));

  const days = week
    .filter((iso) => byDate[iso].length > 0)
    .map((iso) => ({
      date: iso,
      header: formatItineraryDayHeader(iso),
      items: byDate[iso],
    }));

  return { weekRange: formatItineraryWeekRange(meetingDate), days, recurring, unscheduled };
}

/**
 * Plain-text itinerary for clipboard.
 * @param {object[]} cards
 * @param {string} meetingDate
 */
export function buildItineraryText(cards, meetingDate) {
  const { weekRange, days, recurring, unscheduled } = buildItinerary(cards, meetingDate);
  const lines = [`FamilyPause - Week of ${weekRange}`, ""];

  for (const day of days) {
    lines.push(day.header);
    for (const it of day.items) {
      const who = it.person ? `  (${it.person})` : "";
      lines.push(`${formatItineraryTime(it)}  ${calendarTitle(it)}${who}`);
    }
    lines.push("");
  }

  if (recurring.length) {
    lines.push("RECURRING");
    for (const it of recurring) {
      const who = it.person ? `  (${it.person})` : "";
      lines.push(`Weekly · ${formatItineraryTime(it)}  ${calendarTitle(it)}${who}`);
    }
    lines.push("");
  }

  if (unscheduled.length) {
    lines.push("UNSCHEDULED");
    for (const it of unscheduled) {
      const who = it.person ? `  (${it.person})` : "";
      lines.push(`${calendarTitle(it)}${who}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
