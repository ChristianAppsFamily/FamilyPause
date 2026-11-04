/** Home hub week board helpers — Sunday-start weeks from workspace sessions. */

import {
  addDaysYmd,
  formatTimeLabel,
  parseYmd,
  todayYmd,
  ymdFromDate,
} from "./timesPresets.js";

export const HOME_DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KEPT = new Set(["kept", "calendared"]);

export function sundayOfWeekContaining(ymd, now = new Date()) {
  const d = parseYmd(ymd) || new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return ymdFromDate(d);
}

/** Week offset relative to the Sunday of the current calendar week. */
export function weekStartForOffset(offset = 0, now = new Date()) {
  const sun = sundayOfWeekContaining(todayYmd(now), now);
  return addDaysYmd(sun, offset * 7);
}

export function buildHomeWeekDays(weekStartYmd) {
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = addDaysYmd(weekStartYmd, i);
    const d = parseYmd(ymd);
    return {
      index: i,
      ymd,
      short: HOME_DAY_SHORT[i],
      n: d ? d.getDate() : i + 1,
    };
  });
}

export function formatWeekRange(weekStartYmd) {
  const end = addDaysYmd(weekStartYmd, 6);
  const a = parseYmd(weekStartYmd);
  const b = parseYmd(end);
  if (!a || !b) return "";
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const right = b.toLocaleDateString(
    "en-US",
    sameMonth ? { day: "numeric" } : { month: "long", day: "numeric" },
  );
  return `${left} – ${right}`;
}

export function whoKeyFromRole(role) {
  if (role === "person1") return "p1";
  if (role === "person2") return "p2";
  return "both";
}

export function homeTypeKey(type) {
  if (type === "action") return "todo";
  if (type === "time_together") return "event";
  if (type === "decision") return "decision";
  if (type === "note") return "note";
  if (type === "event") return "event";
  return "todo";
}

export function homeTypeMeta(typeKey) {
  if (typeKey === "event") return { label: "Event" };
  if (typeKey === "decision") return { label: "Decision" };
  if (typeKey === "note") return { label: "Note" };
  return { label: "To-do" };
}

/** Flatten kept/calendared dated cards from sessions into home board items. */
export function mapSessionCardsToHomeItems(sessions, roleOf) {
  const items = [];
  for (const session of sessions || []) {
    for (const card of session.cards || []) {
      if (!KEPT.has(card.status)) continue;
      if (!card.date || !/^\d{4}-\d{2}-\d{2}$/.test(card.date)) continue;
      if (card.date_precision === "month") continue;
      const role = roleOf?.(card.person) || "both";
      const typeKey = homeTypeKey(card.type);
      const remChoice = card.calendar_reminder;
      const rem = !!(remChoice && remChoice !== "none") || !!card.reminder_scheduled;
      items.push({
        id: `${session.id}:${card.id}`,
        cardId: card.id,
        sessionId: session.id,
        meetingDate: session.meeting_date,
        title: (card.task || "").trim() || "Untitled",
        type: typeKey,
        rawType: card.type || "action",
        date: card.date,
        time: card.time || null,
        timeLabel: card.time ? formatTimeLabel(card.time) : null,
        who: whoKeyFromRole(role),
        person: card.person || "",
        cat: card.category || "",
        done: !!card.done,
        rem,
        remChoice: remChoice || null,
        card,
      });
    }
  }
  return items;
}

export function itemsForWeek(items, weekDays) {
  const idx = Object.fromEntries(weekDays.map((d) => [d.ymd, d.index]));
  return (items || [])
    .filter((x) => idx[x.date] != null)
    .map((x) => ({ ...x, day: idx[x.date] }));
}

export function filterHomeItems(items, who) {
  if (!who || who === "all") return items;
  return items.filter((x) => x.who === who || x.who === "both");
}

export function buildHistoryRows(sessions) {
  return (sessions || [])
    .filter((s) => s.status === "complete" || (Array.isArray(s.cards) && s.cards.length > 0))
    .map((s) => {
      const kept = (s.cards || []).filter((c) => KEPT.has(c.status));
      const actionable = kept.filter((c) => c.type !== "note");
      const pool = actionable.length ? actionable : kept;
      const done = pool.filter((c) => c.done).length;
      const total = pool.length;
      const d = parseYmd(s.meeting_date);
      const label = d
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : (s.meeting_date || "Session");
      const weekday = d
        ? d.toLocaleDateString("en-US", { weekday: "long" })
        : "";
      const weekStart = s.meeting_date
        ? sundayOfWeekContaining(s.meeting_date)
        : null;
      return {
        id: s.id,
        label,
        session: weekday || "FamilyPause",
        done,
        total: Math.max(total, 1),
        weekStart,
        meetingDate: s.meeting_date,
      };
    });
}

export function weekOffsetForStart(weekStartYmd, now = new Date()) {
  const current = weekStartForOffset(0, now);
  const a = parseYmd(current);
  const b = parseYmd(weekStartYmd);
  if (!a || !b) return 0;
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
}

export function coupleLabel(adults) {
  const a = (adults || []).filter(Boolean);
  if (a.length >= 2) return `${a[0]} & ${a[1]}`;
  if (a.length === 1) return a[0];
  return "Your family";
}

export function planningSinceLabel(workspace) {
  const raw = workspace?.created_at || workspace?.deck_unlocked_at;
  if (!raw) return "Planning together";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "Planning together";
  return `Planning since ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}
