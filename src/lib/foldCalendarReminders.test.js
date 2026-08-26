import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  foldCalendarReminders,
  isReminderSatellite,
  parseReminderOffset,
} from "./foldCalendarReminders.js";

describe("parseReminderOffset", () => {
  it("maps day / hour / minute phrases to preset choices", () => {
    assert.deepEqual(parseReminderOffset("Set reminder for 1 day before"), {
      calendar_reminder: "1440",
      calendar_reminder_minutes: null,
    });
    assert.deepEqual(parseReminderOffset("Set reminder for 1 hour before"), {
      calendar_reminder: "60",
      calendar_reminder_minutes: null,
    });
    assert.deepEqual(parseReminderOffset("Set reminder for 30 minutes before"), {
      calendar_reminder: "30",
      calendar_reminder_minutes: null,
    });
    assert.deepEqual(parseReminderOffset("remind me at hour 1 before"), {
      calendar_reminder: "60",
      calendar_reminder_minutes: null,
    });
  });
});

describe("foldCalendarReminders", () => {
  it("folds the production John/Jackie/Harry payload into 3 events", () => {
    const parsed = [
      {
        id: 1, category: "Health", person: "John",
        task: "John's barber appointment",
        source: "John has barber apponitment at 5pm on Monday 8/31",
        date: "2026-08-31", time: "17:00", type: "event",
      },
      {
        id: 2, category: "Health", person: "John",
        task: "Reminder: John's barber appointment tomorrow",
        source: "Set reminder for 1 day before",
        date: "2026-08-30", time: null, type: "note",
      },
      {
        id: 3, category: "Health", person: "Jackie",
        task: "Jackie's dental appointment",
        source: "Jackie has dental apponitment at 8pm on Tuesday 9/1",
        date: "2026-09-01", time: "20:00", type: "event",
      },
      {
        id: 4, category: "Health", person: "Jackie",
        task: "Reminder: Jackie's dental appointment in 1 hour",
        source: "Set reminder for 1 hour before",
        date: "2026-09-01", time: "19:00", type: "note",
      },
      {
        id: 5, category: "Health", person: "Harry",
        task: "Harry's massage appointment",
        source: "Harry has masaage apponitment at 2pm on Wednesday 9/2",
        date: "2026-09-02", time: "14:00", type: "event",
      },
      {
        id: 6, category: "Health", person: "Harry",
        task: "Reminder: Harry's massage appointment in 30 minutes",
        source: "Set reminder for 30 minutes before",
        date: "2026-09-02", time: "13:30", type: "note",
      },
    ];

    const folded = foldCalendarReminders(parsed);
    assert.equal(folded.length, 3);
    assert.deepEqual(folded.map((c) => c.task), [
      "John's barber appointment",
      "Jackie's dental appointment",
      "Harry's massage appointment",
    ]);
    assert.equal(folded.every((c) => c.type === "event"), true);
    assert.equal(folded[0].calendar_reminder, "1440");
    assert.equal(folded[1].calendar_reminder, "60");
    assert.equal(folded[2].calendar_reminder, "30");
    assert.equal(folded.some(isReminderSatellite), false);
  });

  it("keeps a real remember-to action", () => {
    const cards = [
      { id: 1, person: "Both", task: "Remember to buy milk", type: "action", source: "remember to buy milk" },
    ];
    const folded = foldCalendarReminders(cards);
    assert.equal(folded.length, 1);
    assert.equal(folded[0].task, "Remember to buy milk");
  });
});
