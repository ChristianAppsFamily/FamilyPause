import { getPlanningWeekDates } from "./planWeek.js";

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function timeSortKey(card) {
  if (card?.date_only || !card?.time) return card?.date_only ? 0 : 9999;
  const [h, m] = String(card.time).split(":").map(Number);
  if (!Number.isFinite(h)) return 9999;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function sortCards(a, b) {
  return String(a.date || "").localeCompare(String(b.date || "")) || timeSortKey(a) - timeSortKey(b);
}

/** @param {string} iso YYYY-MM-DD → "Tuesday, Nov 3" */
export function formatReviewDayHeader(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/** @param {string} iso */
export function monthNameFromYmd(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Later";
  return MONTH_LONG[d.getMonth()];
}

/**
 * Split cards into Time Together + chronological review groups.
 * @param {object[]} cards
 * @param {string} meetingDate
 * @returns {{ timeTogether: object[], groups: Array<{ key: string, label: string, items: object[] }> }}
 */
export function buildReviewGroups(cards, meetingDate) {
  const list = Array.isArray(cards) ? cards : [];
  const week = meetingDate ? getPlanningWeekDates(meetingDate) : [];
  const weekSet = new Set(week);
  const weekEnd = week[6] || null;
  const meetingMonth = meetingDate ? meetingDate.slice(0, 7) : null;

  const timeTogether = [];
  const byWeekDay = Object.fromEntries(week.map((iso) => [iso, []]));
  const laterThisMonth = [];
  /** @type {Record<string, object[]>} */
  const byMonth = {};
  const noDate = [];

  for (const card of list) {
    if (card?.type === "time_together") {
      timeTogether.push(card);
      continue;
    }
    if (!card?.date) {
      noDate.push(card);
      continue;
    }
    if (card.date_precision === "month") {
      const label = monthNameFromYmd(card.date);
      (byMonth[label] ||= []).push(card);
      continue;
    }
    if (weekSet.has(card.date)) {
      byWeekDay[card.date].push(card);
      continue;
    }
    const cardMonth = String(card.date).slice(0, 7);
    if (meetingMonth && weekEnd && cardMonth === meetingMonth && card.date > weekEnd) {
      laterThisMonth.push(card);
      continue;
    }
    const label = monthNameFromYmd(card.date);
    (byMonth[label] ||= []).push(card);
  }

  for (const iso of week) byWeekDay[iso].sort((a, b) => timeSortKey(a) - timeSortKey(b));
  timeTogether.sort((a, b) => timeSortKey(a) - timeSortKey(b));
  laterThisMonth.sort(sortCards);
  noDate.sort((a, b) => String(a.task || "").localeCompare(String(b.task || "")));

  /** @type {Array<{ key: string, label: string, items: object[] }>} */
  const groups = [];
  for (const iso of week) {
    if (byWeekDay[iso].length) {
      groups.push({ key: iso, label: formatReviewDayHeader(iso), items: byWeekDay[iso] });
    }
  }
  if (laterThisMonth.length) {
    groups.push({ key: "later-month", label: "Later this month", items: laterThisMonth });
  }

  const monthEntries = Object.entries(byMonth).sort(([, a], [, b]) => {
    const da = a[0]?.date || "";
    const db = b[0]?.date || "";
    return String(da).localeCompare(String(db));
  });
  for (const [label, items] of monthEntries) {
    items.sort(sortCards);
    groups.push({ key: `month-${label}`, label, items });
  }
  if (noDate.length) {
    groups.push({ key: "no-date", label: "No date", items: noDate });
  }

  return { timeTogether, groups };
}

export const REVIEW_TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "event", label: "Appointments" },
  { key: "action", label: "To-dos" },
  { key: "decision", label: "Decisions" },
  { key: "note", label: "Notes" },
  { key: "time_together", label: "Time Together" },
];
