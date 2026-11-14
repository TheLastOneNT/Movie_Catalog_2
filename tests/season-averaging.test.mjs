import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const w=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const p=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
test("series average is displayed as fractional score, not editable whole stars",()=>{
  assert.match(w,/ROUND\(AVG\(latest.rating\),1\)/);
  assert.match(p,/className="seriesAverageRating"/);
  assert.match(p,/maximumFractionDigits:1/);
});
