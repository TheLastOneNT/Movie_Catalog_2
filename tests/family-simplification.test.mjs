import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
const translations = await readFile(new URL("../lib/i18n.js", import.meta.url), "utf8");
test("single household preference identity", () => {
  assert.match(page, /const activeMember = 1/);
  assert.doesNotMatch(page, /className="memberSwitch"/);
  assert.doesNotMatch(page, /ProfileSettings/);
});
test("random button appears only once in catalog layout", () => {
  assert.match(page, /className="catalogRandom"/);
  assert.doesNotMatch(page, /className="randomHeader"/);
});
test("view history is date-only", () => {
  assert.match(page, /const watchViewers = \[1, 2\]/);
  assert.doesNotMatch(page, /className="watchAttendance"/);
  assert.doesNotMatch(page, /event\.viewers\.map/);
});
test("rating label is short", () => {
  assert.match(translations, /rating: "Оценка"/);
  assert.doesNotMatch(page, /общая для семьи/);
});
