import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeReminderSends,
  localToUtc,
  coercePlanReminderChoice,
  defaultReminderForType,
} from "./remindAt.js";

describe("localToUtc", () => {
  it("maps Pacific standard time wall clock to UTC", () => {
    // 2026-01-15 08:00 America/Los_Angeles = UTC-8 → 16:00Z
    const d = localToUtc("2026-01-15", "08:00", "America/Los_Angeles");
    assert.equal(d.toISOString(), "2026-01-15T16:00:00.000Z");
  });

  it("maps Pacific daylight time wall clock to UTC", () => {
    // 2026-07-15 08:00 America/Los_Angeles = UTC-7 → 15:00Z
    const d = localToUtc("2026-07-15", "08:00", "America/Los_Angeles");
    assert.equal(d.toISOString(), "2026-07-15T15:00:00.000Z");
  });

  it("maps New York daylight time correctly", () => {
    // 2026-07-15 08:00 America/New_York = UTC-4 → 12:00Z
    const d = localToUtc("2026-07-15", "08:00", "America/New_York");
    assert.equal(d.toISOString(), "2026-07-15T12:00:00.000Z");
  });
});

describe("computeReminderSends", () => {
  it("day_before for timed event uses same local clock previous day", () => {
    const rows = computeReminderSends({
      event_date: "2026-03-20",
      event_time: "15:00",
      reminder_choice: "day_before",
      type: "event",
      timeZone: "America/Los_Angeles",
    });
    assert.equal(rows.length, 1);
    // 2026-03-19 15:00 PDT (DST starts March 8 2026) → UTC-7 → 22:00Z
    assert.equal(rows[0].sendAt.toISOString(), "2026-03-19T22:00:00.000Z");
  });

  it("day_before for all-day uses 08:00 previous day", () => {
    const rows = computeReminderSends({
      event_date: "2026-03-20",
      date_only: true,
      reminder_choice: "day_before",
      type: "event",
      timeZone: "America/Los_Angeles",
    });
    assert.equal(rows[0].sendAt.toISOString(), "2026-03-19T15:00:00.000Z");
  });

  it("morning_of is 08:00 local on event day", () => {
    const rows = computeReminderSends({
      event_date: "2026-01-10",
      event_time: "17:00",
      reminder_choice: "morning_of",
      type: "action",
      timeZone: "America/New_York",
    });
    // EST UTC-5 → 13:00Z
    assert.equal(rows[0].sendAt.toISOString(), "2026-01-10T13:00:00.000Z");
  });

  it("1_hour subtracts one hour from start", () => {
    const rows = computeReminderSends({
      event_date: "2026-06-01",
      event_time: "10:00",
      reminder_choice: "1_hour",
      type: "event",
      timeZone: "America/Los_Angeles",
    });
    assert.equal(rows[0].sendAt.toISOString(), "2026-06-01T16:00:00.000Z"); // 9am PDT = 16Z
  });

  it("time_together adds day-of checkin at 9am", () => {
    const rows = computeReminderSends({
      event_date: "2026-06-05",
      event_time: "19:00",
      reminder_choice: "day_before",
      type: "time_together",
      timeZone: "America/Los_Angeles",
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].kind, "reminder");
    assert.equal(rows[1].kind, "checkin");
    assert.equal(rows[1].sendAt.toISOString(), "2026-06-05T16:00:00.000Z"); // 9am PDT
  });

  it("none returns empty", () => {
    assert.deepEqual(computeReminderSends({
      event_date: "2026-06-05",
      reminder_choice: "none",
      type: "decision",
    }), []);
  });
});

describe("defaults", () => {
  it("maps types to defaults", () => {
    assert.equal(defaultReminderForType("event"), "day_before");
    assert.equal(defaultReminderForType("action"), "morning_of");
    assert.equal(defaultReminderForType("decision"), "none");
    assert.equal(defaultReminderForType("time_together"), "day_before");
  });

  it("coerces legacy minute offsets", () => {
    assert.equal(coercePlanReminderChoice({ calendar_reminder: "60", type: "event" }), "1_hour");
    assert.equal(coercePlanReminderChoice({ calendar_reminder: "1440", type: "event" }), "day_before");
    assert.equal(coercePlanReminderChoice({ type: "note" }), "none");
  });
});
