import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleTemplateUrl,
  buildIcsCalendar,
  formatMonthOnly,
  isCalendarDated,
} from "./calendarLinks.js";

describe("isCalendarDated", () => {
  it("rejects month-only and missing dates", () => {
    assert.equal(isCalendarDated({ date: "2026-12-01", date_precision: "month" }), false);
    assert.equal(isCalendarDated({ date: null }), false);
    assert.equal(isCalendarDated({ date: "2026-12-05" }), true);
  });
});

describe("buildGoogleTemplateUrl", () => {
  it("builds TEMPLATE link with dates and ctz for timed events", () => {
    const url = buildGoogleTemplateUrl({
      id: 1,
      task: "Dentist",
      type: "event",
      date: "2026-11-05",
      time: "15:00",
    }, "America/Los_Angeles");
    assert.match(url, /action=TEMPLATE/);
    assert.match(url, /text=Dentist/);
    assert.match(url, /ctz=America%2FLos_Angeles/);
    assert.match(url, /20261105T150000/);
  });

  it("includes RRULE for recurring", () => {
    const url = buildGoogleTemplateUrl({
      id: 2,
      task: "Date night",
      type: "time_together",
      date: "2026-11-06",
      time: "19:00",
      recurring: true,
      byday: ["FR"],
    });
    assert.match(url, /recur=RRULE/);
    assert.match(url, /FREQ%3DWEEKLY/);
  });
});

describe("buildIcsCalendar", () => {
  it("emits VEVENT with TZID and VALARM for 1_hour", () => {
    const ics = buildIcsCalendar([{
      id: 3,
      task: "Soccer",
      type: "event",
      date: "2026-11-07",
      time: "10:00",
      calendar_reminder: "1_hour",
    }], { timeZone: "America/Los_Angeles", workspaceId: "ws" });
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261107T100000/);
    assert.match(ics, /BEGIN:VALARM/);
    assert.match(ics, /TRIGGER:-PT1H/);
  });

  it("uses VALUE=DATE for all-day", () => {
    const ics = buildIcsCalendar([{
      id: 4,
      task: "Field trip form",
      type: "action",
      date: "2026-11-08",
      date_only: true,
      calendar_reminder: "none",
    }], { workspaceId: "ws" });
    assert.match(ics, /DTSTART;VALUE=DATE:20261108/);
  });
});

describe("formatMonthOnly", () => {
  it("formats December", () => {
    assert.equal(formatMonthOnly("2026-12-01"), "December");
  });
});
