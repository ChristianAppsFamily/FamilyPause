import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCaptureText,
  countWords,
  formatCaptureTimer,
  highlightPhrases,
} from "./captureHeuristics.js";

describe("countWords", () => {
  it("counts whitespace-separated tokens", () => {
    assert.equal(countWords("one two three"), 3);
    assert.equal(countWords("  "), 0);
  });
});

describe("analyzeCaptureText", () => {
  it("detects appointments, todos, and time together", () => {
    const text = [
      "Jude has the dentist Thursday at 3:30.",
      "We need to pay the water bill.",
      "Date night Friday at Luigi's.",
      "Should we do Christmas in Jersey?",
    ].join("\n");
    const { counts, topics } = analyzeCaptureText(text);
    assert.ok(counts.appt >= 1);
    assert.ok(counts.todo >= 1);
    assert.ok(counts.tt >= 1);
    assert.ok(counts.dec >= 1);
    assert.ok(topics.includes("Kids") || topics.includes("Finances"));
    assert.ok(topics.includes("Time Together"));
  });
});

describe("highlightPhrases", () => {
  it("marks todo-like phrases", () => {
    const segs = highlightPhrases("Please pay the water bill before Friday.");
    assert.ok(segs.some((s) => s.type === "todo"));
  });

  it("returns plain text when nothing matches", () => {
    const segs = highlightPhrases("Hello there.");
    assert.equal(segs.length, 1);
    assert.equal(segs[0].type, null);
  });
});

describe("formatCaptureTimer", () => {
  it("pads seconds", () => {
    assert.equal(formatCaptureTimer(252), "4:12");
    assert.equal(formatCaptureTimer(5), "0:05");
  });
});
