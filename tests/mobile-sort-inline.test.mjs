import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("iPhone toolbar puts view toggle, direction and count in the same row",()=>{
  assert.match(css,/\.toolbar \{ grid-template-columns:auto auto minmax\(0,1fr\)/);
  assert.match(css,/\.toolbar \.viewSwitch \{ grid-column:1;/);
  assert.match(css,/\.toolbar \.sortDirectionToggle \{\s*grid-column:2;/);
  assert.match(css,/\.toolbar \.resultCount \{ grid-column:3;/);
  assert.match(css,/\.toolbar \.viewSwitch, \.toolbar \.sortDirectionToggle, \.toolbar \.resultCount \{ grid-row:5; \}/);
});
test("direction toggle remains compact and matches neighboring controls",()=>{
  assert.match(css,/width:43px; min-width:43px; height:43px; min-height:43px;/);
  assert.match(css,/background:#101013; border:1px solid var\(--line\);/);
});
