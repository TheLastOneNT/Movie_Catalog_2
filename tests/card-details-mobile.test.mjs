import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
test("catalog never renders the redundant mobile rate button", () => {
  assert.doesNotMatch(page, /className="mobileRating"/);
});
test("details action is interactive and belongs only to list mode", () => {
  assert.match(page, /view === "list" && \(/);
  assert.match(page, /className="moreLink cardDetailsButton" onClick=\{\(\) => onOpen\(movie\.id\)\}/);
});
test("list details action is left aligned beneath title and rating", () => {
  assert.match(css, /\.movieCardList \.cardBottom \{ display: flex; flex-direction: column; align-items: flex-start/);
  assert.match(css, /\.movieCardList \.cardDetailsButton/);
});
