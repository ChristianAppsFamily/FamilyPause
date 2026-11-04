import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTimePreset,
  applyWhenPreset,
  formatChipDate,
  inferTimeChip,
  inferWhenChip,
  nextWeekMondayYmd,
  thisMonthYmd,
  thisWeekendYmd,
  todayYmd,
  tomorrowYmd,
  TIME_PERIODS,
} from "./timesPresets.js";

describe("when presets", () => {
  it("maps today / tomorrow from a fixed Monday", () => {
    const mon = new Date(2026, 10, 2, 12, 0, 0); // Mon Nov 2 2026
    assert.equal(todayYmd(mon), "2026-11-02");
    assert.equal(tomorrowYmd(mon), "2026-11-03");
    assert.equal(applyWhenPreset("today", mon).date, "2026-11-02");
    assert.equal(applyWhenPreset("tomorrow", mon).date, "2026-11-03");
  });

  it("this weekend is upcoming Saturday from a weekday", () => {
    const mon = new Date(2026, 10, 2, 12, 0, 0);
    assert.equal(thisWeekendYmd(mon), "2026-11-07");
    assert.equal(applyWhenPreset("this_weekend", mon).date, "2026-11-07");
  });

  it("this weekend keeps Saturday/Sunday as today", () => {
    assert.equal(thisWeekendYmd(new Date(2026, 10, 7, 12, 0, 0)), "2026-11-07");
    assert.equal(thisWeekendYmd(new Date(2026, 10, 8, 12, 0, 0)), "2026-11-08");
  });

  it("next week is Monday of next week", () => {
    const mon = new Date(2026, 10, 2, 12, 0, 0);
    assert.equal(nextWeekMondayYmd(mon), "2026-11-09");
    const wed = new Date(2026, 10, 4, 12, 0, 0);
    assert.equal(nextWeekMondayYmd(wed), "2026-11-09");
  });

  it("this month sets first of month with month precision", () => {
    const mon = new Date(2026, 10, 2, 12, 0, 0);
    const patch = applyWhenPreset("this_month", mon);
    assert.equal(thisMonthYmd(mon), "2026-11-01");
    assert.equal(patch.date, "2026-11-01");
    assert.equal(patch.date_precision, "month");
    assert.equal(patch.date_only, true);
  });

  it("no date clears the schedule", () => {
    const patch = applyWhenPreset("no_date");
    assert.equal(patch.date, null);
    assert.equal(patch.clear, true);
  });
});

describe("time presets", () => {
  it("maps morning afternoon evening all day exact", () => {
    assert.deepEqual(applyTimePreset("morning"), {
      time: TIME_PERIODS.morning,
      date_only: false,
      time_period: "morning",
    });
    assert.equal(applyTimePreset("afternoon").time, "14:00");
    assert.equal(applyTimePreset("evening").time, "19:00");
    assert.deepEqual(applyTimePreset("all_day"), {
      time: null,
      date_only: true,
      time_period: null,
    });
    assert.equal(applyTimePreset("exact", "15:30").time, "15:30");
  });
});

describe("infer chips", () => {
  it("infers when chip from draft date", () => {
    const mon = new Date(2026, 10, 2, 12, 0, 0);
    assert.equal(inferWhenChip({ date: "2026-11-02" }, mon), "today");
    assert.equal(inferWhenChip({ date: "2026-11-03" }, mon), "tomorrow");
    assert.equal(inferWhenChip({ date: null }, mon), "no_date");
    assert.equal(inferWhenChip({ date: "2026-11-01", date_precision: "month" }, mon), "this_month");
    assert.equal(inferWhenChip({ date: "2026-11-14" }, mon), "pick_date");
  });

  it("infers time chip from period or clock", () => {
    assert.equal(inferTimeChip({ date_only: true }), "all_day");
    assert.equal(inferTimeChip({ time: "09:00" }), "morning");
    assert.equal(inferTimeChip({ time: "15:30" }), "exact");
  });
});

describe("formatChipDate", () => {
  it("formats weekday short + month day", () => {
    assert.equal(formatChipDate("2026-11-05"), "Thu, Nov 5");
  });
});
