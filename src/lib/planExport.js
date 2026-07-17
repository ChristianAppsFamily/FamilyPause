import { calendarTitle } from "./googleCalendar";
import { getPlanningWeekDates } from "./planWeek";

/** Readable "Week of Jun 14 – Jun 20, 2026" from meeting ISO date. */
export function formatWeekOfRange(meetingDate) {
  const dates = getPlanningWeekDates(meetingDate);
  const start = new Date(`${dates[0]}T12:00:00`);
  const end = new Date(`${dates[6]}T12:00:00`);
  const optsDay = { month: "short", day: "numeric" };
  const startLabel = start.toLocaleDateString("en-US", optsDay);
  const endLabel = end.toLocaleDateString("en-US", { ...optsDay, year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export function formatPlanItemWhen(card) {
  if (!card?.date) return "";
  const dt = new Date(`${card.date}T${card.time || "00:00"}:00`);
  const day = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!card.time) return day;
  const t = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t}`;
}

/**
 * @param {{ name: string, items: object[] }[]} sections
 * @param {string} meetingDate
 */
export function buildPlanMarkdown(sections, meetingDate) {
  const weekOf = formatWeekOfRange(meetingDate);
  const lines = [`# FamilyPause · Week of ${weekOf}`, ""];
  for (const sec of sections) {
    if (!sec.items?.length) continue;
    lines.push(`## ${String(sec.name).toUpperCase()}`, "");
    for (const it of sec.items) {
      const task = calendarTitle(it);
      const when = formatPlanItemWhen(it);
      lines.push(when ? `- ${task} — ${when}` : `- ${task}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
