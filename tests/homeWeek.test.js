import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeWeekDays,
  filterHomeItems,
  formatWeekRange,
  itemsForWeek,
  mapSessionCardsToHomeItems,
  sundayOfWeekContaining,
  weekStartForOffset,
  whoKeyFromRole,
} from "../src/lib/homeWeek.js";

test("sundayOfWeekContaining anchors to Sunday", () => {
  assert.equal(sundayOfWeekContaining("2026-11-04"), "2026-11-01");
  assert.equal(sundayOfWeekContaining("2026-11-01"), "2026-11-01");
});

test("weekStartForOffset moves by 7 days", () => {
  const now = new Date(2026, 10, 4); // Wed Nov 4 2026
  assert.equal(weekStartForOffset(0, now), "2026-11-01");
  assert.equal(weekStartForOffset(-1, now), "2026-10-25");
  assert.equal(weekStartForOffset(1, now), "2026-11-08");
});

test("buildHomeWeekDays and formatWeekRange", () => {
  const days = buildHomeWeekDays("2026-11-01");
  assert.equal(days.length, 7);
  assert.equal(days[0].ymd, "2026-11-01");
  assert.equal(days[6].ymd, "2026-11-07");
  assert.equal(formatWeekRange("2026-11-01"), "November 1 – 7");
});

test("mapSessionCardsToHomeItems keeps dated kept cards only", () => {
  const sessions = [{
    id: "s1",
    meeting_date: "2026-11-02",
    cards: [
      { id: 1, status: "kept", task: "Call dentist", date: "2026-11-03", type: "action", person: "Alex", calendar_reminder: "none" },
      { id: 2, status: "discarded", task: "Skip", date: "2026-11-03", type: "action" },
      { id: 3, status: "kept", task: "Month only", date: "2026-11-01", date_precision: "month", type: "action" },
      { id: 4, status: "calendared", task: "Soccer", date: "2026-11-05", time: "16:00", type: "event", person: "both", calendar_reminder: "1_hour" },
    ],
  }];
  const roleOf = (p) => {
    const x = String(p || "").toLowerCase();
    if (x === "alex") return "person1";
    if (x === "both") return "both";
    return "both";
  };
  const items = mapSessionCardsToHomeItems(sessions, roleOf);
  assert.equal(items.length, 2);
  assert.equal(items[0].who, "p1");
  assert.equal(items[0].type, "todo");
  assert.equal(items[1].rem, true);
  assert.equal(whoKeyFromRole("person2"), "p2");
});

test("itemsForWeek + filter + missed-ready day index", () => {
  const days = buildHomeWeekDays("2026-11-01");
  const items = [
    { id: "a", date: "2026-11-03", who: "p1", done: false, type: "todo" },
    { id: "b", date: "2026-11-05", who: "p2", done: false, type: "todo" },
    { id: "c", date: "2026-11-10", who: "both", done: false, type: "todo" },
  ];
  const week = itemsForWeek(items, days);
  assert.equal(week.length, 2);
  assert.equal(week[0].day, 2);
  assert.equal(filterHomeItems(week, "p1").length, 1);
  assert.equal(filterHomeItems(week, "all").length, 2);
});
