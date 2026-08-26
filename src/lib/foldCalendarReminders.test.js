import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  foldCalendarReminders,
  isReminderSatellite,
  stripReminderSatellites,
} from "./foldCalendarReminders.js";

describe("stripReminderSatellites", () => {
  it("drops Reminder satellites and leaves Reminder fields unset", () => {
    const parsed = [
      {
        id: 1, category: "Health", person: "John",
        task: "John's massage appointment",
        source: "John has a massage appointment at 4pm on Monday 8/31",
        date: "2026-08-31", time: "16:00", type: "event",
        calendar_reminder: "60",
      },
      {
        id: 2, category: "Health", person: "John",
        task: "Reminder: John's massage appointment in 1 hour",
        source: "set reminder for 1 hour before",
        date: "2026-08-31", time: "15:00", type: "action",
      },
      {
        id: 3, category: "Health", person: "Jackie",
        task: "Jackie's hair appointment",
        source: "jackie has a hair appointment at 3pm on Tuesday 9/1",
        date: "2026-09-01", time: "15:00", type: "event",
      },
      {
        id: 4, category: "Health", person: "Jackie",
        task: "Reminder: Jackie's hair appointment tomorrow",
        source: "set reminder for 1 day before",
        date: "2026-08-31", time: null, type: "action",
      },
      {
        id: 5, category: "Health", person: "Jacob",
        task: "Jacob's dental appointment",
        source: "Jacob has a dental appointment at 2pm on wednesday 9/2",
        date: "2026-09-02", time: "14:00", type: "event",
      },
      {
        id: 6, category: "Health", person: "Jacob",
        task: "Reminder: Jacob's dental appointment in 15 minutes",
        source: "set reminder for 15 min before",
        date: "2026-09-02", time: "13:45", type: "action",
      },
      {
        id: 7, category: "Health", person: "Amanda",
        task: "Amanda's nail appointment",
        source: "Amanda has a nail appointment at 11am on Saturday 9/5",
        date: "2026-09-05", time: "11:00", type: "event",
      },
      {
        id: 8, category: "Health", person: "Amanda",
        task: "Reminder: Amanda's nail appointment next week",
        source: "set reminder for 1 week before",
        date: "2026-08-29", time: null, type: "action",
      },
    ];

    const stripped = stripReminderSatellites(parsed);
    assert.equal(stripped.length, 4);
    assert.deepEqual(stripped.map((c) => c.task), [
      "John's massage appointment",
      "Jackie's hair appointment",
      "Jacob's dental appointment",
      "Amanda's nail appointment",
    ]);
    assert.equal(stripped.every((c) => c.type === "event"), true);
    assert.equal(stripped.every((c) => c.calendar_reminder == null), true);
    assert.equal(stripped.every((c) => c.calendar_reminder_minutes == null), true);
    assert.equal(stripped.some(isReminderSatellite), false);
  });

  it("keeps a real remember-to action", () => {
    const cards = [
      { id: 1, person: "Both", task: "Remember to buy milk", type: "action", source: "remember to buy milk" },
    ];
    const stripped = stripReminderSatellites(cards);
    assert.equal(stripped.length, 1);
    assert.equal(stripped[0].task, "Remember to buy milk");
  });

  it("foldCalendarReminders alias strips without attaching", () => {
    const cards = [
      { id: 1, person: "John", task: "John's barber", type: "event", source: "barber at 5pm" },
      {
        id: 2, person: "John", task: "Reminder: John's barber", type: "note",
        source: "Set reminder for 1 day before",
      },
    ];
    const out = foldCalendarReminders(cards);
    assert.equal(out.length, 1);
    assert.equal(out[0].calendar_reminder, undefined);
  });
});
