import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewGroups,
  formatReviewDayHeader,
  monthNameFromYmd,
} from "./reviewGroups.js";

describe("formatReviewDayHeader", () => {
  it("formats weekday long + short month + day", () => {
    assert.equal(formatReviewDayHeader("2026-11-03"), "Tuesday, Nov 3");
  });
});

describe("monthNameFromYmd", () => {
  it("returns long month name", () => {
    assert.equal(monthNameFromYmd("2026-12-01"), "December");
  });
});

describe("buildReviewGroups", () => {
  const meeting = "2026-11-02"; // Mon → week through Sun Nov 8

  it("puts time_together in its own bucket", () => {
    const { timeTogether, groups } = buildReviewGroups([
      { id: "1", type: "time_together", task: "Walk", date: "2026-11-05", time: "19:30" },
      { id: "2", type: "action", task: "Bill", date: "2026-11-03", time: null, date_only: true },
    ], meeting);
    assert.equal(timeTogether.length, 1);
    assert.equal(timeTogether[0].id, "1");
    assert.ok(groups.some((g) => g.items.some((i) => i.id === "2")));
    assert.ok(!groups.some((g) => g.items.some((i) => i.id === "1")));
  });

  it("groups weekdays in meeting week", () => {
    const { groups } = buildReviewGroups([
      { id: "a", type: "event", date: "2026-11-03", time: "15:30" },
      { id: "b", type: "action", date: "2026-11-07", date_only: true },
    ], meeting);
    assert.equal(groups[0].key, "2026-11-03");
    assert.match(groups[0].label, /Tuesday/);
    assert.equal(groups[1].key, "2026-11-07");
  });

  it("buckets later this month after the planning week", () => {
    const { groups } = buildReviewGroups([
      { id: "w", type: "action", date: "2026-11-14", date_only: true },
    ], meeting);
    const later = groups.find((g) => g.key === "later-month");
    assert.ok(later);
    assert.equal(later.label, "Later this month");
    assert.equal(later.items[0].id, "w");
  });

  it("buckets month-precision and other months by month name", () => {
    const { groups } = buildReviewGroups([
      { id: "x", type: "decision", date: "2026-12-01", date_precision: "month", date_only: true },
    ], meeting);
    const dec = groups.find((g) => g.label === "December");
    assert.ok(dec);
    assert.equal(dec.items[0].id, "x");
  });

  it("buckets undated into No date", () => {
    const { groups } = buildReviewGroups([
      { id: "n", type: "note", task: "Kitchen" },
    ], meeting);
    const none = groups.find((g) => g.key === "no-date");
    assert.ok(none);
    assert.equal(none.items[0].id, "n");
  });
});
