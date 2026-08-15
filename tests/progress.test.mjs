import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProgressPatch, ValidationError } from "../worker/progress.js";

const fixedNow = new Date("2026-08-15T12:00:00.000Z");

test("marks a movie as watched and assigns the current time", () => {
  const result = normalizeProgressPatch({ status: "watched" }, {}, fixedNow);
  assert.equal(result.value.status, "watched");
  assert.equal(result.value.lastWatchedAt, fixedNow.toISOString());
  assert.equal(result.addHistory, true);
});

test("accepts a date-only viewing date", () => {
  const result = normalizeProgressPatch({ lastWatchedAt: "2026-08-01" }, {}, fixedNow);
  assert.equal(result.value.status, "watched");
  assert.equal(result.value.lastWatchedAt, "2026-08-01T12:00:00.000Z");
});

test("clears viewing history when a movie becomes unwatched", () => {
  const result = normalizeProgressPatch(
    { status: "unwatched" },
    { status: "watched", lastWatchedAt: "2026-08-01T12:00:00.000Z" },
    fixedNow,
  );
  assert.equal(result.value.lastWatchedAt, null);
  assert.equal(result.clearHistory, true);
});

test("rejects ratings outside the supported range", () => {
  assert.throws(() => normalizeProgressPatch({ rating: 6 }, {}, fixedNow), ValidationError);
});

test("rejects legacy viewing statuses", () => {
  assert.throws(() => normalizeProgressPatch({ status: "planned" }, {}, fixedNow), ValidationError);
});

test("rejects oversized notes", () => {
  assert.throws(() => normalizeProgressPatch({ notes: "x".repeat(5001) }, {}, fixedNow), ValidationError);
});
