import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css = await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("current rating is selected by viewing date, not last edit",()=>{
  const start=worker.indexOf("async function refreshCurrentRating(");
  const end=worker.indexOf("async function registerRating(",start);
  const query=worker.slice(start,end);
  assert.match(query,/substr\(watched_at,1,10\) AS viewed_date/);
  assert.match(query,/finished_at AS viewed_date/);
  assert.match(query,/ORDER BY viewed_date DESC/);
  assert.doesNotMatch(query,/ORDER BY rc.id DESC/);
});
test("season viewings are listed by dates rather than season number",()=>{
  assert.match(worker,/ORDER BY COALESCE\(finished_at,started_at\) DESC, started_at DESC, id DESC/);
});
test("watch history shows date and compact editable rating in same row",()=>{
  assert.equal((page.match(/className="watchEventLine"/g)||[]).length,2);
  assert.equal((page.match(/className="watchEventRatingSelect"/g)||[]).length,2);
  assert.doesNotMatch(page,/className="watchEventRating"><Stars/);
  assert.match(css,/\.historyPanel \.watchEventLine \{ display:flex;/);
});
test("season selector and responsive date controls",()=>{
  assert.match(page,/Array.from\(\{length:30\}/);
  assert.doesNotMatch(page,/type="number" min="1" max="200"/);
  assert.match(page,/en \? "Finished" : "Закончили"/);
  assert.match(css,/\.seasonForm \{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.seasonForm :is\(select,input\).*height:46px/);
});
