import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calendarSyncOutcome } from "./calendarSyncState.js";

const baseCard = (overrides = {}) => ({
  id: 1,
  status: "kept",
  type: "event",
  date: "2026-08-31",
  time: "10:00",
  ...overrides,
});

describe("calendarSyncOutcome", () => {
  it("returns idle when no eligible kept items", () => {
    const out = calendarSyncOutcome([{ id: 1, status: "discarded" }], { meetingDate: "2026-08-30" });
    assert.equal(out.state, "idle");
    assert.equal(out.eligible, 0);
  });

  it("returns pending when eligible items were never synced", () => {
    const out = calendarSyncOutcome([baseCard()], {
      meetingDate: "2026-08-30",
      requireResolved: true,
    });
    assert.equal(out.state, "pending");
    assert.equal(out.pending, 1);
    assert.equal(out.synced, 0);
    assert.equal(out.failed, 0);
  });

  it("returns succeeded when all eligible items synced", () => {
    const out = calendarSyncOutcome([
      baseCard({ id: 1, calendar_synced: true }),
      baseCard({ id: 2, calendar_synced: true }),
    ], { meetingDate: "2026-08-30", requireResolved: true });
    assert.equal(out.state, "succeeded");
    assert.equal(out.synced, 2);
  });

  it("returns partial when some synced and some failed", () => {
    const out = calendarSyncOutcome([
      baseCard({ id: 1, calendar_synced: true }),
      baseCard({ id: 2, calendar_sync_failed: true }),
    ], { meetingDate: "2026-08-30", requireResolved: true });
    assert.equal(out.state, "partial");
    assert.equal(out.synced, 1);
    assert.equal(out.failed, 1);
  });

  it("returns failed when all eligible items failed", () => {
    const out = calendarSyncOutcome([
      baseCard({ id: 1, calendar_sync_failed: true }),
      baseCard({ id: 2, calendar_sync_failed: true }),
    ], { meetingDate: "2026-08-30", requireResolved: true });
    assert.equal(out.state, "failed");
    assert.equal(out.synced, 0);
    assert.equal(out.failed, 2);
  });

  it("returns syncing while a sync is in flight", () => {
    const out = calendarSyncOutcome([baseCard()], {
      meetingDate: "2026-08-30",
      requireResolved: true,
      syncing: true,
    });
    assert.equal(out.state, "syncing");
  });

  it("excludes unresolved schedule when requireResolved is true", () => {
    const out = calendarSyncOutcome([
      baseCard({ time: null, date_only: false }),
    ], { meetingDate: "2026-08-30", requireResolved: true });
    assert.equal(out.state, "idle");
    assert.equal(out.eligible, 0);
  });
});
