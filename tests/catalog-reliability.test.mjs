import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");

test("repeat viewing dates return a conflict before changing history or ratings", () => {
  const start = worker.indexOf("async function addViewingEvent(");
  const end = worker.indexOf("async function deleteViewingEvent(", start);
  assert.ok(start >= 0 && end > start);
  const source = worker.slice(start, end);
  assert.match(source, /SELECT id FROM watch_history WHERE movie_id = \? AND watched_at = \?/);
  assert.match(source, /if \(existing\) return json\(\{ error: .*\}, 409\)/);
  assert.ok(source.indexOf("if (existing)") < source.indexOf("INSERT INTO watch_history"));
  assert.ok(source.indexOf("if (existing)") < source.indexOf("registerRating"));
});

test("offline catalog shows cache timestamp and deletes it on logout", () => {
  assert.match(page, /movie-catalog-cache-saved-at/);
  assert.match(page, /setCacheSavedAt\(savedAt\)/);
  assert.match(page, /setCacheSavedAt\(window\.localStorage\.getItem/);
  assert.match(page, /window\.localStorage\.removeItem\("movie-catalog-cache-saved-at"\)/);
  assert.match(page, /new Date\(cacheSavedAt\)\.toLocaleString\(t\.locale\)/);
});

test("viewing date conflicts and network failures are visible in the form", () => {
  assert.match(page, /response\.status === 409/);
  assert.match(page, /setSaveError\(error\.message \|\| t\.sync\.error\)/);
  assert.match(page, /saveError && <p className="formError" role="alert">/);
});
