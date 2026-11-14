import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css = await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("films keep chronological latest viewing ratings",()=>{
  const start=worker.indexOf("const EFFECTIVE_RATING_SQL");
  const end=worker.indexOf("function mapMovie(",start);
  const sql=worker.slice(start,end);
  assert.match(sql,/substr\(wh\.watched_at,1,10\) AS viewed_date/);
  assert.match(sql,/ORDER BY viewed_date DESC/);
  assert.match(sql,/FROM watch_history wh WHERE wh.movie_id=m.id/);
});
test("series average each season's most recent rated completed viewing",()=>{
  const sql=worker.slice(worker.indexOf("const EFFECTIVE_RATING_SQL"),worker.indexOf("function mapMovie("));
  assert.match(sql,/CASE WHEN m\.category='series' THEN/);
  assert.match(sql,/ROUND\(AVG\(latest\.rating\),2\)/);
  assert.match(sql,/PARTITION BY sv\.movie_id, sv\.season_number/);
  assert.match(sql,/latest\.movie_id=m\.id AND latest\.recency=1/);
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
test("one custom calendar picks a season date range without native date width overflow",()=>{
  assert.match(page,/function SeasonRangeCalendar/);
  assert.match(page,/className="seasonRangeTrigger"/);
  assert.match(page,/className="seasonCalendarGrid"/);
  assert.match(css,/\.seasonCalendarGrid \{ display:grid; grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(page,/CompactDateField/);
});

test("season selector and compact history use one row",()=>{
  assert.match(page,/Array.from\(\{length:30\}/);
  assert.equal((page.match(/className="watchEventRatingSelect"/g)||[]).length,2);
});
